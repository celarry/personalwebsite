// What I'm playing on Steam and listening to on Last.fm, from my worker (see worker/now.js).
// It fills in the live parts of Off the clock and checks again every minute while the page is open.
(() => {
  const api = document.body.dataset.nowApi;
  const slots = { steam: document.querySelector('[data-live="steam"]'), music: document.querySelector('[data-live="music"]') };
  if (!api || (!slots.steam && !slots.music)) return;

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

  function renderSteam(s) {
    if (!slots.steam) return;
    if (!s || (!s.playing && !(s.games || []).length)) return show(slots.steam, '');
    const games = (s.games || []).slice(0, 3);
    let status = '';
    if (s.playing) status = `<p class="live__status is-on"><i aria-hidden="true"></i>Playing <b>${esc(s.playing.name)}</b> right now.</p>`;
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

  let timer = 0;
  async function load() {
    clearTimeout(timer);
    try {
      const res = await fetch(`${api}/now`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      window.nowData = data;
      renderSteam(data.steam);
      renderMusic(data.music);
      document.dispatchEvent(new CustomEvent('now:update', { detail: data }));
    } catch (e) {
      // Leave whatever was there; the text still says what I play.
    }
    if (!document.hidden) timer = setTimeout(load, 60000);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) load();
    else clearTimeout(timer);
  });
  load();
})();
