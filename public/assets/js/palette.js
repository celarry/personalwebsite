// Command palette (⌘K / Ctrl K, or /) and keyboard shortcuts. On phones it doubles as the menu.
(() => {
  const body = document.body;
  const root = body.dataset.root || './';
  const preview = body.dataset.preview === '1';
  const email = body.dataset.email || '';
  const repo = body.dataset.repo || '';
  const resume = body.dataset.resume || '';
  const tz = body.dataset.tz || 'Australia/Melbourne';
  const place = body.dataset.place || 'Melbourne';

  // Build a link to a site path ('' = home, 'blog/', '#about') from this page.
  const link = (p) => {
    let [base, hash] = p.split('#');
    if (base === '' && hash !== undefined && (onHome() || document.getElementById(hash) || (hasStore() && STORE_HASHES.includes(hash)))) return '#' + hash;
    if (preview && (base === '' || base.endsWith('/'))) base += 'index.html';
    let url = (root === './' ? '' : root) + base;
    if (!url) url = './';
    return hash !== undefined ? `${url}#${hash}` : url;
  };
  const onHome = () => body.classList.contains('page-home');
  const hasStore = () => !!(document.querySelector('[data-floor]') && window.floorDemo);
  const STORE_HASHES = ['closed', 'open', 'shop', 'lunar', 'easter', 'midautumn', 'halloween', 'christmas', ...Array.from({ length: 100 }, (_, i) => `store-${i + 1}`)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const SHORTCUTS = [
    [isMac() ? '⌘ K' : 'Ctrl K', 'Open this palette'],
    ['/', 'Open this palette'],
    ['1', 'Homepage'],
    ['2', 'Projects'],
    ['3', 'Blog'],
    ['4', 'Now page'],
    ['5', 'Resume'],
    ['t', 'Switch light and dark'],
    ['?', 'Show shortcuts'],
  ];
  function isMac() {
    const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    return /mac|iphone|ipad|ipod/i.test(p);
  }
  const kbd = (k) => k.split(' ').map((x) => `<kbd>${esc(x)}</kbd>`).join(' ');

  // ---------- Items ----------
  const pages = [
    { title: 'Home', href: '', keywords: 'homepage start store shop cart', hint: '1' },
    { title: 'Projects', href: 'projects/', keywords: 'work portfolio history built', hint: '2' },
    { title: 'Blog', href: 'blog/', keywords: 'posts writing life archive', hint: '3' },
    { title: 'Now', href: 'now/', keywords: 'currently up to singapore where', hint: '4' },
    { title: 'Resume', href: 'resume/', keywords: 'cv experience skills hire', hint: '5' },
    { title: 'How this site works', href: 'colophon/', keywords: 'colophon build fonts privacy shortcuts source' },
    { title: 'About', href: '#about', keywords: 'bio skills languages' },
    { title: 'Experience', href: '#experience', keywords: 'jobs work netgain unitop monash education' },
    { title: 'Off the clock', href: '#offclock', keywords: 'games music saxophone reading hobbies casting valorant' },
    { title: 'Contact', href: '#contact', keywords: 'email get in touch hire message text' },
  ].map((p) => ({ ...p, group: 'Go to' }));

  function localTime() {
    try {
      const f = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', weekday: 'long', timeZone: tz });
      return f.format(new Date()).replace(/\s?([ap])m$/i, ' $1m');
    } catch (e) {
      return '';
    }
  }

  const actions = [
    {
      title: () => (window.siteTheme && window.siteTheme.current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'),
      keywords: 'theme dark light mode colour',
      hint: 't',
      run: () => window.siteTheme && window.siteTheme.toggle(),
      stay: true,
    },
    {
      title: 'Copy email address',
      keywords: 'email contact clipboard',
      run: async () => {
        try {
          await navigator.clipboard.writeText(email);
          answer(`<p>Copied <b>${esc(email)}</b> to your clipboard.</p>`);
        } catch (e) {
          answer(`<p>Here it is: <b class="palette__select">${esc(email)}</b></p>`);
          const el = dialog.querySelector('.palette__select');
          const r = document.createRange();
          r.selectNodeContents(el);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
        }
      },
      stay: true,
    },
    { title: 'Email Lawrence', keywords: 'contact mail message', href: `mailto:${email}`, external: true },
    resume && { title: 'Download resume (PDF)', keywords: 'cv pdf download', href: resume, external: true },
    {
      title: 'What time is it for Lawrence?',
      keywords: 'clock time zone local where',
      run: () => answer(`<p>It's <b>${esc(localTime())}</b> in ${esc(place)}.</p>`),
      stay: true,
    },
    {
      title: 'Say hello in four languages',
      keywords: 'hello greeting mandarin cantonese french chinese bonjour',
      run: () =>
        answer(`<ul class="palette__hello">
          <li><b>Hello</b><span>English</span></li>
          <li><b lang="zh-Hans">你好</b><span>nǐ hǎo, Mandarin</span></li>
          <li><b lang="zh-Hant-HK">你好</b><span>néih hóu, Cantonese</span></li>
          <li><b lang="fr">Bonjour</b><span>French</span></li>
        </ul>`),
      stay: true,
    },
    { title: 'Read a random post', keywords: 'blog surprise random', run: () => randomPost() },
    {
      title: 'What is Lawrence playing?',
      keywords: 'steam game gaming playing now',
      when: () => !!(window.nowData && window.nowData.steam),
      run: () => {
        const s = window.nowData.steam;
        const g = s.playing || (s.games || [])[0];
        answer(s.playing ? `<p>Right now: <b>${esc(g.name)}</b>.</p>` : g ? `<p>Nothing right now. Lately it's been <b>${esc(g.name)}</b>.</p>` : '<p>Nothing on Steam lately.</p>');
      },
      stay: true,
    },
    {
      title: 'What is Lawrence listening to?',
      keywords: 'music spotify last.fm song listening now',
      when: () => !!(window.nowData && window.nowData.music && window.nowData.music.tracks.length),
      run: () => {
        const t = window.nowData.music.tracks[0];
        answer(`<p>${t.nowPlaying ? 'Right now' : 'Most recently'}: <b>${esc(t.name)}</b> by ${esc(t.artist)}.</p>`);
      },
      stay: true,
    },
    {
      title: 'Send the cart shopping',
      keywords: 'cart a* astar pathfinding store shop demo receipt',
      run: () => {
        if (hasStore()) {
          close();
          const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
          document.querySelector('[data-floor]').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
          setTimeout(() => window.floorDemo.shop(), smooth ? 450 : 0);
        } else location.href = link('#shop');
      },
    },
    ...[
      ['astar', 'A*', 'a star astar heuristic'],
      ['dijkstra', 'Dijkstra', 'dijkstra uniform cost'],
      ['greedy', 'greedy search', 'greedy best first'],
    ].map(([key, name, kw]) => ({
      title: `Plan the cart's routes with ${name}`,
      keywords: `${kw} algorithm search pathfinding cart store`,
      when: hasStore,
      run: () => {
        close();
        window.floorDemo.setAlgo(key);
      },
    })),
    { title: 'Turn the store lights off', keywords: 'closed night store sleep dark hours', href: '#closed', hidden: true },
    { title: 'Open the store', keywords: 'open day store hours lights', href: '#open', hidden: true },
    ...[
      ['lunar', 'Lunar New Year'],
      ['easter', 'Easter'],
      ['midautumn', 'Mid-Autumn Festival'],
      ['halloween', 'Halloween'],
      ['christmas', 'Christmas'],
    ].map(([key, name]) => ({ title: `Decorate the store for ${name}`, keywords: `season festival decorations ${key} ${name}`, href: `#${key}`, hidden: true })),
    {
      title: 'Visit another store',
      keywords: 'store layout shop cart new different another random',
      when: () => hasStore() && !!window.floorDemo.anotherStore,
      run: () => {
        close();
        const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.querySelector('[data-floor]').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
        window.floorDemo.anotherStore();
      },
    },
    { title: 'See all the stores', keywords: 'stores layouts collection found hundred 100', href: 'stores/' },
    ...(window.StoreEngine
      ? window.StoreEngine.list().map((st) => ({ title: `Store ${st.number}: ${st.name}`, keywords: `store layout ${st.note}`, href: `#store-${st.number}`, hidden: true }))
      : []),
    { title: 'Play with the Valorant predictor', keywords: 'valorant demo win probability model', href: '#valorant-win-probability' },
    repo && { title: "View this site's source on GitHub", keywords: 'code repository source github', href: repo, external: true },
    { title: 'Follow with RSS', keywords: 'rss feed subscribe', href: 'feed.xml' },
    { title: 'Show keyboard shortcuts', keywords: 'keys keyboard help shortcuts', hint: '?', run: () => showShortcuts(), stay: true },
  ]
    .filter(Boolean)
    .map((a) => ({ ...a, group: 'Actions' }));

  let indexItems = [];
  let indexLoaded = false;
  function loadIndex() {
    if (indexLoaded) return Promise.resolve();
    indexLoaded = true;
    return fetch(link('search.json'))
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        indexItems = rows.map((r) => ({
          title: r.title,
          href: r.url,
          text: r.text,
          group: r.type === 'project' ? 'Projects' : 'Blog posts',
          hint: r.type === 'post' && r.date ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(r.date + 'T12:00:00Z')) : '',
          date: r.date || '',
          tags: r.tags || [],
        }));
        const tags = [...new Set(indexItems.flatMap((i) => i.tags))];
        tags.forEach((t) => pages.push({ title: `Blog posts tagged ${t}`, href: `blog/#${t.toLowerCase()}`, keywords: `tag ${t}`, group: 'Go to' }));
        if (dialog.open) render();
      })
      .catch(() => {});
  }

  function randomPost() {
    const ps = indexItems.filter((i) => i.group === 'Blog posts');
    if (!ps.length) return answer('<p>No posts yet.</p>');
    location.href = link(pick(ps).href);
  }
  const pick = (a) => a[(Math.random() * a.length) | 0];

  // ---------- Dialog ----------
  const dialog = document.createElement('dialog');
  dialog.className = 'palette';
  dialog.setAttribute('aria-label', 'Search and commands');
  dialog.innerHTML = `<div class="palette__box">
    <div class="palette__search">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
      <input id="palette-input" type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Search, or type a command">
      <button type="button" class="palette__close" aria-label="Close"><span class="palette__close-key">Esc</span><span class="palette__close-word">Close</span></button>
    </div>
    <div class="palette__answer" aria-live="polite" hidden></div>
    <ul id="palette-list" class="palette__list" role="listbox" aria-label="Results"></ul>
    <p class="palette__foot"><span>${kbd('↑ ↓')} move</span><span>${kbd('↵')} open</span><span>${kbd('esc')} close</span><span class="palette__foot-tip">Try “hello” or “time”</span></p>
  </div>`;
  document.body.appendChild(dialog);
  const input = dialog.querySelector('input');
  const listEl = dialog.querySelector('.palette__list');
  const answerEl = dialog.querySelector('.palette__answer');
  let results = [];
  let active = 0;

  function answer(html) {
    answerEl.innerHTML = html;
    answerEl.hidden = false;
  }
  function showShortcuts() {
    answer(`<table class="palette__keys"><tbody>${SHORTCUTS.map(([k, d]) => `<tr><td>${kbd(k)}</td><td>${esc(d)}</td></tr>`).join('')}</tbody></table>`);
  }

  function score(item, q) {
    const title = (typeof item.title === 'function' ? item.title() : item.title).toLowerCase();
    const hay = `${title} ${item.keywords || ''} ${item.text || ''} ${item.group}`.toLowerCase();
    let s = 0;
    for (const tok of q) {
      if (!hay.includes(tok)) return -1;
      if (title.startsWith(tok)) s += 8;
      else if (title.includes(' ' + tok)) s += 5;
      else if (title.includes(tok)) s += 3;
      else if ((item.keywords || '').toLowerCase().includes(tok)) s += 2;
      else s += 1;
    }
    return s;
  }

  function render() {
    const q = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const usable = actions.filter((a) => !a.when || a.when());
    if (!q.length) {
      const latest = indexItems.filter((i) => i.group === 'Blog posts').slice(0, 3).map((i) => ({ ...i, group: 'Latest posts' }));
      results = [...pages.slice(0, 6), ...latest, ...usable.filter((a) => !a.hidden).slice(0, 6)];
    } else {
      results = [...pages, ...indexItems, ...usable]
        .map((item) => ({ item, s: score(item, q) }))
        .filter((r) => r.s >= 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, 14)
        .map((r) => r.item);
    }
    active = Math.min(active, Math.max(0, results.length - 1));
    let lastGroup = '';
    listEl.innerHTML = results.length
      ? results
          .map((item, i) => {
            const title = typeof item.title === 'function' ? item.title() : item.title;
            const head = !q.length && item.group !== lastGroup ? `<li class="palette__group" role="presentation">${esc(item.group)}</li>` : '';
            lastGroup = item.group;
            const tag = q.length ? `<span class="palette__kind">${esc(item.group.replace(/s$/, '').replace('Go to', 'Page').replace('Blog post', 'Post').replace('Action', 'Command'))}</span>` : '';
            const hint = item.hint ? `<span class="palette__hint">${/^([a-z?] ?[a-z]?|[1-9])$/.test(item.hint) ? kbd(item.hint) : esc(item.hint)}</span>` : '';
            return `${head}<li role="option" id="palette-opt-${i}" class="palette__opt" data-i="${i}" aria-selected="${i === active}"><span class="palette__title">${esc(title)}</span>${tag}${hint}</li>`;
          })
          .join('')
      : `<li class="palette__empty" role="presentation">Nothing matches “${esc(input.value.trim())}”. Try a project name, a tag like Life, or “resume”.</li>`;
    input.setAttribute('aria-activedescendant', results.length ? `palette-opt-${active}` : '');
  }

  function setActive(i) {
    if (!results.length) return;
    active = (i + results.length) % results.length;
    listEl.querySelectorAll('[role="option"]').forEach((el) => el.setAttribute('aria-selected', String(Number(el.dataset.i) === active)));
    const el = listEl.querySelector(`#palette-opt-${active}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', `palette-opt-${active}`);
  }

  function runItem(item) {
    if (!item) return;
    if (item.run) {
      item.run();
      if (item.stay) render();
      return;
    }
    const href = item.external ? item.href : link(item.href);
    close();
    if (href.startsWith('#')) {
      const target = document.getElementById(href.slice(1));
      if (target) {
        if (target.tagName === 'DETAILS') target.open = true;
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        history.replaceState(null, '', href);
        return;
      }
      if (hasStore()) {
        location.hash = href;
        return;
      }
    }
    location.href = href;
  }

  function open() {
    loadIndex();
    answerEl.hidden = true;
    input.value = '';
    active = 0;
    render();
    if (!dialog.open) dialog.showModal();
    input.focus();
  }
  function close() {
    if (dialog.open) dialog.close();
  }
  function toggle() {
    dialog.open ? close() : open();
  }

  input.addEventListener('input', () => {
    active = 0;
    answerEl.hidden = true;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === 'Enter') { e.preventDefault(); runItem(results[active]); }
  });
  listEl.addEventListener('click', (e) => {
    const opt = e.target.closest('[role="option"]');
    if (opt) runItem(results[Number(opt.dataset.i)]);
  });
  listEl.addEventListener('mousemove', (e) => {
    const opt = e.target.closest('[role="option"]');
    if (opt && Number(opt.dataset.i) !== active) setActive(Number(opt.dataset.i));
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close();
  });
  dialog.querySelector('.palette__close').addEventListener('click', close);

  document.querySelectorAll('[data-palette-open]').forEach((b) => b.addEventListener('click', open));

  // ---------- Shortcuts ----------
  const goMap = { h: '', p: 'projects/', b: 'blog/', n: 'now/', r: 'resume/' };
  const numberMap = { 1: '', 2: 'projects/', 3: 'blog/', 4: 'now/', 5: 'resume/' };
  let gAt = 0;
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggle();
      return;
    }
    if (dialog.open || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
    if (gAt && Date.now() - gAt < 1200 && goMap[e.key] !== undefined) {
      gAt = 0;
      location.href = link(goMap[e.key]);
      return;
    }
    gAt = 0;
    if (numberMap[e.key] !== undefined && !e.shiftKey) {
      location.href = link(numberMap[e.key]);
      return;
    }
    if (e.key === '/') { e.preventDefault(); open(); }
    else if (e.key === '?') { e.preventDefault(); open(); showShortcuts(); }
    else if (e.key === 't' && window.siteTheme) window.siteTheme.toggle();
    else if (e.key === 'g') gAt = Date.now();
  });

  window.palette = { open, close };
})();
