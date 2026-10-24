// Charts on /stats/: what I play on Steam and listen to on Last.fm. Everything comes from two
// files a GitHub Action refreshes every ten minutes (scripts/live-feed.mjs), plus Last.fm itself
// for genres. Charts are plain HTML so they follow the site's light and dark themes.
(() => {
  const root = document.querySelector('[data-stats]');
  if (!root) return;
  const d = document.body.dataset;
  const steamUrl = d.steamFeed;
  const historyUrl = root.dataset.history;
  const lfm = d.lastfmUser && d.lastfmKey ? { user: d.lastfmUser, key: d.lastfmKey } : null;
  const tz = d.tz || 'Australia/Melbourne';

  // ---------- Small helpers ----------
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const fmtHours = (min) => {
    const h = min / 60;
    if (min < 60) return `${Math.round(min)} min`;
    return `${h < 10 ? h.toFixed(1).replace(/\.0$/, '') : Math.round(h).toLocaleString('en-AU')} h`;
  };
  const fmtNum = (n) => (n >= 10000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : n.toLocaleString('en-AU'));
  const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  const todayStr = () => dayFmt.format(new Date());
  const lastDays = (n) => {
    const out = [];
    const t = Date.parse(todayStr() + 'T12:00:00Z');
    for (let k = n - 1; k >= 0; k--) out.push(new Date(t - k * 86400000).toISOString().slice(0, 10));
    return out;
  };
  const shortDate = (iso) => new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
  const longDate = (iso) => new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hourLabel = (h) => `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}`;
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
    return 10 * p;
  };
  const sumObj = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

  // ---------- Tooltip: one for the page, filled with textContent ----------
  const tip = el('div', 'viz-tip');
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.appendChild(tip);
  function showTip(target, title, rows, e) {
    tip.replaceChildren();
    tip.appendChild(el('p', 'viz-tip__title', title));
    for (const r of rows) {
      const row = el('p', 'viz-tip__row');
      if (r.color) {
        const key = el('span', 'viz-tip__key');
        key.style.background = r.color;
        row.appendChild(key);
      }
      row.appendChild(el('b', null, r.value));
      if (r.label) row.appendChild(el('span', null, r.label));
      tip.appendChild(row);
    }
    tip.hidden = false;
    const box = target.getBoundingClientRect();
    const x = e && e.clientX != null ? e.clientX : box.left + box.width / 2;
    const y = e && e.clientY != null ? e.clientY : box.top;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 14, top = y - h - 12;
    if (left + w > innerWidth - 8) left = x - w - 14;
    if (top < 8) top = y + 18;
    tip.style.left = `${Math.max(8, left) + scrollX}px`;
    tip.style.top = `${top + scrollY}px`;
  }
  const hideTip = () => (tip.hidden = true);
  function hover(target, fill) {
    target.addEventListener('pointermove', (e) => fill(e));
    target.addEventListener('pointerleave', hideTip);
    target.addEventListener('focus', () => fill(null));
    target.addEventListener('blur', hideTip);
  }
  addEventListener('scroll', hideTip, { passive: true });

  // ---------- Chart frames ----------
  const charts = {};
  root.querySelectorAll('[data-chart]').forEach((f) => (charts[f.dataset.chart] = f));
  const plot = (key) => charts[key].querySelector('[data-plot]');
  function empty(key, text) {
    const p = plot(key);
    p.replaceChildren(el('p', 'chart__empty', text));
    charts[key].querySelector('.chart__table').hidden = true;
  }
  // The table twin of every chart, behind "Show the numbers".
  function table(key, head, rows) {
    const holder = charts[key].querySelector('[data-table]');
    const t = el('table', 'viz-table');
    const tr = el('tr');
    head.forEach((h, i) => tr.appendChild(el('th', i ? 'num' : '', h)));
    const thead = el('thead');
    thead.appendChild(tr);
    const tbody = el('tbody');
    rows.forEach((r) => {
      const row = el('tr');
      r.forEach((c, i) => row.appendChild(el('td', i ? 'num' : '', c)));
      tbody.appendChild(row);
    });
    t.append(thead, tbody);
    holder.replaceChildren(t);
    charts[key].querySelector('.chart__table').hidden = false;
  }
  function legend(items) {
    const ul = el('ul', 'viz-legend');
    for (const it of items) {
      const li = el('li');
      const sw = el('span', 'viz-legend__key');
      sw.style.background = it.color;
      li.append(sw, document.createTextNode(it.label));
      ul.appendChild(li);
    }
    return ul;
  }

  // Horizontal bars: one series, value at the tip.
  function bars(key, items, { color, value, tipLabel }) {
    const max = Math.max(...items.map((i) => i.v)) || 1;
    const wrap = el('div', 'viz-bars');
    for (const it of items) {
      const row = el('div', 'viz-bars__row');
      row.tabIndex = 0;
      const name = el('span', 'viz-bars__name', it.name);
      const track = el('span', 'viz-bars__track');
      const bar = el('span', 'viz-bars__bar');
      bar.style.width = `${Math.max(1.5, (it.v / max) * 100)}%`;
      bar.style.background = color;
      const val = el('span', 'viz-bars__value', value(it.v));
      track.append(bar, val);
      row.append(name, track);
      hover(row, (e) => showTip(row, it.name, [{ value: value(it.v), label: tipLabel, color }], e));
      wrap.appendChild(row);
    }
    plot(key).replaceChildren(wrap);
  }

  // Columns over days, stacked by series. series: [{ key, label, color }], days: [{ date, parts: {key: v} }].
  function columns(key, days, series, { unit, fmt }) {
    const totals = days.map((dd) => series.reduce((a, s) => a + (dd.parts[s.key] || 0), 0));
    const top = niceMax(Math.max(...totals) / unit);
    const box = el('div', 'viz-cols');
    const axis = el('div', 'viz-cols__axis');
    [top, top / 2, 0].forEach((t) => axis.appendChild(el('span', null, t ? `${t % 1 ? t.toFixed(1) : t}` : '0')));
    const area = el('div', 'viz-cols__area');
    [0, 0.5, 1].forEach((f) => {
      const g = el('span', 'viz-cols__grid');
      g.style.bottom = `${f * 100}%`;
      area.appendChild(g);
    });
    const barsEl = el('div', 'viz-cols__bars');
    days.forEach((dd, i) => {
      const col = el('div', 'viz-cols__col');
      col.tabIndex = totals[i] ? 0 : -1;
      const stack = el('div', 'viz-cols__stack');
      stack.style.height = `${((totals[i] / unit) / top) * 100}%`;
      for (const s of series) {
        const v = dd.parts[s.key] || 0;
        if (!v) continue;
        const seg = el('span', 'viz-cols__seg');
        seg.style.flexGrow = String(v);
        seg.style.background = s.color;
        stack.appendChild(seg);
      }
      col.appendChild(stack);
      hover(col, (e) =>
        showTip(
          col,
          longDate(dd.date),
          totals[i]
            ? series.filter((s) => dd.parts[s.key]).map((s) => ({ value: fmt(dd.parts[s.key]), label: series.length > 1 ? s.label : '', color: s.color }))
            : [{ value: 'Nothing', label: '' }],
          e
        )
      );
      barsEl.appendChild(col);
    });
    area.appendChild(barsEl);
    const xs = el('div', 'viz-cols__x');
    days.forEach((dd, i) => xs.appendChild(el('span', null, i % 7 === (days.length - 1) % 7 ? shortDate(dd.date) : '')));
    box.append(axis, area, el('span'), xs);
    const out = [];
    if (series.length > 1) out.push(legend(series.map((s) => ({ label: s.label, color: s.color }))));
    out.push(box);
    plot(key).replaceChildren(...out);
  }

  // A week-by-hour heatmap in one hue: more is stronger.
  function heatmap(key, grid, { hue, fmt }) {
    const max = Math.max(...grid.flat());
    const box = el('div', 'viz-heat');
    box.style.setProperty('--heat', hue);
    for (let r = 0; r < 7; r++) {
      box.appendChild(el('span', 'viz-heat__day', DAYS[r].slice(0, 3)));
      for (let h = 0; h < 24; h++) {
        const v = grid[r][h];
        const c = el('span', 'viz-heat__cell');
        const f = v ? 0.18 + 0.82 * (v / max) : 0;
        c.style.setProperty('--f', `${Math.round(f * 100)}%`);
        hover(c, (e) => showTip(c, `${DAYS[r]}s, ${hourLabel(h)} to ${hourLabel((h + 1) % 24)}`, [{ value: v ? fmt(v) : 'Nothing', label: '' }], e));
        box.appendChild(c);
      }
    }
    box.appendChild(el('span'));
    for (let h = 0; h < 24; h++) box.appendChild(el('span', 'viz-heat__hour', h % 6 === 0 ? hourLabel(h).replace(' ', '') : ''));
    const scale = el('div', 'viz-heat__scale');
    scale.style.setProperty('--heat', hue);
    scale.append(el('span', null, 'Less'), el('span', 'viz-heat__ramp'), el('span', null, 'More'));
    plot(key).replaceChildren(box, scale);
  }

  // ---------- Genres, from Last.fm tags of the top artists ----------
  const NOT_GENRES = new Set(['seen live', 'favorites', 'favourites', 'favorite', 'favourite', 'albums i own', 'under 2000 listeners', 'spotify', 'love', 'loved', 'beautiful', 'awesome', 'amazing', 'cool', 'good', 'best', 'all', 'music', 'female vocalists', 'male vocalists', 'female vocalist', 'male vocalist', 'vocalists', 'american', 'british', 'english', 'australian', 'canadian', 'japanese', 'korean', 'chinese', 'french', 'german', 'swedish', 'usa', 'uk', 'australia', 'japan', 'korea', 'saxophone', 'piano', 'guitar', 'drums', 'bass', 'instrumental']);
  async function genres(artists) {
    if (!lfm || !artists.length) return [];
    const names = new Set(artists.map((a) => a.name.toLowerCase()));
    const score = new Map();
    await Promise.all(
      artists.slice(0, 6).map(async (a) => {
        const k = `lfm-tags:${a.name.toLowerCase()}`;
        let tags = null;
        try {
          const hit = JSON.parse(localStorage.getItem(k) || 'null');
          if (hit && Date.now() - hit.t < 86400000) tags = hit.tags;
        } catch (e) {}
        if (!tags) {
          const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=${encodeURIComponent(a.name)}&autocorrect=1&api_key=${encodeURIComponent(lfm.key)}&format=json`).catch(() => null);
          const data = res && res.ok ? await res.json().catch(() => null) : null;
          tags = (data?.toptags?.tag || []).slice(0, 6).map((t) => ({ name: String(t.name || '').toLowerCase().trim(), count: Number(t.count) || 0 }));
          try { localStorage.setItem(k, JSON.stringify({ t: Date.now(), tags })); } catch (e) {}
        }
        for (const t of tags) {
          const name = t.name.replace(/\s+/g, ' ').replace(/^hip hop$/, 'hip-hop');
          if (!name || NOT_GENRES.has(name) || names.has(name) || /^\d0s$/.test(name) || /^\d{4}$/.test(name)) continue;
          score.set(name, (score.get(name) || 0) + a.v * (t.count / 100));
        }
      })
    );
    return [...score.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([n]) => n);
  }
  const and = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

  // ---------- Draw everything ----------
  const col = (name) => `var(${name})`;
  const GAMES = col('--viz-games');
  const MUSIC = col('--viz-music');
  const SERIES = ['--viz-1', '--viz-2', '--viz-3', '--viz-4'].map(col);
  const OTHER = col('--viz-other');

  function draw(steam, H) {
    const S = (H && H.steam) || {};
    const M = (H && H.music) || {};
    const since = H && H.since ? H.since.slice(0, 10) : '';
    const sinceText = since ? `The record started on ${longDate(since)}.` : '';
    const sinceEl = document.querySelector('[data-stats-since]');
    if (sinceEl) sinceEl.textContent = sinceText;
    const notYet = since ? `Nothing yet. The record started on ${longDate(since)}, so check back in a few days.` : 'Nothing yet. Check back in a few days.';
    const days30 = lastDays(30);
    const names = { ...(S.names || {}) };
    (steam?.games || []).forEach((g) => (names[g.appid] = g.name));

    // Headline numbers.
    const k = document.querySelector('[data-kpis]');
    const g2w = (steam?.games || []).reduce((a, g) => a + (g.minutes2w || 0), 0);
    const topRecent = [...(steam?.games || [])].sort((a, b) => b.minutes2w - a.minutes2w)[0];
    const songs7 = lastDays(7).reduce((a, dd) => a + ((M.days || {})[dd] || 0), 0);
    const artist30 = {};
    days30.forEach((dd) => Object.entries((M.artistDays || {})[dd] || {}).forEach(([a, n]) => (artist30[a] = (artist30[a] || 0) + n)));
    const topArtist = Object.entries(artist30).sort((a, b) => b[1] - a[1])[0];
    const tile = (label, value, sub) => {
      const t = el('div', 'kpi');
      t.append(el('p', 'kpi__label', label), el('p', 'kpi__value', value), el('p', 'kpi__sub', sub));
      return t;
    };
    k.replaceChildren(
      tile('Played, last two weeks', g2w ? fmtHours(g2w) : '0 h', 'On Steam'),
      tile('Most played lately', topRecent && topRecent.minutes2w ? topRecent.name.replace(/®|™/g, '') : 'Nothing', topRecent && topRecent.minutes2w ? `${fmtHours(topRecent.minutes2w)} in two weeks` : 'In the last two weeks'),
      tile('Songs, last seven days', fmtNum(songs7), 'Through Last.fm'),
      tile('Top artist this month', topArtist ? topArtist[0] : 'Nobody yet', topArtist ? `${topArtist[1]} play${topArtist[1] === 1 ? '' : 's'}` : 'Still collecting')
    );

    // Hours played, all time.
    // Until the record has Steam's full list, the recently played games' totals stand in.
    const owned = ((S.owned || []).length ? S.owned : (steam?.games || []).filter((g) => g.minutesTotal).map((g) => ({ appid: g.appid, name: g.name, minutes: g.minutesTotal })).sort((a, b) => b.minutes - a.minutes)).slice(0, 8);
    if (owned.length) {
      bars('lifetime', owned.map((g) => ({ name: g.name.replace(/®|™/g, ''), v: g.minutes })), { color: GAMES, value: fmtHours, tipLabel: 'all time' });
      table('lifetime', ['Game', 'Hours'], owned.map((g) => [g.name.replace(/®|™/g, ''), (g.minutes / 60).toFixed(1)]));
    } else empty('lifetime', 'Nothing to show yet.');

    // Hours each day, by game: the four most played this month, the rest as Other.
    const perGame = {};
    days30.forEach((dd) => Object.entries((S.days || {})[dd] || {}).forEach(([id, m]) => (perGame[id] = (perGame[id] || 0) + m)));
    const topIds = Object.entries(perGame).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
    if (Object.keys(perGame).length) {
      // Colour follows the game: slots go to games in order of all-time hours, so they stay put.
      const slotOrder = [...new Set([...(S.owned || []).map((g) => String(g.appid)), ...topIds])];
      const series = topIds
        .map((id) => ({ key: id, label: (names[id] || 'A game').replace(/®|™/g, ''), slot: slotOrder.indexOf(id) }))
        .sort((a, b) => a.slot - b.slot)
        .map((s, i) => ({ ...s, color: SERIES[i] }));
      const hasOther = Object.keys(perGame).length > topIds.length;
      if (hasOther) series.push({ key: 'other', label: 'Other games', color: OTHER });
      const days = days30.map((dd) => {
        const parts = {};
        Object.entries((S.days || {})[dd] || {}).forEach(([id, m]) => {
          const key = topIds.includes(id) ? id : 'other';
          parts[key] = (parts[key] || 0) + m;
        });
        return { date: dd, parts };
      });
      columns('daily', days, series, { unit: 60, fmt: fmtHours });
      table('daily', ['Day', 'Hours'], days.filter((dd) => sumObj(dd.parts)).map((dd) => [shortDate(dd.date), (sumObj(dd.parts) / 60).toFixed(1)]));
    } else empty('daily', notYet);

    // When I play.
    const pg = S.grid || [];
    if (pg.flat && pg.flat().some(Boolean)) {
      heatmap('playclock', pg, { hue: GAMES, fmt: fmtHours });
      table('playclock', ['Day', 'Hours'], pg.map((r, i) => [DAYS[i], (r.reduce((a, b) => a + b, 0) / 60).toFixed(1)]));
    } else empty('playclock', notYet);

    // Songs each day.
    const songDays = days30.map((dd) => ({ date: dd, parts: { songs: (M.days || {})[dd] || 0 } }));
    if (songDays.some((dd) => dd.parts.songs)) {
      columns('songs', songDays, [{ key: 'songs', label: 'Songs', color: MUSIC }], { unit: 1, fmt: (n) => `${n} song${n === 1 ? '' : 's'}` });
      table('songs', ['Day', 'Songs'], songDays.filter((dd) => dd.parts.songs).map((dd) => [shortDate(dd.date), String(dd.parts.songs)]));
    } else empty('songs', notYet);

    // Most played artists, and the genres they add up to.
    const artists = Object.entries(artist30).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, v]) => ({ name, v }));
    if (artists.length) {
      bars('artists', artists, { color: MUSIC, value: (v) => `${v}`, tipLabel: 'plays' });
      table('artists', ['Artist', 'Plays'], artists.map((a) => [a.name, String(a.v)]));
      genres(artists).then((gs) => {
        const note = charts.artists.querySelector('[data-genres]');
        if (gs.length && note) {
          note.textContent = `Mostly ${and(gs)}, going by Last.fm’s tags for these artists.`;
          note.hidden = false;
        }
      });
    } else empty('artists', notYet);

    // When I listen.
    const lg = M.grid || [];
    if (lg.flat && lg.flat().some(Boolean)) {
      heatmap('listenclock', lg, { hue: MUSIC, fmt: (n) => `${n} song${n === 1 ? '' : 's'}` });
      table('listenclock', ['Day', 'Songs'], lg.map((r, i) => [DAYS[i], String(r.reduce((a, b) => a + b, 0))]));
    } else empty('listenclock', notYet);

    // Soundtrack: the artists I had on in each game.
    const wp = Object.entries(M.whilePlaying || {})
      .map(([id, arts]) => ({ id, name: (names[id] || 'A game').replace(/®|™/g, ''), total: sumObj(arts), top: Object.entries(arts).sort((a, b) => b[1] - a[1]).slice(0, 3) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    if (wp.length) {
      const ul = el('ul', 'soundtrack');
      for (const g of wp) {
        const li = el('li');
        li.append(el('b', null, g.name), el('span', null, g.top.map(([a, n]) => `${a} (${n})`).join(', ')));
        ul.appendChild(li);
      }
      plot('soundtrack').replaceChildren(ul);
      table('soundtrack', ['Game', 'Songs'], wp.map((g) => [g.name, String(g.total)]));
    } else empty('soundtrack', since ? `Nothing yet. This fills in when I listen to Spotify with a game open.` : notYet);
  }

  const bust = () => `?t=${Math.floor(Date.now() / 120000)}`;
  const get = (url) => fetch(url + bust(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  async function load() {
    const [steam, H] = await Promise.all([get(steamUrl), get(historyUrl)]);
    root.classList.remove('is-loading');
    if (!steam && !H) {
      Object.keys(charts).forEach((key) => empty(key, 'Couldn’t load the data just now. Try again in a minute.'));
      return;
    }
    draw(steam && steam.steam, H);
  }
  root.classList.add('is-loading');
  load();
  setInterval(() => !document.hidden && load(), 5 * 60000);
})();
