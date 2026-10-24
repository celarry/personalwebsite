// The homepage's smaller pieces: skills that show where they were used, the countdown,
// the timeline, and notes behind each book cover.
(() => {
  const body = document.body;
  const tz = body.dataset.tz || 'Australia/Melbourne';
  // Today's date where I am, as YYYY-MM-DD.
  const today = () => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); }
  };

  /* ---------- Toggles that open one panel at a time ---------- */
  // Buttons with aria-controls; opening one closes the others in the same group.
  function panels(buttons) {
    const close = (btn) => {
      btn.setAttribute('aria-expanded', 'false');
      const p = document.getElementById(btn.getAttribute('aria-controls'));
      if (p) p.hidden = true;
    };
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        buttons.forEach(close);
        if (open) return;
        btn.setAttribute('aria-expanded', 'true');
        const p = document.getElementById(btn.getAttribute('aria-controls'));
        if (p) p.hidden = false;
      });
    });
  }
  panels([...document.querySelectorAll('[data-skill]')]);
  panels([...document.querySelectorAll('[data-book]')]);

  // Links to a project open its row, even when the address already points at it.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.proof a[href^="#"], .related a[href^="#"], .related__list a[href^="#"], .tl a[href^="#"]');
    if (!a) return;
    const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!target || target.tagName !== 'DETAILS') return;
    if (location.hash === a.getAttribute('href')) {
      e.preventDefault();
      target.open = true;
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });

  /* ---------- Countdown ---------- */
  const cd = document.querySelector('[data-countdown]');
  if (cd) {
    const n = cd.querySelector('[data-countdown-n]');
    const text = cd.querySelector('[data-countdown-text]');
    const update = () => {
      const days = Math.round((Date.parse(cd.dataset.countdown) - Date.parse(today())) / 86400000);
      cd.hidden = days < 0;
      if (days < 0) return;
      n.textContent = String(days);
      text.textContent = days === 0 ? `Today's the day. I fly to ${cd.dataset.place}.` : `${days === 1 ? 'day' : 'days'} until I fly to ${cd.dataset.place}, on ${cd.dataset.when}.`;
      cd.classList.toggle('is-today', days === 0);
    };
    update();
    setInterval(update, 60000);
  }

  /* ---------- Timeline ---------- */
  const tl = document.querySelector('[data-tl]');
  if (tl) {
    const items = [...tl.querySelectorAll('.tl__item')];
    // Mark today, and anything still to come.
    const t = today();
    const future = (d) => (d.length === 7 ? d > t.slice(0, 7) : d > t);
    let marked = false;
    items.forEach((li) => {
      const ahead = future(li.dataset.date);
      li.classList.toggle('is-future', ahead);
      if (ahead && !marked) {
        marked = true;
        const now = document.createElement('li');
        now.className = 'tl__today is-in';
        now.innerHTML = '<span class="tl__dot" aria-hidden="true"></span><p>Today</p>';
        // Keep the year heading above the marker when the next thing is in a new year.
        const prev = li.previousElementSibling;
        tl.insertBefore(now, prev && prev.classList.contains('tl__year') && prev.textContent.trim() !== t.slice(0, 4) ? prev : li);
      }
    });
    if (!marked) tl.insertAdjacentHTML('beforeend', '<li class="tl__today is-in"><span class="tl__dot" aria-hidden="true"></span><p>Today</p></li>');

    // Filters by kind.
    const bar = document.querySelector('[data-tl-filters]');
    if (bar) {
      bar.hidden = false;
      const buttons = [...bar.querySelectorAll('button')];
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const kind = btn.dataset.kind;
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
        items.forEach((li) => (li.hidden = kind !== 'all' && li.dataset.kind !== kind));
        // Hide year headings with nothing under them.
        tl.querySelectorAll('.tl__year').forEach((y) => {
          let el = y.nextElementSibling;
          let any = false;
          while (el && !el.classList.contains('tl__year')) {
            if (el.classList.contains('tl__item') && !el.hidden) any = true;
            el = el.nextElementSibling;
          }
          y.hidden = !any;
        });
        // Anything revealed by a filter should show straight away.
        items.forEach((li) => li.classList.add('is-in'));
        tl.querySelectorAll('.tl__year, .tl__today').forEach((li) => li.classList.add('is-in'));
      });
    }
  }
})();
