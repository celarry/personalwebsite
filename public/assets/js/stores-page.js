// The /stores/ page: a thumbnail of every store, drawn with the same code as the homepage.
(() => {
  const E = window.StoreEngine;
  const list = document.querySelector('[data-cards]');
  if (!E || !list) return;
  const countEl = document.querySelector('[data-count]');
  const revealBtn = document.querySelector('[data-reveal]');
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || fallback); } catch (e) { return JSON.parse(fallback); }
  };
  const seen = new Set(read('storesSeen', '[]'));
  let revealed = !!read('storesRevealed', 'false');

  function colours() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    const c = { paper: v('--paper'), panel: v('--panel'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), rule: v('--rule'), shelf: v('--shelf'), route: v('--route'), red: v('--atk'), gold: v('--festive'), pumpkin: v('--pumpkin') };
    const h = c.panel.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    c.dark = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255) < 128;
    return c;
  }

  function draw() {
    const C = colours();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cols = 47, rows = 20, cell = 6;
    list.querySelectorAll('[data-n]').forEach((li) => {
      const i = Number(li.dataset.n) - 1;
      const found = seen.has(i + 1);
      const show = found || revealed;
      li.classList.toggle('is-found', found);
      li.classList.toggle('is-hidden', !show);
      const info = E.info(i);
      li.querySelector('[data-name]').textContent = show ? info.name : 'Not found yet';
      li.querySelector('a').title = show ? info.note : '';
      const cv = li.querySelector('canvas');
      cv.width = cols * cell * dpr;
      cv.height = rows * cell * dpr;
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cols * cell, rows * cell);
      if (!show) return;
      try {
        const L = E.build(i, cols, rows);
        const geom = { ox: 0, oy: 0, cell, W: cols * cell, H: rows * cell, labels: false };
        E.renderStatic(g, L, geom, C);
        E.drawLive(g, L, geom, C, 1000);
        g.fillStyle = C.route;
        g.beginPath();
        g.arc((L.park % cols) * cell + cell / 2, Math.floor(L.park / cols) * cell + cell / 2, cell * 0.35, 0, Math.PI * 2);
        g.fill();
      } catch (e) {}
    });
    if (countEl) {
      countEl.hidden = false;
      countEl.textContent = seen.size >= E.count ? `You've found all ${E.count}.` : `You've found ${seen.size} of ${E.count}.`;
    }
    if (revealBtn) {
      revealBtn.hidden = seen.size >= E.count;
      revealBtn.textContent = revealed ? "Hide the ones I haven't found" : 'Show me all of them';
    }
  }

  if (revealBtn)
    revealBtn.addEventListener('click', () => {
      revealed = !revealed;
      try { localStorage.setItem('storesRevealed', JSON.stringify(revealed)); } catch (e) {}
      draw();
    });
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  else draw();
})();
