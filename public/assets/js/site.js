// Runs on every page: theme, local clock, copy buttons, blog filters and a note for the curious.
(() => {
  const root = document.documentElement;
  const body = document.body;
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const current = () => root.dataset.theme || (dark.matches ? 'dark' : 'light');

  /* ---------- Theme ---------- */
  const label = (btn) => btn.setAttribute('aria-label', current() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
    toggles.forEach(label);
  }
  toggles.forEach((btn) => {
    label(btn);
    btn.addEventListener('click', toggle);
  });
  dark.addEventListener('change', () => toggles.forEach(label));
  window.siteTheme = { toggle, current };

  /* ---------- Keyboard hint: ⌘K on Apple devices, Ctrl K elsewhere ---------- */
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  if (!/mac|iphone|ipad|ipod/i.test(platform)) {
    document.querySelectorAll('[data-kbd-mod]').forEach((k) => (k.textContent = 'Ctrl K'));
    document.querySelectorAll('[data-kbd-mod-only]').forEach((k) => (k.textContent = 'Ctrl'));
  }

  /* ---------- Local clock ---------- */
  const tz = body.dataset.tz;
  const place = body.dataset.place;
  let fmt = null;
  try { fmt = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: tz }); } catch (e) {}
  const clocks = document.querySelectorAll('[data-clock]');
  if (fmt && clocks.length) {
    const tick = () => {
      const t = fmt.format(new Date()).replace(/\s?([ap])m$/i, ' $1m');
      clocks.forEach((c) => (c.textContent = `It's ${t} for me in ${place}.`));
    };
    tick();
    setInterval(tick, 30000);
  }

  /* ---------- "Updated 3 days ago" ---------- */
  document.querySelectorAll('time[data-ago]').forEach((el) => {
    const then = new Date(el.getAttribute('datetime') + 'T12:00:00');
    const days = Math.round((Date.now() - then) / 86400000);
    if (Number.isNaN(days) || days < 0) return;
    const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : days < 45 ? `${days} days ago` : `${Math.round(days / 30)} months ago`;
    el.title = el.textContent;
    el.textContent = `${el.textContent} (${ago})`;
  });

  /* ---------- Copy buttons ---------- */
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    const original = btn.textContent;
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = 'Copied';
      } catch (e) {
        const target = btn.previousElementSibling;
        if (target) {
          const r = document.createRange();
          r.selectNodeContents(target);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r);
        }
        btn.textContent = 'Press Ctrl C to copy';
      }
      setTimeout(() => (btn.textContent = original), 2200);
    });
  });

  /* ---------- Blog tag filters (bookmarkable as /blog/#life) ---------- */
  const filters = document.querySelector('[data-filters]');
  if (filters) {
    const buttons = [...filters.querySelectorAll('[data-filter]')];
    const items = [...document.querySelectorAll('.posts__item[data-tags]')];
    const years = [...document.querySelectorAll('[data-year]')];
    const empty = document.querySelector('[data-filter-empty]');
    const apply = (tag, push) => {
      if (tag && !buttons.some((b) => b.dataset.filter === tag)) tag = '';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === tag)));
      let shown = 0;
      items.forEach((li) => {
        const ok = !tag || li.dataset.tags.split(' ').includes(tag);
        li.hidden = !ok;
        if (ok) shown++;
      });
      years.forEach((y) => (y.hidden = !y.querySelector('.posts__item:not([hidden])')));
      if (empty) empty.hidden = shown > 0;
      if (push) history.replaceState(null, '', tag ? `#${tag}` : location.pathname + location.search);
    };
    buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter, true)));
    const fromHash = () => apply(decodeURIComponent(location.hash.slice(1)).toLowerCase(), false);
    window.addEventListener('hashchange', fromHash);
    fromHash();
  }

  /* ---------- For anyone who opens the developer tools ---------- */
  try {
    const repo = body.dataset.repo;
    console.log(
      '%cHi, I\'m Lawrence.%c\nThanks for looking under the hood. No framework here: one Node build script, plain JS and a lot of CSS.\nPress ⌘K (or Ctrl K) to search, ? for shortcuts.' + (repo ? `\nSource: ${repo}` : ''),
      'font: 700 16px system-ui; color: #2b45e0',
      'font: 13px/1.5 system-ui'
    );
  } catch (e) {}
})();
