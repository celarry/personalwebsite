// The homepage's smaller pieces: skills that show where they were used, the countdown,
// and notes behind each book cover.
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
    const a = e.target.closest('.proof a[href^="#"], .related a[href^="#"], .related__list a[href^="#"]');
    if (!a) return;
    const target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (!target || target.tagName !== 'DETAILS') return;
    if (location.hash === a.getAttribute('href')) {
      e.preventDefault();
      target.open = true;
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  });

  /* ---------- On this page ----------
     The list in the right margin (wide screens only) shows once the live demo has scrolled
     away, and steps aside whenever something full-width, like an opened project's demo,
     passes behind it. Jumping and marking the current section are in site.js. */
  const toc = document.querySelector('[data-toc-home]');
  const live = document.getElementById('live');
  if (toc) {
    let queued = false;
    const update = () => {
      queued = false;
      if (getComputedStyle(toc).display === 'none') return;
      const box = toc.getBoundingClientRect();
      const pastHero = !live || live.getBoundingClientRect().bottom < box.top;
      const wide = [...document.querySelectorAll('.row[open] .demo, .row[open] .gallery-strip')];
      const blocked = wide.some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > box.left && r.top < box.bottom + 16 && r.bottom > box.top - 16;
      });
      // Keep it while it has focus, so a keyboard user never loses the link they're on.
      const show = (pastHero && !blocked) || toc.contains(document.activeElement);
      toc.classList.toggle('is-shown', show);
    };
    const queue = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    document.addEventListener('toggle', queue, true); // rows opening and closing
    toc.addEventListener('focusout', () => setTimeout(queue));
    update();
  }

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

})();
