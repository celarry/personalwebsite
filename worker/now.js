// A small Cloudflare Worker that tells lawrenceqi.com what I'm playing on Steam and
// listening to on Last.fm.
//
// It keeps the API keys out of the website, caches answers for 30 seconds, and passes
// game and album art through itself, so visitors never connect to Steam or Last.fm.
//
//   GET /now                 { updated, steam, music }
//   GET /art?steam=APPID     a game's header image
//   GET /art?u=URL           album art (Last.fm images only)
//
// Settings (Workers > this worker > Settings > Variables and Secrets):
//   STEAM_KEY    secret: a Steam Web API key
//   STEAM_ID     my 64-bit Steam ID
//   LASTFM_KEY   secret: a Last.fm API key
//   LASTFM_USER  my Last.fm username
//   ALLOWED_ORIGINS  optional, comma-separated; defaults to lawrenceqi.com

const FRESH = 30; // seconds to keep the /now answer
const TAGS = 60 * 60 * 12; // genres change slowly
const ART = 60 * 60 * 24 * 7;
const TIMEOUT = 6000;
const LASTFM_BLANK = '2a96cbd8b46e442fc41c2b86b821562f'; // Last.fm's grey star placeholder

// Tags on Last.fm that aren't really genres.
const NOT_GENRES = new Set([
  'seen live', 'favorites', 'favourites', 'favorite', 'favourite', 'albums i own', 'under 2000 listeners',
  'spotify', 'love', 'loved', 'beautiful', 'awesome', 'amazing', 'cool', 'good', 'best', 'all', 'music',
  'female vocalists', 'male vocalists', 'female vocalist', 'male vocalist', 'vocalists',
  'american', 'british', 'english', 'australian', 'canadian', 'japanese', 'korean', 'chinese', 'french',
  'german', 'swedish', 'usa', 'uk', 'australia', 'japan', 'korea',
  'saxophone', 'piano', 'guitar', 'drums', 'bass', 'instrumental',
]);

const memo = new Map(); // per-isolate cache, for when the Cache API isn't available (workers.dev)

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('Origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });
    try {
      if (url.pathname === '/art') return await art(url, ctx);
      if (url.pathname === '/' || url.pathname === '/now') return await now(url, env, ctx, cors);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'upstream' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return new Response('Not found', { status: 404, headers: cors });
  },
};

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://lawrenceqi.com,https://www.lawrenceqi.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  const ok = origin && (allowed.includes(origin) || local);
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    Vary: 'Origin',
  };
}

// ---------- Caching: the Cache API where it works, memory otherwise ----------
async function cached(key, ttl, ctx, make) {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const req = new Request(`https://cache.internal/${encodeURIComponent(key)}`);
  if (cache) {
    const res = await cache.match(req);
    if (res) {
      const value = await res.json();
      memo.set(key, { value, until: Date.now() + ttl * 1000 });
      return value;
    }
  }
  const value = await make();
  memo.set(key, { value, until: Date.now() + ttl * 1000 });
  if (cache) {
    const put = cache.put(req, new Response(JSON.stringify(value), { headers: { 'Cache-Control': `max-age=${ttl}` } }));
    if (ctx && ctx.waitUntil) ctx.waitUntil(put);
    else await put;
  }
  return value;
}

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), headers: { 'User-Agent': 'lawrenceqi.com now-playing' } });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
}

const list = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// ---------- /now ----------
async function now(url, env, ctx, cors) {
  const base = url.origin;
  const data = await cached('now:v1', FRESH, ctx, async () => {
    const [steam, music] = await Promise.all([
      getSteam(env, base).catch(() => null),
      getMusic(env, base, ctx).catch(() => null),
    ]);
    return { updated: new Date().toISOString(), steam, music };
  });
  return new Response(JSON.stringify(data), {
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=20' },
  });
}

async function getSteam(env, base) {
  if (!env.STEAM_KEY || !env.STEAM_ID) return null;
  const key = encodeURIComponent(env.STEAM_KEY);
  const id = encodeURIComponent(env.STEAM_ID);
  const api = 'https://api.steampowered.com';
  const [summary, recent, owned] = await Promise.all([
    getJson(`${api}/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${id}`),
    getJson(`${api}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${id}&count=8`),
    // Only used for "last played" times; fine to do without.
    getJson(`${api}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${id}&include_appinfo=0&include_played_free_games=1`).catch(() => null),
  ]);
  const player = list(summary?.response?.players)[0] || {};
  const last = new Map(list(owned?.response?.games).map((g) => [g.appid, g.rtime_last_played || 0]));
  const games = list(recent?.response?.games)
    .map((g) => ({
      appid: g.appid,
      name: g.name,
      minutes2w: g.playtime_2weeks || 0,
      minutesTotal: g.playtime_forever || 0,
      lastPlayed: last.get(g.appid) || null,
      art: `${base}/art?steam=${g.appid}`,
    }))
    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || b.minutes2w - a.minutes2w);
  const appid = Number(player.gameid) || null;
  return {
    online: (player.personastate || 0) > 0,
    playing: player.gameextrainfo ? { appid, name: player.gameextrainfo, art: appid ? `${base}/art?steam=${appid}` : null } : null,
    games,
  };
}

