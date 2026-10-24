// Collects what I play on Steam and listen to on Last.fm, for the homepage and the charts on
// /stats/. Run every ten minutes by .github/workflows/steam.yml, which publishes the two files
// it writes to the `live` branch:
//
//   steam.json    what I'm playing now and lately (the homepage's Games row)
//   history.json  a running record, added to on every run (the charts)
//
// Usage: node scripts/live-feed.mjs <previous history.json> <output folder>
// Needs STEAM_KEY and STEAM_ID in the environment. The Last.fm username and API key are read
// from content/site.yml, where they already are for the homepage.
import fs from 'node:fs';
import path from 'node:path';
import { load } from '../lib/vendor/js-yaml.mjs';

const [, , prevPath, outDir] = process.argv;
const site = load(fs.readFileSync(new URL('../content/site.yml', import.meta.url), 'utf8')) || {};
const TZ = String(site.timezone || 'Australia/Melbourne');
const LFM_USER = String(site.lastfm_user || '').trim();
const LFM_KEY = String(site.lastfm_key || '').trim();
const STEAM_KEY = process.env.STEAM_KEY;
const STEAM_ID = process.env.STEAM_ID;

const now = Date.now();
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const getJson = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} from ${new URL(url).host}`);
  return res.json();
};

// The date, weekday (0 = Monday) and hour of a moment, in my time zone.
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
const DOW = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
function when(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, dow: DOW[p.weekday], hour: Number(p.hour) % 24 };
}
const grid = () => Array.from({ length: 7 }, () => new Array(24).fill(0));
const bump = (obj, key, n = 1) => (obj[key] = (obj[key] || 0) + n);

// ---------- The history so far ----------
let H = {};
try {
  H = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
} catch (e) {}
H.v = 1;
H.since = H.since || new Date(now).toISOString();
H.tz = TZ;
H.steam = { totals: {}, names: {}, days: {}, grid: grid(), owned: [], playing: null, ...(H.steam || {}) };
H.music = { lastUts: 0, days: {}, grid: grid(), artistDays: {}, whilePlaying: {}, ...(H.music || {}) };
const lastRun = H.lastRun ? Date.parse(H.lastRun) : 0;
// Minutes since the last run, so a late run still counts the right amount of play.
const gap = lastRun ? Math.min(30, Math.max(1, (now - lastRun) / 60000)) : 10;
const today = when(now);

// ---------- Steam ----------
let steamNow = null;
if (STEAM_KEY && STEAM_ID) {
  const api = 'https://api.steampowered.com';
  const q = `key=${encodeURIComponent(STEAM_KEY)}`;
  const id = encodeURIComponent(STEAM_ID);
  const art = (appid) => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
  const [summary, recent, owned] = await Promise.all([
    getJson(`${api}/ISteamUser/GetPlayerSummaries/v2/?${q}&steamids=${id}`),
    getJson(`${api}/IPlayerService/GetRecentlyPlayedGames/v1/?${q}&steamid=${id}&count=8`),
    getJson(`${api}/IPlayerService/GetOwnedGames/v1/?${q}&steamid=${id}&include_appinfo=1&include_played_free_games=1`).catch(() => null),
  ]);
  const player = list(summary?.response?.players)[0] || {};
  const ownedGames = list(owned?.response?.games);
  const last = new Map(ownedGames.map((g) => [g.appid, g.rtime_last_played || 0]));
  const games = list(recent?.response?.games)
    .map((g) => ({ appid: g.appid, name: g.name, minutes2w: g.playtime_2weeks || 0, minutesTotal: g.playtime_forever || 0, lastPlayed: last.get(g.appid) || null, art: art(g.appid) }))
    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0) || b.minutes2w - a.minutes2w);
  const appid = Number(player.gameid) || null;
  steamNow = {
    online: (player.personastate || 0) > 0,
    playing: player.gameextrainfo ? { appid, name: player.gameextrainfo, art: appid ? art(appid) : null } : null,
    games,
  };

  // Playtime per day: Steam only gives running totals, so each run adds what went up since the last.
  const S = H.steam;
  const firstTime = !Object.keys(S.totals).length;
  const all = ownedGames.length ? ownedGames : list(recent?.response?.games);
  for (const g of all) {
    const total = g.playtime_forever || 0;
    const before = S.totals[g.appid];
    if (!firstTime && before != null && total > before) {
      S.days[today.date] = S.days[today.date] || {};
      bump(S.days[today.date], g.appid, total - before);
      if (g.name) S.names[g.appid] = g.name;
    }
    S.totals[g.appid] = total;
  }
  for (const g of games) S.names[g.appid] = g.name;
  if (steamNow.playing && steamNow.playing.appid) S.names[steamNow.playing.appid] = steamNow.playing.name;
  // When I play: minutes in each weekday and hour, from being seen in a game.
  if (steamNow.playing) S.grid[today.dow][today.hour] = Math.round((S.grid[today.dow][today.hour] + gap) * 10) / 10;
  // All-time hours, most played first.
  if (ownedGames.length)
    S.owned = ownedGames
      .filter((g) => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 12)
      .map((g) => ({ appid: g.appid, name: g.name, minutes: g.playtime_forever }));
  S.previous = S.playing;
  S.playing = steamNow.playing ? steamNow.playing.appid : null;
}

// ---------- Last.fm ----------
if (LFM_USER && LFM_KEY) {
  const M = H.music;
  const base = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${encodeURIComponent(LFM_USER)}&api_key=${encodeURIComponent(LFM_KEY)}&format=json&limit=200`;
  const scrobbles = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const d = await getJson(`${base}&page=${page}${M.lastUts ? `&from=${M.lastUts + 1}` : ''}`);
      for (const t of list(d?.recenttracks?.track)) {
        if (t['@attr']?.nowplaying === 'true' || !t.date?.uts || Number(t.date.uts) <= M.lastUts) continue;
        scrobbles.push({ uts: Number(t.date.uts), artist: t.artist?.['#text'] || t.artist?.name || '' });
      }
      if (page >= Number(d?.recenttracks?.['@attr']?.totalPages || 1)) break;
    }
  } catch (e) {
    console.error(`Last.fm: ${e.message}`);
  }
  // The game I was in around then, if any: now, or at the last run.
  const gameNow = H.steam.playing || H.steam.previous || null;
  for (const s of scrobbles) {
    const w = when(s.uts * 1000);
    bump(M.days, w.date);
    M.grid[w.dow][w.hour] += 1;
    if (s.artist) {
      M.artistDays[w.date] = M.artistDays[w.date] || {};
      bump(M.artistDays[w.date], s.artist);
      if (gameNow && lastRun && s.uts * 1000 >= lastRun - 5 * 60000) {
        M.whilePlaying[gameNow] = M.whilePlaying[gameNow] || {};
        bump(M.whilePlaying[gameNow], s.artist);
      }
    }
    M.lastUts = Math.max(M.lastUts, s.uts);
  }
}

// ---------- Keep it small ----------
const keepFrom = (days) => when(now - days * 86400000).date;
const prune = (obj, days) => {
  const from = keepFrom(days);
  for (const k of Object.keys(obj)) if (k < from) delete obj[k];
};
prune(H.steam.days, 400);
prune(H.music.days, 400);
prune(H.music.artistDays, 120);
H.lastRun = new Date(now).toISOString();

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'history.json'), JSON.stringify(H));
if (steamNow) fs.writeFileSync(path.join(outDir, 'steam.json'), JSON.stringify({ updated: new Date(now).toISOString(), steam: steamNow }, null, 1) + '\n');
console.log(`Steam ${steamNow ? (steamNow.playing ? `playing ${steamNow.playing.name}` : 'idle') : 'skipped'}; Last.fm up to ${H.music.lastUts || 'nothing yet'}.`);
