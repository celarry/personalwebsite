// The store: a cart that plans routes with A* (or Dijkstra, or greedy best-first, if you
// switch it), and reroutes when a wandering shopper steps into its path.
(() => {
  const store = document.querySelector('[data-floor]');
  if (!store) return;
  const floorEl = store.querySelector('.store__floor');
  const canvas = floorEl.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const readoutEl = store.querySelector('[data-readout]');
  const captionEl = store.querySelector('[data-caption]');
  const trayEl = store.querySelector('[data-tray]');
  const algoEl = store.querySelector('[data-algo]');
  const receiptEl = store.querySelector('[data-receipt]');
  const liveEl = store.querySelector('[data-floor-live]');
  const whichEl = store.querySelector('[data-which]');
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = reduceMq.matches;
  if (!window.StoreEngine) return;

  const BASE_LIST = ['milk', 'eggs', 'rice', 'tofu', 'bread', 'apples', 'coffee', 'noodles', 'bok choy', 'dumplings', 'soy sauce', 'oranges', 'kimchi', 'yoghurt'];
  const TZ = document.body.dataset.tz || 'Australia/Melbourne';
  const PLACE = document.body.dataset.place || 'Melbourne';
  const OPEN_HOUR = 7;
  const CLOSE_HOUR = 22;

  // Seasonal stock. Dates are for the festival day itself; each shows for a window around it.
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
    halloween: {
      list: ['pumpkin', 'lollies', 'toffee apples', 'chocolate', 'popcorn', 'fairy floss', 'caramel'],
      tray: 'lollies',
      note: 'Happy Halloween. The lollies are by the door.',
      grumbles: ['boo.', '…fine.', 'spooky hours.', 'it’s late.'],
    },
    easter: {
      // Easter Sunday; shows from the week before until Easter Monday.
      days: { 2027: '03-28', 2028: '04-16', 2029: '04-01', 2030: '04-21', 2031: '04-13', 2032: '03-28' },
      before: 7,
      after: 1,
      list: ['hot cross buns', 'Easter eggs', 'chocolate bilby', 'chocolate bunny', 'lamb', 'carrots'],
      tray: 'hot cross buns',
      note: 'Happy Easter. Hot cross buns are fresh out of the oven.',
    },
  };
  const TRAY = ['bubble tea', 'dumplings', 'Tim Tams', 'durian', 'mangoes'];
  // Prices in Australian dollars, for the tickets and the receipt.
  const PRICES = {
    'bubble tea': 7.5, dumplings: 12, 'Tim Tams': 5.5, durian: 24, mangoes: 5, mandarins: 4.5, mooncakes: 9.8, pavlova: 14,
    milk: 3.1, eggs: 6.2, rice: 9, tofu: 3.5, bread: 4.5, apples: 4.9, coffee: 11, noodles: 4.8, 'bok choy': 3.2,
    'soy sauce': 4.2, oranges: 4.5, kimchi: 7.5, yoghurt: 6, cherries: 12, prawns: 22, 'candy canes': 3, gingerbread: 6.5,
    ham: 28, pomelo: 6, 'oolong tea': 9, taro: 4, osmanthus: 7, 'lotus paste': 8, persimmons: 5.5, 'nian gao': 7.8,
    'red packets': 2.5, 'pineapple tarts': 11, pumpkin: 4.5, lollies: 3.5, 'toffee apples': 4, chocolate: 5, popcorn: 3.2,
    'fairy floss': 3, caramel: 4.2, 'hot cross buns': 6.5, 'Easter eggs': 8, 'chocolate bilby': 5.5, 'chocolate bunny': 6,
    lamb: 26, carrots: 2.5,
  };
  const GRUMBLES = ['…fine.', 'it’s late.', 'one trip.', 'mm.', 'five more minutes', 'really?'];

  // The three searches differ only in how they rank the next square to look at:
  // distance travelled (g), a guess at the distance left (h), or both.
  const ALGOS = {
    astar: { name: 'A*', wg: 1, wh: 1, note: 'It heads for the goal but still guarantees the shortest route.' },
    dijkstra: { name: 'Dijkstra', wg: 1, wh: 0, note: 'It ignores where the goal is, so it spreads out in every direction.' },
    greedy: { name: 'Greedy search', wg: 0, wh: 1, note: 'It rushes at the goal and checks very little, but the route can come out longer.' },
  };
  let algo = 'astar';
  let storeAlgo = false; // the current search was picked by the store, not the visitor

  // ---------- Which store ----------
  // The first visit gets the original. After that, each visit gets one you haven't seen yet.
  // Stores you've seen are remembered in this browser only, for the /stores/ page.
  const STORES = window.StoreEngine.count;
  const SEEN_KEY = 'storesSeen';
  const readSeen = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]').filter((n) => Number.isInteger(n)));
    } catch (e) {
      return new Set();
    }
  };
  const markSeen = (n) => {
    const seen = readSeen();
    seen.add(n);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].sort((a, b) => a - b))); } catch (e) {}
    return seen;
  };
  const storeFromHash = () => {
    const m = location.hash.match(/^#store-(\d{1,3})$/i);
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= STORES ? n - 1 : -1;
  };
  function pickStore(exclude) {
    const seen = readSeen();
    if (!seen.size && exclude < 0) return 0;
    const all = [...Array(STORES).keys()].filter((i) => i !== exclude);
    const fresh = all.filter((i) => !seen.has(i + 1));
    const pool = fresh.length ? fresh : all;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let storeIndex = storeFromHash() >= 0 ? storeFromHash() : pickStore(-1);

  const hash = () => location.hash.slice(1).toLowerCase();
  function localParts(d = new Date()) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    const o = Object.fromEntries(f.formatToParts(d).map((p) => [p.type, p.value]));
    return { y: Number(o.year), m: Number(o.month), d: Number(o.day), h: Number(o.hour) };
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
    if (t.m === 10 && t.d >= 24) return 'halloween';
    const today = Date.UTC(t.y, t.m - 1, t.d);
    for (const key of ['lunar', 'easter', 'midautumn']) {
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
  let festive = ''; // the season, but only in the stores that decorate for it
  let SHOPPING_LIST = BASE_LIST;
  const SQRT2 = Math.SQRT2;
  const NB = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
  ];

  // Grid state
  let W = 0, H = 0, DPR = 1, CELL = 22, cols = 0, rows = 0, ox = 0, oy = 0;
  let grid = new Uint8Array(0); // 0 free, 1 shelf, 3 unreachable, 4 fixture, 5 checkout
  let shelves = [];
  let fixtures = []; // the checkout counter and display tables
  let layout = null; // the current store, from stores.js
  let staticLayer = null;
  let colors = {};

  // Actors
  const cart = { x: 0, y: 0, cell: 0, path: [], pi: 0, goal: -1, retry: -1, mode: 'shop', wait: 0, item: null };
  const shopper = { x: 0, y: 0, cell: 0, path: [], pi: 0, pause: 0 };
  let items = [];
  let listIndex = 0;
  let explored = { cells: [], frontier: [], t0: 0, reveal: 0 };
  let pin = null;
  let stats = { searched: 0, route: 0, reroutes: 0, algo: 'astar' };
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
  const LABEL_FONT = (px) => `600 ${px}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;

  function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    colors = { paper: v('--paper'), panel: v('--panel'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), rule: v('--rule'), shelf: v('--shelf'), sunk: v('--sunk'), route: v('--route'), red: v('--atk'), gold: v('--festive'), pumpkin: v('--pumpkin') };
    const [r, g, b] = hexToRgb(colors.panel);
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

  // ---------- Building the store ----------
  function regionFree(c, r, w, h, margin) {
    for (let y = r - margin; y < r + h + margin; y++)
      for (let x = c - margin; x < c + w + margin; x++) {
        if (!inb(x, y)) return false;
        if (grid[idx(x, y)] !== 0) return false;
      }
    return true;
  }

  function fill(rect, val) {
    for (let r = rect.r; r < rect.r + rect.h; r++) for (let c = rect.c; c < rect.c + rect.w; c++) if (inb(c, r)) grid[idx(c, r)] = val;
  }

  // The layout comes from stores.js: one of a hundred stores.
  function layOut() {
    layout = window.StoreEngine.build(storeIndex, cols, rows);
    grid = layout.grid;
    shelves = layout.shelves;
    fixtures = layout.fixtures;
    parkCell = layout.park;
    // Some stores sell their own things.
    // Ordinary supermarkets decorate for the season; the themed stores keep to their theme.
    // Asking for a season by name (#halloween) decorates whichever store you're in.
    festive = season && (layout.seasonal || hash() === season) ? season : '';
    SHOPPING_LIST = layout.stock ? (festive ? [...layout.stock, ...SEASONS[festive].list.slice(0, 2)] : layout.stock) : festive ? [...SEASONS[festive].list, ...BASE_LIST.slice(0, 4)] : BASE_LIST;
    listIndex = 0;
  }

  // Shelves can wall off little pockets of floor. Block everything outside the largest
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
    if (start < 0 || start >= grid.length) return -1;
    if (grid[start] === 0 && !(avoid && avoid(start))) return start;
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
      if (inb(nc, nr) && (grid[idx(nc, nr)] === 1 || (grid[idx(nc, nr)] === 4 && !(layout && layout.stockOnShelves)))) return true;
    }
    return false;
  }

  function spawnItem() {
    if (closed) return;
    const taken = new Set(items.map((it) => it.cell));
    // Not in the top row, where the aisle numbers are.
    let cands = freeCells((i) => rowOf(i) > 1 && nextToShelf(i) && !taken.has(i) && dist(i, cart.cell) > 6 && items.every((it) => dist(i, it.cell) > 5));
    if (!cands.length) cands = freeCells((i) => rowOf(i) > 1 && !taken.has(i) && dist(i, cart.cell) > 4);
    if (!cands.length) return;
    const name = SHOPPING_LIST[listIndex++ % SHOPPING_LIST.length];
    items.push({ cell: pick(cands), name });
  }

  function build() {
    const rect = floorEl.getBoundingClientRect();
    W = floorEl.clientWidth;
    H = floorEl.clientHeight;
    if (W < 40 || H < 40 || !rect.width) return false;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    CELL = W < 640 ? 18 : 22;
    cols = Math.floor(W / CELL);
    rows = Math.floor(H / CELL);
    ox = (W - cols * CELL) / 2;
    oy = (H - rows * CELL) / 2;
    grid = new Uint8Array(cols * rows);

    layOut();
    keepLargestRegion();

    // The cart lives by the checkout.
    parkCell = nearestFree(parkCell);
    cart.cell = parkCell;
    if (cart.cell < 0) return false;
    cart.x = cx(cart.cell);
    cart.y = cy(cart.cell);
    cart.path = [];
    cart.pi = 0;
    cart.goal = -1;
    cart.mode = closed ? 'sleep' : 'shop';
    cart.wait = 0.6;
    cart.item = null;
    cart.retry = -1;
    order = null;
    bubble = null;

    const far = freeCells((i) => dist(i, cart.cell) > Math.min(cols, rows) * 0.5);
    shopper.cell = far.length ? pick(far) : nearestFree(idx(2, rows - 3));
    shopper.x = cx(shopper.cell);
    shopper.y = cy(shopper.cell);
    shopper.path = [];
    shopper.pi = 0;
    shopper.pause = 0.5;
    shopper.away = !layout.shopper;

    items = [];
    for (let k = 0; k < 3; k++) spawnItem();
    explored = { cells: [], frontier: [], t0: 0, reveal: 0 };
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
    window.StoreEngine.renderStatic(g, layout, { ox, oy, cell: CELL, W, H }, colors);
    drawDecor(g);
  }

  // Seasonal decorations, drawn once with the shelves.
  function drawDecor(g) {
    if (!festive) return;
    const shelfBox = (s) => ({ x: ox + s.c * CELL + 2, y: oy + s.r * CELL + 2, w: s.w * CELL - 4, h: s.h * CELL - 4 });
    if (festive === 'lunar' || festive === 'midautumn') {
      const every = festive === 'lunar' ? 2 : 3;
      shelves.forEach((s, k) => {
        if (k % every) return;
        const b = shelfBox(s);
        const x = b.x + b.w / 2;
        const top = b.y + 2;
        const rx = CELL * (festive === 'lunar' ? 0.34 : 0.36);
        const ry = CELL * (festive === 'lunar' ? 0.44 : 0.34);
        const yc = top + 6 + ry;
        g.strokeStyle = colors.ink3;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, top - 4);
        g.lineTo(x, yc - ry);
        g.stroke();
        g.fillStyle = festive === 'lunar' ? colors.red : colors.gold;
        g.beginPath();
        g.ellipse(x, yc, rx, ry, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = festive === 'lunar' ? colors.gold : colors.red;
        g.fillRect(x - rx * 0.45, yc - ry - 1.5, rx * 0.9, 3);
        g.fillRect(x - rx * 0.45, yc + ry - 1.5, rx * 0.9, 3);
        g.strokeStyle = festive === 'lunar' ? colors.gold : colors.red;
        g.beginPath();
        g.moveTo(x, yc + ry + 1);
        g.lineTo(x, yc + ry + 7);
        g.stroke();
      });
    }
    if (festive === 'midautumn') {
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
    if (festive === 'halloween') {
      shelves.forEach((s, k) => {
        const b = shelfBox(s);
        const vertical = b.h > b.w;
        if (k % 2 === 0) {
          // A pumpkin at the foot of the shelf.
          const x = vertical ? b.x + b.w / 2 : b.x + b.w - 2;
          const y = vertical ? b.y + b.h - 2 : b.y + b.h / 2;
          const rx = CELL * 0.38, ry = CELL * 0.3;
          g.fillStyle = colors.pumpkin;
          g.beginPath();
          g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(0,0,0,0.2)';
          g.lineWidth = 1;
          g.beginPath();
          g.ellipse(x, y, rx * 0.45, ry, 0, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = '#4f7a3c';
          g.fillRect(x - 1.5, y - ry - 3, 3, 4);
        }
        if (k % 3 === 1) {
          // A cobweb in the top corner.
          const x = b.x, y = b.y, r = CELL * 0.95;
          g.strokeStyle = rgba(colors.ink3, 0.55);
          g.lineWidth = 0.8;
          g.beginPath();
          for (let a = 0; a <= 3; a++) {
            const t = (a / 3) * (Math.PI / 2);
            g.moveTo(x, y);
            g.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
          }
          for (const f of [0.45, 0.8]) {
            g.moveTo(x + r * f, y);
            for (let a = 1; a <= 3; a++) {
              const t = (a / 3) * (Math.PI / 2);
              const mid = ((a - 0.5) / 3) * (Math.PI / 2);
              g.quadraticCurveTo(x + Math.cos(mid) * r * f * 0.82, y + Math.sin(mid) * r * f * 0.82, x + Math.cos(t) * r * f, y + Math.sin(t) * r * f);
            }
          }
          g.stroke();
        }
      });
    }
    if (festive === 'easter') {
      const pastels = ['#f2b8c6', '#b9d8f2', '#bfe3c5', '#f4dc9a', '#d6c4f0'];
      shelves.forEach((s, k) => {
        const b = shelfBox(s);
        const vertical = b.h > b.w;
        const count = 1 + (k % 2);
        for (let e = 0; e < count; e++) {
          const x = vertical ? b.x + b.w / 2 + (count > 1 ? (e ? 8 : -6) : 0) : b.x + b.w - 10 - e * 15;
          const y = vertical ? b.y + b.h - 6 - e * 4 : b.y + b.h / 2 + (e ? 3 : -2);
          const rx = CELL * 0.27, ry = CELL * 0.35;
          g.fillStyle = pastels[(k * 2 + e) % pastels.length];
          g.beginPath();
          g.ellipse(x, y, rx, ry, (e ? 0.3 : -0.2), 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.8)';
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(x - rx * 0.8, y);
          for (let z = 1; z <= 4; z++) g.lineTo(x - rx * 0.8 + (z * rx * 1.6) / 4, y + (z % 2 ? -2 : 1));
          g.stroke();
        }
      });
    }
    if (festive === 'christmas') {
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

  // ---------- Search ----------
  // One function for all three: f = wg·g + wh·h. Greedy search never revisits a square
  // once it has a parent, which is why its routes can wander.
  function search(start, goal, dynBlocked, mode = 'astar') {
    const { wg, wh } = ALGOS[mode];
    const greedy = wg === 0;
    const N = cols * rows;
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    const heap = [];
    const order = [];
    const gc = colOf(goal), gr = rowOf(goal);
    const hfn = (i) => {
      const dx = Math.abs(colOf(i) - gc), dy = Math.abs(rowOf(i) - gr);
      return (dx + dy + (SQRT2 - 2) * Math.min(dx, dy)) * 1.001; // octile distance, ties broken towards the goal
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
    push(start, wh * hfn(start));
    let found = start === goal;
    while (heap.length && !found) {
      const [, cur] = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      order.push(cur);
      if (cur === goal) { found = true; break; }
      const c = colOf(cur), r = rowOf(cur);
      for (const [dx, dy, cost] of NB) {
        const nc = c + dx, nr = r + dy;
        if (!inb(nc, nr)) continue;
        const n = idx(nc, nr);
        if (done[n] || blocked(n)) continue;
        if (dx && dy && (blocked(idx(c + dx, r)) || blocked(idx(c, r + dy)))) continue; // no corner cutting
        const ng = gScore[cur] + cost;
        if (greedy ? gScore[n] !== Infinity : ng >= gScore[n]) continue;
        gScore[n] = ng;
        came[n] = cur;
        push(n, wg * ng + wh * hfn(n));
      }
    }
    // Squares that were discovered but never expanded: the open set when the search stopped.
    const frontier = [];
    for (let i = 0; i < N; i++) if (gScore[i] !== Infinity && !done[i]) frontier.push(i);
    if (!found) return { path: null, order, frontier };
    const path = [goal];
    let k = goal;
    while (k !== start) { k = came[k]; if (k < 0) return { path: null, order, frontier }; path.push(k); }
    path.reverse();
    return { path, order, frontier };
  }

  const routeLength = (path) => {
    let d = 0;
    for (let k = 1; k < path.length; k++) d += colOf(path[k]) !== colOf(path[k - 1]) && rowOf(path[k]) !== rowOf(path[k - 1]) ? SQRT2 : 1;
    return d;
  };

  function shopperBlocks(i) {
    if (shopper.away || closed) return false;
    return Math.abs(colOf(i) - colOf(shopper.cell)) <= 1 && Math.abs(rowOf(i) - rowOf(shopper.cell)) <= 1;
  }

  function plan(goal, { reroute = false } = {}) {
    if (goal < 0) return false;
    const res = search(cart.cell, goal, shopperBlocks, algo);
    const reveal = reduce ? 0 : Math.min(1100, 240 + res.order.length * 0.9);
    explored = { cells: res.order, frontier: res.frontier, t0: performance.now(), reveal };
    stats.searched = res.order.length;
    stats.algo = algo;
    if (order) order.searched += res.order.length;
    if (!res.path) {
      cart.path = [];
      updateReadout();
      if (!search(cart.cell, goal).path) {
        // Walled in: drop this goal and move on.
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
    cart.wait = reroute ? 0.12 + reveal / 2000 : 0.15 + reveal / 1000;
    stats.route = routeLength(res.path);
    // How long the shortest route would have been, so a worse one can say by how much.
    stats.best = algo === 'astar' ? stats.route : (() => {
      const best = search(cart.cell, goal, shopperBlocks, 'astar');
      return best.path ? routeLength(best.path) : stats.route;
    })();
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
    if (!mine.length && order) return headToCheckout();
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

  // With the visitor's items on board, the cart goes back to the till to print a receipt.
  function headToCheckout() {
    cart.item = null;
    pin = null;
    if (cart.cell === parkCell || parkCell < 0) return finishOrder();
    cart.mode = 'checkout';
    if (!plan(parkCell) || reduce) finishOrder();
  }

  function grumble() {
    if (!closed) return;
    const lines = (festive && SEASONS[festive].grumbles) || GRUMBLES;
    bubble = { text: lines[(Math.random() * lines.length) | 0], until: performance.now() + 2600 };
  }

  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  function updateReadout() {
    if (!readoutEl || !stats.searched) return;
    const a = ALGOS[stats.algo];
    // Each square is about half a metre, the same scale as the receipt.
    const m = (d) => `${(d * 0.5).toFixed(1)} metres`;
    const route = stats.route ? ` and found a route ${m(stats.route)} long` : '';
    const longer = stats.route && stats.best && stats.route - stats.best > 0.05;
    const compare = stats.algo === 'astar' || !stats.route ? '' : longer ? ` <b>That's ${m(stats.route - stats.best)} longer than the shortest route</b>, which A* would have found.` : ' This time that matched the shortest route.';
    const rr = stats.reroutes ? ` The shopper has made it reroute ${stats.reroutes === 1 ? 'once' : plural(stats.reroutes, 'time')}.` : '';
    readoutEl.innerHTML = `<b>${a.name}</b> checked <b>${stats.searched}</b> squares${route}.${compare} ${a.note}${rr}`;
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
    if (closed || shopper.away) return;
    if (shopper.pause > 0) { shopper.pause -= dt; return; }
    if (shopper.pi >= shopper.path.length) {
      // Wander to a nearby aisle.
      const cands = freeCells((i) => { const d = dist(i, shopper.cell); return d > 4 && d < 14 && i !== cart.cell; });
      if (!cands.length) { shopper.pause = 1; return; }
      const res = search(shopper.cell, pick(cands));
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
      // In some stores the cart takes each thing back to the checkout before the next.
      if (layout.shuttle && !got.mine && parkCell >= 0 && cart.cell !== parkCell) {
        cart.mode = 'return';
        plan(parkCell);
        cart.wait = Math.max(cart.wait, 0.5);
      }
      return;
    }
    if (cart.mode === 'return') {
      cart.mode = 'shop';
      cart.wait = 0.7;
      cart.path = [];
      return;
    }
    if (cart.mode === 'checkout') {
      cart.path = [];
      finishOrder();
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
    if (['sleep', 'home', 'idle', 'shop', 'checkout'].includes(cart.mode)) {
      grumble();
      cart.path = [];
      cart.wait = closed ? 0.6 : 0.2;
      cart.mode = 'idle';
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
      travelled = order.got.length * CELL * 8; // a rough distance; nothing moved to measure
      headToCheckout();
    }
    draw(performance.now());
  }

  function finishOrder() {
    const o = order;
    order = null;
    if (o && o.got.length) printReceipt(o);
    if (closed) {
      if (cart.cell === parkCell) { cart.mode = 'sleep'; cart.path = []; }
      else goHome();
    } else if (!reduce) { cart.mode = 'shop'; cart.wait = 1.2; cart.path = []; }
  }

  const live = (t) => { if (liveEl) liveEl.textContent = t; };
  const money = (n) => n.toFixed(2);
  const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
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
    const row = (a, b, cls = '') => `<p class="receipt__row ${cls}"><span>${escHtml(a)}</span><span>${escHtml(b)}</span></p>`;
    receiptEl.innerHTML = `<div class="receipt__paper">
      <p class="receipt__store">Lawrence’s</p>
      <p class="receipt__sub">Corner store, ${escHtml(PLACE)}</p>
      <p class="receipt__sub">${escHtml(when)}</p>
      <hr>
      ${lines.map((l) => row(l.n, money(l.p))).join('')}
      <hr>
      ${row('Total', `$${money(total)}`, 'receipt__total')}
      ${row('Includes GST', money(total / 11))}
      <hr>
      ${row('Walked', `${metres.toFixed(1)} m`)}
      ${row('Squares searched', o.searched)}
      ${row('Reroutes', stats.reroutes - o.reroutes)}
      ${row('Cashier', ALGOS[algo].name.replace(' search', ''))}
      ${o.night ? '<p class="receipt__note">After-hours service. The cart would like you to know it was asleep.</p>' : ''}
      ${o.skipped.length ? `<p class="receipt__note">Couldn’t reach: ${escHtml(o.skipped.join(', '))}.</p>` : ''}
      <p class="receipt__thanks">Thanks for shopping!</p>
    </div>
    <button type="button" class="receipt__done" data-receipt-done>Done</button>`;
    receiptEl.hidden = false;
    receiptEl.classList.remove('is-printing');
    void receiptEl.offsetWidth;
    receiptEl.classList.add('is-printing');
    receiptEl.querySelector('[data-receipt-done]').addEventListener('click', hideReceipt);
    // On smaller screens it prints under the floor; bring it into view.
    if (window.matchMedia('(max-width: 1099px)').matches) receiptEl.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
    live(`Receipt printed: ${plural(o.got.length, 'item')}, total $${money(total)}.`);
  }

  // ---------- Drawing ----------
  function draw(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (staticLayer) ctx.drawImage(staticLayer, 0, 0);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // Lanterns, screens, steam and so on.
    if (layout) window.StoreEngine.drawLive(ctx, layout, { ox, oy, cell: CELL, W, H }, colors, reduce ? 1000 : now);

    // Squares the search looked at: revealed in the order it expanded them, then fading.
    const cells = explored.cells;
    const reveal = explored.reveal;
    if (cells.length) {
      const age = now - explored.t0;
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
    const searchDone = reduce || now - explored.t0 > reveal;
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
    ctx.font = LABEL_FONT(CELL < 20 ? 11 : 12);
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
      const right = x + 12 + tw < W - 6;
      ctx.fillStyle = rgba(colors.panel, 0.88);
      ctx.fillRect(right ? x + 8 : x - 12 - tw, y - 8, tw + 4, 16);
      ctx.fillStyle = target || it.mine ? colors.ink : colors.ink2;
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

    // Shopper (gone home when the store is closed)
    if (!closed && !shopper.away) {
      ctx.strokeStyle = colors.ink2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(shopper.x, shopper.y, CELL * 0.26, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lights off: dim the floor, leaving a pool of light around the cart.
    if (closed || layout.dark) {
      const torch = layout.torch;
      const shade = torch ? (colors.dark ? 'rgba(0,0,0,0.7)' : 'rgba(18,26,44,0.55)') : colors.dark ? 'rgba(0,0,0,0.34)' : layout.dark && !closed ? 'rgba(18,26,44,0.2)' : 'rgba(18,26,44,0.12)';
      const grad = ctx.createRadialGradient(cart.x, cart.y, CELL * (torch ? 1.5 : 1.2), cart.x, cart.y, CELL * (torch ? 4 : layout.dark && !closed ? 7 : 5));
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
      ctx.font = LABEL_FONT(CELL < 20 ? 11 : 12);
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
      ctx.font = LABEL_FONT(CELL < 20 ? 11 : 12);
      const tw = ctx.measureText(bubble.text).width;
      const bx = Math.min(W - tw - 18, Math.max(6, cart.x - tw / 2 - 7));
      const by = Math.max(6, cart.y - CELL * 1.5 - 10);
      ctx.fillStyle = colors.panel;
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

  // A little hanging sign near the checkout.
  function drawClosedSign() {
    if (parkCell < 0) return;
    const x0 = cx(parkCell), y0 = cy(parkCell);
    ctx.save();
    const t1 = 'Closed';
    const t2 = `Opens ${OPEN_HOUR} am`;
    ctx.font = '400 18px "Newsreader Display", Georgia, serif';
    const w1 = ctx.measureText(t1).width;
    ctx.font = LABEL_FONT(11);
    const w2 = ctx.measureText(t2).width;
    const w = Math.max(w1, w2) + 24, h = 44;
    // Try to the left of the cart, then above, then below, keeping clear of the
    // fixtures and their labels; skip the sign if nothing fits.
    const spots = [
      [x0 - w - CELL * 1.2, y0 - h / 2 - CELL * 0.6],
      [x0 - w / 2, y0 - CELL * 2.6 - h],
      [x0 - w / 2, y0 + CELL * 1.6],
    ];
    const overlaps = (x, y, list, pad) =>
      list.filter((f) => {
        const fx = ox + f.c * CELL - pad, fy = oy + f.r * CELL - pad - 14, fw = f.w * CELL + pad * 2, fh = f.h * CELL + pad + 14;
        return x < fx + fw && x + w > fx && y - 14 < fy + fh && y + h > fy;
      }).length;
    const inside = (x, y) => x >= 6 && y >= 16 && x + w <= W - 6 && y + h <= H - 6;
    // Never over the checkout or its label; over a shelf only if nothing else fits.
    const ok = spots.filter(([x, y]) => inside(x, y) && !overlaps(x, y, fixtures, 20));
    const spot = ok.find(([x, y]) => !overlaps(x, y, shelves, 2)) || ok[0];
    if (!spot) { ctx.restore(); return; }
    const [x, y] = spot;
    ctx.translate(x + w / 2, y);
    ctx.rotate(-0.035);
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 10, 0); ctx.lineTo(0, -12); ctx.lineTo(w / 2 - 10, 0);
    ctx.stroke();
    ctx.fillStyle = colors.panel;
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.25;
    roundRect(ctx, -w / 2, 0, w, h, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '400 18px "Newsreader Display", Georgia, serif';
    ctx.fillText(t1, 0, 16);
    ctx.font = LABEL_FONT(11);
    ctx.fillStyle = colors.ink2;
    ctx.fillText(t2, 0, 32);
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

  // ---------- Words under the floor ----------
  // On touch screens, "click" becomes "tap".
  const touch = window.matchMedia('(hover: none)').matches;
  const verb = (t) => (touch ? t.replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap') : t);
  const captionDefault = captionEl ? verb(captionEl.innerHTML) : '';
  function updateCaption() {
    if (!captionEl) return;
    const note = festive ? ` ${SEASONS[festive].note}` : '';
    if (closed) {
      const time = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).format(new Date()).replace(/\s?([ap])m$/i, ' $1m');
      captionEl.textContent = verb(`The store’s shut for the night. It’s ${time} in ${PLACE}, so the lights are down and the cart is asleep by the checkout. Click the floor or give it something from the list, and it’ll get up for one trip.${note}`);
    } else {
      // In a store that starts with another search, say so instead of claiming A*.
      const text = layout && layout.algo === 'greedy'
        ? captionDefault.replace(/The cart in this little store plans every trip with A\*[^.]*\./, 'The cart in this store plans every trip with greedy search.')
        : captionDefault;
      captionEl.innerHTML = text + note;
    }
  }

  // Which store this is. A different one turns up on the next visit.
  function showWhich(seen) {
    if (!whichEl) return;
    const root = document.body.dataset.root || './';
    const page = `${root === './' ? '' : root}stores/${document.body.dataset.preview ? 'index.html' : ''}`;
    whichEl.innerHTML = `<p>Store ${storeIndex + 1} of ${STORES}: <b>${escHtml(layout.name)}</b>. ${escHtml(layout.note)}</p>
      <p class="store__more"><a href="${page}">You've found ${seen.size} of ${STORES}</a></p>`;
    whichEl.hidden = false;
  }

  function goToStore(n) {
    if (n < 1 || n > STORES) return;
    storeIndex = n - 1;
    hideReceipt();
    init();
  }

  function renderTray() {
    if (!trayEl) return;
    const names = [...TRAY];
    if (festive && !names.includes(SEASONS[festive].tray)) names.push(SEASONS[festive].tray);
    const holder = trayEl.querySelector('[data-tray-items]');
    holder.innerHTML = names
      .map((n) => `<button type="button" class="ticket" data-item="${escHtml(n)}" aria-label="Add ${escHtml(n)} to the list">${escHtml(n)} <b>$${money(PRICES[n] ?? 4)}</b></button>`)
      .join('');
    trayEl.hidden = false;
    holder.querySelectorAll('[data-item]').forEach(bindTrayItem);
  }

  function init() {
    stop();
    season = currentSeason();
    closed = isClosed();
    ready = build();
    renderTray();
    updateCaption();
    if (!ready) return;
    if (algoEl) algoEl.hidden = false;
    // A store can ask for a particular search to start with; the next store goes back to A*.
    const want = layout.algo && ALGOS[layout.algo] ? layout.algo : storeAlgo ? 'astar' : '';
    storeAlgo = !!layout.algo;
    if (want) {
      algo = want;
      const radio = algoEl && algoEl.querySelector(`input[value="${algo}"]`);
      if (radio) radio.checked = true;
      stats.algo = algo;
    }
    updateCaption();
    showWhich(markSeen(storeIndex + 1));
    if (reduce && !closed) nextItem();
    // Draw once straight away, so the store is there even before it scrolls into view.
    draw(performance.now());
    if (!reduce) start();
  }

  // Check the store's hours every minute; rebuild when it opens or closes.
  setInterval(() => {
    if (isClosed() !== closed || currentSeason() !== season) init();
    else if (closed) updateCaption();
  }, 60000);

  // ---------- Input ----------
  const cellAt = (clientX, clientY) => {
    const rect = floorEl.getBoundingClientRect();
    const c = Math.floor((clientX - rect.left - floorEl.clientLeft - ox) / CELL);
    const r = Math.floor((clientY - rect.top - floorEl.clientTop - oy) / CELL);
    return inb(c, r) ? idx(c, r) : -1;
  };

  floorEl.addEventListener('click', (e) => {
    if (!ready || e.target.closest('[data-receipt]')) return;
    const at = cellAt(e.clientX, e.clientY);
    if (at < 0) return;
    const goal = nearestFree(at, shopperBlocks);
    if (goal < 0) return;
    pin = goal;
    if (cart.mode === 'sleep') grumble();
    cart.mode = 'pin';
    cart.item = null;
    if (plan(goal)) cart.wait = reduce ? 0 : closed ? 0.8 : cart.wait;
    if (reduce) {
      draw(performance.now());
      if (closed) setTimeout(() => { goHome(); draw(performance.now()); }, 1600);
    }
  });

  // Switching the search re-plans the current trip straight away, so the difference shows.
  if (algoEl) {
    algoEl.addEventListener('change', (e) => {
      if (!ALGOS[e.target.value]) return;
      setAlgo(e.target.value);
    });
  }
  function setAlgo(name) {
    if (!ALGOS[name]) return;
    algo = name;
    storeAlgo = false;
    const radio = algoEl && algoEl.querySelector(`input[value="${name}"]`);
    if (radio) radio.checked = true;
    if (!ready) return;
    if (cart.goal >= 0 && cart.path.length && cart.pi < cart.path.length) plan(cart.goal);
    else if (cart.mode === 'sleep') { stats.algo = algo; updateReadout(); }
    else { cart.wait = 0; cart.path = []; if (cart.mode === 'idle' || cart.mode === 'pin') cart.mode = 'shop'; nextItem(); }
    if (reduce) draw(performance.now());
    live(`Now planning with ${ALGOS[name].name}.`);
  }

  // ---------- The tickets: tap to add, or drag onto the floor ----------
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
        ghost.innerHTML = btn.innerHTML;
        document.body.appendChild(ghost);
      }
      if (ghost) ghost.style.transform = `translate(${e.clientX + 8}px, ${e.clientY - 16}px)`;
    });
    const end = (e, cancel) => {
      if (e.pointerId !== id) return;
      id = null;
      if (ghost) { ghost.remove(); ghost = null; }
      if (!dragging || cancel) return;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      const at = over && floorEl.contains(over) && !over.closest('[data-receipt]') ? cellAt(e.clientX, e.clientY) : -1;
      if (at >= 0) addItem(btn.dataset.item, at);
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
      addItem(pick(TRAY));
    },
    addItem,
    setAlgo,
    goToStore,
  };

  // ---------- Lifecycle ----------
  let resizeTimer = 0;
  let lastW = 0, lastH = 0;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = floorEl.clientWidth, h = floorEl.clientHeight;
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      lastW = w;
      lastH = h;
      init();
    }, 160);
  }).observe(floorEl);
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    visible ? start() : stop();
  }).observe(floorEl);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  reduceMq.addEventListener('change', () => { reduce = reduceMq.matches; init(); });

  // Re-colour when the theme changes.
  const recolour = () => { if (ready) { renderStatic(); if (reduce) draw(performance.now()); } };
  new MutationObserver(recolour).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', recolour);

  const goShopping = () => {
    const smooth = !reduce;
    store.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    setTimeout(() => window.floorDemo.shop(), smooth ? 450 : 0);
  };
  const go = () => {
    lastW = floorEl.clientWidth;
    lastH = floorEl.clientHeight;
    init();
    // Arriving from "Send the cart shopping" on another page.
    if (location.hash === '#shop') setTimeout(goShopping, 300);
    // Or from the list of stores.
    if (storeFromHash() >= 0) setTimeout(() => store.scrollIntoView({ block: 'center' }), 100);
  };
  window.addEventListener('hashchange', () => {
    if (location.hash === '#shop') goShopping();
    else if (storeFromHash() >= 0) { goToStore(storeFromHash() + 1); store.scrollIntoView({ block: 'center' }); }
    else if (['closed', 'open', ...Object.keys(SEASONS)].includes(hash())) init();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  else window.addEventListener('load', go);
})();