async function getMusic(env, base, ctx) {
  if (!env.LASTFM_KEY || !env.LASTFM_USER) return null;
  const q = (method, extra = '') =>
    `https://ws.audioscrobbler.com/2.0/?method=${method}&user=${encodeURIComponent(env.LASTFM_USER)}&api_key=${encodeURIComponent(env.LASTFM_KEY)}&format=json${extra}`;
  const [recent, top] = await Promise.all([getJson(q('user.getrecenttracks', '&limit=6')), getJson(q('user.gettopartists', '&period=1month&limit=6'))]);
  const tracks = list(recent?.recenttracks?.track)
    .map((t) => ({
      name: t.name,
      artist: t.artist?.['#text'] || t.artist?.name || '',
      album: t.album?.['#text'] || '',
      nowPlaying: t['@attr']?.nowplaying === 'true',
      at: t.date?.uts ? Number(t.date.uts) : null,
      url: t.url || null,
      art: lastfmArt(base, t.image),
    }))
    .slice(0, 6);
  const artists = list(top?.topartists?.artist).map((a) => ({ name: a.name, plays: Number(a.playcount) || 0, url: a.url || null }));
  const genres = await topGenres(env, artists, ctx).catch(() => []);
  return { tracks, artists, genres };
}

function lastfmArt(base, images) {
  const all = list(images);
  const pick = all.find((i) => i.size === 'large') || all[all.length - 1];
  const src = pick && pick['#text'];
  if (!src || src.includes(LASTFM_BLANK)) return null;
  return `${base}/art?u=${encodeURIComponent(src)}`;
}

// Genres: each top artist's Last.fm tags, weighted by how much I've played them.
async function topGenres(env, artists, ctx) {
  const names = new Set(artists.map((a) => a.name.toLowerCase()));
  const score = new Map();
  const tagLists = await Promise.all(
    artists.slice(0, 6).map((a) =>
      cached(`tags:${a.name.toLowerCase()}`, TAGS, ctx, async () => {
        const d = await getJson(
          `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(a.name)}&api_key=${encodeURIComponent(env.LASTFM_KEY)}&format=json&autocorrect=1`
        );
        return list(d?.toptags?.tag)
          .slice(0, 6)
          .map((t) => ({ name: String(t.name || '').toLowerCase().trim(), count: Number(t.count) || 0 }));
      }).catch(() => [])
    )
  );
  tagLists.forEach((tags, k) => {
    const plays = artists[k].plays || 1;
    for (const t of tags) {
      const name = t.name.replace(/\s+/g, ' ').replace(/^hip hop$/, 'hip-hop');
      if (!name || NOT_GENRES.has(name) || names.has(name) || /^\d0s$/.test(name) || /^\d{4}$/.test(name)) continue;
      score.set(name, (score.get(name) || 0) + plays * (t.count / 100));
    }
  });
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name);
}

// ---------- /art: images, passed through and cached ----------
const ART_HOSTS = [/^lastfm\.freetls\.fastly\.net$/, /(^|\.)lastfm\.(com|net)$/, /\.steamstatic\.com$/];

async function art(url, ctx) {
  let sources = [];
  const appid = url.searchParams.get('steam');
  const u = url.searchParams.get('u');
  if (appid && /^\d{1,10}$/.test(appid)) {
    sources = [
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`,
      `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
      async () => (await getJson(`https://store.steampowered.com/api/appdetails?appids=${appid}&filters=basic`))?.[appid]?.data?.header_image,
    ];
  } else if (u) {
    let host = '';
    try {
      const parsed = new URL(u);
      if (parsed.protocol === 'https:') host = parsed.hostname;
    } catch (e) {}
    if (!ART_HOSTS.some((re) => re.test(host))) return new Response('Not allowed', { status: 400 });
    sources = [u];
  } else {
    return new Response('Missing image', { status: 400 });
  }
  for (const source of sources) {
    const src = typeof source === 'function' ? await source().catch(() => null) : source;
    if (!src) continue;
    const res = await fetch(src, { cf: { cacheTtl: ART, cacheEverything: true }, signal: AbortSignal.timeout(TIMEOUT) }).catch(() => null);
    const type = res && res.headers.get('Content-Type');
    if (res && res.ok && type && type.startsWith('image/')) {
      return new Response(res.body, {
        headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${ART}`, 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
  return new Response('No image', { status: 404 });
}
