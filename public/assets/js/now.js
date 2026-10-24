// What I'm playing on Steam and listening to on Last.fm. It fills in the live parts of
// Off the clock and checks again every minute while the page is open.
//
// Two ways to get the data, whichever the site is set up for:
//  - Without a server: music straight from Last.fm (its API key is meant for apps like this
//    and can only read public listening history), and Steam from a small file a GitHub
//    Action refreshes every ten minutes (see .github/workflows/steam.yml), so the Steam key
//    stays secret.
//  - Or my Cloudflare worker (worker/now.js), which does both.
(() => {
  const d = document.body.dataset;
  const api = d.nowApi;
  const steamFeed = d.steamFeed;
  const lfm = d.lastfmUser && d.lastfmKey ? { user: d.lastfmUser, key: d.lastfmKey } : null;
  const slots = { steam: document.querySelector('[data-live="steam"]'), music: document.querySelector('[data-live="music"]') };
  if ((!api && !steamFeed && !lfm) || (!slots.steam && !slots.music)) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const rel = new Intl.RelativeTimeFormat('en-AU', { numeric: 'auto' });
  function ago(seconds) {
    const d = Date.now() / 1000 - seconds;
    if (d < 90) return 'just now';
    if (d < 3600) return rel.format(-Math.round(d / 60), 'minute');
    if (d < 86400) return rel.format(-Math.round(d / 3600), 'hour');
    return rel.format(-Math.round(d / 86400), 'day');
  }
  function playtime(minutes) {
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const h = Math.round(minutes / 60);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const and = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
  const show = (el, html) => {
    el.innerHTML = html;
    el.hidden = !html;
    const row = el.closest('[data-live-row]');
    if (row) row.hidden = !html;
  };

  function renderSteam(s, updated) {
    if (!slots.steam) return;
    if (!s || (!s.playing && !(s.games || []).length)) return show(slots.steam, '');
    const games = (s.games || []).slice(0, 3);
    // The file from GitHub can be a little behind; only say "right now" if it's recent.
    const checked = updated ? Date.parse(updated) / 1000 : Date.now() / 1000;
    const fresh = Date.now() / 1000 - checked < 25 * 60;
    let status = '';
    if (s.playing && fresh) status = `<p class="live__status is-on"><i aria-hidden="true"></i>Playing <b>${esc(s.playing.name)}</b> right now.</p>`;
    else if (s.playing) status = `<p class="live__status">Was playing <b>${esc(s.playing.name)}</b> ${ago(checked)}.</p>`;
    else if (games[0] && games[0].lastPlayed) status = `<p class="live__status">Last played <b>${esc(games[0].name)}</b> ${ago(games[0].lastPlayed)}.</p>`;
    const list = games.length
      ? `<ul class="live__games" aria-label="Recently played on Steam">${games
          .map(
            (g) => `<li><span class="live__shot"><img src="${esc(g.art)}" alt="" width="460" height="215" loading="lazy" onerror="this.remove()"></span><span class="live__name">${esc(g.name)}</span><span class="live__meta">${g.minutes2w ? `${playtime(g.minutes2w)} this fortnight` : 'This fortnight'}</span></li>`
          )
          .join('')}</ul>`
      : '';
    show(slots.steam, status + list);
  }

  function renderMusic(m) {
    if (!slots.music) return;
    if (!m || !(m.tracks || []).length) return show(slots.music, '');
    const t = m.tracks[0];
    const when = t.nowPlaying ? '<span class="live__meta is-on"><i aria-hidden="true"></i>Playing now</span>' : t.at ? `<span class="live__meta">${ago(t.at)}</span>` : '';
    const art = t.art ? `<img src="${esc(t.art)}" alt="" width="174" height="174" loading="lazy" onerror="this.remove()">` : '';
    const title = t.url ? `<a href="${esc(t.url)}">${esc(t.name)}</a>` : esc(t.name);
    const track = `<div class="live__track"><span class="live__art">${art}</span><p><b>${title}</b><span>${esc(t.artist)}</span>${when}</p></div>`;
    const artists = (m.artists || []).slice(0, 3).map((a) => esc(a.name));
    const genres = (m.genres || []).slice(0, 3).map(esc);
    const month = artists.length ? `<p class="live__month">This month, mostly ${and(artists)}${genres.length ? `. Lots of ${and(genres)}` : ''}.</p>` : '';
    show(slots.music, track + month);
  }

  // ---------- Straight from Last.fm ----------
  const LASTFM_BLANK = '2a96cbd8b46e442fc41c2b86b821562f'; // Last.fm's grey star placeholder
  const NOT_GENRES = new Set([
    'seen live', 'favorites', 'favourites', 'favorite', 'favourite', 'albums i own', 'under 2000 listeners',
    'spotify', 'love', 'loved', 'beautiful', 'awesome', 'amazing', 'cool', 'good', 'best', 'all', 'music',
    'female vocalists', 'male vocalists', 'female vocalist', 'male vocalist', 'vocalists',
    'american', 'british', 'english', 'australian', 'canadian', 'japanese', 'korean', 'chinese', 'french',
    'german', 'swedish', 'usa', 'uk', 'australia', 'japan', 'korea',
    'saxophone', 'piano', 'guitar', 'drums', 'bass', 'instrumental',
  ]);
  const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const lastfm = async (method, extra = '') => {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=${method}&api_key=${encodeURIComponent(lfm.key)}&format=json${extra}`);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  const artOf = (images) => {
    const all = list(images);
    const pick = all.find((i) => i.size === 'large') || all[all.length - 1];
    const src = pick && pick['#text'];
    return src && !src.includes(LASTFM_BLANK) ? src.replace(/^http:/, 'https:') : null;
  };
  // An artist's tags barely change, so they're kept in this browser for a day.
  async function tagsFor(name) {
    const k = `lfm-tags:${name.toLowerCase()}`;
    try {
      const hit = JSON.parse(localStorage.getItem(k) || 'null');
      if (hit && Date.now() - hit.t < 86400000) return hit.tags;
    } catch (e) {}
    const data = await lastfm('artist.gettoptags', `&artist=${encodeURIComponent(name)}&autocorrect=1`).catch(() => null);
    const tags = list(data?.toptags?.tag).slice(0, 6).map((t) => ({ name: String(t.name || '').toLowerCase().trim(), count: Number(t.count) || 0 }));
    try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), tags })); } catch (e) {}
    return tags;
  }
  async function musicFromLastfm() {
    const u = `&user=${encodeURIComponent(lfm.user)}`;
    const [recent, top] = await Promise.all([lastfm('user.getrecenttracks', `${u}&limit=6`), lastfm('user.gettopartists', `${u}&period=1month&limit=6`)]);
    const tracks = list(recent?.recenttracks?.track).map((t) => ({
      name: t.name,
      artist: t.artist?.['#text'] || t.artist?.name || '',
      nowPlaying: t['@attr']?.nowplaying === 'true',
      at: t.date?.uts ? Number(t.date.uts) : null,
      url: t.url || null,
      art: artOf(t.image),
    }));
    const artists = list(top?.topartists?.artist).map((a) => ({ name: a.name, plays: Number(a.playcount) || 0 }));
    // Genres: each top artist's tags, weighted by how much I've played them.
    const names = new Set(artists.map((a) => a.name.toLowerCase()));
    const score = new Map();
    const tagLists = await Promise.all(artists.slice(0, 6).map((a) => tagsFor(a.name).catch(() => [])));
    tagLists.forEach((tags, k) => {
      for (const t of tags) {
        const name = t.name.replace(/\s+/g, ' ').replace(/^hip hop$/, 'hip-hop');
        if (!name || NOT_GENRES.has(name) || names.has(name) || /^\d0s$/.test(name) || /^\d{4}$/.test(name)) continue;
        score.set(name, (score.get(name) || 0) + (artists[k].plays || 1) * (t.count / 100));
      }
    });
    const genres = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n]) => n);
    return { tracks, artists, genres };
  }

  // ---------- Steam, from the file the GitHub Action keeps up to date ----------
  async function steamFromFeed() {
    const res = await fetch(steamFeed, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }

  let timer = 0;
  async function load() {
    clearTimeout(timer);
    let data = null;
    if (api) {
      try {
        const res = await fetch(`${api}/now`, { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        data = await res.json();
      } catch (e) {
        // Leave whatever was there; the text still says what I play.
      }
    } else {
      const [steam, music] = await Promise.all([
        steamFeed ? steamFromFeed().catch(() => null) : null,
        lfm ? musicFromLastfm().catch(() => null) : null,
      ]);
      if (steam || music) data = { updated: steam?.updated || null, steam: steam?.steam || null, music };
    }
    if (data) {
      window.nowData = data;
      if (data.steam || !steamFeed) renderSteam(data.steam, data.updated);
      if (data.music || !lfm) renderMusic(data.music);
      document.dispatchEvent(new CustomEvent('now:update', { detail: data }));
    }
    if (!document.hidden) timer = setTimeout(load, 60000);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
    else clearTimeout(timer);
  });
  load();
})();
