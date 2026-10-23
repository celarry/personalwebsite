// The shop floor in the hero: a cart that plans routes with A* around the page text,
// and reroutes when a wandering shopper steps into its path.
(() => {
  const hero = document.querySelector('[data-floor]');
  if (!hero) return;
  const canvas = hero.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const out = {
    searched: hero.querySelector('[data-searched]'),
    route: hero.querySelector('[data-route]'),
    reroutes: hero.querySelector('[data-reroutes]'),
  };
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = reduceMq.matches;

  const BASE_LIST = ['milk', 'eggs', 'rice', 'tofu', 'bread', 'apples', 'coffee', 'noodles', 'bok choy', 'dumplings', 'soy sauce', 'oranges', 'kimchi', 'yoghurt'];
  const TZ = document.body.dataset.tz || 'Australia/Melbourne';
  const PLACE = document.body.dataset.place || 'Melbourne';
  const OPEN_HOUR = 7;
  const CLOSE_HOUR = 22;

  // Seasonal shop floors. Dates are for the festival day itself; each shows for a window around it.
  const SEASONS = {
    lunar: {
      days: { 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11' },
      before: 7,
      after: 15,
      list: ['mandarins', 'nian gao', 'dumplings', 'red packets', 'pomelo', 'pineapple tarts', 'bok choy', 'oranges'],
      tray: 'mandarins',
      note: 'Happy Lunar New Year. The shelves are stocked with mandarins.',
    },
    midautumn: {
      days: { 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12', 2031: '10-01', 2032: '09-19' },
      before: 10,
      after: 2,
      list: ['mooncakes', 'pomelo', 'oolong tea', 'taro', 'osmanthus', 'lotus paste', 'persimmons'],
      tray: 'mooncakes',
      note: 'Happy Mid-Autumn Festival. Mooncakes are in stock.',
    },
    christmas: {
      list: ['cherries', 'mangoes', 'prawns', 'pavlova', 'candy canes', 'gingerbread', 'ham'],
      tray: 'pavlova',
      note: 'Merry Christmas. Cherries and mangoes are in season.',
    },
  };
  const TRAY = ['bubble tea', 'dumplings', 'Tim Tams', 'durian', 'mangoes'];
  // Prices in Australian dollars, for the receipt.
  const PRICES = {
    'bubble tea': 7.5, dumplings: 12, 'Tim Tams': 5.5, durian: 24, mangoes: 5, mandarins: 4.5, mooncakes: 9.8, pavlova: 14,
    milk: 3.1, eggs: 6.2, rice: 9, tofu: 3.5, bread: 4.5, apples: 4.9, coffee: 11, noodles: 4.8, 'bok choy': 3.2,
    'soy sauce': 4.2, oranges: 4.5, kimchi: 7.5, yoghurt: 6, cherries: 12, prawns: 22, 'candy canes': 3, gingerbread: 6.5,
    ham: 28, pomelo: 6, 'oolong tea': 9, taro: 4, osmanthus: 7, 'lotus paste': 8, persimmons: 5.5, 'nian gao': 7.8,
    'red packets': 2.5, 'pineapple tarts': 11,
  };
  const GRUMBLES = ['…fine.', 'it’s late.', 'one trip.', 'mm.', 'five more minutes', 'really?'];

  const hash = () => location.hash.slice(1).toLowerCase();
  function localParts(d = new Date()) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
    return { y: Number(o.year), md: `${o.month}-${o.day}`, m: Number(o.month), d: Number(o.day), h: Number(o.hour) };
  }
  function isClosed() {
    if (hash() === 'closed') return true;
    if (hash() === 'open') return false;
    const h = localParts().h;
    return h >= CLOSE_HOUR || h < OPEN_HOUR;
  }
  function currentSeason() {
    const forced = hash();
    if (SEASONS[forced]) return forced;
    const t = localParts();
    if (t.m === 12 && t.d <= 26) return 'christmas';
    const today = Date.UTC(t.y, t.m - 1, t.d);
    for (const key of ['lunar', 'midautumn']) {
      const sz = SEASONS[key];
      for (const y of [t.y, t.y + 1, t.y - 1]) {
        if (!sz.days[y]) continue;
        const [mm, dd] = sz.days[y].split('-').map(Number);
        const diff = (today - Date.UTC(y, mm - 1, dd)) / 86400000;
        if (diff >= -sz.before && diff <= sz.after) return key;
      }
    }
    return '';
  }
  let closed = false;
  let season = '';
  let SHOPPING_LIST = BASE_LIST;
  const SQRT2 = Math.SQRT2;
  const NB = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
  ];

  // Grid state
  let W = 0, H = 0, DPR = 1, CELL = 22, cols = 0, rows = 0, ox = 0, oy = 0;
  let grid = new Uint8Array(0); // 0 free, 1 shelf, 2 text, 3 reserved
  let shelves = [];
  let staticLayer = null;
  let colors = {};

  // Actors
  const cart = { x: 0, y: 0, cell: 0, path: [], pi: 0, goal: -1, retry: -1, mode: 'shop', wait: 0, item: null };
  const shopper = { x: 0, y: 0, cell: 0, path: [], pi: 0, pause: 0 };
  let items = [];
  let listIndex = 0;
  let explored = { cells: [], t0: 0 };
  let pin = null;
  let stats = { searched: 0, route: 0, reroutes: 0 };
  let parkCell = -1;
  let bubble = null; // { text, until }
  let order = null; // the visitor's own shopping trip
  let travelled = 0; // pixels the cart has moved during the current order
  let running = false, visible = true, raf = 0, last = 0, ready = false;

  const idx = (c, r) => r * cols + c;
  const colOf = (i) => i % cols;
  const rowOf = (i) => (i / cols) | 0;
  const cx = (i) => ox + colOf(i) * CELL + CELL / 2;
  const cy = (i) => oy + rowOf(i) * CELL + CELL / 2;
  const inb = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    colors = { paper: v('--paper'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), rule: v('--rule'), shelf: v('--shelf'), route: v('--route'), red: v('--atk'), gold: v('--festive') };
    const [r, g, b] = hexToRgb(colors.paper);
    colors.dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (hex, a) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  // ---------- Building the floor ----------
  function markRect(x, y, w, h, val, pad) {
    const c0 = Math.floor((x - ox) / CELL) - pad;
    const r0 = Math.floor((y - oy) / CELL) - pad;
    const c1 = Math.floor((x + w - ox - 0.01) / CELL) + pad;
    const r1 = Math.floor((y + h - oy - 0.01) / CELL) + pad;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (inb(c, r) && grid[idx(c, r)] === 0) grid[idx(c, r)] = val;
  }

  function obstacleRects(el) {
    if (el.dataset.obstacle === 'box') return [el.getBoundingClientRect()];
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1);
    return rects.length ? rects : [el.getBoundingClientRect()];
  }

  function regionFree(c, r, w, h, margin) {
    for (let y = r - margin; y < r + h + margin; y++)
      for (let x = c - margin; x < c + w + margin; x++) {
        if (!inb(x, y)) return false;
        if (grid[idx(x, y)] !== 0) return false;
      }
    return true;
  }

  function placeShelves() {
    shelves = [];
    const wide = W >= 760;
    // Keep the left margin clear: shelves start at the text's left edge.
    let minCol = cols;
    for (let i = 0; i < grid.length; i++) if (grid[i] === 2) minCol = Math.min(minCol, colOf(i));
    const startCol = wide && minCol < cols ? Math.max(2, minCol) : 2;
    if (wide) {
      const sw = 2;
      const sh = Math.max(4, Math.min(8, Math.round(rows * 0.2)));
      for (let r = 2; r + sh <= rows - 2; r += sh + 3) {
        for (let c = startCol; c + sw <= cols - 2; c += sw + 5) {
          if (regionFree(c, r, sw, sh, 1)) shelves.push({ c, r, w: sw, h: sh });
        }
      }
    } else {
      const sh = 1;
      const sw = 5;
      let row = 0;
      for (let r = 2; r + sh <= rows - 2; r += sh + 3, row++) {
        for (let c = 1 + (row % 2) * 3; c + sw <= cols - 1; c += sw + 3) {
          if (regionFree(c, r, sw, sh, 1)) shelves.push({ c, r, w: sw, h: sh });
        }
      }
    }
    for (const s of shelves) for (let r = s.r; r < s.r + s.h; r++) for (let c = s.c; c < s.c + s.w; c++) grid[idx(c, r)] = 1;
  }

  // Text boxes can wall off little pockets of floor. Block everything outside the largest
  // open area so the cart, shopper and items always share one connected floor.
  function keepLargestRegion() {
    const comp = new Int32Array(cols * rows).fill(-1);
    let best = -1, bestSize = 0, id = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== 0 || comp[i] !== -1) continue;
      const q = [i];
      comp[i] = id;
      for (let h = 0; h < q.length; h++) {
        const c = colOf(q[h]), r = rowOf(q[h]);
        for (let k = 0; k < 4; k++) {
          const nc = c + NB[k][0], nr = r + NB[k][1];
          if (!inb(nc, nr)) continue;
          const n = idx(nc, nr);
          if (grid[n] === 0 && comp[n] === -1) { comp[n] = id; q.push(n); }
        }
      }
      if (q.length > bestSize) { bestSize = q.length; best = id; }
      id++;
    }
    for (let i = 0; i < grid.length; i++) if (grid[i] === 0 && comp[i] !== best) grid[i] = 3;
  }

  function nearestFree(start, avoid) {
    if (start >= 0 && grid[start] === 0 && !(avoid && avoid(start))) return start;
    const seen = new Uint8Array(cols * rows);
    const q = [start];
    seen[start] = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      if (grid[i] === 0 && !(avoid && avoid(i))) return i;
      const c = colOf(i), r = rowOf(i);
      for (let k = 0; k < 4; k++) {
        const nc = c + NB[k][0], nr = r + NB[k][1];
        if (!inb(nc, nr)) continue;
        const n = idx(nc, nr);
        if (!seen[n]) { seen[n] = 1; q.push(n); }
      }
    }
    return -1;
  }

  function freeCells(filter) {
    const out = [];
    for (let i = 0; i < grid.length; i++) if (grid[i] === 0 && (!filter || filter(i))) out.push(i);
    return out;
  }

  const dist = (a, b) => Math.hypot(colOf(a) - colOf(b), rowOf(a) - rowOf(b));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  function nextToShelf(i) {
    const c = colOf(i), r = rowOf(i);
    for (let k = 0; k < 4; k++) {
      const nc = c + NB[k][0], nr = r + NB[k][1];
      if (inb(nc, nr) && grid[idx(nc, nr)] === 1) return true;
    }
    return false;
  }

  function spawnItem() {
    if (closed) return;
    const taken = new Set(items.map((it) => it.cell));
    let cands = freeCells((i) => nextToShelf(i) && !taken.has(i) && dist(i, cart.cell) > 6 && items.every((it) => dist(i, it.cell) > 5));
    if (!cands.length) cands = freeCells((i) => !taken.has(i) && dist(i, cart.cell) > 4);
    if (!cands.length) return;
    const name = SHOPPING_LIST[listIndex++ % SHOPPING_LIST.length];
    items.push({ cell: pick(cands), name });
  }

  function build() {
    const rect = hero.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    CELL = W < 640 ? 18 : 22;
    cols = Math.floor(W / CELL);
    rows = Math.floor(H / CELL);
    ox = (W - cols * CELL) / 2;
    oy = (H - rows * CELL) / 2;
    grid = new Uint8Array(cols * rows);

    hero.querySelectorAll('[data-obstacle]').forEach((el) => {
      const isText = el.dataset.obstacle !== 'box';
      for (const r of obstacleRects(el)) markRect(r.left - rect.left, r.top - rect.top, r.width, r.height, isText ? 2 : 3, isText ? 0 : 0);
    });
    placeShelves();
    keepLargestRegion();

    // Cart starts near the bottom right, the shopper somewhere else.
    cart.cell = nearestFree(idx(Math.max(1, cols - 4), Math.max(1, rows - 4)));
    if (cart.cell < 0) return false;
    parkCell = cart.cell;
    cart.x = cx(cart.cell);
    cart.y = cy(cart.cell);
    cart.path = [];
    cart.pi = 0;
    cart.mode = closed ? 'sleep' : 'shop';
    cart.wait = 0.4;
    cart.item = null;
    cart.retry = -1;
    order = null;
    bubble = null;

    const far = freeCells((i) => dist(i, cart.cell) > Math.min(cols, rows) * 0.5);
    shopper.cell = far.length ? pick(far) : nearestFree(idx(2, rows - 3));
    shopper.x = cx(shopper.cell);
    shopper.y = cy(shopper.cell);
    shopper.path = [];
    shopper.pause = 0.5;

    items = [];
    for (let k = 0; k < 3; k++) spawnItem();
    explored = { cells: [], t0: 0 };
    pin = null;
    renderStatic();
    return true;
  }

  function renderStatic() {
    readColors();
    staticLayer = staticLayer || document.createElement('canvas');
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
    const g = staticLayer.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, H);
    // Floor dots, skipped under text so the words stay clean.
    g.fillStyle = colors.rule;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const v = grid[idx(c, r)];
        if (v === 2 || v === 3 || v === 1) continue;
        g.beginPath();
        g.arc(ox + c * CELL + CELL / 2, oy + r * CELL + CELL / 2, 1.1, 0, Math.PI * 2);
        g.fill();
      }
    // Shelves
    for (const s of shelves) {
      const x = ox + s.c * CELL + 2, y = oy + s.r * CELL + 2, w = s.w * CELL - 4, h = s.h * CELL - 4;
      g.fillStyle = colors.shelf;
      g.strokeStyle = colors.rule;
      g.lineWidth = 1;
      roundRect(g, x, y, w, h, 4);
      g.fill();
      g.stroke();
      // Product facings along the shelf
      g.strokeStyle = colors.rule;
      g.beginPath();
      if (s.h > s.w) {
        for (let yy = y + CELL * 0.75; yy < y + h - 4; yy += CELL * 0.75) { g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); }
      } else {
        for (let xx = x + CELL * 0.75; xx < x + w - 4; xx += CELL * 0.75) { g.moveTo(xx, y + 4); g.lineTo(xx, y + h - 4); }
      }
      g.stroke();
    }
    drawDecor(g);
  }

  // Seasonal decorations, drawn once with the shelves.
  function drawDecor(g) {
    if (!season) return;
    const shelfBox = (s) => ({ x: ox + s.c * CELL + 2, y: oy + s.r * CELL + 2, w: s.w * CELL - 4, h: s.h * CELL - 4 });
    if (season === 'lunar' || season === 'midautumn') {
      const every = season === 'lunar' ? 2 : 3;
      shelves.forEach((s, k) => {
        if (k % every) return;
        const b = shelfBox(s);
        const x = b.x + b.w / 2;
        const top = b.y + 2;
        const rx = CELL * (season === 'lunar' ? 0.34 : 0.36);
        const ry = CELL * (season === 'lunar' ? 0.44 : 0.34);
        const yc = top + 6 + ry;
        g.strokeStyle = colors.ink3;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, top - 4);
        g.lineTo(x, yc - ry);
        g.stroke();
        g.fillStyle = season === 'lunar' ? colors.red : colors.gold;
        g.beginPath();
        g.ellipse(x, yc, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = season === 'lunar' ? colors.gold : colors.red;
        g.fillRect(x - rx * 0.45, yc - ry - 1.5, rx * 0.9, 3);
        g.fillRect(x - rx * 0.45, yc + ry - 1.5, rx * 0.9, 3);
        g.strokeStyle = season === 'lunar' ? colors.gold : colors.red;
        g.beginPath();
        g.moveTo(x, yc + ry + 1);
        g.lineTo(x, yc + ry + 7);
        g.stroke();
      });
    }
    if (season === 'midautumn') {
      // A full moon in the emptiest top corner.
      const r = CELL * 1.2;
      for (let c = cols - 3; c > cols / 2; c--) {
        const cc = Math.round(c);
        if (regionFree(cc - 2, 5, 4, 4, 0)) {
          const x = ox + cc * CELL, y = oy + 7 * CELL;
          g.fillStyle = rgba(colors.gold, colors.dark ? 0.55 : 0.35);
          g.beginPath();
          g.arc(x, y, r, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = rgba(colors.gold, 0.8);
          g.lineWidth = 1.5;
          g.stroke();
          break;
        }
      }
    }
    if (season === 'christmas') {
      shelves.forEach((s) => {
        const b = shelfBox(s);
        const vertical = b.h > b.w;
        const len = vertical ? b.h : b.w;
        const n = Math.max(2, Math.round(len / (CELL * 0.7)));
        const step = len / n;
        g.strokeStyle = colors.gold;
        g.lineWidth = 1.6;
        g.beginPath();
        for (let k = 0; k < n; k++) {
          if (vertical) {
            const y0 = b.y + k * step;
            g.moveTo(b.x, y0);
            g.quadraticCurveTo(b.x + 6, y0 + step / 2, b.x, y0 + step);
          } else {
            const x0 = b.x + k * step;
            g.moveTo(x0, b.y);
            g.quadraticCurveTo(x0 + step / 2, b.y + 6, x0 + step, b.y);
          }
        }
        g.stroke();
        g.fillStyle = colors.red;
        for (let k = 1; k < n; k += 2) {
          g.beginPath();
          if (vertical) g.arc(b.x, b.y + k * step, 2.2, 0, Math.PI * 2);
          else g.arc(b.x + k * step, b.y, 2.2, 0, Math.PI * 2);
          g.fill();
        }
      });
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ---------- A* ----------
  function astar(start, goal, dynBlocked) {
    const N = cols * rows;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = [];
    const order = [];
    const gc = colOf(goal), gr = rowOf(goal);
    const hfn = (i) => {
      const dx = Math.abs(colOf(i) - gc), dy = Math.abs(rowOf(i) - gr);
      return (dx + dy + (SQRT2 - 2) * Math.min(dx, dy)) * 1.001;
    };
    const blocked = (i) => grid[i] !== 0 || (dynBlocked && i !== goal && i !== start && dynBlocked(i));
    const push = (i, f) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const end = heap.pop();
      if (heap.length) {
        heap[0] = end;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    gScore[start] = 0;
    push(start, hfn(start));
    let found = start === goal;
    while (heap.length && !found) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      order.push(cur);
      if (cur === goal) { found = true; break; }
      const c = colOf(cur), r = rowOf(cur);
      for (const [dx, dy, cost] of NB) {
        const nc = c + dx, nr = r + dy;
        if (!inb(nc, nr)) continue;
        const n = idx(nc, nr);
        if (closed[n] || blocked(n)) continue;
        if (dx && dy && (blocked(idx(c + dx, r)) || blocked(idx(c, r + dy)))) continue; // no corner cutting
        const ng = gScore[cur] + cost;
        if (ng < gScore[n]) {
          gScore[n] = ng;
          came[n] = cur;
          push(n, ng + hfn(n));
        }
      }
    }
    // Cells that were discovered but never expanded: the open set when the search stopped.
    const frontier = [];
    for (let i = 0; i < N; i++) if (gScore[i] !== Infinity && !closed[i]) frontier.push(i);
    if (!found) return { path: null, order, frontier };
    const path = [goal];
    let k = goal;
    while (k !== start) { k = came[k]; if (k < 0) return { path: null, order, frontier }; path.push(k); }
    path.reverse();
    return { path, order, frontier };
  }

  function shopperBlocks(i) {
    return Math.abs(colOf(i) - colOf(shopper.cell)) <= 1 && Math.abs(rowOf(i) - rowOf(shopper.cell)) <= 1;
  }

  function plan(goal, { reroute = false } = {}) {
    if (goal < 0) return false;
    const res = astar(cart.cell, goal, shopperBlocks);
    explored = { cells: res.order, frontier: res.frontier, t0: performance.now() };
    stats.searched = res.order.length;
    if (order) order.searched += res.order.length;
    if (!res.path) {
      cart.path = [];
      updateReadout();
      if (!astar(cart.cell, goal).path) {
        // Walled in by shelves or text: drop this goal and move on.
        cart.retry = -1;
        if (cart.item && cart.item.cell === goal) {
          const lost = cart.item;
          items = items.filter((it) => it !== lost);
          cart.item = null;
          if (lost.mine && order) order.skipped.push(lost.name);
          else spawnItem();
        }
        if (cart.mode === 'pin') { cart.mode = 'idle'; pin = null; }
        cart.wait = 0.3;
      } else {
        // Only the shopper is in the way. Wait a moment and try again.
        cart.retry = goal;
        cart.wait = 0.4;
      }
      return false;
    }
    cart.retry = -1;
    cart.path = res.path;
    cart.pi = 1;
    cart.goal = goal;
    // Let people watch the search before the cart moves.
    cart.wait = reroute ? 0.15 : 0.55;
    stats.route = res.path.length - 1;
    if (reroute) stats.reroutes++;
    updateReadout();
    if (reduce) {
      cart.cell = goal;
      cart.x = cx(goal);
      cart.y = cy(goal);
      cart.pi = cart.path.length;
    }
    return true;
  }

  function nextItem() {
    const mine = items.filter((it) => it.mine);
    if (!mine.length && order) return finishOrder();
    if (!mine.length && closed) return goHome();
    if (!items.length) spawnItem();
    // Head for the closest item: the visitor's own picks first.
    let best = null, bestD = Infinity;
    for (const it of mine.length ? mine : items) {
      const d = dist(it.cell, cart.cell);
      if (d < bestD) { bestD = d; best = it; }
    }
    if (!best) return;
    cart.item = best;
    cart.mode = best.mine ? 'order' : 'shop';
    pin = null;
    plan(best.cell);
  }

  function goHome() {
    cart.item = null;
    pin = null;
    if (cart.cell === parkCell || parkCell < 0) {
      cart.mode = 'sleep';
      cart.path = [];
      return;
    }
    cart.mode = 'home';
    if (!plan(parkCell) || reduce) cart.mode = 'sleep';
  }

  function grumble() {
    if (!closed) return;
    bubble = { text: GRUMBLES[(Math.random() * GRUMBLES.length) | 0], until: performance.now() + 2600 };
  }

  function updateReadout() {
    if (out.searched) out.searched.textContent = stats.searched;
    if (out.route) out.route.textContent = stats.route;
    if (out.reroutes) out.reroutes.textContent = stats.reroutes;
  }

  // ---------- Simulation ----------
  function moveAlong(actor, speed, dt) {
    let budget = speed * CELL * dt;
    while (budget > 0 && actor.pi < actor.path.length) {
      const target = actor.path[actor.pi];
      const tx = cx(target), ty = cy(target);
      const dx = tx - actor.x, dy = ty - actor.y;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        actor.x = tx; actor.y = ty; actor.cell = target; actor.pi++; budget -= d;
        if (actor === cart) return 'step';
      } else {
        actor.x += (dx / d) * budget; actor.y += (dy / d) * budget; budget = 0;
      }
    }
    return actor.pi >= actor.path.length ? 'done' : 'moving';
  }

  function updateShopper(dt) {
    if (closed) return;
    if (shopper.pause > 0) { shopper.pause -= dt; return; }
    if (shopper.pi >= shopper.path.length) {
      // Wander to a nearby aisle cell.
      const cands = freeCells((i) => { const d = dist(i, shopper.cell); return d > 4 && d < 14 && !shopperBlocksCart(i); });
      if (!cands.length) { shopper.pause = 1; return; }
      const res = astar(shopper.cell, pick(cands));
      if (res.path) { shopper.path = res.path; shopper.pi = 1; } else shopper.pause = 0.6;
      return;
    }
    // Shoppers step aside rather than walk through the cart.
    const nextCell = shopper.path[shopper.pi];
    if (Math.abs(colOf(nextCell) - colOf(cart.cell)) <= 1 && Math.abs(rowOf(nextCell) - rowOf(cart.cell)) <= 1) {
      shopper.pause = 0.4;
      return;
    }
    if (moveAlong(shopper, 1.5, dt) === 'done') shopper.pause = 0.6 + Math.random() * 1.4;
  }
  const shopperBlocksCart = (i) => i === cart.cell;

  function updateCart(dt) {
    if (cart.mode === 'sleep') return;
    if (cart.wait > 0) { cart.wait -= dt; return; }
    if (cart.retry >= 0 && !cart.path.length) {
      const g = cart.retry;
      cart.retry = -1;
      plan(g, { reroute: true });
      return;
    }
    if (cart.pi >= cart.path.length || !cart.path.length) {
      arrive();
      return;
    }
    // Look a few steps ahead. If the shopper is in the way, plan around them.
    for (let k = cart.pi; k < Math.min(cart.path.length, cart.pi + 4); k++) {
      if (shopperBlocks(cart.path[k]) && cart.path[k] !== cart.goal) {
        if (!plan(cart.goal, { reroute: true })) cart.wait = 0.4;
        return;
      }
    }
    const bx = cart.x, by = cart.y;
    const res = moveAlong(cart, closed ? 4 : 5.2, dt);
    if (order) travelled += Math.hypot(cart.x - bx, cart.y - by);
    if (res === 'done') arrive();
  }

  function arrive() {
    if ((cart.mode === 'shop' || cart.mode === 'order') && cart.item && cart.cell === cart.item.cell) {
      const got = cart.item;
      items = items.filter((it) => it !== got);
      cart.item = null;
      if (got.mine && order) order.got.push(got.name);
      else spawnItem();
      cart.wait = 0.5;
      cart.path = [];
      return;
    }
    if (cart.mode === 'pin') {
      cart.mode = 'idle';
      cart.wait = closed ? 1 : 1.6;
      cart.path = [];
      return;
    }
    if (cart.mode === 'home') {
      cart.mode = 'sleep';
      cart.path = [];
      return;
    }
    nextItem();
  }

  // ---------- The visitor's own shopping ----------
  function addItem(name, at) {
    if (!ready) return;
    const mine = items.filter((it) => it.mine);
    if (mine.length >= 8) return;
    const taken = new Set(items.map((it) => it.cell));
    const avoid = (i) => taken.has(i) || i === cart.cell || shopperBlocks(i);
    let cell = -1;
    if (at != null) cell = nearestFree(at, avoid);
    if (cell < 0) {
      let cands = freeCells((i) => nextToShelf(i) && !avoid(i) && dist(i, cart.cell) > 4);
      if (!cands.length) cands = freeCells((i) => !avoid(i));
      cell = cands.length ? pick(cands) : -1;
    }
    if (cell < 0) return;
    items.push({ cell, name, mine: true });
    if (!order) {
      order = { got: [], skipped: [], searched: 0, reroutes: stats.reroutes, started: performance.now(), night: closed };
      travelled = 0;
      hideReceipt();
    }
    live(`Added ${name}. The cart is on its way.`);
    if (cart.mode === 'sleep' || cart.mode === 'home' || cart.mode === 'idle' || cart.mode === 'shop') {
      grumble();
      cart.path = [];
      cart.wait = closed ? 0.6 : 0.2;
      if (cart.mode === 'sleep' || cart.mode === 'home') cart.mode = 'idle';
      if (cart.mode === 'shop') cart.mode = 'idle';
    }
    if (reduce) runInstant();
  }

  // Without animation, do the whole trip at once and print the receipt.
  function runInstant() {
    let guard = 20;
    while (items.some((it) => it.mine) && guard--) {
      nextItem();
      if (cart.item && cart.cell === cart.item.cell) arrive();
      else if (cart.item) { const lost = cart.item; items = items.filter((it) => it !== lost); order.skipped.push(lost.name); cart.item = null; }
    }
    if (order) {
      travelled = order.got.length * CELL * 8; // rough distance; there was no movement to measure
      finishOrder();
    }
    draw(performance.now());
  }

  function finishOrder() {
    const o = order;
    order = null;
    if (o && o.got.length) printReceipt(o);
    if (closed) goHome();
    else if (!reduce) { cart.mode = 'shop'; cart.wait = 0.8; cart.path = []; }
  }

  const receiptEl = hero.querySelector('[data-receipt]');
  const liveEl = hero.querySelector('[data-floor-live]');
  const live = (t) => { if (liveEl) liveEl.textContent = t; };
  const money = (n) => n.toFixed(2);
  function hideReceipt() {
    if (receiptEl) receiptEl.hidden = true;
  }
  function printReceipt(o) {
    if (!receiptEl) return;
    const counts = {};
    o.got.forEach((n) => (counts[n] = (counts[n] || 0) + 1));
    const lines = Object.entries(counts).map(([n, q]) => ({ n: q > 1 ? `${n} ×${q}` : n, p: (PRICES[n] ?? 4) * q }));
    const total = lines.reduce((a, l) => a + l.p, 0);
    const metres = (travelled / CELL) * 0.5;
    const when = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
      .format(new Date())
      .replace(/\s?([ap])m$/i, ' $1m');
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const row = (a, b, cls = '') => `<p class="receipt__row ${cls}"><span>${esc(a)}</span><span>${esc(b)}</span></p>`;
    receiptEl.innerHTML = `<div class="receipt__paper">
      <p class="receipt__store">Lawrence’s</p>
      <p class="receipt__sub">Corner store, ${esc(PLACE)}</p>
      <p class="receipt__sub">${esc(when)}</p>
      <hr>
      ${lines.map((l) => row(l.n, money(l.p))).join('')}
      <hr>
      ${row('Total', `$${money(total)}`, 'receipt__total')}
      ${row('Includes GST', money(total / 11))}
      <hr>
      ${row('Walked', `${metres.toFixed(1)} m`)}
      ${row('Cells searched', o.searched)}
      ${row('Reroutes', stats.reroutes - o.reroutes)}
      ${row('Cashier', 'A*')}
      ${o.night ? '<p class="receipt__note">After-hours service. The cart would like you to know it was asleep.</p>' : ''}
      ${o.skipped.length ? `<p class="receipt__note">Couldn’t reach: ${esc(o.skipped.join(', '))}.</p>` : ''}
      <p class="receipt__thanks">Thanks for shopping!</p>
    </div>
    <button type="button" class="receipt__done" data-receipt-done>Done</button>`;
    receiptEl.hidden = false;
    receiptEl.classList.remove('is-printing');
    void receiptEl.offsetWidth;
    receiptEl.classList.add('is-printing');
    receiptEl.querySelector('[data-receipt-done]').addEventListener('click', hideReceipt);
    live(`Receipt printed: ${o.got.length} item${o.got.length === 1 ? '' : 's'}, total $${money(total)}.`);
  }

  // ---------- Drawing ----------
  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (staticLayer) ctx.drawImage(staticLayer, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // Cells A* looked at: revealed in search order, then fading.
    const cells = explored.cells;
    if (cells.length) {
      const age = now - explored.t0;
      const reveal = reduce ? 0 : 420;
      const fade = reduce ? Infinity : 1700;
      for (let k = 0; k < cells.length; k++) {
        const at = (k / cells.length) * reveal;
        if (age < at) break;
        const a = reduce ? 0.13 : 0.2 * (1 - Math.min(1, (age - at) / fade));
        if (a <= 0.002) continue;
        ctx.fillStyle = rgba(colors.route, a);
        const i = cells[k];
        ctx.fillRect(ox + colOf(i) * CELL + 1.5, oy + rowOf(i) * CELL + 1.5, CELL - 3, CELL - 3);
      }
      // The open set, outlined, once the search has finished.
      if (explored.frontier && age >= reveal) {
        const a = reduce ? 0.3 : 0.45 * (1 - Math.min(1, (age - reveal) / fade));
        if (a > 0.002) {
          ctx.strokeStyle = rgba(colors.route, a);
          ctx.lineWidth = 1;
          for (const i of explored.frontier) ctx.strokeRect(ox + colOf(i) * CELL + 2.5, oy + rowOf(i) * CELL + 2.5, CELL - 5, CELL - 5);
        }
      }
    }

    // Route still to travel
    const searchDone = reduce || now - explored.t0 > 420;
    if (searchDone && cart.path.length && (cart.pi < cart.path.length || reduce)) {
      ctx.strokeStyle = colors.route;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (reduce) {
        ctx.moveTo(cx(cart.path[0]), cy(cart.path[0]));
        for (let k = 1; k < cart.path.length; k++) ctx.lineTo(cx(cart.path[k]), cy(cart.path[k]));
      } else {
        ctx.moveTo(cart.x, cart.y);
        for (let k = cart.pi; k < cart.path.length; k++) ctx.lineTo(cx(cart.path[k]), cy(cart.path[k]));
      }
      ctx.stroke();
    }

    // Items
    ctx.font = `600 ${CELL < 20 ? 11 : 12}px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    for (const it of items) {
      const x = cx(it.cell), y = cy(it.cell);
      const target = it === cart.item;
      ctx.fillStyle = it.mine ? colors.route : colors.ink;
      ctx.fillRect(x - 4, y - 4, 8, 8);
      if (target) {
        ctx.strokeStyle = colors.route;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x - 8, y - 8, 16, 16);
      }
      const tw = ctx.measureText(it.name).width;
      const right = x + 10 + tw < W - 6;
      ctx.fillStyle = rgba(colors.paper, 0.85);
      ctx.fillRect(right ? x + 8 : x - 12 - tw, y - 8, tw + 4, 16);
      ctx.fillStyle = target || it.mine ? colors.ink : colors.ink3;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillText(it.name, right ? x + 10 : x - 10, y + 0.5);
    }

    // Pin where someone clicked
    if (pin != null && cart.mode === 'pin') {
      const x = cx(pin), y = cy(pin);
      ctx.strokeStyle = colors.route;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y);
      ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
      ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4);
      ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12);
      ctx.stroke();
    }

    // Shopper (gone home when the shop is closed)
    if (!closed) {
      ctx.strokeStyle = colors.ink2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(shopper.x, shopper.y, CELL * 0.26, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lights off: dim the floor, leaving a pool of light around the cart.
    if (closed) {
      const shade = colors.dark ? 'rgba(0,0,0,0.32)' : 'rgba(18,26,44,0.11)';
      const grad = ctx.createRadialGradient(cart.x, cart.y, CELL * 1.2, cart.x, cart.y, CELL * 5);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, shade);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Cart
    const pulse = reduce ? 0 : (Math.sin(now / 260) + 1) / 2;
    ctx.fillStyle = rgba(colors.route, 0.16 + pulse * 0.08);
    ctx.beginPath();
    ctx.arc(cart.x, cart.y, CELL * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.route;
    ctx.beginPath();
    ctx.arc(cart.x, cart.y, CELL * 0.27, 0, Math.PI * 2);
    ctx.fill();

    if (closed) drawClosedSign();
    if (cart.mode === 'sleep') {
      ctx.font = `600 ${CELL < 20 ? 11 : 12}px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = colors.ink3;
      for (let k = 0; k < 3; k++) {
        const t = reduce ? k / 3 : ((now / 2400 + k / 3) % 1);
        ctx.globalAlpha = reduce ? 0.8 : Math.sin(t * Math.PI);
        ctx.fillText('z', cart.x + CELL * 0.4 + t * 10, cart.y - CELL * 0.4 - t * 22);
      }
      ctx.globalAlpha = 1;
    }
    if (bubble && now < bubble.until) {
      ctx.font = `600 ${CELL < 20 ? 11 : 12}px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
      const tw = ctx.measureText(bubble.text).width;
      const bx = Math.min(W - tw - 18, Math.max(6, cart.x - tw / 2 - 7));
      const by = cart.y - CELL * 1.5 - 10;
      ctx.fillStyle = colors.paper;
      ctx.strokeStyle = colors.ink3;
      ctx.lineWidth = 1;
      roundRect(ctx, bx, by, tw + 14, 20, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = colors.ink;
      ctx.textAlign = 'left';
      ctx.fillText(bubble.text, bx + 7, by + 10.5);
    }
  }

  // A little hanging sign above the cart's parking spot.
  function drawClosedSign() {
    if (parkCell < 0) return;
    const x0 = cx(parkCell), y0 = cy(parkCell);
    ctx.save();
    ctx.font = `760 15px Anybody, system-ui, sans-serif`;
    const t1 = 'Closed';
    const t2 = `Opens ${OPEN_HOUR} am`;
    const w1 = ctx.measureText(t1).width;
    ctx.font = `600 11px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
    const w2 = ctx.measureText(t2).width;
    const w = Math.max(w1, w2) + 22, h = 42;
    // Try above the cart, then below, then either side; skip the sign rather than cover any text.
    const spots = [
      [x0 - w / 2, y0 - CELL * 2.4 - h],
      [x0 - w / 2, y0 + CELL * 1.6],
      [x0 - w - CELL * 1.2, y0 - h / 2],
      [x0 + CELL * 1.2, y0 - h / 2],
    ];
    const clear = (x, y) => {
      if (x < 6 || y < 14 || x + w > W - 6 || y + h > H - 6) return false;
      for (let r = Math.floor((y - 14 - oy) / CELL); r <= Math.floor((y + h - oy) / CELL); r++)
        for (let c = Math.floor((x - ox) / CELL); c <= Math.floor((x + w - ox) / CELL); c++)
          if (inb(c, r) && (grid[idx(c, r)] === 2 || grid[idx(c, r)] === 3)) return false;
      return true;
    };
    const spot = spots.find(([x, y]) => clear(x, y));
    if (!spot) { ctx.restore(); return; }
    const [x, y] = spot;
    ctx.translate(x + w / 2, y);
    ctx.rotate(-0.04);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 10, 0); ctx.lineTo(0, -12); ctx.lineTo(w / 2 - 10, 0);
    ctx.stroke();
    ctx.fillStyle = colors.paper;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.5;
    roundRect(ctx, -w / 2, 0, w, h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `760 15px Anybody, system-ui, sans-serif`;
    ctx.fillText(t1, 0, 14);
    ctx.font = `600 11px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
    ctx.fillStyle = colors.ink2;
    ctx.fillText(t2, 0, 30);
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    updateShopper(dt);
    updateCart(dt);
    draw(now);
    if (running) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running || reduce || !visible || document.hidden || !ready) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const captionEl = hero.querySelector('[data-caption]');
  const captionDefault = captionEl ? captionEl.innerHTML : '';
  function updateCaption() {
    if (!captionEl) return;
    const note = season ? ` ${SEASONS[season].note}` : '';
    if (closed) {
      const time = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date()).replace(/\s?([ap])m$/i, ' $1m');
      captionEl.textContent = `The shop is closed for the night. It's ${time} in ${PLACE} and the cart is asleep. Click anywhere, or add something to the list, to wake it for one trip.${note}`;
    } else {
      captionEl.innerHTML = captionDefault + (note ? ` ${note.trim()}` : '');
    }
  }

  const trayEl = hero.querySelector('[data-tray]');
  function renderTray() {
    if (!trayEl) return;
    const names = [...TRAY];
    if (season && !names.includes(SEASONS[season].tray)) names.push(SEASONS[season].tray);
    const holder = trayEl.querySelector('[data-tray-items]');
    holder.innerHTML = names.map((n) => `<button type="button" class="tray__item" data-item="${n}"><i aria-hidden="true"></i>${n}</button>`).join('');
    trayEl.hidden = false;
    holder.querySelectorAll('[data-item]').forEach(bindTrayItem);
  }

  function init() {
    stop();
    season = currentSeason();
    SHOPPING_LIST = season ? [...SEASONS[season].list, ...BASE_LIST.slice(0, 4)] : BASE_LIST;
    listIndex = 0;
    closed = isClosed();
    updateCaption();
    ready = build();
    if (!ready) return;
    if (reduce) {
      if (!closed) nextItem();
      draw(performance.now());
    } else {
      start();
    }
  }

  // Check the shop's hours every minute; rebuild when it opens or closes.
  setInterval(() => {
    if (isClosed() !== closed || currentSeason() !== season) init();
    else if (closed) updateCaption();
  }, 60000);

  // ---------- Input ----------
  hero.addEventListener('click', (e) => {
    if (!ready || e.target.closest('a, button, input, label, textarea, select, [data-tray], [data-receipt]')) return;
    if (window.getSelection && String(window.getSelection()).length) return;
    const rect = hero.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left - ox) / CELL);
    const r = Math.floor((e.clientY - rect.top - oy) / CELL);
    if (!inb(c, r)) return;
    const goal = nearestFree(idx(c, r), shopperBlocks);
    if (goal < 0) return;
    pin = goal;
    if (cart.mode === 'sleep') grumble();
    cart.mode = 'pin';
    cart.item = null;
    if (plan(goal)) cart.wait = reduce ? 0 : closed ? 0.8 : 0.45;
    if (reduce) {
      draw(performance.now());
      if (closed) setTimeout(() => { goHome(); draw(performance.now()); }, 1600);
    }
  });

  // ---------- The item tray: tap to add, or drag onto the floor ----------
  function bindTrayItem(btn) {
    let startX = 0, startY = 0, dragging = false, ghost = null, id = null;
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      startX = e.clientX; startY = e.clientY; dragging = false; id = e.pointerId;
      btn.setPointerCapture(id);
    });
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 6) {
        dragging = true;
        ghost = document.createElement('div');
        ghost.className = 'tray__ghost';
        ghost.innerHTML = `<i></i>${btn.dataset.item}`;
        document.body.appendChild(ghost);
      }
      if (ghost) ghost.style.transform = `translate(${e.clientX + 8}px, ${e.clientY - 14}px)`;
    });
    const end = (e, cancel) => {
      if (e.pointerId !== id) return;
      id = null;
      if (ghost) { ghost.remove(); ghost = null; }
      if (!dragging || cancel) return;
      const rect = hero.getBoundingClientRect();
      const c = Math.floor((e.clientX - rect.left - ox) / CELL);
      const r = Math.floor((e.clientY - rect.top - oy) / CELL);
      if (inb(c, r) && !trayEl.contains(document.elementFromPoint(e.clientX, e.clientY))) addItem(btn.dataset.item, idx(c, r));
      btn.dataset.dragged = '1';
    };
    btn.addEventListener('pointerup', (e) => end(e, false));
    btn.addEventListener('pointercancel', (e) => end(e, true));
    btn.addEventListener('click', () => {
      if (btn.dataset.dragged) { delete btn.dataset.dragged; return; }
      addItem(btn.dataset.item);
    });
  }

  window.floorDemo = {
    shop() {
      if (!ready) return;
      if (closed) {
        addItem(pick(TRAY));
        return;
      }
      cart.wait = 0;
      nextItem();
      if (reduce) draw(performance.now());
    },
    addItem,
  };

  // ---------- Lifecycle ----------
  let resizeTimer = 0;
  let lastW = 0;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = hero.getBoundingClientRect().width;
      // Mobile browsers fire resize when the address bar hides; only rebuild on width changes or big height changes.
      if (Math.abs(w - lastW) < 2 && Math.abs(hero.getBoundingClientRect().height - H) < 120) return;
      lastW = w;
      init();
    }, 180);
  };
  window.addEventListener('resize', onResize);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    visible ? start() : stop();
  }).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduceMq.addEventListener('change', () => { reduce = reduceMq.matches; init(); });

  // Re-colour when the theme changes.
  const recolour = () => { if (ready) { renderStatic(); if (reduce) draw(performance.now()); } };
  new MutationObserver(recolour).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);

  const go = () => {
    lastW = hero.getBoundingClientRect().width;
    renderTray();
    init();
    // Arriving from "Send the cart shopping" on another page.
    if (location.hash === '#shop') setTimeout(() => window.floorDemo.shop(), 300);
  };
  window.addEventListener('hashchange', () => {
    if (location.hash === '#shop') window.floorDemo.shop();
    else if (['closed', 'open', ...Object.keys(SEASONS)].includes(hash())) { renderTray(); init(); }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  else window.addEventListener('load', go);
})();
