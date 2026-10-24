// One hundred store layouts for the homepage, and the code that draws them.
//
// Each store is written for a landscape floor. On a portrait floor (phones) it's flipped
// across the diagonal, so long aisles still run the long way. Sizes are worked out from
// the floor's size, so every store fits anything from a phone (about 21 by 15 squares
// after flipping) to a desktop (about 47 by 20).
(() => {
  // ---------- Small tools ----------
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // A 3-by-5 pixel font, for the stores that spell something with their shelves.
  const FONT = {
    A: ['111', '101', '111', '101', '101'],
    H: ['101', '101', '111', '101', '101'],
    I: ['111', '010', '010', '010', '111'],
    L: ['100', '100', '100', '100', '111'],
    Q: ['111', '101', '101', '111', '001'],
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '*': ['000', '101', '010', '101', '000'],
    S: ['111', '100', '111', '001', '111'],
    G: ['111', '100', '101', '101', '111'],
  };

  // ---------- The layout builder handed to each store ----------
  // Everything is in logical (landscape) squares; build() flips it for portrait floors.
  function makeApi(cols, rows, seed) {
    const L = {
      cols, rows, rand: rng(seed),
      shelves: [], fixtures: [], decos: [], anims: [], labels: [], numbers: [],
      park: null, stock: null, shopper: true, dark: false,
    };
    const api = {
      cols, rows,
      rand: L.rand,
      int: (a, b) => a + Math.floor(L.rand() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(L.rand() * arr.length)],
      shelf(c, r, w, h, style) { if (w > 0 && h > 0) L.shelves.push({ c, r, w, h, style }); },
      fix(kind, c, r, w, h, opts = {}) { if (w > 0 && h > 0) L.fixtures.push({ kind, c, r, w, h, ...opts }); },
      deco(kind, c, r, w, h, opts = {}) { L.decos.push({ kind, c, r, w, h, ...opts }); },
      anim(kind, c, r, w = 1, h = 1, opts = {}) { L.anims.push({ kind, c, r, w, h, ...opts }); },
      label(text, c, r) { L.labels.push({ text, c, r }); },
      number(c, r, n) { L.numbers.push({ c, r, n }); },
      stock(list) { L.stock = list; },
      noShopper() { L.shopper = false; },
      lightsOff() { L.dark = true; },
      park(c, r) { L.park = { c, r }; },
      // A trip worth watching: the "Show me" button sends the cart from start to goal with this search.
      demo(start, goal, algo = 'greedy', compare = 'astar') { L.demo = { start, goal, algo, compare }; },
      // The checkout: a counter on the right with the cart's spot beside it.
      checkout({ c = cols - 3, r, len } = {}) {
        len = len || clamp(Math.floor(rows / 5), 3, 4);
        r = r ?? rows - len - 3;
        api.fix('counter', c, r, 1, len);
        api.park(c - 2, r + Math.floor(len / 2));
      },
      // Rows of shelves between x0 and x1, cut by cross aisles.
      aisles({ x0 = 3, x1 = cols - 11, y0 = 2, y1 = rows - 2, w = 2, gap = 4, cross = 1, crossW = 2, style, numbers = true, stagger = 0, endcaps = false } = {}) {
        let n = 1;
        const segs = cross + 1;
        const span = y1 - y0 - cross * crossW;
        const segH = Math.floor(span / segs);
        for (let c = x0, k = 0; c + w <= x1; c += w + gap, k++, n++) {
          let y = y0 + (stagger && k % 2 ? stagger : 0);
          for (let s = 0; s < segs; s++) {
            const h = s === segs - 1 ? y1 - y : segH;
            const hh = Math.min(h, y1 - y);
            if (hh >= 2) api.shelf(c, y, w, hh, style);
            if (endcaps && hh >= 2) api.fix('display', c, y + hh, w, 1);
            y += segH + crossW;
          }
          if (numbers) api.number(c + w / 2, Math.max(0.5, y0 - 1), n);
        }
      },
      // Shelves spelling a word in the pixel font, in the middle of the floor. These stores
      // aren't flipped on phones, so the letters stay readable; the word shrinks to fit.
      spell(text, scale = 2, kind = 'shelf') {
        const tall = rows > cols;
        const room = tall ? cols - 3 : cols - 9;
        const width = (sc) => [...text].length * 3 * sc + ([...text].length - 1) * (sc + 1);
        while (scale > 1 && (width(scale) > room || 5 * scale > rows - 6)) scale--;
        return api.word(text, tall ? cols / 2 : (cols - 7) / 2, tall ? rows * 0.4 : rows / 2, scale, kind);
      },
      // Shelves spelling a word in the pixel font, centred on (cx, cy).
      word(text, cx, cy, scale = 1, kind = 'shelf') {
        const chars = [...text];
        const wch = 3 * scale, gapc = scale + 1;
        const total = chars.length * wch + (chars.length - 1) * gapc;
        let x = Math.round(cx - total / 2);
        const y = Math.round(cy - (5 * scale) / 2);
        for (const ch of chars) {
          const g = FONT[ch];
          if (g) {
            g.forEach((line, ry) => {
              let run = -1;
              for (let rx = 0; rx <= 3; rx++) {
                const on = rx < 3 && line[rx] === '1';
                if (on && run < 0) run = rx;
                if (!on && run >= 0) {
                  if (kind === 'shelf') api.shelf(x + run * scale, y + ry * scale, (rx - run) * scale, scale, 'plain');
                  else api.fix(kind, x + run * scale, y + ry * scale, (rx - run) * scale, scale);
                  run = -1;
                }
              }
            });
          }
          x += wch + gapc;
        }
        return total;
      },
      // A maze of hedges filling the box, built by a random walk so every corner is reachable.
      maze(x0, y0, x1, y1, kind = 'hedge') {
        const w = Math.floor((x1 - x0 - 1) / 2), h = Math.floor((y1 - y0 - 1) / 2);
        if (w < 2 || h < 2) return;
        const W = w * 2 + 1, H = h * 2 + 1;
        const wall = Array.from({ length: H }, () => new Array(W).fill(true));
        const seen = Array.from({ length: h }, () => new Array(w).fill(false));
        const stack = [[0, 0]];
        seen[0][0] = true;
        wall[1][1] = false;
        while (stack.length) {
          const [cx, cy] = stack[stack.length - 1];
          const next = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .map(([dx, dy]) => [cx + dx, cy + dy, dx, dy])
            .filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny][nx]);
          if (!next.length) { stack.pop(); continue; }
          const [nx, ny, dx, dy] = next[Math.floor(L.rand() * next.length)];
          seen[ny][nx] = true;
          wall[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = false;
          wall[ny * 2 + 1][nx * 2 + 1] = false;
          stack.push([nx, ny]);
        }
        // Knock out a few extra walls so there's more than one way round.
        for (let k = 0; k < Math.floor((w * h) / 6); k++) {
          const x = 1 + Math.floor(L.rand() * (W - 2)), y = 1 + Math.floor(L.rand() * (H - 2));
          if ((x + y) % 2 === 1) wall[y][x] = false;
        }
        // Doors on the left and right.
        wall[1][0] = false;
        wall[H - 2][W - 1] = false;
        for (let y = 0; y < H; y++) {
          let run = -1;
          for (let x = 0; x <= W; x++) {
            const on = x < W && wall[y][x];
            if (on && run < 0) run = x;
            if (!on && run >= 0) { api.fix(kind, x0 + run, y0 + y, x - run, 1); run = -1; }
          }
        }
      },
      // A rectangle of shelves with gaps for doors.
      ring(c, r, w, h, doors = 2, style) {
        const dl = Math.max(2, Math.floor(w / 6));
        const mid = c + Math.floor(w / 2) - Math.floor(dl / 2);
        api.shelf(c, r, mid - c, 1, style);
        api.shelf(mid + dl, r, c + w - mid - dl, 1, style);
        if (doors > 1) {
          api.shelf(c, r + h - 1, mid - c, 1, style);
          api.shelf(mid + dl, r + h - 1, c + w - mid - dl, 1, style);
        } else api.shelf(c, r + h - 1, w, 1, style);
        api.shelf(c, r + 1, 1, h - 2, style);
        api.shelf(c + w - 1, r + 1, 1, h - 2, style);
      },
      // Boxes scattered without touching each other.
      scatter(kind, n, { x0 = 2, y0 = 2, x1 = cols - 8, y1 = rows - 2, minW = 1, maxW = 3, minH = 1, maxH = 2, margin = 1 } = {}) {
        // Keep clear of anything already on the floor, too.
        const placed = [...L.shelves, ...L.fixtures].map((o) => ({ c: o.c, r: o.r, w: o.w, h: o.h }));
        const before = placed.length;
        for (let k = 0, tries = 0; k < n && tries < n * 40; tries++) {
          const w = api.int(minW, maxW), h = api.int(minH, maxH);
          const c = api.int(x0, Math.max(x0, x1 - w)), r = api.int(y0, Math.max(y0, y1 - h));
          if (placed.some((p) => c < p.c + p.w + margin && c + w + margin > p.c && r < p.r + p.h + margin && r + h + margin > p.r)) continue;
          placed.push({ c, r, w, h });
          if (kind === 'shelf') api.shelf(c, r, w, h);
          else api.fix(kind, c, r, w, h);
          k++;
        }
        return placed.slice(before);
      },
      // Round tables with room around them.
      tables(x0, y0, x1, y1, size = 2, gap = 2, kind = 'table', opts = {}) {
        for (let r = y0; r + size <= y1; r += size + gap)
          for (let c = x0; c + size <= x1; c += size + gap) api.fix(kind, c, r, size, size, opts);
      },
    };
    return { api, L };
  }

  // ---------- The stores ----------
  const S = [];
  const store = (name, note, build, opts = {}) => S.push({ name, note, build, ...opts });
  // Ordinary supermarkets: the only ones that put up decorations for the season.
  const market = (name, note, build, opts = {}) => store(name, note, build, { seasonal: true, ...opts });
  const front = (a) => Math.max(7, Math.round(a.cols * 0.24));

  // 1. The original.
  market('The corner store', 'The first one. Aisles at the back, fruit by the door.', (a) => {
    const f = front(a);
    a.aisles({ x1: a.cols - f });
    if (a.cols >= 30) a.fix('fruit', a.cols - f + 1, 3, 3, 2);
    a.checkout();
  });
  market('Long aisles', 'No cross aisle, so every trip goes the long way round.', (a) => {
    a.aisles({ x1: a.cols - front(a), cross: 0, y1: a.rows - 3 });
    a.checkout();
  });
  market('The cut-through', 'Three cross aisles. Shortcuts everywhere.', (a) => {
    a.aisles({ x1: a.cols - front(a), cross: a.rows >= 18 ? 3 : 2, crossW: 1 });
    a.checkout();
  });
  market('Wide aisles', 'Room for two carts to pass. Rare in real life.', (a) => {
    a.aisles({ x1: a.cols - front(a), gap: 6 });
    a.checkout();
  });
  market('Tight squeeze', 'Aisles one cart wide. The shopper is a real problem here.', (a) => {
    a.aisles({ x1: a.cols - front(a), gap: 2, cross: 1 });
    a.checkout();
  });
  market('Big gondolas', 'Thick double-sided shelving, stocked both ways.', (a) => {
    a.aisles({ x1: a.cols - front(a), w: 3, gap: 4 });
    a.checkout();
  });
  market('Staggered', 'Every other aisle starts lower, so no two cross aisles line up.', (a) => {
    a.aisles({ x1: a.cols - front(a), stagger: 2, y1: a.rows - 3 });
    a.checkout();
  });
  market('Produce first', 'Fruit and veg up the front, dry goods behind.', (a) => {
    const f = Math.max(9, Math.round(a.cols * 0.36));
    a.aisles({ x1: a.cols - f });
    for (let r = 2; r + 2 <= a.rows - 6; r += 4) a.fix('fruit', a.cols - f + 2, r, 3, 2);
    for (let r = 2; r + 2 <= a.rows - 6; r += 4) if (a.cols - f + 7 < a.cols - 4) a.fix('fruit', a.cols - f + 7, r + 1, 2, 2);
    a.checkout();
  });
  market('Endcaps', 'Specials at the end of every aisle. Somebody paid for that spot.', (a) => {
    a.aisles({ x1: a.cols - front(a), endcaps: true, y1: a.rows - 4 });
    a.checkout();
  });
  market('Saturday rush', 'Every checkout open, still a queue.', (a) => {
    a.aisles({ x1: a.cols - 2, y1: a.rows - 7, cross: 0 });
    const n = Math.floor((a.cols - 6) / 5);
    for (let k = 0; k < n; k++) a.fix('counter', 3 + k * 5, a.rows - 4, 3, 1, { label: false });
    a.park(a.cols - 3, a.rows - 2);
    a.label('Checkouts', 3, a.rows - 5);
  });
  market('Self-serve', 'Six self-checkouts and one person watching them all.', (a) => {
    a.aisles({ x1: a.cols - front(a) - 2, y1: a.rows - 2 });
    const x = a.cols - front(a) + 1;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) a.fix('kiosk', x + j * 3, 3 + k * 3, 1, 1);
    a.checkout();
  });
  market('Mirror image', 'The same store twice, back to back, with the tills in the middle.', (a) => {
    const mid = Math.floor(a.cols / 2);
    a.aisles({ x0: 2, x1: mid - 3, numbers: false });
    a.aisles({ x0: mid + 3, x1: a.cols - 1, numbers: false });
    a.checkout({ c: mid, r: a.rows - 6 });
  });
  market('The frozen section', 'A long wall of freezers. The cart keeps its distance.', (a) => {
    a.fix('freezer', 2, 1, a.cols - 4, 1);
    a.aisles({ y0: 4, x1: a.cols - front(a) });
    a.anim('frost', 2, 1, a.cols - 4, 1);
    a.checkout();
  });
  market('The long thin shop', 'A shopfront on a busy street, all depth and no width.', (a) => {
    const t = Math.max(3, Math.floor(a.rows / 4));
    a.fix('wall', 0, 0, a.cols, t);
    a.fix('wall', 0, a.rows - t, a.cols, t);
    for (let c = 3; c + 3 <= a.cols - 8; c += 6) {
      a.shelf(c, t + 1, 3, 1);
      a.shelf(c + 2, a.rows - t - 2, 3, 1);
    }
    a.fix('counter', a.cols - 4, t + 1, 1, a.rows - 2 * t - 3);
    a.park(a.cols - 6, Math.floor(a.rows / 2));
  });
  market('Perimeter', 'Shelves round the walls and one big island in the middle.', (a) => {
    a.shelf(1, 1, a.cols - 9, 1);
    a.shelf(1, a.rows - 2, a.cols - 9, 1);
    a.shelf(1, 3, 1, a.rows - 6);
    const iw = Math.max(4, a.cols - 22), ih = Math.max(2, a.rows - 12);
    a.fix('display', Math.floor((a.cols - 8 - iw) / 2) + 2, Math.floor((a.rows - ih) / 2), iw, ih);
    a.checkout();
  });
  market('Stairs', 'Shelves stepped on the diagonal, like someone pushed them.', (a) => {
    const f = front(a);
    for (let c = 2, k = 0; c + 2 <= a.cols - f; c += 5, k++) {
      for (let r = 1 + (k % 3), s = 0; r + 2 <= a.rows - 2; r += 3, s++) a.shelf(c + (s % 2), r, 2, 2);
    }
    a.checkout();
  });
  market('Herringbone', 'Short shelves at alternating angles. Pretty, and a pain to shop.', (a) => {
    const f = front(a);
    for (let c = 2, k = 0; c + 3 <= a.cols - f; c += 4, k++) {
      for (let r = 2 + (k % 2) * 2; r + 1 <= a.rows - 3; r += 4) { a.shelf(c, r, 2, 1); a.shelf(c + 1, r + 1, 2, 1); }
    }
    a.checkout();
  });
  market('Old warehouse', 'Pillars every few metres. The aisles were laid out around them.', (a) => {
    const f = front(a);
    a.aisles({ x1: a.cols - f, gap: 5 });
    for (let c = 6; c < a.cols - f; c += 7) for (let r = 3; r < a.rows - 3; r += 5) a.fix('pillar', c, r, 1, 1);
    a.checkout();
  });
  market('Two shops', 'A wall down the middle and one doorway between them.', (a) => {
    const mid = Math.floor(a.cols / 2);
    a.fix('wall', mid, 0, 1, Math.floor(a.rows / 2) - 1);
    a.fix('wall', mid, Math.floor(a.rows / 2) + 2, 1, a.rows - Math.floor(a.rows / 2) - 2);
    a.aisles({ x0: 2, x1: mid - 1, numbers: false });
    a.aisles({ x0: mid + 3, x1: a.cols - 6, numbers: false, cross: 0 });
    a.checkout();
  });

  // Food and markets.
  store('The night market', 'Stalls under strings of lanterns. Best after dark.', (a) => {
    a.stock(['satay', 'bao', 'mango sticky rice', 'grilled squid', 'sugarcane juice', 'dumplings', 'egg waffles']);
    const signs = [['SATAY', 'skewers'], ['BAO', 'buns'], ['SQUID', 'skewers'], ['MANGO', 'fruit'], ['WAFFLES', 'buns'], ['JUICE', 'drinks'], ['DUMPLINGS', 'bowls']];
    let k = 0;
    for (let c = 2; c + 3 <= a.cols - 6; c += 5) {
      const [sign, goods] = signs[k++ % signs.length];
      a.fix('stall', c, 1, 3, 2, { sign, goods, hue: k });
      if (a.rows >= 16) { const [s2, g2] = signs[(k + 3) % signs.length]; a.fix('stall', c, a.rows - 3, 3, 2, { sign: s2, goods: g2, hue: k + 2 }); }
    }
    a.anim('string', 1, 4, a.cols - 8, 1);
    if (a.rows >= 16) a.anim('string', 1, a.rows - 5, a.cols - 8, 1);
    a.tables(4, Math.floor(a.rows / 2) - 1, a.cols - 8, Math.floor(a.rows / 2) + 2, 2, 4, 'table', { set: 'bowls', seat: 'stool', shape: 'square' });
    a.checkout({ r: Math.floor(a.rows / 2) - 1, len: 3 });
  }, { dim: true, floor: 'asphalt' });
  store('Hawker centre', 'Stalls round the edge, tables in the middle, and a packet of tissues saving every seat.', (a) => {
    a.stock(['chicken rice', 'laksa', 'kaya toast', 'char kway teow', 'teh tarik', 'satay', 'carrot cake']);
    const signs = [['RICE', 'bowls'], ['LAKSA', 'bowls'], ['KAYA', 'buns'], ['NOODLES', 'woks'], ['TEH', 'drinks'], ['SATAY', 'skewers'], ['CAKE', 'woks']];
    let k = 0;
    for (let c = 2; c + 3 <= a.cols - 2; c += 4) { const [sign, goods] = signs[k++ % signs.length]; a.fix('stall', c, 1, 3, 2, { sign, goods, hue: k * 2 }); }
    a.tables(3, 5, a.cols - 7, a.rows - 2, 2, 2, 'table', { set: 'bowls', seat: 'stool', top: 'stone' });
    a.checkout({ r: a.rows - 6, len: 3 });
    a.label('Tray return', a.cols - 9, a.rows - 1);
  }, { floor: 'terrazzo' });
  store("Farmers' market", 'Crates of fruit in rows, and one person selling honey.', (a) => {
    a.stock(['honey', 'peaches', 'apples', 'sourdough', 'eggs', 'tomatoes', 'cherries']);
    a.fix('stall', 2, 1, 3, 2, { sign: 'HONEY', goods: 'drinks', hue: 2 });
    for (let c = 7; c + 3 <= a.cols - 7; c += 5) a.fix('fruit', c, 1, 3, 2);
    for (let c = 2; c + 3 <= a.cols - 7; c += 5) for (let r = 5; r + 2 <= a.rows - 2; r += 4) a.fix('fruit', c, r, 3, 2);
    a.checkout();
  }, { floor: 'grass' });
  store('The bakery', 'Ovens on the back wall, racks of bread cooling everywhere else.', (a) => {
    a.stock(['sourdough', 'croissants', 'hot cross buns', 'baguette', 'lamingtons', 'pies']);
    for (let c = 2; c + 3 <= a.cols - 8; c += 5) { a.fix('oven', c, 1, 3, 2); a.anim('steam', c + 1, 1); }
    a.aisles({ y0: 5, x1: a.cols - front(a), w: 1, gap: 4, numbers: false, style: 'bread' });
    a.checkout();
  }, { floor: 'tile:warm' });
  store('The deli', 'Long glass counters. Take a number.', (a) => {
    a.stock(['salami', 'olives', 'brie', 'prosciutto', 'pickles', 'sourdough']);
    a.fix('deli', 2, 2, a.cols - 12, 1);
    a.fix('deli', 2, a.rows - 4, a.cols - 12, 1);
    a.tables(4, 5, a.cols - 10, a.rows - 5, 2, 3, 'table', { set: 'plates' });
    a.checkout();
    a.label('Now serving 42', 2, 1);
  }, { floor: 'checker' });
  store('Bubble tea', 'One counter, a lot of tables, and a lot of tapioca.', (a) => {
    a.stock(['bubble tea', 'brown sugar milk', 'taro slush', 'jasmine green tea', 'pudding']);
    a.fix('bar', 2, 1, a.cols - 12, 1, { items: 'drinks', stools: false, top: 'stone' });
    a.tables(3, 4, a.cols - 8, a.rows - 1, 2, 3, 'table', { set: 'boba', shape: 'square' });
    a.checkout();
  }, { floor: 'terrazzo' });
  store('Dumpling house', 'Round tables and steaming baskets.', (a) => {
    a.stock(['xiao long bao', 'pork buns', 'har gow', 'potstickers', 'wontons', 'chilli oil']);
    a.tables(3, 2, a.cols - 8, a.rows - 2, 3, 3, 'table', { set: 'steamers' });
    for (let c = 4; c + 3 <= a.cols - 8; c += 6) for (let r = 3; r + 2 <= a.rows - 2; r += 6) a.anim('steam', c, r);
    a.checkout();
  }, { floor: 'carpet:red' });
  store('The fish market', 'Tanks along the wall. Somebody is watching you.', (a) => {
    a.stock(['salmon', 'prawns', 'oysters', 'squid', 'barramundi', 'scallops']);
    a.fix('tank', 2, 1, a.cols - 10, 2);
    a.anim('fish', 2, 1, a.cols - 10, 2);
    a.aisles({ y0: 5, x1: a.cols - front(a), style: 'ice', numbers: false });
    a.checkout();
  }, { floor: 'tile:cool' });
  store('Food court', 'Counters round three walls and every table taken.', (a) => {
    const signs = [['SUSHI', 'bowls'], ['PHO', 'bowls'], ['KEBAB', 'skewers'], ['PIZZA', 'buns'], ['CURRY', 'bowls'], ['JUICE', 'drinks'], ['RAMEN', 'bowls']];
    let k = 0;
    for (let c = 2; c + 3 <= a.cols - 6; c += 5) { const [sign, goods] = signs[k++ % signs.length]; a.fix('stall', c, 1, 3, 2, { sign, goods, hue: k * 3 }); }
    a.tables(3, 5, a.cols - 7, a.rows - 1, 2, 2, 'table', { set: 'plates' });
    a.checkout();
  }, { floor: 'terrazzo' });
  store('Cat café', 'Couches, coffee, and a cat asleep exactly where the cart wants to go.', (a) => {
    a.stock(['flat white', 'banana bread', 'matcha latte', 'toastie', 'cat treats']);
    a.fix('bar', 2, 1, Math.floor(a.cols / 3), 2, { items: 'coffee' });
    a.deco('rug', 1, a.rows - 5, Math.floor(a.cols / 2) + 6, 5, { hue: 1 });
    a.fix('sofa', 2, a.rows - 4, 5, 2, { face: 'up' });
    a.fix('sofa', Math.floor(a.cols / 2), a.rows - 4, 5, 2, { face: 'up' });
    a.tables(4, 5, a.cols - 9, a.rows - 6, 2, 4, 'table', { set: 'cups' });
    a.fix('plant', 1, 4, 1, 1);
    a.fix('cat', Math.floor(a.cols / 2) - 2, Math.floor(a.rows / 2), 2, 1);
    a.anim('cat', Math.floor(a.cols / 2) - 2, Math.floor(a.rows / 2), 2, 1);
    a.checkout();
  }, { floor: 'wood' });
  store('The milk bar', 'Tiny, a bit dusty, sells everything. Classic Melbourne.', (a) => {
    a.stock(['milk', 'the paper', 'a sausage roll', 'mixed lollies', 'bread', 'a Chiko roll']);
    const w = Math.max(14, Math.floor(a.cols * 0.55)), h = Math.max(9, a.rows - 6);
    const c0 = Math.floor((a.cols - w) / 2) - 2, r0 = Math.floor((a.rows - h) / 2);
    a.deco('path', 0, 0, a.cols, a.rows);
    a.deco('floor', c0, r0, w, h, { mat: 'checker' });
    const door = c0 + Math.floor(w / 2) - 1;
    a.fix('wall', c0, r0, w, 1);
    a.fix('wall', c0, r0 + h - 1, door - c0, 1);
    a.fix('wall', door + 3, r0 + h - 1, c0 + w - door - 3, 1);
    a.fix('wall', c0, r0 + 1, 1, h - 2);
    a.fix('wall', c0 + w - 1, r0 + 1, 1, h - 2);
    a.shelf(c0 + 2, r0 + 2, w - 4, 1);
    a.shelf(c0 + 2, r0 + 4, 1, h - 7);
    a.shelf(c0 + 5, r0 + 5, Math.max(2, w - 12), 1, 'toys');
    a.fix('counter', c0 + w - 3, r0 + h - 5, 1, 3);
    a.park(c0 + w - 5, r0 + h - 4);
    a.fix('bench', c0 + 2, r0 + h, 3, 1);
  });
  store('The servo', 'A petrol station. The shop part, anyway.', (a) => {
    a.stock(['a pie', 'iced coffee', 'chips', 'ice', 'a phone charger', 'jerky']);
    a.deco('bay', 1, 1, a.cols - 12, a.rows - 2);
    for (let c = 4; c + 1 <= a.cols - 13; c += 6) { a.fix('pump', c, 3, 1, 1); a.fix('pump', c, a.rows - 4, 1, 1); }
    const x = a.cols - 10;
    a.deco('floor', x, 0, 10, a.rows, { mat: 'lino' });
    a.fix('wall', x, 0, 1, a.rows - 5);
    a.shelf(x + 2, 2, 1, a.rows - 9);
    a.fix('freezer', x + 4, 1, 3, 1);
    a.checkout({ c: a.cols - 3, len: 3 });
  });

  // Things I like.
  store('The bookshop', 'Root Rot is face-out by the door.', (a) => {
    a.stock(['a novel', 'a cookbook', 'a travel guide', 'poetry', 'a manga volume', 'a bookmark']);
    a.aisles({ x1: a.cols - front(a), w: 1, gap: 3, style: 'books' });
    a.deco('rug', a.cols - front(a) + 1, 2, 5, 4, { hue: 4 });
    a.fix('sofa', a.cols - front(a) + 2, 2, 3, 1, { face: 'down' });
    a.fix('plant', a.cols - front(a) + 1, 7, 1, 1);
    a.checkout();
  }, { floor: 'wood' });
  store('The library', 'Long shelves, quiet desks. The cart is asked to keep it down.', (a) => {
    a.stock(['a reserve', 'a returned book', 'a quiet desk', 'a library card']);
    for (let r = 2; r + 1 <= a.rows - 3; r += 3) a.shelf(2, r, Math.floor(a.cols * 0.45), 1, 'books');
    a.tables(Math.floor(a.cols * 0.45) + 5, 2, a.cols - 7, a.rows - 2, 2, 2, 'desk', { items: 'books', face: 'down' });
    a.checkout();
  }, { floor: 'carpet:blue' });
  store('Manga corner', 'Stacks and stacks of volumes. Somebody is still on volume one.', (a) => {
    a.stock(['volume 1', 'volume 52', 'volume 104', 'a box set', 'an art book']);
    for (let c = 2; c + 2 <= a.cols - 8; c += 4) for (let r = 2; r + 2 <= a.rows - 3; r += 4) a.shelf(c, r, 2, 2, 'books');
    a.checkout();
  }, { floor: 'wood:pale' });
  store('The music shop', 'Guitars on the wall, a piano no one is allowed to play, and one tenor sax.', (a) => {
    a.stock(['reeds', 'a capo', 'strings', 'a metronome', 'valve oil', 'a mouthpiece']);
    a.fix('guitars', 1, 0, a.cols - 10, 2, { face: 'down' });
    const mid = Math.floor(a.rows / 2);
    a.deco('rug', 2, mid - 3, 7, 6, { hue: 5 });
    a.fix('piano', 3, mid - 2, 5, 4, { face: 'down' });
    a.fix('sax', Math.floor(a.cols / 2), mid - 1, 2, 3);
    a.shelf(3, a.rows - 3, a.cols - 14, 1);
    a.checkout();
  }, { floor: 'wood' });
  store('The arcade', 'Fighting games on the left, and locals start at seven.', (a) => {
    a.stock(['tokens', 'a soft drink', 'a fight stick', 'tickets']);
    a.lightsOff();
    for (let c = 2; c + 2 <= a.cols - 8; c += 3) {
      a.fix('arcade', c, 1, 2, 2, { face: 'down' });
      a.anim('screen', c, 1, 2, 2, { part: 'arcade', face: 'down' });
      if (a.rows >= 16) { a.fix('arcade', c, a.rows - 3, 2, 2, { face: 'up' }); a.anim('screen', c, a.rows - 3, 2, 2, { part: 'arcade', face: 'up' }); }
    }
    a.label('Locals tonight, 7 pm', 3, Math.floor(a.rows / 2));
    a.checkout({ r: Math.floor(a.rows / 2) - 1, len: 3 });
  }, { dim: true, floor: 'carpet:arcade' });
  store('Board game café', 'Every table mid-game. Nobody wants to be the banker.', (a) => {
    a.stock(['a board game', 'chips', 'iced tea', 'extra dice', 'a rulebook']);
    a.shelf(1, 1, a.cols - 9, 1, 'toys');
    a.tables(3, 4, a.cols - 8, a.rows - 1, 3, 3, 'gametable');
    a.checkout();
  }, { floor: 'wood' });
  store('The server room', 'Racks of blinking lights. The homelab, minus the downtime.', (a) => {
    a.stock(['a patch cable', 'a hard drive', 'thermal paste', 'a spare fan', 'zip ties']);
    a.lightsOff();
    for (let c = 3; c + 2 <= a.cols - 8; c += 5) {
      a.fix('rack', c, 2, 2, Math.floor((a.rows - 6) / 2));
      a.fix('rack', c, a.rows - 2 - Math.floor((a.rows - 6) / 2), 2, Math.floor((a.rows - 6) / 2));
    }
    a.checkout();
  }, { dim: true, floor: 'raised' });
  store('Cold aisle', 'A data centre. The blue squares are cold air, which the cart enjoys.', (a) => {
    a.stock(['a server', 'a rail kit', 'a fibre patch', 'a label maker']);
    for (let r = 2; r + 2 <= a.rows - 3; r += 6) {
      a.fix('rack', 2, r, a.cols - 12, 1);
      a.deco('cold', 2, r + 1, a.cols - 12, 2);
      if (r + 3 < a.rows - 2) a.fix('rack', 2, r + 3, a.cols - 12, 1);
    }
    a.checkout();
  }, { floor: 'raised' });
  store('Hackathon hall', 'Hour 31 of 48. Where the original cart was built.', (a) => {
    a.stock(['an energy drink', 'cold pizza', 'a jumper lead', 'an Arduino', 'sleep']);
    const len = Math.min(10, Math.floor((a.cols - 12) / 2));
    for (let r = 2; r + 3 <= a.rows - 1; r += 5) for (let c = 2; c + len <= a.cols - 8; c += len + 2) a.fix('worktable', c, r, len, 3);
    a.label('UNIHACK', 2, a.rows - 1);
    a.checkout();
  }, { floor: 'carpet:grey' });
  store('The exam hall', 'Rows of single desks. Pens down.', (a) => {
    a.stock(['a pen', 'a calculator', 'a water bottle', 'a student ID']);
    for (let r = 2; r < a.rows - 2; r += 2) for (let c = 2; c < a.cols - 8; c += 3) a.fix('desk', c, r, 1, 1, { items: 'paper', face: 'right' });
    a.checkout();
  }, { floor: 'court' });
  store('The tutoring room', 'Small desks, a whiteboard, and a lot of fractions.', (a) => {
    a.stock(['a workbook', 'a whiteboard marker', 'a times table', 'a gold star']);
    a.fix('board', 2, 0, Math.floor(a.cols / 2), 2, { face: 'down' });
    a.tables(3, 4, a.cols - 9, a.rows - 2, 2, 3, 'desk', { items: 'books', face: 'down' });
    a.checkout();
  }, { floor: 'carpet:green' });
  store('The esports stage', 'Two teams of five facing off, and the casters on the left.', (a) => {
    a.stock(['a headset', 'an energy drink', 'a mousepad', 'a jersey']);
    a.lightsOff();
    const mid = Math.floor(a.rows / 2);
    const len = Math.min(12, a.cols - 18);
    a.fix('stage', 4, mid - 4, len, 2, { face: 'down', team: 'blue' });
    a.fix('stage', 4, mid + 2, len, 2, { face: 'up', team: 'red' });
    a.fix('desk', 1, mid - 1, 1, 2, { items: 'monitor', face: 'left' });
    a.label('Casters', 1, mid - 2);
    a.fix('screen', len + 6, mid - 1, 3, 2, { face: 'left' });
    a.anim('screen', len + 6, mid - 1, 3, 2);
    a.checkout();
  }, { dim: true, floor: 'stage' });
  store('The record shop', 'Crates of vinyl, a listening post, and someone in the jazz section for an hour.', (a) => {
    a.stock(['a jazz record', 'a seven-inch single', 'a soundtrack', 'a record brush', 'a turntable belt']);
    a.shelf(1, 1, a.cols - 9, 1, 'records');
    const f = front(a);
    for (let c = 3; c + 3 <= a.cols - f; c += 5) for (let r = 4; r + 1 <= a.rows - 3; r += 3) a.fix('crate', c, r, 3, 1);
    a.fix('turntable', a.cols - f + 1, 4, 2, 2);
    a.fix('turntable', a.cols - f + 1, 8, 2, 2);
    a.label('Jazz', 3, 3);
    a.checkout();
  }, { floor: 'checker' });
  store('The cinema', 'Rows of red seats, a choc top, and the trailers have already started.', (a) => {
    a.stock(['popcorn', 'a choc top', 'a slushie', 'two tickets', 'nachos']);
    a.lightsOff();
    a.fix('cinemascreen', 0, 1, 2, a.rows - 2, { face: 'right' });
    const mid = Math.floor(a.rows / 2);
    for (let c = 5; c + 1 <= a.cols - 8; c += 2) {
      a.fix('seats', c, 2, 1, mid - 3, { face: 'left' });
      a.fix('seats', c, mid + 1, 1, a.rows - mid - 4, { face: 'left' });
    }
    a.anim('beam', 2, 1, a.cols - 8, a.rows - 2);
    a.fix('bar', a.cols - 6, 1, 1, 4, { items: 'cinema', stools: false, face: 'left' });
    a.checkout();
  }, { dim: true, floor: 'carpet:red' });
  store('The laneway', 'Coffee, a mural, and nowhere to sit.', (a) => {
    a.stock(['a long black', 'a croissant', 'a vinyl record', 'a tote bag']);
    a.fix('mural', 0, 0, a.cols, 2);
    a.fix('mural', 0, a.rows - 2, a.cols, 2);
    a.tables(3, 4, a.cols - 8, a.rows - 3, 1, 4, 'table', { set: 'cups', chairs: 0 });
    a.checkout({ r: 4, len: 3 });
  }, { floor: 'stone:blue' });

  // Puzzles.
  store('The maze', 'Hedges. A* earns its keep in here.', (a) => {
    a.maze(1, 0, a.cols - 6, a.rows);
    a.checkout({ c: a.cols - 2, r: a.rows - 6, len: 3 });
  }, { floor: 'grass' });
  store('The other maze', 'Same idea, different hedges. Try Dijkstra and watch it flood.', (a) => {
    a.maze(1, 0, a.cols - 6, a.rows);
    a.checkout({ c: a.cols - 2, r: 2, len: 3 });
  }, { floor: 'grass' });
  store('The spiral', 'Walls that wind in towards the middle.', (a) => {
    let x0 = 1, y0 = 1, x1 = a.cols - 8, y1 = a.rows - 2, k = 0;
    while (x1 - x0 > 4 && y1 - y0 > 4) {
      const side = k % 4;
      if (side === 0) { a.fix('wall', x0, y0, x1 - x0, 1); y0 += 2; }
      if (side === 1) { a.fix('wall', x1 - 1, y0 - 1, 1, y1 - y0 + 1); x1 -= 2; }
      if (side === 2) { a.fix('wall', x0 + 2, y1 - 1, x1 - x0 - 2, 1); y1 -= 2; }
      if (side === 3) { a.fix('wall', x0, y0 + 1, 1, y1 - y0 - 1); x0 += 2; }
      k++;
    }
    a.checkout();
  });
  store('The vault', 'Rings inside rings, with the doors never lined up.', (a) => {
    let c = 1, r = 1, w = a.cols - 9, h = a.rows - 2, k = 0;
    while (w > 6 && h > 5) {
      a.ring(c, r, w, h, k % 2 ? 1 : 2, 'plain');
      c += 3; r += 2; w -= 6; h -= 4; k++;
    }
    a.checkout();
  });
  store('The greedy trap', 'A U-shaped wall, open towards the cart. Press Show me to watch greedy search head straight for the goal behind it, walk into the U and have to back out. Then run the same trip with A*.', (a) => {
    const cx = Math.floor((a.cols - 8) / 2), h = Math.floor(a.rows * 0.6), top = Math.floor((a.rows - h) / 2);
    const arm = Math.min(6, Math.max(3, a.cols - cx - 12));
    a.fix('wall', cx, top, 1, h);
    a.fix('wall', cx + 1, top, arm, 1);
    a.fix('wall', cx + 1, top + h - 1, arm, 1);
    a.checkout();
    // Start in line with the opening, goal straight behind the wall.
    const mid = top + Math.floor(h / 2);
    const start = { c: Math.min(cx + arm + 7, a.cols - 7), r: mid };
    const goal = { c: Math.max(1, cx - 5), r: mid };
    a.demo(start, goal);
    a.label('Start', start.c - 1, mid - 1);
    a.label('Goal', goal.c - 1, mid - 1);
  });
  store('The comb', 'Long teeth with dead ends between them.', (a) => {
    a.fix('wall', 1, a.rows - 3, a.cols - 9, 1);
    for (let c = 2; c < a.cols - 8; c += 3) a.fix('wall', c, 2, 1, a.rows - 5);
    a.checkout({ r: 2, len: 3 });
  });
  store('Checkerboard', 'Pillars in a grid. Lots of equally short routes.', (a) => {
    for (let c = 2; c < a.cols - 7; c += 2) for (let r = 1 + ((c / 2) % 2); r < a.rows - 1; r += 2) a.fix('pillar', c, r, 1, 1);
    a.checkout();
  });
  store('Seven blocks', 'Shelves in the shapes you are thinking of.', (a) => {
    const shapes = [
      [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]],
      [[1, 0], [2, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]],
    ];
    let x = 2, y = 2, k = 0;
    while (y + 2 <= a.rows - 2) {
      const sh = shapes[k++ % shapes.length];
      for (const [dx, dy] of sh) a.shelf(x + dx * 2, y + dy * 2, 2, 2, 'plain');
      x += 11;
      if (x + 8 > a.cols - 7) { x = 2 + (k % 2) * 4; y += 6; }
    }
    a.checkout();
  });
  store('Hello', 'The shelves are waving.', (a) => {
    a.spell('HI');
    a.checkout();
  }, { upright: true });
  store('A-star', 'Named after the search, in shelf form.', (a) => {
    a.spell('A*');
    a.checkout();
  }, { upright: true });
  store('Initials', "Mine, in shelving. A bit much, but it's my store.", (a) => {
    a.spell('LQ');
    a.checkout();
  }, { upright: true });
  store('Store not found', 'This aisle is empty. So are all the others.', (a) => {
    a.spell('404');
    a.checkout();
  }, { upright: true });
  store('This way', 'A big arrow pointing at the checkout, in case you were lost.', (a) => {
    const mid = Math.floor(a.rows / 2);
    const tip = a.cols - 10;
    const k = Math.min(4, Math.floor((a.rows - 4) / 4));
    a.shelf(3, mid - 1, tip - 5, 2, 'plain');
    for (let j = 0; j <= k; j++) {
      a.shelf(tip - 2 * j - 1, mid - 1 - 2 * j, 2, 2, 'plain');
      if (j) a.shelf(tip - 2 * j - 1, mid - 1 + 2 * j, 2, 2, 'plain');
    }
    a.checkout();
  });
  store('Islands', 'Displays scattered like an archipelago.', (a) => {
    a.scatter('display', Math.floor((a.cols * a.rows) / 50), { minW: 2, maxW: 4, minH: 2, maxH: 3, margin: 2, x1: a.cols - 7 });
    a.checkout();
  });
  store('Zigzag', 'One long shelf, folded back and forth.', (a) => {
    for (let c = 3, k = 0; c < a.cols - 8; c += 4, k++) {
      if (k % 2) a.shelf(c, 2, 1, a.rows - 5);
      else a.shelf(c, 3, 1, a.rows - 5);
    }
    a.checkout();
  });
  store('Kaleidoscope', 'Symmetrical in both directions. Mostly.', (a) => {
    const W = a.cols - 8, H = a.rows;
    const pts = [];
    for (let k = 0; k < 6; k++) pts.push([a.int(2, Math.floor(W / 2) - 3), a.int(1, Math.floor(H / 2) - 2), a.int(1, 3), a.int(1, 2)]);
    for (const [c, r, w, h] of pts) {
      a.shelf(c, r, w, h, 'plain');
      a.shelf(W - c - w, r, w, h, 'plain');
      a.shelf(c, H - r - h, w, h, 'plain');
      a.shelf(W - c - w, H - r - h, w, h, 'plain');
    }
    a.checkout();
  });

  // Other places.
  store('Bowling alley', 'Lanes down one side, shoes for hire on the other.', (a) => {
    a.stock(['bowling shoes', 'hot chips', 'a slushie', 'a lucky ball']);
    for (let r = 1; r + 1 <= a.rows - 5; r += 3) {
      a.deco('lane', 1, r, a.cols - 14, 2);
      a.fix('pins', a.cols - 13, r, 2, 2, { face: 'left' });
      a.fix('gutter', 1, r + 2, a.cols - 12, 1);
    }
    a.checkout();
  }, { floor: 'carpet:arcade' });
  store('The tea house', 'Gongfu tea, a wall of tins, and nobody in a hurry.', (a) => {
    a.stock(['oolong', 'pu-erh', 'jasmine pearls', 'a gaiwan', 'a clay teapot']);
    a.shelf(1, 0, a.cols - 9, 1, 'tins');
    a.shelf(0, 2, 1, a.rows - 4, 'drawers');
    a.tables(3, 3, a.cols - 9, a.rows - 1, 2, 3, 'teatable');
    a.fix('plant', a.cols - 9, 2, 1, 1, { hue: 2 });
    a.checkout();
  }, { floor: 'wood:dark' });
  store('Garden centre', 'Rows of plants. Mind the root rot.', (a) => {
    a.stock(['potting mix', 'a monstera', 'seedlings', 'a watering can', 'snail pellets']);
    for (let r = 2; r + 1 <= a.rows - 2; r += 3) for (let c = 2; c < a.cols - 8; c += 2) a.fix('plant', c, r, 1, 1, { hue: a.int(0, 3) });
    a.checkout();
  }, { floor: 'concrete' });
  store('The hardware store', 'Tall racking and a sausage sizzle out the front.', (a) => {
    a.stock(['a sausage in bread', 'screws', 'timber', 'cable ties', 'a drill bit', 'paint']);
    a.aisles({ x1: a.cols - front(a), w: 3, gap: 4, cross: 0, style: 'racking' });
    a.fix('bbq', a.cols - 6, 2, 2, 1);
    a.anim('steam', a.cols - 6, 2);
    a.checkout();
  }, { floor: 'concrete' });
  store('The chemist', 'Aisles of everything, and a counter at the back for the real stuff.', (a) => {
    a.stock(['sunscreen', 'tissues', 'ibuprofen', 'lip balm', 'a toothbrush', 'vitamins']);
    a.aisles({ x1: a.cols - front(a), y0: 4, w: 1, gap: 4 });
    a.fix('bar', 2, 1, a.cols - 12, 1, { items: 'chemist', stools: false, top: 'stone' });
    a.fix('cross', a.cols - 9, 1, 1, 1);
    a.checkout();
  }, { floor: 'lino' });
  store('The laundromat', 'Rows of machines, all spinning.', (a) => {
    a.stock(['detergent', 'coins', 'a dryer sheet', 'a lost sock']);
    for (let c = 2; c < a.cols - 8; c += 2) { a.fix('washer', c, 1, 2, 2); a.anim('spin', c, 1, 2, 2); }
    for (let c = 2; c < a.cols - 8; c += 2) if (a.rows >= 15) { a.fix('washer', c, a.rows - 3, 2, 2); a.anim('spin', c, a.rows - 3, 2, 2); }
    a.fix('bench', 3, Math.floor(a.rows / 2), a.cols - 14, 1);
    a.checkout({ r: Math.floor(a.rows / 2) - 1, len: 3 });
  }, { floor: 'checker' });
  store('The toy shop', 'A claw machine, a ball pit and nobody over the age of nine.', (a) => {
    a.stock(['a yo-yo', 'a plushie', 'a puzzle', 'a kite', 'bubbles']);
    a.fix('claw', 2, 2, 2, 2);
    a.fix('claw', 5, 2, 2, 2);
    a.fix('ballpit', Math.floor(a.cols / 2) - 3, Math.floor(a.rows / 2) - 2, 5, 4);
    a.shelf(2, a.rows - 3, a.cols - 12, 1, 'toys');
    a.checkout();
  }, { floor: 'rubber:play' });
  store('The florist', 'Buckets of flowers, all over the floor.', (a) => {
    a.stock(['roses', 'sunflowers', 'eucalyptus', 'tulips', 'a vase', 'wattle']);
    a.scatter('flowers', Math.floor((a.cols * a.rows) / 18), { x1: a.cols - 7, maxW: 1, maxH: 1, margin: 1 });
    a.checkout();
  }, { floor: 'tile:warm' });
  store('The gym', 'Machines in rows. The cart is here for the cardio.', (a) => {
    a.stock(['a protein bar', 'a towel', 'a shaker', 'chalk']);
    for (let c = 2; c + 2 <= a.cols - 8; c += 4) for (let r = 2; r + 1 <= a.rows - 2; r += 4) a.fix('gym', c, r, 2, 1, { face: 'down' });
    a.deco('mat', a.cols - 14, a.rows - 5, 5, 3);
    a.checkout();
  }, { floor: 'rubber' });
  store('The station', 'A platform, two tracks and a train that is ten minutes late.', (a) => {
    a.stock(['a myki top-up', 'a coffee', 'a newspaper', 'a timetable']);
    const p = Math.floor(a.rows / 2);
    a.deco('tracks', 0, 1, a.cols, 2);
    a.fix('edge', 0, 3, a.cols - 7, 1);
    a.fix('edge', 0, a.rows - 4, a.cols - 7, 1);
    a.deco('tracks', 0, a.rows - 3, a.cols, 2);
    for (let c = 4; c < a.cols - 9; c += 7) a.fix('bench', c, p, 3, 1);
    for (let c = 8; c < a.cols - 9; c += 14) a.fix('pillar', c, p - 3, 1, 1);
    a.checkout({ r: p - 1, len: 3 });
  }, { floor: 'concrete' });
  store('The museum', 'Exhibits on plinths, behind ropes. Please do not touch.', (a) => {
    a.stock(['a postcard', 'an audio guide', 'a fridge magnet', 'a catalogue']);
    for (let c = 3; c + 2 <= a.cols - 8; c += 6) for (let r = 2; r + 2 <= a.rows - 2; r += 5) a.fix('plinth', c, r, 2, 2);
    a.checkout();
  }, { floor: 'marble' });
  store('The gallery', 'Paintings on the walls and a bench in the middle for staring.', (a) => {
    a.stock(['a print', 'a postcard', 'a tote bag', 'an exhibition book']);
    a.fix('frames', 1, 0, a.cols - 9, 1, { face: 'down' });
    a.fix('frames', 1, a.rows - 1, a.cols - 9, 1, { face: 'up' });
    a.fix('wall', Math.floor((a.cols - 8) / 2), 3, 1, a.rows - 6);
    a.fix('bench', 4, Math.floor(a.rows / 2), 4, 1);
    a.checkout();
  }, { floor: 'wood:pale' });

  // Odd days.
  market('Opening day', 'One shelf, mostly empty. Stock arrives Tuesday.', (a) => {
    a.shelf(4, 3, 2, a.rows - 7);
    a.scatter('box', 6, { x0: 9, x1: a.cols - 8, maxW: 2, maxH: 2, margin: 2 });
    a.checkout();
  });
  market('Stocktake', 'Pallets everywhere. Nobody can find anything.', (a) => {
    a.scatter('pallet', Math.floor((a.cols * a.rows) / 26), { x1: a.cols - 7, minW: 2, maxW: 3, minH: 2, maxH: 2 });
    a.checkout();
  });
  market('Clearance sale', 'Everything must go, including the layout.', (a) => {
    a.scatter('shelf', Math.floor((a.cols * a.rows) / 34), { x1: a.cols - 7, minW: 1, maxW: 4, minH: 1, maxH: 3 });
    a.label('Everything 50% off', 2, a.rows - 1);
    a.checkout();
  });
  market('Blackout', 'The power is out. The cart has a torch.', (a) => {
    a.aisles({ x1: a.cols - front(a) });
    a.lightsOff();
    a.checkout();
  }, { torch: true });
  market('Wet floor', 'Someone dropped the milk. Several times.', (a) => {
    a.aisles({ x1: a.cols - front(a), gap: 5 });
    a.scatter('puddle', 5, { x1: a.cols - 8, minW: 1, maxW: 2, minH: 1, maxH: 1, margin: 2 });
    a.scatter('wetsign', 2, { x1: a.cols - 8, maxW: 1, maxH: 1, margin: 2 });
    a.checkout();
  });
  store('Tiny shop', 'The rest of the building is for lease.', (a) => {
    const w = 12, h = Math.min(9, a.rows - 4);
    const c0 = Math.floor((a.cols - w) / 2), r0 = Math.floor((a.rows - h) / 2);
    a.deco('floor', c0 - 1, r0 - 1, w + 2, h + 2, { mat: 'checker' });
    a.ring(c0 - 1, r0 - 1, w + 2, h + 2, 1, 'plain');
    a.shelf(c0 + 2, r0 + 2, 1, h - 4);
    a.shelf(c0 + 5, r0 + 2, 1, h - 4);
    a.fix('counter', c0 + w - 2, r0 + h - 4, 1, 3, { label: false });
    a.park(c0 + w - 4, r0 + h - 3);
  });
  market('Giant shelves', 'Built for someone much bigger.', (a) => {
    const f = front(a);
    a.aisles({ x1: a.cols - f, w: 5, gap: 5, cross: 1, crossW: 3 });
    a.checkout();
  });
  store('Hall of pillars', 'More pillar than floor.', (a) => {
    for (let c = 2; c < a.cols - 7; c += 3) for (let r = 1 + (c % 2); r < a.rows - 1; r += 3) a.fix('pillar', c, r, 1, 1);
    a.checkout();
  }, { floor: 'marble' });
  market('Aisle thirteen', "Aisle 13 isn't on the map. The cart won't go down it.", (a) => {
    a.aisles({ x1: a.cols - front(a), numbers: false });
    const f = front(a);
    let n = 1;
    for (let c = 3; c + 2 <= a.cols - f; c += 6, n++) a.number(c + 1, 0.5, n === 3 ? 13 : n);
    a.checkout();
  });
  store('Rooftop garden', 'Planter boxes, a view, and wind.', (a) => {
    a.stock(['basil', 'tomatoes', 'chillies', 'mint', 'a hose']);
    a.fix('planter', 1, 1, a.cols - 9, 1);
    for (let r = 4; r + 2 <= a.rows - 3; r += 4) for (let c = 3; c + 4 <= a.cols - 9; c += 6) a.fix('planter', c, r, 4, 2);
    a.checkout();
  }, { floor: 'wood' });
  store('Pop-up shop', 'A tent in a park. Open until the rain starts.', (a) => {
    a.deco('grass', 0, 0, a.cols, a.rows);
    const w = Math.min(20, a.cols - 12), h = Math.min(9, a.rows - 4);
    const c0 = 3, r0 = Math.floor((a.rows - h) / 2);
    a.deco('tent', c0, r0, w, h);
    a.shelf(c0 + 2, r0 + 2, w - 4, 1);
    a.shelf(c0 + 2, r0 + h - 3, w - 4, 1);
    a.checkout();
  });
  store('Snow day', "It never snows in Melbourne. It's snowing in here.", (a) => {
    a.aisles({ x1: a.cols - front(a) });
    a.anim('snow', 0, 0, a.cols, a.rows);
    a.checkout();
  });
  market('After hours', 'Closed, but the cleaner left the radio on.', (a) => {
    a.aisles({ x1: a.cols - front(a) });
    a.fix('mopbucket', a.cols - front(a) + 1, 2, 1, 1);
    a.lightsOff();
    a.checkout();
  }, { dim: true });

  // Suburbs: seeded mixes of everything above, named after places I know.
  const SUBURBS = [
    ['Clayton', 'Two minutes from campus. Always out of instant noodles.'],
    ['Box Hill', 'Upstairs from the dumpling place.'],
    ['Glen Waverley', 'Next to the bubble tea shop, which is next to the other bubble tea shop.'],
    ['Footscray', 'The best fruit prices in Melbourne.'],
    ['Fitzroy', 'Half of it is a café now.'],
    ['Carlton', 'Pasta aisle three times longer than it needs to be.'],
    ['Tiong Bahru', 'Old flats, new coffee.'],
    ['Toa Payoh', 'Near the hawker centre, which is near every hawker centre.'],
    ['Bugis', 'Busy. Always busy.'],
    ['Jurong', 'A long way from everything, with a lot of parking.'],
    ['Tampines', 'Big, bright and very well signposted.'],
  ];
  SUBURBS.forEach(([name, note]) => {
    market(name, note, (a) => {
      const f = front(a);
      const pickStyle = a.pick(['aisles', 'aisles', 'islands', 'mixed']);
      if (pickStyle === 'aisles') a.aisles({ x1: a.cols - f, gap: a.int(3, 5), w: a.int(1, 3), cross: a.int(0, 2), stagger: a.pick([0, 0, 2]) });
      else if (pickStyle === 'islands') a.scatter('display', Math.floor((a.cols * a.rows) / 55), { minW: 2, maxW: 4, minH: 2, maxH: 3, margin: 2, x1: a.cols - 7 });
      else {
        const mid = Math.floor((a.cols - f) / 2);
        a.aisles({ x1: mid, gap: 4, cross: a.int(0, 1) });
        a.scatter(a.pick(['fruit', 'display']), 5, { x0: mid + 2, x1: a.cols - 7, minW: 2, maxW: 3, minH: 2, maxH: 2, margin: 2 });
      }
      a.checkout();
    }, { suburb: true });
  });

  // Chinatown: a street of shops under a gate, with lanterns strung across it.
  store('Chinatown', 'Lanterns over the street, roast duck in the window, and a gate at the end of it all.', (a) => {
    a.stock(['egg tarts', 'bok choy', 'dried shiitake', 'oolong', 'roast duck', 'char siu bao']);
    const d = 3;
    // Shops run the whole street; the checkout sits in the gap between them.
    const x0 = 6, x1 = a.cols - 1;
    const signs = ['茶', '面', '鸭', '药', '饼', '包', '粥', '米'];
    let k = 0;
    for (let c = x0; c + 4 <= x1; c += 6) {
      a.fix('shop', c, 0, Math.min(5, x1 - c), d, { sign: signs[k % signs.length], face: 'down' });
      a.fix('shop', c, a.rows - d, Math.min(5, x1 - c), d, { sign: signs[(k + 4) % signs.length], face: 'up' });
      k++;
    }
    // The gate: four red pillars holding up a tiled roof, with the street's name on it.
    const top = d, bot = a.rows - d - 1, span = bot - top;
    a.deco('paifang', 1, top - 1, 3, span + 3, { text: '唐人街' });
    for (const r of [top, top + Math.round(span * 0.3), top + Math.round(span * 0.7), bot]) a.fix('redpillar', 2, r, 1, 1);
    for (let c = x0 + 2; c < a.cols - 7; c += 6) a.anim('string', c, d, 1, a.rows - 2 * d);
    const mid = Math.floor(a.rows / 2);
    for (let c = x0 + 4; c + 2 <= a.cols - 8; c += 12) a.fix('fruit', c, mid, 2, 1);
    a.checkout();
  }, { floor: 'stone' });

  // The last one.
  store('One hundred', 'Store one hundred. You found them all, or you cheated. Either way, thanks for looking.', (a) => {
    a.spell('100', 2);
    a.anim('confetti', 0, 0, a.cols, a.rows);
    a.checkout();
  }, { upright: true });

  // ---------- Building a store for a floor of a given size ----------
  function build(index, cols, rows) {
    const def = S[clamp(index, 0, S.length - 1)];
    const portrait = rows > cols && !def.upright;
    const lc = portrait ? rows : cols, lr = portrait ? cols : rows;
    const { api, L } = makeApi(lc, lr, index * 7919 + 13);
    def.build(api);
    // Which way things face: given, or towards the middle of the floor. Flipping the floor
    // turns "down" into "right" and so on.
    const FT = { down: 'right', right: 'down', up: 'left', left: 'up' };
    const faced = (o) => ({ ...o, face: o.face || (o.w >= o.h ? (o.r + o.h / 2 < lr / 2 ? 'down' : 'up') : o.c + o.w / 2 < lc / 2 ? 'right' : 'left') });
    const T = (o) => (portrait ? { ...o, c: o.r, r: o.c, w: o.h, h: o.w, face: o.face && FT[o.face] } : o);
    const P = (p) => (portrait ? { c: p.r, r: p.c } : p);
    const inside = (o) => {
      const c0 = Math.max(0, Math.floor(o.c)), r0 = Math.max(0, Math.floor(o.r));
      const c1 = Math.min(cols, Math.floor(o.c) + Math.max(1, Math.round(o.w))), r1 = Math.min(rows, Math.floor(o.r) + Math.max(1, Math.round(o.h)));
      return c1 > c0 && r1 > r0 ? { ...o, c: c0, r: r0, w: c1 - c0, h: r1 - r0 } : null;
    };
    const shelves = L.shelves.map(T).map(inside).filter(Boolean);
    const fixtures = L.fixtures.map(faced).map(T).map(inside).filter(Boolean);
    const decos = L.decos.map(T).map(inside).filter(Boolean);
    const anims = L.anims.map(faced).map(T).map(inside).filter(Boolean);
    const labels = L.labels.map((l) => ({ ...l, ...P(l) }));
    const numbers = L.numbers.map((n) => ({ ...n, ...(portrait ? { c: n.r, r: n.c } : {}) }));
    const grid = new Uint8Array(cols * rows);
    const fill = (o, v) => {
      for (let r = o.r; r < o.r + o.h; r++) for (let c = o.c; c < o.c + o.w; c++) grid[r * cols + c] = v;
    };
    shelves.forEach((s) => fill(s, 1));
    fixtures.forEach((f) => fill(f, f.kind === 'counter' ? 5 : 4));
    let park = L.park ? P(L.park) : { c: cols - 3, r: rows - 3 };
    park = { c: clamp(Math.round(park.c), 0, cols - 1), r: clamp(Math.round(park.r), 0, rows - 1) };
    return {
      index, name: def.name, note: def.note, portrait,
      cols, rows, grid, shelves, fixtures, decos, anims, labels, numbers,
      park: park.r * cols + park.c,
      stock: L.stock, shopper: L.shopper, dark: L.dark || !!def.dim || !!def.torch, torch: !!def.torch,
      floor: def.floor || null, seasonal: !!def.seasonal,
      demo: L.demo
        ? (() => {
            const at = (p) => {
              const q = P(p);
              return clamp(Math.round(q.r), 0, rows - 1) * cols + clamp(Math.round(q.c), 0, cols - 1);
            };
            return { start: at(L.demo.start), goal: at(L.demo.goal), algo: L.demo.algo, compare: L.demo.compare };
          })()
        : null,
    };
  }

  // ---------- Drawing ----------
  const hexToRgb = (hex) => {
    const h = String(hex).replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (hex, a) => {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };
  function roundRect(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  const HUES = ['#d8574a', '#e0913a', '#e8c547', '#8fb453', '#5b9bd5', '#9b7fd1'];
  const FONT_UI = (px, weight = 600) => `${weight} ${px}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  const FONT_CJK = (px) => `700 ${px}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", "Source Han Sans SC", sans-serif`;
  const TAU = Math.PI * 2;

  // Materials. Muted, so a theme reads at a glance without shouting, and each has a
  // darker twin for dark mode.
  function materials(C) {
    const d = !!C.dark;
    return {
      d,
      wood: d ? '#6d5843' : '#d8bc97',
      woodDeep: d ? '#54432f' : '#b48e66',
      woodDark: d ? '#3e3024' : '#7d5a3c',
      grain: d ? 'rgba(0,0,0,0.3)' : 'rgba(110,72,36,0.22)',
      white: d ? '#b9c1cc' : '#ffffff',
      cream: d ? '#48463f' : '#f7f0e2',
      steel: d ? '#59647a' : '#ccd3db',
      steelDeep: d ? '#3d4757' : '#9ba6b4',
      black: d ? '#0a0e14' : '#2b3039',
      glass: d ? 'rgba(141,170,255,0.2)' : 'rgba(132,180,226,0.34)',
      water: d ? '#24466b' : '#a8cde8',
      red: d ? '#c4503f' : '#c9473a',
      lacquer: d ? '#9c3328' : '#b0352a',
      gold: d ? '#d9ab48' : '#d39e35',
      green: d ? '#4f8048' : '#78a65e',
      leaf: d ? '#3c6939' : '#5a8f45',
      leafLight: d ? '#6e9c57' : '#9fc87a',
      soil: d ? '#4b3b2d' : '#8a6a4b',
      clay: d ? '#9b5c40' : '#cc8059',
      card: d ? '#8a6d4d' : '#d2ae80',
      sheet: d ? '#9ea7b4' : '#fffdf7',
      tile: d ? '#3f5a4f' : '#5f8a76',
      hues: d ? ['#d36f5a', '#d99a4b', '#d4ba59', '#84ab62', '#6c9bd2', '#9d88dc', '#d283a3'] : ['#dc7d65', '#e3a558', '#e3c66a', '#93b96c', '#72a4d2', '#a08fd4', '#d88cab'],
      shadow: d ? 'rgba(0,0,0,0.55)' : 'rgba(38,48,66,0.24)',
    };
  }

  // A small stable number from a position, for picking colours and variations.
  const hashOf = (a, b, k = 0) => {
    let h = (a * 73856093) ^ (b * 19349663) ^ (k * 83492791);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    return ((h ^ (h >>> 15)) >>> 0);
  };

  // Turn so that "front" points down: everything oriented is drawn as if it faces the
  // bottom of the screen, centred on (0, 0), and returns its local width and depth.
  const ROT = { down: 0, up: Math.PI, right: -Math.PI / 2, left: Math.PI / 2 };
  function orient(g, face, x, y, w, h) {
    const f = ROT[face] !== undefined ? face : h > w ? 'right' : 'down';
    g.translate(x + w / 2, y + h / 2);
    g.rotate(ROT[f]);
    return f === 'left' || f === 'right' ? [h, w] : [w, h];
  }
  // Where a local point ends up on screen, for text that has to stay upright.
  function toScreen(face, cx, cy, lx, ly) {
    switch (face) {
      case 'up': return [cx - lx, cy - ly];
      case 'right': return [cx + ly, cy - lx];
      case 'left': return [cx - ly, cy + lx];
      default: return [cx + lx, cy + ly];
    }
  }

  // ---------- Floors ----------
  // A floor material across a rectangle, lined up with the grid at (gx, gy).
  function paintFloor(g, spec, x, y, w, h, C, P, cell, gx, gy) {
    const [mat, variant] = String(spec).split(':');
    const fine = cell >= 10;
    const ink = (a) => rgba(C.ink, a);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    // Grid-aligned start positions, so patterns sit under the squares.
    const sx = (step) => gx + Math.floor((x - gx) / step) * step;
    const sy = (step) => gy + Math.floor((y - gy) / step) * step;
    const R = rng(Math.floor(x * 31 + y * 17 + w));
    switch (mat) {
      case 'wood': {
        const base = variant === 'dark' ? P.woodDark : variant === 'pale' ? P.cream : P.wood;
        g.fillStyle = rgba(base, P.d ? 0.42 : variant === 'dark' ? 0.32 : 0.42);
        g.fillRect(x, y, w, h);
        const ph = cell / 2;
        for (let yy = sy(ph), k = 0; yy < y + h; yy += ph, k++) {
          if (k % 3 === 1) { g.fillStyle = rgba(P.woodDeep, P.d ? 0.12 : 0.1); g.fillRect(x, yy, w, ph); }
          if (!fine) continue;
          g.strokeStyle = P.grain;
          g.lineWidth = 0.7;
          g.beginPath();
          g.moveTo(x, yy + 0.35);
          g.lineTo(x + w, yy + 0.35);
          const step = cell * (2.5 + (k % 3) * 0.75);
          for (let xx = sx(cell) + ((k * 7) % 5) * cell * 0.55; xx < x + w; xx += step) { g.moveTo(xx, yy); g.lineTo(xx, yy + ph); }
          g.stroke();
        }
        break;
      }
      case 'court': {
        // A school gym floor, with the court lines still on it.
        paintFloor(g, 'wood', x, y, w, h, C, P, cell, gx, gy);
        if (!fine) break;
        g.strokeStyle = rgba(P.d ? '#e0b24c' : '#c98a1e', 0.55);
        g.lineWidth = 2;
        g.strokeRect(x + cell * 1, y + cell * 0.5, w - cell * 2, h - cell);
        g.beginPath();
        g.moveTo(x + w / 2, y + cell * 0.5);
        g.lineTo(x + w / 2, y + h - cell * 0.5);
        g.stroke();
        g.beginPath();
        g.arc(x + w / 2, y + h / 2, cell * 2.2, 0, TAU);
        g.stroke();
        g.strokeStyle = rgba(P.d ? '#6c9bd2' : '#3a6fb3', 0.4);
        g.beginPath();
        g.arc(x + cell, y + h / 2, cell * 4, -Math.PI / 2, Math.PI / 2);
        g.arc(x + w - cell, y + h / 2, cell * 4, Math.PI / 2, Math.PI * 1.5);
        g.stroke();
        break;
      }
      case 'tile': case 'checker': case 'lino': {
        const step = mat === 'lino' ? cell * 2 : cell;
        const tint = variant === 'warm' ? P.clay : variant === 'cool' ? (P.d ? '#4b6a86' : '#9fbfd6') : variant === 'green' ? P.tile : null;
        if (tint) { g.fillStyle = rgba(tint, P.d ? 0.22 : 0.2); g.fillRect(x, y, w, h); }
        if (mat === 'checker' || mat === 'lino') {
          g.fillStyle = mat === 'checker' ? ink(P.d ? 0.06 : 0.05) : ink(P.d ? 0.04 : 0.035);
          for (let yy = sy(step), j = Math.round((sy(step) - gy) / step); yy < y + h; yy += step, j++)
            for (let xx = sx(step), i = Math.round((sx(step) - gx) / step); xx < x + w; xx += step, i++) if ((i + j) % 2 === 0) g.fillRect(xx, yy, step, step);
        }
        if (fine) {
          g.strokeStyle = ink(P.d ? 0.1 : 0.08);
          g.lineWidth = 0.8;
          g.beginPath();
          for (let xx = sx(step); xx <= x + w; xx += step) { g.moveTo(xx + 0.4, y); g.lineTo(xx + 0.4, y + h); }
          for (let yy = sy(step); yy <= y + h; yy += step) { g.moveTo(x, yy + 0.4); g.lineTo(x + w, yy + 0.4); }
          g.stroke();
        }
        break;
      }
      case 'terrazzo': case 'marble': {
        g.fillStyle = ink(P.d ? 0.04 : 0.03);
        g.fillRect(x, y, w, h);
        if (!fine) break;
        if (mat === 'terrazzo') {
          const n = Math.floor((w * h) / 120);
          for (let k = 0; k < n; k++) {
            g.fillStyle = rgba(k % 3 ? C.ink3 : P.hues[k % 5], P.d ? 0.22 : 0.22);
            const px = x + R() * w, py = y + R() * h, s = 0.8 + R() * 1.6;
            g.beginPath();
            g.moveTo(px, py - s); g.lineTo(px + s, py + s * 0.4); g.lineTo(px - s * 0.7, py + s * 0.8);
            g.fill();
          }
        } else {
          const step = cell * 3;
          g.strokeStyle = ink(P.d ? 0.12 : 0.09);
          g.lineWidth = 0.8;
          g.beginPath();
          for (let xx = sx(step); xx <= x + w; xx += step) { g.moveTo(xx, y); g.lineTo(xx, y + h); }
          for (let yy = sy(step); yy <= y + h; yy += step) { g.moveTo(x, yy); g.lineTo(x + w, yy); }
          g.stroke();
          g.strokeStyle = ink(P.d ? 0.08 : 0.06);
          g.lineWidth = 1;
          for (let k = 0; k < (w * h) / (step * step) * 1.2; k++) {
            const px = x + R() * w, py = y + R() * h;
            g.beginPath();
            g.moveTo(px, py);
            g.bezierCurveTo(px + 10, py + 6, px + 18, py - 4, px + 30 + R() * 20, py + 8);
            g.stroke();
          }
        }
        break;
      }
      case 'stone': {
        // Pavers, or Melbourne bluestone when the variant says so.
        const blue = variant === 'blue';
        g.fillStyle = blue ? rgba(P.d ? '#26303d' : '#5d6878', P.d ? 0.5 : 0.22) : rgba(P.d ? '#4a4840' : '#c4b9a6', P.d ? 0.35 : 0.3);
        g.fillRect(x, y, w, h);
        if (!fine) break;
        const ph = blue ? cell * 0.5 : cell;
        const pw = blue ? cell * 1.1 : cell * 1.5;
        g.strokeStyle = blue ? rgba(P.d ? '#000000' : '#3b4452', P.d ? 0.35 : 0.22) : ink(P.d ? 0.18 : 0.1);
        g.lineWidth = 1;
        g.beginPath();
        for (let yy = sy(ph), k = 0; yy < y + h; yy += ph, k++) {
          g.moveTo(x, yy + 0.5); g.lineTo(x + w, yy + 0.5);
          for (let xx = sx(pw) - (k % 2 ? pw / 2 : 0); xx < x + w; xx += pw) { g.moveTo(xx + 0.5, yy); g.lineTo(xx + 0.5, yy + ph); }
        }
        g.stroke();
        break;
      }
      case 'concrete': case 'asphalt': {
        g.fillStyle = mat === 'asphalt' ? ink(P.d ? 0.12 : 0.1) : ink(P.d ? 0.05 : 0.045);
        g.fillRect(x, y, w, h);
        if (!fine) break;
        g.fillStyle = ink(P.d ? 0.1 : 0.07);
        for (let k = 0; k < (w * h) / 90; k++) g.fillRect(x + R() * w, y + R() * h, 1, 1);
        if (mat === 'concrete') {
          g.strokeStyle = ink(P.d ? 0.12 : 0.08);
          g.beginPath();
          const step = cell * 6;
          for (let xx = sx(step); xx <= x + w; xx += step) { g.moveTo(xx, y); g.lineTo(xx, y + h); }
          for (let yy = sy(step); yy <= y + h; yy += step) { g.moveTo(x, yy); g.lineTo(x + w, yy); }
          g.stroke();
        }
        break;
      }
      case 'grass': {
        g.fillStyle = rgba(P.green, P.d ? 0.2 : 0.2);
        g.fillRect(x, y, w, h);
        if (!fine) break;
        g.strokeStyle = rgba(P.leaf, P.d ? 0.5 : 0.35);
        g.lineWidth = 1;
        g.beginPath();
        for (let k = 0; k < (w * h) / 110; k++) {
          const px = x + R() * w, py = y + R() * h;
          g.moveTo(px - 1.5, py); g.lineTo(px, py - 3); g.lineTo(px + 1.5, py);
        }
        g.stroke();
        break;
      }
      case 'carpet': {
        const col = { red: P.d ? '#7a2a26' : '#b5534a', blue: P.d ? '#2b3f66' : '#6d87b8', grey: P.d ? '#3a4352' : '#8e98a6', green: P.d ? '#2f5240' : '#6e9a80' }[variant];
        if (variant === 'arcade') {
          // Arcade carpet: dark, with little neon shapes that glow under black light.
          g.fillStyle = P.d ? 'rgba(20,10,40,0.4)' : 'rgba(40,30,80,0.16)';
          g.fillRect(x, y, w, h);
          if (!fine) break;
          for (let k = 0; k < (w * h) / 300; k++) {
            const px = x + R() * w, py = y + R() * h;
            g.strokeStyle = rgba(['#ff5fa2', '#4fd1ff', '#ffe14d', '#7dff7a'][k % 4], P.d ? 0.32 : 0.4);
            g.lineWidth = 1.2;
            g.beginPath();
            if (k % 3 === 0) g.arc(px, py, 2.2, 0, TAU);
            else if (k % 3 === 1) { g.moveTo(px - 3, py + 2); g.lineTo(px, py - 2); g.lineTo(px + 3, py + 2); }
            else { g.moveTo(px - 3, py); g.quadraticCurveTo(px, py - 3, px + 3, py); }
            g.stroke();
          }
          break;
        }
        g.fillStyle = rgba(col || C.route, P.d ? 0.24 : 0.18);
        g.fillRect(x, y, w, h);
        if (!fine) break;
        // A faint diamond weave.
        g.strokeStyle = rgba(col || C.route, P.d ? 0.22 : 0.2);
        g.lineWidth = 0.8;
        g.beginPath();
        const s = cell;
        for (let xx = sx(s) - h; xx < x + w + h; xx += s) { g.moveTo(xx, y); g.lineTo(xx + h, y + h); g.moveTo(xx + h, y); g.lineTo(xx, y + h); }
        g.stroke();
        break;
      }
      case 'rubber': {
        if (variant === 'play') {
          // Foam play mats in four colours.
          const step = cell * 2;
          for (let yy = sy(step), j = 0; yy < y + h; yy += step, j++)
            for (let xx = sx(step), i = 0; xx < x + w; xx += step, i++) {
              g.fillStyle = rgba(P.hues[(i + j * 2) % 4 === 3 ? 4 : (i + j * 2) % 4], P.d ? 0.14 : 0.12);
              g.fillRect(xx, yy, step, step);
            }
          break;
        }
        g.fillStyle = ink(P.d ? 0.12 : 0.07);
        g.fillRect(x, y, w, h);
        if (!fine) break;
        const step = cell * 2;
        g.strokeStyle = ink(P.d ? 0.2 : 0.1);
        g.beginPath();
        for (let xx = sx(step); xx <= x + w; xx += step) { g.moveTo(xx, y); g.lineTo(xx, y + h); }
        for (let yy = sy(step); yy <= y + h; yy += step) { g.moveTo(x, yy); g.lineTo(x + w, yy); }
        g.stroke();
        break;
      }
      case 'raised': {
        // Data-centre floor tiles, some of them perforated.
        g.fillStyle = ink(P.d ? 0.07 : 0.06);
        g.fillRect(x, y, w, h);
        const step = cell * 1.5;
        g.strokeStyle = ink(P.d ? 0.2 : 0.12);
        g.lineWidth = 1;
        g.beginPath();
        for (let xx = sx(step); xx <= x + w; xx += step) { g.moveTo(xx + 0.5, y); g.lineTo(xx + 0.5, y + h); }
        for (let yy = sy(step); yy <= y + h; yy += step) { g.moveTo(x, yy + 0.5); g.lineTo(x + w, yy + 0.5); }
        g.stroke();
        break;
      }
      case 'stage': {
        g.fillStyle = P.d ? 'rgba(0,0,0,0.35)' : 'rgba(24,32,46,0.12)';
        g.fillRect(x, y, w, h);
        break;
      }
    }
    g.restore();
  }

  // Floor markings and areas, drawn under everything else.
  function drawDeco(g, d, x, y, w, h, C, cell, P, gx, gy) {
    const fine = cell >= 10;
    switch (d.kind) {
      case 'surface': paintFloor(g, d.mat, x, y, w, h, C, P, cell, gx, gy); break;
      case 'rug': {
        const col = d.hue !== undefined ? P.hues[d.hue % P.hues.length] : P.red;
        g.fillStyle = rgba(col, P.d ? 0.14 : 0.14);
        roundRect(g, x + 3, y + 3, w - 6, h - 6, 3); g.fill();
        if (!fine) break;
        g.strokeStyle = rgba(col, P.d ? 0.45 : 0.35); g.lineWidth = 1.2;
        roundRect(g, x + 7, y + 7, w - 14, h - 14, 2); g.stroke();
        g.fillStyle = rgba(col, P.d ? 0.3 : 0.2);
        const mr = Math.min(w, h) * 0.16;
        g.beginPath(); g.moveTo(x + w / 2, y + h / 2 - mr); g.lineTo(x + w / 2 + mr, y + h / 2); g.lineTo(x + w / 2, y + h / 2 + mr); g.lineTo(x + w / 2 - mr, y + h / 2); g.fill();
        // Fringe.
        g.strokeStyle = rgba(col, 0.35); g.lineWidth = 0.8; g.beginPath();
        for (let yy = y + 5; yy < y + h - 4; yy += 3) { g.moveTo(x + 3, yy); g.lineTo(x, yy); g.moveTo(x + w - 3, yy); g.lineTo(x + w, yy); }
        g.stroke();
        break;
      }
      case 'mat': paintFloor(g, 'rubber', x + 2, y + 2, w - 4, h - 4, C, P, cell, gx, gy); break;
      case 'cold': {
        g.fillStyle = rgba(C.route, P.d ? 0.12 : 0.08); g.fillRect(x, y, w, h);
        if (!fine) break;
        g.strokeStyle = rgba(C.route, 0.25); g.lineWidth = 1; g.beginPath();
        for (let xx = x + cell; xx < x + w - cell; xx += cell * 3) {
          g.moveTo(xx, y + h / 2); g.lineTo(xx + cell, y + h / 2);
          g.moveTo(xx + cell - 3, y + h / 2 - 3); g.lineTo(xx + cell, y + h / 2); g.lineTo(xx + cell - 3, y + h / 2 + 3);
        }
        g.stroke();
        break;
      }
      case 'grass': paintFloor(g, 'grass', x, y, w, h, C, P, cell, gx, gy); break;
      case 'path': paintFloor(g, 'concrete', x, y, w, h, C, P, cell, gx, gy); break;
      case 'floor': g.fillStyle = C.panel; g.fillRect(x, y, w, h); if (d.mat) paintFloor(g, d.mat, x, y, w, h, C, P, cell, gx, gy); break;
      case 'tent': {
        g.fillStyle = C.panel; g.fillRect(x, y, w, h);
        // Striped canvas, seen from inside.
        for (let xx = x, k = 0; xx < x + w; xx += cell, k++) if (k % 2 === 0) { g.fillStyle = rgba(P.hues[4], P.d ? 0.12 : 0.1); g.fillRect(xx, y, Math.min(cell, x + w - xx), h); }
        g.strokeStyle = rgba(C.ink, 0.3); g.setLineDash([4, 3]); g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); g.setLineDash([]);
        // Guy ropes and pegs.
        g.strokeStyle = rgba(C.ink, 0.25); g.beginPath();
        for (const [px, py, qx, qy] of [[x, y, x - cell * 0.8, y - cell * 0.8], [x + w, y, x + w + cell * 0.8, y - cell * 0.8], [x, y + h, x - cell * 0.8, y + h + cell * 0.8], [x + w, y + h, x + w + cell * 0.8, y + h + cell * 0.8]]) { g.moveTo(px, py); g.lineTo(qx, qy); }
        g.stroke();
        break;
      }
      case 'lane': {
        g.fillStyle = rgba(P.d ? '#8a7150' : '#e9d3ad', P.d ? 0.45 : 0.75); g.fillRect(x, y + 2, w, h - 4);
        if (!fine) break;
        g.strokeStyle = P.grain; g.lineWidth = 0.6; g.beginPath();
        for (let yy = y + 2 + 3; yy < y + h - 2; yy += 3) { g.moveTo(x, yy); g.lineTo(x + w, yy); }
        g.stroke();
        // Foul line, approach dots and the target arrows.
        g.strokeStyle = rgba(C.ink, 0.35); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + cell * 2, y + 2); g.lineTo(x + cell * 2, y + h - 2); g.stroke();
        g.fillStyle = rgba(C.ink, 0.35);
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.arc(x + cell * 1.2, y + h / 2 + k * 4, 0.9, 0, TAU); g.fill(); }
        const ax = x + cell * 4.5;
        for (let k = -2; k <= 2; k++) { g.beginPath(); const yy = y + h / 2 + k * 4; const dx = Math.abs(k) * 3; g.moveTo(ax + dx, yy - 1.6); g.lineTo(ax + dx + 4, yy); g.lineTo(ax + dx, yy + 1.6); g.fill(); }
        break;
      }
      case 'bay': {
        paintFloor(g, 'asphalt', x, y, w, h, C, P, cell, gx, gy);
        g.strokeStyle = rgba(P.d ? '#e6eaf0' : '#ffffff', P.d ? 0.3 : 0.85); g.lineWidth = 1.5; g.beginPath();
        for (let xx = x + cell * 1.5; xx < x + w - cell; xx += cell * 5) {
          // Arrows showing the way through the forecourt.
          g.moveTo(xx, y + h / 2); g.lineTo(xx + cell * 1.4, y + h / 2);
          g.moveTo(xx + cell * 0.9, y + h / 2 - 4); g.lineTo(xx + cell * 1.4, y + h / 2); g.lineTo(xx + cell * 0.9, y + h / 2 + 4);
        }
        g.stroke();
        break;
      }
      case 'tracks': {
        // Ballast, sleepers, then the two rails.
        g.fillStyle = rgba(C.ink, P.d ? 0.18 : 0.12); g.fillRect(x, y + h * 0.08, w, h * 0.84);
        if (fine) {
          const R = rng(Math.floor(x + y));
          g.fillStyle = rgba(C.ink, P.d ? 0.25 : 0.14);
          for (let k = 0; k < (w * h) / 22; k++) g.fillRect(x + R() * w, y + h * 0.1 + R() * h * 0.8, 1.4, 1.4);
        }
        g.fillStyle = rgba(P.woodDeep, P.d ? 0.8 : 0.7);
        for (let xx = x + 2; xx < x + w; xx += cell * 0.55) g.fillRect(xx, y + h * 0.16, Math.max(1.5, cell * 0.18), h * 0.68);
        g.fillStyle = P.d ? '#8b96a8' : '#7d8794';
        g.fillRect(x, y + h * 0.3 - 1.5, w, 3);
        g.fillRect(x, y + h * 0.7 - 1.5, w, 3);
        break;
      }
      case 'paifang': break; // drawn over the floor dots, see drawOver
    }
  }

  // Things that sit on the floor but under the shelves: the Chinatown gate's roof.
  function drawOver(g, d, x, y, w, h, C, cell, P) {
    if (d.kind !== 'paifang') return;
    g.save();
    const [lw, lh] = orient(g, d.face || (h > w ? 'right' : 'down'), x, y, w, h);
    const fine = cell >= 10;
    g.shadowColor = P.shadow; g.shadowBlur = cell * 0.4; g.shadowOffsetY = cell * 0.12;
    // Green glazed tiles with a gold ridge and upturned ends.
    const L = lw / 2, D = lh / 2;
    g.fillStyle = P.d ? '#2f6150' : '#3f8a6c';
    g.beginPath();
    g.moveTo(-L - 4, -D + 2);
    g.quadraticCurveTo(-L + 6, -D + 6, -L + 10, -D + 4);
    g.lineTo(L - 10, -D + 4);
    g.quadraticCurveTo(L - 6, -D + 6, L + 4, -D + 2);
    g.lineTo(L, D - 4);
    g.lineTo(-L, D - 4);
    g.closePath();
    g.fill();
    g.shadowColor = 'transparent';
    if (fine) {
      g.strokeStyle = P.d ? 'rgba(0,0,0,0.35)' : 'rgba(20,60,40,0.35)'; g.lineWidth = 1; g.beginPath();
      for (let xx = -L + 4; xx < L - 2; xx += 4) { g.moveTo(xx, -D + 5); g.lineTo(xx, D - 5); }
      g.stroke();
    }
    g.fillStyle = P.gold;
    g.fillRect(-L - 2, -1.5, lw + 4, 3);
    g.fillStyle = P.lacquer;
    g.fillRect(-L, D - 5, lw, 4);
    g.restore();
    if (!fine || !d.text) return;
    // The name board in the middle, kept upright.
    const cx = x + w / 2, cy = y + h / 2;
    const px = Math.max(10, Math.min(15, cell * 0.62));
    g.font = FONT_CJK(px);
    const tw = Math.max(...[...d.text].map((ch) => g.measureText(ch).width));
    const vertical = h > w;
    const bw = vertical ? tw + 8 : tw * [...d.text].length + 10, bh = vertical ? px * [...d.text].length + 8 : px + 8;
    g.fillStyle = P.lacquer; roundRect(g, cx - bw / 2, cy - bh / 2, bw, bh, 2); g.fill();
    g.strokeStyle = P.gold; g.lineWidth = 1.2; roundRect(g, cx - bw / 2 + 1.5, cy - bh / 2 + 1.5, bw - 3, bh - 3, 1.5); g.stroke();
    g.fillStyle = P.d ? '#f2d58a' : '#f6d27a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...d.text].forEach((ch, k) => {
      if (vertical) g.fillText(ch, cx, cy - bh / 2 + 4 + px * (k + 0.5));
      else g.fillText(ch, cx - bw / 2 + 5 + tw * (k + 0.5), cy + 0.5);
    });
  }

  // ---------- Shelves ----------
  function drawShelf(g, s, x, y, w, h, C, cell, P) {
    const fine = cell >= 10;
    const vertical = h > w;
    const len = vertical ? h : w;
    const wood = s.style === 'bread' || s.style === 'books' || s.style === 'tins' || s.style === 'drawers' || s.style === 'records';
    g.save();
    g.shadowColor = P.shadow; g.shadowBlur = cell * 0.25; g.shadowOffsetY = cell * 0.08;
    g.fillStyle = s.style === 'ice' ? (P.d ? '#2e4256' : '#e4eff7') : s.style === 'racking' ? rgba(C.ink, P.d ? 0.2 : 0.07) : wood ? (P.d ? '#4f4234' : '#e2cfb2') : C.shelf;
    roundRect(g, x, y, w, h, 3);
    g.fill();
    g.restore();
    g.strokeStyle = wood ? rgba(P.woodDeep, P.d ? 0.8 : 0.7) : C.rule;
    g.lineWidth = 1;
    roundRect(g, x + 0.5, y + 0.5, w - 1, h - 1, 3);
    g.stroke();
    if (s.style === 'plain' || !fine) return;
    // Lay out goods along both long sides: (along, across) in shelf space.
    const R = rng(hashOf(Math.round(x), Math.round(y)));
    const at = (a, b, la, lb) => (vertical ? [x + b, y + a, lb, la] : [x + a, y + b, la, lb]);
    const across = vertical ? w : h;
    const band = Math.max(3, Math.min(6, (across - 6) / 2));
    const sides = across >= 12 ? [2, across - 2 - band] : [2];
    switch (s.style) {
      case 'books': case 'toys': case 'records': {
        for (const b0 of sides) {
          for (let a = 3; a < len - 3;) {
            const t = s.style === 'books' ? 2 + Math.floor(R() * 3) : s.style === 'records' ? 1.2 : 4 + Math.floor(R() * 4);
            const deep = s.style === 'books' ? band * (0.7 + R() * 0.3) : band;
            g.fillStyle = rgba(P.hues[Math.floor(R() * P.hues.length)], P.d ? 0.75 : 0.7);
            const [rx, ry, rw, rh] = at(a, b0 === 2 ? b0 : b0 + band - deep, Math.min(t, len - 3 - a), deep);
            g.fillRect(rx, ry, rw, rh);
            a += t + (s.style === 'records' ? 0.6 : 0.8);
          }
        }
        break;
      }
      case 'bread': {
        for (const b0 of sides) {
          for (let a = 4; a < len - 6;) {
            const kind = R();
            const l = kind < 0.4 ? 9 : kind < 0.7 ? 6 : 4;
            const [cx0, cy0] = at(a + l / 2, b0 + band / 2, 0, 0);
            g.fillStyle = kind < 0.4 ? (P.d ? '#a77b45' : '#cf9a5c') : kind < 0.7 ? (P.d ? '#b88a52' : '#e0ab68') : (P.d ? '#c09a62' : '#e8c27e');
            g.beginPath();
            g.ellipse(cx0, cy0, vertical ? band / 2 : l / 2, vertical ? l / 2 : band / 2, 0, 0, TAU);
            g.fill();
            if (kind < 0.4) {
              g.strokeStyle = 'rgba(255,240,210,0.6)'; g.lineWidth = 0.8; g.beginPath();
              for (let k = -1; k <= 1; k++) { const [px, py] = at(a + l / 2 + k * 2.5, b0 + band / 2, 0, 0); g.moveTo(px - 1, py - 1); g.lineTo(px + 1, py + 1); }
              g.stroke();
            }
            a += l + 2;
          }
        }
        break;
      }
      case 'ice': {
        g.fillStyle = 'rgba(255,255,255,0.65)';
        for (let k = 0; k < (w * h) / 14; k++) g.fillRect(x + 2 + R() * (w - 4), y + 2 + R() * (h - 4), 1.3, 1.3);
        // Fish laid out on the ice.
        for (let a = 6; a < len - 8; a += 11) {
          const [fx, fy] = at(a, across / 2 + (R() - 0.5) * (across - 12) * 0.5, 0, 0);
          const col = [P.d ? '#8c99ab' : '#a9b6c6', P.d ? '#c07062' : '#e3907d', P.d ? '#9aa3ad' : '#c7ccd2'][Math.floor(R() * 3)];
          g.save(); g.translate(fx, fy); if (vertical) g.rotate(Math.PI / 2);
          g.fillStyle = col;
          g.beginPath(); g.ellipse(0, 0, 4.2, 1.8, 0, 0, TAU); g.fill();
          g.beginPath(); g.moveTo(3.6, 0); g.lineTo(6.2, -1.8); g.lineTo(6.2, 1.8); g.fill();
          g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-3, -0.6, 1, 1);
          g.restore();
        }
        break;
      }
      case 'racking': {
        // Orange uprights and beams, with boxes on pallets between them.
        const bays = Math.max(1, Math.round(len / (cell * 1.4)));
        const step = (len - 2) / bays;
        for (let k = 0; k < bays; k++) {
          const [bx, by, bw, bh] = at(k * step + 3, 3, step - 3, across - 6);
          g.fillStyle = P.card; g.fillRect(bx, by, bw, bh);
          g.strokeStyle = rgba(P.woodDark, 0.4); g.lineWidth = 0.8; g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        }
        g.fillStyle = P.d ? '#d27a35' : '#e2782b';
        g.fillRect(...at(0, 0, len, 2));
        g.fillRect(...at(0, across - 2, len, 2));
        for (let k = 0; k <= bays; k++) g.fillRect(...at(Math.min(len - 2.5, k * step), 0, 2.5, across));
        break;
      }
      case 'tins': {
        for (const b0 of sides) {
          const r = band / 2;
          for (let a = 3 + r, k = 0; a < len - 3 - r; a += r * 2 + 1.5, k++) {
            const [cx0, cy0] = at(a, b0 + r, 0, 0);
            g.fillStyle = [P.lacquer, P.gold, P.tile, P.d ? '#6a5a8a' : '#7d6aa8', P.clay][Math.floor(R() * 5)];
            g.beginPath(); g.arc(cx0, cy0, r, 0, TAU); g.fill();
            g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.7; g.beginPath(); g.arc(cx0, cy0, r * 0.6, 0, TAU); g.stroke();
          }
        }
        break;
      }
      case 'drawers': {
        // A wall of little wooden drawers, each with a brass knob.
        const n = Math.max(1, Math.floor(len / 7));
        const step = (len - 4) / n;
        const rowsN = across >= 12 ? 2 : 1;
        for (let j = 0; j < rowsN; j++)
          for (let k = 0; k < n; k++) {
            const [dx, dy, dw, dh] = at(2 + k * step + 0.5, 2 + j * ((across - 4) / rowsN) + 0.5, step - 1, (across - 4) / rowsN - 1);
            g.fillStyle = P.d ? '#6a4f39' : '#c49a6c'; g.fillRect(dx, dy, dw, dh);
            g.fillStyle = P.gold; g.beginPath(); g.arc(dx + dw / 2, dy + dh / 2, 1, 0, TAU); g.fill();
          }
        break;
      }
      default: {
        // A supermarket shelf: products along both faces, a spine down the middle.
        for (const b0 of sides) {
          for (let a = 3; a < len - 3;) {
            const t = 2.5 + Math.floor(R() * 5);
            g.fillStyle = rgba(P.hues[Math.floor(R() * P.hues.length)], P.d ? 0.5 : 0.48);
            const [rx, ry, rw, rh] = at(a, b0, Math.min(t, len - 3 - a), band);
            g.fillRect(rx, ry, rw, rh);
            a += t + 1;
          }
        }
        if (sides.length > 1) {
          g.strokeStyle = rgba(C.ink, P.d ? 0.18 : 0.12); g.lineWidth = 1; g.beginPath();
          if (vertical) { g.moveTo(x + w / 2, y + 3); g.lineTo(x + w / 2, y + h - 3); } else { g.moveTo(x + 3, y + h / 2); g.lineTo(x + w - 3, y + h / 2); }
          g.stroke();
        }
      }
    }
  }

  // ---------- Fixtures ----------
  function drawFixture(g, f, x, y, w, h, C, cell, P) {
    const fine = cell >= 10;
    const ink = (a) => rgba(C.ink, a);
    const vertical = h > w;
    const H = hashOf(f.c, f.r, f.kind.length);
    const R = rng(H);
    // Shapes with a soft shadow under them, so things sit on the floor.
    const lifted = (fn) => { g.save(); g.shadowColor = P.shadow; g.shadowBlur = cell * 0.3; g.shadowOffsetY = cell * 0.09; fn(); g.restore(); };
    const rr = (rx, ry, rw, rh, r, fill, stroke, lw = 1) => {
      roundRect(g, rx, ry, rw, rh, r);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    };
    const dot = (cx, cy, r, fill, stroke, lw = 1) => {
      g.beginPath(); g.arc(cx, cy, Math.max(0.3, r), 0, TAU);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
    };
    const box = (fill, stroke = C.rule, r = 3) => lifted(() => rr(x, y, w, h, r, fill)) || rr(x + 0.5, y + 0.5, w - 1, h - 1, r, null, stroke);
    // Draw facing down, centred, in local units; the canvas turns it the right way.
    const turned = (fn) => { g.save(); const [lw, lh] = orient(g, f.face, x, y, w, h); fn(lw, lh, lw / 2, lh / 2); g.restore(); };
    const depthOf = () => (f.face === 'left' || f.face === 'right' || (!f.face && vertical) ? w : h);
    const sign = (text, lx, ly, opts = {}) => {
      if (!fine || !text) return;
      const [sx, sy] = toScreen(f.face || (vertical ? 'right' : 'down'), x + w / 2, y + h / 2, lx, ly);
      const cjk = /[㐀-鿿]/.test(text);
      const px = opts.px || Math.max(8, Math.min(cjk ? 14 : 10, cell * (cjk ? 0.6 : 0.42)));
      g.font = cjk ? FONT_CJK(px) : FONT_UI(px, 700);
      const tw = g.measureText(text).width;
      const bw = tw + 8, bh = px + 6;
      lifted(() => rr(sx - bw / 2, sy - bh / 2, bw, bh, 2, opts.bg || P.lacquer));
      if (opts.border !== false) rr(sx - bw / 2 + 1.5, sy - bh / 2 + 1.5, bw - 3, bh - 3, 1.5, null, opts.line || P.gold, 0.8);
      g.fillStyle = opts.color || (P.d ? '#f2d58a' : '#f8dc8c');
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, sx, sy + 0.5);
    };
    const chairs = (cx, cy, rad, n, col, kind = 'chair') => {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + (n === 2 ? 0 : Math.PI / 4) * (n === 4 ? 0 : 1);
        const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
        if (kind === 'stool') { dot(px, py, cell * 0.16, col, rgba(C.ink, 0.25), 0.8); continue; }
        g.save(); g.translate(px, py); g.rotate(a + Math.PI / 2);
        const cw = cell * 0.42, cd = cell * 0.32;
        lifted(() => rr(-cw / 2, -cd / 2, cw, cd, 2, col));
        rr(-cw / 2, cd / 2 - 2.2, cw, 2.2, 1, rgba(C.ink, 0.25));
        g.restore();
      }
    };
    switch (f.kind) {
      case 'counter': {
        // A checkout: a till at one end and a belt running the length of it.
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 3, P.d ? '#3b4556' : '#dfe4ea'));
          rr(-X + 0.5, -Y + 0.5, lw - 1, lh - 1, 3, null, ink(0.3));
          if (!fine) return;
          const bx = -X + Math.min(lw * 0.3, cell * 1.2), bw = lw - (bx + X) - 3;
          rr(bx, -Y + 3, bw, lh * 0.55, 1.5, P.d ? '#151a22' : '#3a404b');
          g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.beginPath();
          for (let xx = bx + 3; xx < bx + bw; xx += 4) { g.moveTo(xx, -Y + 3); g.lineTo(xx, -Y + 3 + lh * 0.55); }
          g.stroke();
          // The till and its little screen.
          rr(-X + 3, -Y + 3, Math.min(lw * 0.3, cell * 1.2) - 5, lh - 6, 2, P.d ? '#212834' : '#59616e');
          rr(-X + 5, -Y + 5, Math.min(10, Math.min(lw * 0.3, cell * 1.2) - 9), Math.max(3, lh * 0.35), 1, rgba(C.route, 0.7));
          // A divider stick and a few groceries on the belt.
          g.fillStyle = P.hues[(H % 5)]; g.fillRect(bx + bw * 0.6, -Y + 4, 6, lh * 0.25);
          g.fillStyle = P.hues[(H + 2) % 7]; g.fillRect(bx + bw * 0.3, -Y + 4, 5, lh * 0.3);
        });
        break;
      }
      case 'bar': {
        // A counter with the back of house behind it and, if wanted, stools in front.
        const stools = f.stools !== false;
        turned((lw, lh, X, Y) => {
          const depth = stools && lh > cell * 0.8 ? lh * 0.62 : lh;
          const top = f.top === 'stone' ? (P.d ? '#596273' : '#e9ecef') : f.top === 'dark' ? P.woodDark : P.wood;
          lifted(() => rr(-X, -Y, lw, depth, 3, top));
          rr(-X + 0.5, -Y + 0.5, lw - 1, depth - 1, 3, null, rgba(P.woodDark, 0.45));
          if (!fine) return;
          g.fillStyle = rgba(C.ink, 0.1); g.fillRect(-X + 2, -Y + depth - 3, lw - 4, 2);
          if (stools && depth < lh) for (let xx = -X + cell * 0.6; xx < X - cell * 0.3; xx += cell * 1.2) dot(xx, -Y + depth + (lh - depth) / 2 + 1, Math.min(cell * 0.2, (lh - depth) / 2), P.d ? '#3c4655' : '#7d8794', rgba(C.ink, 0.2), 0.8);
          const mid = -Y + depth / 2;
          const items = f.items || 'coffee';
          if (items === 'coffee') {
            // Espresso machine, grinder, then cups and a cake stand.
            rr(-X + 4, -Y + 2, cell * 1.3, depth - 5, 2, P.steel, ink(0.3));
            dot(-X + 4 + cell * 0.4, mid, 2, P.black); dot(-X + 4 + cell * 0.9, mid, 2, P.black);
            dot(-X + cell * 2.2, mid, cell * 0.2, P.black);
            for (let xx = -X + cell * 3; xx < X - cell * 1.5; xx += cell * 1.3) { dot(xx, mid, 3.4, P.white, ink(0.25), 0.8); dot(xx, mid, 1.8, P.d ? '#6d4a32' : '#8b5a36'); }
            dot(X - cell * 0.9, mid, Math.min(depth * 0.36, cell * 0.38), 'rgba(255,255,255,0.5)', ink(0.25));
            dot(X - cell * 0.9, mid, Math.min(depth * 0.22, cell * 0.24), P.d ? '#a9744a' : '#d39b62');
          } else if (items === 'drinks') {
            // Bubble tea: cups with straws, and a row of tapioca pots.
            for (let xx = -X + cell * 0.7; xx < X - cell * 0.6; xx += cell * 0.9) {
              const tone = [P.d ? '#a98a6c' : '#d9b48f', P.d ? '#7b6aa8' : '#b7a1db', P.d ? '#7e9a62' : '#b8d49a'][Math.floor(R() * 3)];
              dot(xx, mid, 3.6, tone, ink(0.25), 0.8);
              dot(xx + 1, mid - 1, 1, P.black);
            }
          } else if (items === 'tea') {
            for (let xx = -X + cell * 0.7; xx < X - cell * 0.6; xx += cell * 1.1) {
              dot(xx, mid, 3.6, [P.lacquer, P.gold, P.tile][Math.floor(R() * 3)], 'rgba(255,255,255,0.4)', 0.8);
            }
            dot(X - cell * 0.8, mid, 4.5, P.clay); g.fillStyle = P.clay; g.fillRect(X - cell * 0.8 + 3.5, mid - 1, 4, 2);
          } else if (items === 'chemist') {
            for (let xx = -X + cell * 0.6; xx < X - cell * 0.5; xx += cell * 0.7) rr(xx, mid - 3, 5, 6, 1, R() < 0.5 ? P.white : (P.d ? '#8fb7a0' : '#cfe6d8'), ink(0.2), 0.6);
          } else if (items === 'cinema') {
            // A popcorn machine and a row of drinks.
            rr(-X + 4, -Y + 2, cell * 1.4, depth - 5, 2, P.red);
            rr(-X + 6, -Y + 4, cell * 1.4 - 4, depth - 9, 1.5, P.d ? '#d6b65a' : '#f3d77c');
            for (let k = 0; k < 6; k++) dot(-X + 8 + R() * (cell * 1.4 - 8), -Y + 5 + R() * (depth - 11), 1.4, '#fff8e0');
            for (let xx = -X + cell * 2.6; xx < X - cell * 0.6; xx += cell * 0.9) { dot(xx, mid, 3.2, xx % 2 ? P.red : P.white, ink(0.25), 0.8); }
          } else if (items === 'service') {
            dot(-X + cell * 0.7, mid, 2.5, P.gold);
            rr(-X + cell * 1.3, mid - 3, cell, 6, 1, P.sheet, ink(0.2), 0.6);
          }
        });
        break;
      }
      case 'kiosk': {
        // A self-checkout: scanner, screen and a bagging shelf.
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 3, P.d ? '#3b4556' : '#e6eaef'));
          rr(-X + 0.5, -Y + 0.5, lw - 1, lh - 1, 3, null, ink(0.3));
          if (!fine) return;
          rr(-X + 3, -Y + 3, lw - 6, lh * 0.32, 1.5, P.d ? '#151a22' : '#3a404b');
          rr(-X + 4, -Y + 4, lw - 8, lh * 0.32 - 2, 1, rgba(C.route, 0.6));
          rr(-X + 3, 0, lw * 0.45, lh / 2 - 3, 1, rgba(C.ink, 0.2));
          g.fillStyle = 'rgba(230,60,60,0.7)'; g.fillRect(-X + 4, lh / 4 - 0.5, lw * 0.45 - 2, 1);
        });
        break;
      }
      case 'display': {
        // A promo table: stacks of the week's specials and a price card.
        lifted(() => rr(x, y, w, h, 3, P.wood));
        rr(x + 0.5, y + 0.5, w - 1, h - 1, 3, null, rgba(P.woodDark, 0.4));
        if (!fine) break;
        const s = Math.max(4, Math.min(7, cell * 0.3));
        const hueA = P.hues[H % 7], hueB = P.hues[(H + 3) % 7];
        for (let yy = y + 3, j = 0; yy + s <= y + h - 3; yy += s + 1, j++)
          for (let xx = x + 3, i = 0; xx + s <= x + w - 3; xx += s + 1, i++) {
            g.fillStyle = (Math.floor(i / 2) + j) % 2 ? hueA : hueB;
            g.fillRect(xx, yy, s, s);
            g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(xx, yy, s, 1.2);
          }
        if (w > cell * 1.4) { lifted(() => rr(x + w - 13, y + h - 9, 11, 7, 1, P.d ? '#e8c25c' : '#ffe27a')); g.fillStyle = P.red; g.fillRect(x + w - 11, y + h - 6.5, 7, 1.6); }
        break;
      }
      case 'fruit': {
        // Wooden crates, one fruit each.
        const n = Math.max(1, Math.round((vertical ? h : w) / (cell * 1.1)));
        const FRUIT = [['#e8963c', '#d47f2a'], ['#d4513f', '#b83c2c'], ['#8cbf4a', '#6f9f36'], ['#ecd04f', '#d1b23a'], ['#8a5aa8', '#6f448c'], ['#f0a37a', '#d9865f'], ['#5c7d3a', '#4a682c']];
        for (let k = 0; k < n; k++) {
          const cx0 = vertical ? x : x + (k * w) / n, cy0 = vertical ? y + (k * h) / n : y;
          const cw = vertical ? w : w / n - (k < n - 1 ? 1.5 : 0), ch = vertical ? h / n - (k < n - 1 ? 1.5 : 0) : h;
          lifted(() => rr(cx0, cy0, cw, ch, 2, P.wood));
          rr(cx0 + 2, cy0 + 2, cw - 4, ch - 4, 1, P.woodDeep);
          if (!fine) { g.fillStyle = FRUIT[(H + k) % FRUIT.length][0]; g.fillRect(cx0 + 2, cy0 + 2, cw - 4, ch - 4); continue; }
          const [col, deep] = FRUIT[(H + k * 3) % FRUIT.length];
          const r = Math.max(2, Math.min(3.4, cell * 0.15));
          for (let yy = cy0 + 3 + r, j = 0; yy <= cy0 + ch - 3 - r + 0.1; yy += r * 1.75, j++)
            for (let xx = cx0 + 3 + r + (j % 2 ? r * 0.9 : 0); xx <= cx0 + cw - 3 - r + 0.1; xx += r * 2) {
              dot(xx, yy, r, R() < 0.3 ? deep : col);
              dot(xx - r * 0.35, yy - r * 0.35, r * 0.3, 'rgba(255,255,255,0.45)');
            }
        }
        break;
      }
      case 'flowers': {
        // A steel bucket full of one kind of flower.
        const cx0 = x + w / 2, cy0 = y + h / 2, r = Math.min(w, h) / 2;
        lifted(() => dot(cx0, cy0, r, P.steel));
        dot(cx0, cy0, r - 1.5, P.steelDeep);
        if (!fine) { dot(cx0, cy0, r * 0.6, P.hues[H % 7]); break; }
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + H;
          g.save(); g.translate(cx0 + Math.cos(a) * r * 0.55, cy0 + Math.sin(a) * r * 0.55); g.rotate(a);
          g.fillStyle = k % 2 ? P.leaf : P.leafLight; g.beginPath(); g.ellipse(0, 0, r * 0.4, r * 0.16, 0, 0, TAU); g.fill();
          g.restore();
        }
        const col = ['#e86a7a', '#f2c94c', '#f29e4c', '#c78fe0', '#ffffff', '#e8505b', '#f6a5c0'][H % 7];
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU + 0.4, bx = cx0 + Math.cos(a) * r * 0.38 * (k ? 1 : 0), by = cy0 + Math.sin(a) * r * 0.38 * (k ? 1 : 0);
          for (let p = 0; p < 5; p++) dot(bx + Math.cos((p / 5) * TAU) * r * 0.13, by + Math.sin((p / 5) * TAU) * r * 0.13, r * 0.12, P.d ? rgba(col, 0.85) : col);
          dot(bx, by, r * 0.07, P.d ? '#d9b04a' : '#f2c14e');
        }
        break;
      }
      case 'freezer': {
        lifted(() => rr(x, y, w, h, 3, P.d ? '#3d4a5e' : '#eef2f6'));
        rr(x + 0.5, y + 0.5, w - 1, h - 1, 3, null, rgba(C.route, 0.35));
        if (!fine) break;
        const len = vertical ? h : w;
        const n = Math.max(1, Math.round(len / (cell * 2)));
        for (let k = 0; k < n; k++) {
          const a0 = (k * len) / n + 3, l = len / n - 4;
          const [gx0, gy0, gw, gh] = vertical ? [x + 3, y + a0, w - 6, l] : [x + a0, y + 3, l, h - 6];
          rr(gx0, gy0, gw, gh, 1.5, P.d ? '#22344a' : '#d6e6f3');
          for (let j = 0; j < 4; j++) { g.fillStyle = rgba(P.hues[(H + k + j) % 7], 0.45); g.fillRect(gx0 + 2 + R() * (gw - 8), gy0 + 2 + R() * (gh - 7), 5, 4); }
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(gx0 + 1, gy0 + 1, vertical ? gw - 2 : 2, vertical ? 2 : gh - 2);
        }
        break;
      }
      case 'table': case 'gametable': case 'teatable': {
        const cx0 = x + w / 2, cy0 = y + h / 2, s = Math.min(w, h);
        const square = f.shape === 'square' || f.kind === 'gametable' || f.kind === 'teatable';
        const tr = s * (f.chairs === 0 ? 0.42 : 0.3);
        const nChairs = f.chairs ?? (s > cell * 1.6 ? 4 : 2);
        const seat = f.kind === 'teatable' ? (P.d ? '#6b3a35' : '#b9574d') : f.seat === 'stool' ? (P.d ? '#596273' : '#aeb7c2') : P.d ? '#4a5263' : '#9aa3b0';
        chairs(cx0, cy0, tr + s * 0.13, nChairs, seat, f.seat === 'stool' || f.kind === 'teatable' ? 'stool' : 'chair');
        const top = f.top === 'stone' ? (P.d ? '#596273' : '#f1f1ee') : f.kind === 'teatable' ? P.woodDark : P.wood;
        lifted(() => (square ? rr(cx0 - tr, cy0 - tr, tr * 2, tr * 2, 2, top) : dot(cx0, cy0, tr, top)));
        if (square) rr(cx0 - tr + 0.5, cy0 - tr + 0.5, tr * 2 - 1, tr * 2 - 1, 2, null, rgba(P.woodDark, 0.45)); else dot(cx0, cy0, tr - 0.5, null, rgba(P.woodDark, 0.4));
        if (!fine) break;
        const set = f.set || (f.kind === 'gametable' ? 'game' : f.kind === 'teatable' ? 'tea' : 'cups');
        const ring = (n, rad, fn) => { for (let k = 0; k < n; k++) { const a = (k / n) * TAU + Math.PI / 4; fn(cx0 + Math.cos(a) * rad, cy0 + Math.sin(a) * rad, k); } };
        if (set === 'cups') ring(Math.max(1, Math.min(nChairs, 3)), tr * 0.5, (px, py) => { dot(px, py, 3.2, P.white, ink(0.22), 0.7); dot(px, py, 1.7, P.d ? '#6d4a32' : '#9b6a43'); });
        else if (set === 'boba') ring(Math.min(nChairs, 3), tr * 0.5, (px, py, k) => { dot(px, py, 3.2, [P.d ? '#a98a6c' : '#d9b48f', P.d ? '#7b6aa8' : '#b7a1db', P.d ? '#7e9a62' : '#b8d49a'][(k + H) % 3], ink(0.22), 0.7); dot(px + 0.8, py - 0.8, 0.9, P.black); });
        else if (set === 'bowls') ring(Math.min(nChairs, 4), tr * 0.5, (px, py, k) => { dot(px, py, 3.6, P.white, ink(0.22), 0.7); dot(px, py, 2.4, k % 2 ? (P.d ? '#c08a45' : '#e8b45c') : (P.d ? '#b0563f' : '#d9734f')); });
        else if (set === 'steamers') {
          ring(3, tr * 0.42, (px, py) => {
            dot(px, py, tr * 0.38, P.d ? '#8f7650' : '#d9bf86', P.d ? '#6c5838' : '#b49556', 1);
            g.strokeStyle = P.d ? 'rgba(0,0,0,0.3)' : 'rgba(140,110,60,0.5)'; g.lineWidth = 0.6; g.beginPath();
            for (let k = -2; k <= 2; k++) { g.moveTo(px + k * tr * 0.12, py - tr * 0.3); g.lineTo(px + k * tr * 0.12, py + tr * 0.3); }
            g.stroke();
          });
          dot(cx0, cy0, 2, P.red);
        } else if (set === 'plates') ring(Math.min(nChairs, 4), tr * 0.55, (px, py, k) => { dot(px, py, 3.8, P.white, ink(0.2), 0.7); dot(px, py, 2, P.hues[(H + k) % 7]); });
        else if (set === 'game') {
          const b = tr * 1.2;
          rr(cx0 - b / 2, cy0 - b / 2, b, b, 1, P.d ? '#c9c2a4' : '#f2ead0', ink(0.3), 0.6);
          g.strokeStyle = ink(0.25); g.lineWidth = 0.5; g.beginPath();
          for (let k = 1; k < 4; k++) { g.moveTo(cx0 - b / 2 + (k * b) / 4, cy0 - b / 2); g.lineTo(cx0 - b / 2 + (k * b) / 4, cy0 + b / 2); g.moveTo(cx0 - b / 2, cy0 - b / 2 + (k * b) / 4); g.lineTo(cx0 + b / 2, cy0 - b / 2 + (k * b) / 4); }
          g.stroke();
          for (let k = 0; k < 4; k++) dot(cx0 - b / 2 + (b / 4) * (0.5 + Math.floor(R() * 4)), cy0 - b / 2 + (b / 4) * (0.5 + Math.floor(R() * 4)), b / 12, P.hues[k * 2 % 7]);
          // A few cards, and some money nobody wants.
          g.save(); g.translate(cx0 + tr * 0.75, cy0 - tr * 0.6); g.rotate(0.3); rr(-2.5, -3.5, 5, 7, 1, P.white, ink(0.25), 0.5); g.restore();
          g.fillStyle = P.d ? '#8fb37a' : '#b9dca0'; g.fillRect(cx0 - tr * 0.95, cy0 + tr * 0.55, 6, 3.5);
        } else if (set === 'tea') {
          // A tea tray with slats, a clay pot and little cups.
          const b = tr * 1.25;
          rr(cx0 - b / 2, cy0 - b / 2, b, b, 1.5, P.d ? '#2a1f18' : '#5b4030');
          g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.6; g.beginPath();
          for (let k = 1; k < 6; k++) { g.moveTo(cx0 - b / 2 + (k * b) / 6, cy0 - b / 2 + 1); g.lineTo(cx0 - b / 2 + (k * b) / 6, cy0 + b / 2 - 1); }
          g.stroke();
          dot(cx0 - b * 0.12, cy0 - b * 0.1, b * 0.18, P.clay);
          g.fillStyle = P.clay; g.fillRect(cx0 - b * 0.12 + b * 0.15, cy0 - b * 0.12, b * 0.14, 1.6);
          dot(cx0 - b * 0.12, cy0 - b * 0.1, b * 0.06, P.d ? '#6d3c28' : '#9a4f33');
          for (let k = 0; k < 3; k++) dot(cx0 + b * 0.25, cy0 - b * 0.28 + k * b * 0.27, b * 0.08, P.d ? '#c9c1ad' : '#f6f1e2');
        }
        break;
      }
      case 'desk': {
        turned((lw, lh, X, Y) => {
          const deep = lh > cell * 0.8 ? lh * 0.66 : lh;
          if (deep < lh) dot(0, Y - (lh - deep) / 2 + 1, Math.min(cell * 0.22, (lh - deep) / 2 + 1), P.d ? '#4a5263' : '#8e98a6');
          lifted(() => rr(-X, -Y, lw, deep, 2, P.wood));
          rr(-X + 0.5, -Y + 0.5, lw - 1, deep - 1, 2, null, rgba(P.woodDark, 0.4));
          if (!fine) return;
          const items = f.items || 'paper';
          if (items === 'paper') {
            g.save(); g.translate(-lw * 0.08, -Y + deep / 2); g.rotate(-0.12);
            rr(-4, -5, 8, 10, 0.5, P.sheet, ink(0.25), 0.5);
            g.strokeStyle = ink(0.25); g.lineWidth = 0.5; g.beginPath(); for (let k = -3; k <= 3; k += 2) { g.moveTo(-2.5, k); g.lineTo(2.5, k); } g.stroke();
            g.restore();
            g.strokeStyle = C.route; g.lineWidth = 1.2; g.beginPath(); g.moveTo(lw * 0.18, -Y + deep * 0.3); g.lineTo(lw * 0.3, -Y + deep * 0.65); g.stroke();
          } else if (items === 'books') {
            rr(-lw * 0.3, -Y + 2, lw * 0.25, deep - 5, 1, P.hues[H % 7]);
            rr(-lw * 0.02, -Y + 3, lw * 0.25, deep - 6, 1, P.sheet, ink(0.2), 0.5);
            dot(lw * 0.36, -Y + deep / 2, 1.8, P.d ? '#c9b26a' : '#f2d27a');
          } else if (items === 'laptop') {
            rr(-6, -Y + deep / 2 - 4.5, 12, 9, 1.2, P.steel, ink(0.3), 0.6);
            g.fillStyle = rgba(C.route, 0.5); g.fillRect(-5, -Y + deep / 2 - 4, 10, 2);
          } else if (items === 'monitor') {
            rr(-lw * 0.3, -Y + 2, lw * 0.6, 3, 1, P.black);
            rr(-lw * 0.22, -Y + deep - 6, lw * 0.44, 3.5, 0.8, P.d ? '#2a3140' : '#e6e9ee', ink(0.3), 0.5);
          }
        });
        break;
      }
      case 'worktable': {
        // A long hackathon table: laptops down both sides, cans, and a pizza box.
        const cx0 = x + w / 2, cy0 = y + h / 2;
        const long = vertical ? h : w, short = vertical ? w : h;
        const tw = long - 4, th = short * 0.5;
        const n = Math.max(1, Math.floor(tw / (cell * 1.2)));
        for (let k = 0; k < n; k++) {
          const a = -tw / 2 + ((k + 0.5) * tw) / n;
          for (const side of [-1, 1]) {
            const [px, py] = vertical ? [cx0 + side * (th / 2 + short * 0.14), cy0 + a] : [cx0 + a, cy0 + side * (th / 2 + short * 0.14)];
            dot(px, py, Math.min(cell * 0.2, short * 0.11), P.d ? '#4a5263' : '#9aa3b0');
          }
        }
        lifted(() => rr(vertical ? cx0 - th / 2 : cx0 - tw / 2, vertical ? cy0 - tw / 2 : cy0 - th / 2, vertical ? th : tw, vertical ? tw : th, 2, P.d ? '#596273' : '#f2f3f1'));
        if (!fine) break;
        for (let k = 0; k < n; k++) {
          const a = -tw / 2 + ((k + 0.5) * tw) / n;
          for (const side of [-1, 1]) {
            if (R() < 0.15) continue;
            const [px, py] = vertical ? [cx0 + side * th * 0.22, cy0 + a] : [cx0 + a, cy0 + side * th * 0.22];
            rr(px - 5, py - 3.5, 10, 7, 1, R() < 0.5 ? P.steel : (P.d ? '#2a3140' : '#3a404b'), ink(0.3), 0.5);
            if (R() < 0.5) dot(px + 7, py + (side > 0 ? -3 : 3), 1.6, P.hues[Math.floor(R() * 7)]);
          }
        }
        const [pzx, pzy] = vertical ? [cx0, cy0 + tw * 0.32] : [cx0 + tw * 0.32, cy0];
        lifted(() => rr(pzx - 6, pzy - 6, 12, 12, 1, P.card));
        dot(pzx, pzy, 4.5, P.d ? '#b98a4a' : '#e8b866'); dot(pzx - 1.5, pzy - 1, 0.9, P.red); dot(pzx + 1.6, pzy + 1.2, 0.9, P.red);
        break;
      }
      case 'stall': {
        // A market stall: a striped awning over the back, food on the counter in front.
        const hue = f.hue !== undefined ? P.hues[f.hue % P.hues.length] : [P.red, P.hues[4], P.hues[3], P.hues[1], P.hues[5]][H % 5];
        turned((lw, lh, X, Y) => {
          const awn = lh * 0.55;
          lifted(() => rr(-X, -Y, lw, lh, 2, P.wood));
          // The counter and what's on it.
          if (fine) {
            const goods = f.goods || ['bowls', 'skewers', 'buns', 'fruit'][H % 4];
            const gy = -Y + awn + (lh - awn) / 2;
            const step = Math.max(6, cell * 0.5);
            for (let xx = -X + step * 0.8, k = 0; xx < X - step * 0.5; xx += step, k++) {
              if (goods === 'bowls') { dot(xx, gy, 2.8, P.white, ink(0.2), 0.6); dot(xx, gy, 1.6, P.hues[(k + H) % 7]); }
              else if (goods === 'skewers') { g.strokeStyle = P.d ? '#8a6040' : '#a5683b'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(xx - 1.5, gy - 3); g.lineTo(xx + 1.5, gy + 3); g.stroke(); g.lineCap = 'butt'; }
              else if (goods === 'buns') dot(xx, gy, 2.6, P.d ? '#d8cfbf' : '#fbf6ec', ink(0.2), 0.5);
              else if (goods === 'fruit') dot(xx, gy, 2.6, P.hues[(k * 3 + H) % 4]);
              else if (goods === 'woks') { dot(xx, gy, 3.2, P.black); g.fillStyle = P.black; g.fillRect(xx + 2.5, gy - 0.6, 3, 1.2); }
              else if (goods === 'drinks') { dot(xx, gy, 2.4, rgba(P.hues[(k + H) % 7], 0.8), ink(0.25), 0.5); }
            }
          }
          // Stripes, with a scalloped front edge.
          g.save(); roundRect(g, -X, -Y, lw, awn, 2); g.clip();
          const sw = Math.max(4, cell * 0.33);
          for (let xx = -X, k = 0; xx < X; xx += sw, k++) { g.fillStyle = k % 2 ? hue : P.cream; g.fillRect(xx, -Y, sw, awn); }
          g.restore();
          for (let xx = -X, k = 0; xx < X; xx += sw, k++) { g.fillStyle = k % 2 ? hue : P.cream; g.beginPath(); g.arc(xx + sw / 2, -Y + awn, sw / 2, 0, Math.PI); g.fill(); }
          g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(-X, -Y + awn * 0.5, lw, awn * 0.5);
        });
        if (f.sign) sign(f.sign, 0, -depthOf() * 0.22, { bg: P.d ? '#20262f' : '#2b3039', line: 'transparent', border: false, color: P.d ? '#f2e7c8' : '#ffffff' });
        break;
      }
      case 'shop': {
        // A Chinatown shopfront from above: tiled roof, red eaves, a sign over the door.
        turned((lw, lh, X, Y) => {
          const roof = lh * 0.72;
          lifted(() => rr(-X, -Y, lw, roof, 1.5, P.d ? '#38423f' : '#6f7c74'));
          if (fine) {
            g.strokeStyle = P.d ? 'rgba(0,0,0,0.4)' : 'rgba(30,40,35,0.35)'; g.lineWidth = 1; g.beginPath();
            for (let xx = -X + 2.5; xx < X; xx += 3.5) { g.moveTo(xx, -Y + 2); g.lineTo(xx, -Y + roof - 2); }
            g.stroke();
            g.fillStyle = P.d ? '#24302c' : '#4b5852'; g.fillRect(-X, -Y + roof * 0.38, lw, 3);
            // Upturned ends of the ridge.
            g.strokeStyle = P.d ? '#24302c' : '#4b5852'; g.lineWidth = 2; g.beginPath();
            g.moveTo(-X + 3, -Y + roof * 0.38 + 1.5); g.quadraticCurveTo(-X - 1, -Y + roof * 0.38, -X - 2, -Y + roof * 0.2);
            g.moveTo(X - 3, -Y + roof * 0.38 + 1.5); g.quadraticCurveTo(X + 1, -Y + roof * 0.38, X + 2, -Y + roof * 0.2);
            g.stroke();
          }
          rr(-X, -Y + roof - 2, lw, 4, 1, P.lacquer);
          // Goods out the front: baskets of dried things, or a duck in the window.
          if (fine && f.goods !== false) {
            const gy = -Y + roof + (lh - roof) / 2 + 1.5;
            for (let xx = -X + cell * 0.6, k = 0; xx < X - cell * 0.4; xx += cell * 0.85, k++) {
              if (Math.abs(xx) < cell * 0.6) continue; // the doorway
              dot(xx, gy, Math.min(cell * 0.24, (lh - roof) * 0.38), P.d ? '#7a6143' : '#c9a575', rgba(P.woodDark, 0.5), 0.7);
              dot(xx, gy, Math.min(cell * 0.15, (lh - roof) * 0.24), [P.d ? '#8a4a2a' : '#b5653a', P.d ? '#6c5a2c' : '#a88b3f', P.d ? '#5a3a2a' : '#7a4b33', P.d ? '#a68a4a' : '#d6b25e'][(k + H) % 4]);
            }
          }
        });
        if (f.sign) sign(f.sign, 0, depthOf() * 0.2, {});
        break;
      }
      case 'redpillar': {
        const cx0 = x + w / 2, cy0 = y + h / 2, r = Math.min(w, h) * 0.42;
        lifted(() => rr(cx0 - r, cy0 - r, r * 2, r * 2, 1.5, P.d ? '#5d5a52' : '#cfc8b8'));
        dot(cx0, cy0, r * 0.78, P.gold);
        dot(cx0, cy0, r * 0.62, P.lacquer);
        break;
      }
      case 'box': {
        lifted(() => rr(x, y, w, h, 1.5, P.card));
        if (!fine) break;
        g.strokeStyle = 'rgba(90,60,30,0.35)'; g.lineWidth = 1; g.beginPath();
        if (w >= h) { g.moveTo(x + 2, y + h / 2); g.lineTo(x + w - 2, y + h / 2); } else { g.moveTo(x + w / 2, y + 2); g.lineTo(x + w / 2, y + h - 2); }
        g.stroke();
        g.fillStyle = P.d ? 'rgba(200,190,160,0.35)' : 'rgba(225,215,190,0.8)';
        if (w >= h) g.fillRect(x + w / 2 - 2, y + 1, 4, h - 2); else g.fillRect(x + 1, y + h / 2 - 2, w - 2, 4);
        if (w > cell * 1.4 && h > cell * 0.8) rr(x + 4, y + h - 9, 10, 6, 0.5, P.sheet);
        break;
      }
      case 'pallet': {
        lifted(() => rr(x, y, w, h, 1, P.wood));
        if (!fine) break;
        g.strokeStyle = P.grain; g.lineWidth = 1; g.beginPath();
        for (let yy = y + 3; yy < y + h; yy += 4) { g.moveTo(x, yy); g.lineTo(x + w, yy); }
        g.stroke();
        // Boxes stacked on it, shrink-wrapped.
        const n = Math.max(1, Math.floor(w / (cell * 0.9))), m = Math.max(1, Math.floor(h / (cell * 0.9)));
        for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
          if (R() < 0.18) continue;
          const bw = (w - 6) / n, bh = (h - 6) / m;
          rr(x + 3 + i * bw + 0.5, y + 3 + j * bh + 0.5, bw - 1, bh - 1, 1, P.card, rgba(P.woodDark, 0.35), 0.7);
        }
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 3, y + 3, w - 6, (h - 6) * 0.3);
        break;
      }
      case 'rack': {
        lifted(() => rr(x, y, w, h, 2, P.d ? '#0e131b' : '#2e343f'));
        if (!fine) break;
        g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; g.beginPath();
        if (vertical) for (let yy = y + 4; yy < y + h - 2; yy += 4) { g.moveTo(x + 3, yy); g.lineTo(x + w - 9, yy); }
        else for (let xx = x + 4; xx < x + w - 2; xx += 4) { g.moveTo(xx, y + 3); g.lineTo(xx, y + h - 9); }
        g.stroke();
        break;
      }
      case 'oven': {
        // A deck oven: steel front, a glowing window and the handle.
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 2, P.steelDeep));
          rr(-X + 0.5, -Y + 0.5, lw - 1, lh - 1, 2, null, ink(0.35));
          if (!fine) return;
          const gr = g.createLinearGradient(0, -Y, 0, Y);
          gr.addColorStop(0, P.d ? '#6a3518' : '#b5521f'); gr.addColorStop(1, P.d ? '#d27a35' : '#f5a14e');
          rr(-X + 4, -Y + 3, lw - 8, lh * 0.55, 2, gr);
          for (let k = 0; k < 3; k++) dot(-X + 8 + k * ((lw - 16) / 2), -Y + 3 + lh * 0.28, 2.6, P.d ? '#c08a4a' : '#e8b06a');
          rr(-X + 5, Y - lh * 0.22, lw - 10, 2, 1, P.steel);
          for (let k = 0; k < 3; k++) dot(X - 5 - k * 5, Y - 3.5, 1.3, P.black);
        });
        break;
      }
      case 'deli': {
        // Glass counter: a steel frame, trays of cured meats, cheese and olives.
        lifted(() => rr(x, y, w, h, 3, P.steel));
        rr(x + 2, y + 2, w - 4, h - 4, 2, P.d ? '#2a3747' : '#e9f2f8');
        if (!fine) break;
        const long = vertical ? h : w;
        const n = Math.max(1, Math.floor(long / (cell * 1.1)));
        for (let k = 0; k < n; k++) {
          const a = 4 + (k * (long - 8)) / n, l = (long - 8) / n - 2;
          const [tx, ty, tw, th] = vertical ? [x + 4, y + a, w - 8, l] : [x + a, y + 4, l, h - 8];
          rr(tx, ty, tw, th, 1, P.d ? '#9aa4b4' : '#ffffff', ink(0.2), 0.5);
          const kind = (k + H) % 5;
          const cxk = tx + tw / 2, cyk = ty + th / 2, rr0 = Math.min(tw, th) * 0.32;
          if (kind === 0) { for (let j = -1; j <= 1; j++) { dot(cxk + j * rr0 * 0.8, cyk, rr0 * 0.55, P.d ? '#a3443a' : '#c2463b'); dot(cxk + j * rr0 * 0.8 - 0.8, cyk - 0.8, 0.6, '#f3d9cf'); } }
          else if (kind === 1) { g.fillStyle = P.d ? '#d8b24e' : '#f1cf5a'; g.beginPath(); g.moveTo(cxk - rr0, cyk + rr0 * 0.6); g.lineTo(cxk + rr0, cyk + rr0 * 0.6); g.lineTo(cxk + rr0 * 0.2, cyk - rr0 * 0.8); g.fill(); }
          else if (kind === 2) { for (let j = 0; j < 6; j++) dot(cxk + (R() - 0.5) * tw * 0.6, cyk + (R() - 0.5) * th * 0.5, 1.5, j % 2 ? '#4f6b2c' : '#2d2a2a'); }
          else if (kind === 3) { dot(cxk, cyk, rr0, P.d ? '#c48a8a' : '#efa9a3'); dot(cxk, cyk, rr0 * 0.4, '#f6e2dc'); }
          else { g.fillStyle = P.d ? '#c9b37a' : '#f3e4b0'; g.fillRect(cxk - rr0, cyk - rr0 * 0.5, rr0 * 2, rr0); }
        }
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 2, y + 2, vertical ? 3 : w - 4, vertical ? h - 4 : 3);
        break;
      }
      case 'plant': case 'tree': {
        const cx0 = x + w / 2, cy0 = y + h / 2, s = Math.min(w, h);
        const big = f.kind === 'tree';
        const tones = [[P.leaf, P.leafLight], [P.green, P.leafLight], [P.leaf, P.green], [P.d ? '#4d7a5c' : '#5f9a7a', P.d ? '#79a68b' : '#9fd0b3']][(f.hue ?? H) % 4];
        lifted(() => dot(cx0, cy0, s * (big ? 0.2 : 0.3), big ? P.soil : P.clay));
        if (!big) dot(cx0, cy0, s * 0.24, P.soil);
        if (!fine) { dot(cx0, cy0, s * 0.36, tones[0]); break; }
        const n = big ? 9 : 7;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * TAU + (H % 10) * 0.3;
          g.save(); g.translate(cx0 + Math.cos(a) * s * 0.16, cy0 + Math.sin(a) * s * 0.16); g.rotate(a);
          g.fillStyle = k % 2 ? tones[0] : tones[1];
          g.beginPath(); g.ellipse(s * 0.1, 0, s * (big ? 0.28 : 0.24), s * 0.1, 0, 0, TAU); g.fill();
          g.restore();
        }
        dot(cx0, cy0, s * 0.1, tones[1]);
        break;
      }
      case 'planter': {
        lifted(() => rr(x, y, w, h, 2, P.wood));
        rr(x + 2.5, y + 2.5, w - 5, h - 5, 1.5, P.soil);
        if (!fine) break;
        const kind = f.grow || ['herbs', 'tomatoes', 'herbs', 'flowers'][H % 4];
        for (let yy = y + cell * 0.5; yy < y + h - 4; yy += cell * 0.75)
          for (let xx = x + cell * 0.5; xx < x + w - 4; xx += cell * 0.75) {
            for (let k = 0; k < 4; k++) dot(xx + Math.cos(k * 1.6) * 2.4, yy + Math.sin(k * 1.6) * 2.4, 2.3, k % 2 ? P.leaf : P.leafLight);
            if (kind === 'tomatoes') dot(xx + 1, yy + 1, 1.6, P.red);
            if (kind === 'flowers') dot(xx, yy, 1.6, P.hues[Math.floor(R() * 7)]);
          }
        break;
      }
      case 'hedge': {
        lifted(() => rr(x, y, w, h, 3, P.leaf));
        if (!fine) break;
        const R2 = rng(H);
        for (let yy = y + 3; yy < y + h - 1; yy += 4)
          for (let xx = x + 3; xx < x + w - 1; xx += 4) dot(xx + R2() * 2 - 1, yy + R2() * 2 - 1, 2.4, R2() < 0.5 ? P.green : P.leafLight);
        break;
      }
      case 'wall': box(ink(P.d ? 0.32 : 0.42), ink(P.d ? 0.45 : 0.55), 1); break;
      case 'mural': {
        // A laneway wall: brick, with a lot of paint on it.
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 1, P.d ? '#5a3a33' : '#b56a55'));
          if (!fine) return;
          g.strokeStyle = P.d ? 'rgba(0,0,0,0.3)' : 'rgba(255,240,230,0.35)'; g.lineWidth = 0.8; g.beginPath();
          for (let yy = -Y + 4, k = 0; yy < Y; yy += 4, k++) {
            g.moveTo(-X, yy); g.lineTo(X, yy);
            for (let xx = -X + (k % 2 ? 4 : 0); xx < X; xx += 8) { g.moveTo(xx, yy - 4); g.lineTo(xx, yy); }
          }
          g.stroke();
          const R2 = rng(H);
          for (let k = 0; k < lw / 26; k++) {
            const px = -X + 8 + k * 26 + R2() * 8, py = 0;
            g.fillStyle = rgba(P.hues[(k * 2 + H) % 7], 0.85);
            g.beginPath();
            g.moveTo(px - 10, py + lh * 0.3);
            g.bezierCurveTo(px - 6, py - lh * 0.5, px + 6, py + lh * 0.4, px + 12, py - lh * 0.32);
            g.lineTo(px + 14, py + lh * 0.1);
            g.bezierCurveTo(px + 6, py + lh * 0.45, px - 2, py - lh * 0.1, px - 6, py + lh * 0.38);
            g.fill();
            if (k % 3 === 1) dot(px + 4, py - lh * 0.15, Math.min(lh * 0.18, 5), rgba(P.hues[(k + 4) % 7], 0.9));
          }
        });
        break;
      }
      case 'pillar': {
        const cx0 = x + w / 2, cy0 = y + h / 2, r = Math.min(w, h) * 0.4;
        lifted(() => dot(cx0, cy0, r, P.d ? '#596273' : '#c3c9cf'));
        if (fine) { dot(cx0, cy0, r, null, ink(0.25)); dot(cx0 - r * 0.3, cy0 - r * 0.3, r * 0.35, 'rgba(255,255,255,0.25)'); }
        break;
      }
      case 'sofa': {
        const col = f.hue !== undefined ? P.hues[f.hue % P.hues.length] : [P.d ? '#3d6670' : '#6f9fa8', P.d ? '#8a6a3a' : '#cf9f55', P.d ? '#6a4a6a' : '#a78bb5'][H % 3];
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, Math.min(6, lh * 0.35), col));
          if (!fine) return;
          const back = Math.max(4, lh * 0.3), arm = Math.max(4, Math.min(lw * 0.12, cell * 0.35));
          rr(-X, -Y, lw, back, 3, 'rgba(0,0,0,0.12)');
          rr(-X, -Y, arm, lh, 3, 'rgba(0,0,0,0.12)'); rr(X - arm, -Y, arm, lh, 3, 'rgba(0,0,0,0.12)');
          const n = Math.max(1, Math.round((lw - arm * 2) / (cell * 1.1)));
          const cw = (lw - arm * 2) / n;
          for (let k = 0; k < n; k++) rr(-X + arm + k * cw + 1, -Y + back + 1, cw - 2, lh - back - 3, 2, 'rgba(255,255,255,0.12)', 'rgba(0,0,0,0.12)', 0.8);
          dot(-X + arm + 5, -Y + back + 4, 3.5, P.cream);
        });
        break;
      }
      case 'cat': break; // drawn as an animation
      case 'board': {
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y + lh * 0.2, lw, lh * 0.6, 1, P.steel));
          rr(-X + 2, -Y + lh * 0.2 + 2, lw - 4, lh * 0.6 - 4, 0.5, P.d ? '#c9d0da' : '#ffffff');
          if (!fine) return;
          rr(-X + lw * 0.3, Y - lh * 0.22, lw * 0.4, 2, 1, P.steelDeep);
        });
        if (fine) {
          const vert = f.face === 'left' || f.face === 'right';
          g.fillStyle = P.d ? '#2b45c0' : '#2b45e0';
          g.font = FONT_UI(Math.max(8, Math.min(11, cell * 0.45)), 700);
          g.textAlign = 'center'; g.textBaseline = 'middle';
          if (!vert) {
            const parts = ['½ + ¼ = ¾', '3/4 = 6/8', '⅔ of 9 = 6', '1/2 = 0.5'];
            const step = Math.max(70, cell * 3.6);
            for (let k = 0, xx = x + step / 2; xx < x + w - step / 3; xx += step, k++) g.fillText(parts[k % parts.length], xx, y + h / 2 + 0.5);
          }
        }
        break;
      }
      case 'arcade': {
        // A cabinet: screen at the back, a control panel with a stick and six buttons.
        const panel = [P.red, P.hues[4], P.hues[2], P.hues[5]][H % 4];
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 2, P.d ? '#06080c' : '#1f232b'));
          if (!fine) return;
          rr(-X + 3, -Y + 3, lw - 6, lh * 0.5, 1.5, P.d ? '#141c30' : '#26304a');
          rr(-X + 2, Y - lh * 0.4, lw - 4, lh * 0.36, 2, panel);
          const py = Y - lh * 0.22;
          dot(-X + lw * 0.24, py, 3.2, P.black); dot(-X + lw * 0.24, py, 1.8, P.red);
          for (let k = 0; k < 3; k++) { dot(-X + lw * 0.5 + k * 4.6, py - 2.6, 1.7, ['#ffd84d', '#ffffff', '#4fd1ff'][k]); dot(-X + lw * 0.5 + k * 4.6, py + 2.6, 1.7, ['#ff6b6b', '#7dff7a', '#ffffff'][k]); }
        });
        break;
      }
      case 'screen': {
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 2, P.d ? '#06080c' : '#1f232b'));
          if (fine) rr(-X + 3, -Y + 3, lw - 6, lh - 6, 1.5, P.d ? '#141c30' : '#26304a');
        });
        break;
      }
      case 'cinemascreen': {
        // A wide screen with curtains drawn back at the ends.
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 1, P.d ? '#0a0e14' : '#2b3039'));
          rr(-X + cell * 0.8, -Y + lh * 0.25, lw - cell * 1.6, lh * 0.5, 1, P.d ? '#c9d2e6' : '#f7f8fb');
          g.fillStyle = P.lacquer;
          for (const side of [-1, 1]) {
            g.beginPath();
            const ex = side * X;
            g.moveTo(ex, -Y); g.lineTo(ex - side * cell * 1.1, -Y); g.quadraticCurveTo(ex - side * cell * 0.5, 0, ex - side * cell * 1.1, Y); g.lineTo(ex, Y);
            g.fill();
          }
        });
        break;
      }
      case 'stage': {
        // A team's row on stage: five desks with monitors, keyboards and chairs.
        const team = f.team === 'red' ? P.red : rgba(C.route, 1);
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 2, P.d ? '#1a2029' : '#3a404b'));
          if (!fine) return;
          g.fillStyle = team; g.fillRect(-X, -Y, lw, 2);
          const n = 5, step = lw / n;
          for (let k = 0; k < n; k++) {
            const cx0 = -X + step * (k + 0.5);
            rr(cx0 - step * 0.36, -Y + 2, step * 0.72, 3, 1, P.black);
            g.fillStyle = rgba(team, 0.8); g.fillRect(cx0 - step * 0.3, -Y + 2.6, step * 0.6, 1.4);
            rr(cx0 - step * 0.22, -Y + lh * 0.45, step * 0.44, 3, 0.8, P.steelDeep);
            dot(cx0 + step * 0.32, -Y + lh * 0.5, 1.6, P.steel);
          }
        });
        break;
      }
      case 'guitars': {
        // Guitars hanging on the wall, necks up.
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, Math.max(3, lh * 0.18), 1, P.woodDeep));
          if (!fine) return;
          const step = Math.max(16, cell * 1.35);
          const tones = [['#c97a3a', '#3a2418'], [P.d ? '#2a2f38' : '#1f232b', null], [P.red, null], [P.d ? '#c9b48a' : '#e8cfa2', '#5a3a22'], ['#3a6f9a', null]];
          for (let xx = -X + step * 0.6, k = 0; xx < X - step * 0.4; xx += step, k++) {
            const [body, hole] = tones[(k + H) % tones.length];
            const by = -Y + lh * 0.66, s = Math.min(step * 0.34, lh * 0.2);
            g.fillStyle = P.d ? '#4a3a2a' : '#6b4a2e'; g.fillRect(xx - 1, -Y + 1, 2, lh * 0.5);
            g.fillStyle = P.d ? '#2a2018' : '#3a2a1c'; g.fillRect(xx - 1.8, -Y + 0.5, 3.6, 3.5);
            lifted(() => { dot(xx, by - s * 0.9, s * 0.72, body); dot(xx, by + s * 0.2, s, body); });
            if (hole) dot(xx, by - s * 0.3, s * 0.3, hole);
            else { g.fillStyle = P.white; g.fillRect(xx - s * 0.5, by - 0.8, s, 1.6); }
          }
        });
        break;
      }
      case 'piano': {
        // A grand piano from above, keyboard to the front, with its bench.
        turned((lw, lh, X, Y) => {
          const kb = Math.max(4, lh * 0.14);
          const bodyBottom = Y - lh * 0.22;
          lifted(() => {
            g.fillStyle = P.d ? '#05070a' : '#16191f';
            g.beginPath();
            g.moveTo(-X, bodyBottom);
            g.lineTo(-X, -Y + 2);
            g.quadraticCurveTo(-X, -Y, -X + lw * 0.2, -Y);
            g.bezierCurveTo(-X + lw * 0.55, -Y, -X + lw * 0.42, -Y + lh * 0.38, X, -Y + lh * 0.45);
            g.lineTo(X, bodyBottom);
            g.closePath();
            g.fill();
          });
          if (!fine) return;
          g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-X + 3, bodyBottom - kb - 4); g.quadraticCurveTo(-X + lw * 0.3, -Y + lh * 0.2, -X + lw * 0.25, -Y + 4); g.stroke();
          rr(-X + 2, bodyBottom - kb, lw - 4, kb, 0.5, '#f4f2ec');
          g.fillStyle = '#16191f';
          for (let xx = -X + 4, k = 0; xx < X - 4; xx += 3.2, k++) if (k % 7 !== 2 && k % 7 !== 6) g.fillRect(xx, bodyBottom - kb, 1.8, kb * 0.6);
          rr(-lw * 0.18, bodyBottom + lh * 0.07, lw * 0.36, lh * 0.11, 1.5, P.d ? '#05070a' : '#2b3039');
        });
        break;
      }
      case 'sax': {
        // A tenor sax on its stand: brass body, a curve at the bottom, the bell, and keys.
        const cx0 = x + w / 2, cy0 = y + h / 2, s = Math.min(w, h * 0.7);
        lifted(() => dot(cx0, cy0 + h * 0.12, s * 0.42, P.d ? '#1a1f27' : '#3a404b'));
        const brass = g.createLinearGradient(cx0 - s * 0.3, 0, cx0 + s * 0.3, 0);
        brass.addColorStop(0, P.d ? '#9c7524' : '#c8932a'); brass.addColorStop(0.5, P.d ? '#e6c467' : '#f3d27a'); brass.addColorStop(1, P.d ? '#9c7524' : '#c8932a');
        g.strokeStyle = brass; g.lineCap = 'round';
        g.lineWidth = Math.max(3, s * 0.2);
        g.beginPath(); g.moveTo(cx0 - s * 0.12, y + h * 0.12); g.lineTo(cx0 - s * 0.05, cy0 + h * 0.18); g.quadraticCurveTo(cx0, cy0 + h * 0.34, cx0 + s * 0.2, cy0 + h * 0.24); g.stroke();
        g.lineWidth = Math.max(1.5, s * 0.08); g.beginPath(); g.moveTo(cx0 - s * 0.12, y + h * 0.12); g.quadraticCurveTo(cx0 - s * 0.2, y + h * 0.04, cx0 - s * 0.32, y + h * 0.07); g.stroke();
        g.lineCap = 'butt';
        dot(cx0 + s * 0.22, cy0 + h * 0.18, s * 0.17, P.d ? '#e6c467' : '#f3d27a', P.d ? '#9c7524' : '#c8932a', 1.2);
        dot(cx0 + s * 0.22, cy0 + h * 0.18, s * 0.08, P.d ? '#6a4d14' : '#a87618');
        if (fine) for (let k = 0; k < 4; k++) dot(cx0 - s * 0.1 + k * s * 0.015, y + h * 0.22 + k * h * 0.09, 1.3, P.d ? '#fff0c2' : '#fff6da');
        break;
      }
      case 'pump': {
        // A fuel pump on its island, hose looped round.
        lifted(() => rr(x - 1, y - 1, w + 2, h + 2, 3, P.d ? '#4a5160' : '#dadfe4'));
        rr(x + 3, y + 3, w - 6, h - 6, 2, P.red);
        if (!fine) break;
        rr(x + w / 2 - 3.5, y + 5, 7, 4, 1, P.d ? '#1a1f27' : '#2b3039');
        g.fillStyle = rgba('#7dff7a', 0.8); g.fillRect(x + w / 2 - 2.5, y + 6, 5, 1.5);
        g.strokeStyle = P.black; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + w - 4, y + h - 6); g.quadraticCurveTo(x + w + 4, y + h + 2, x + w - 2, y + h - 1); g.stroke();
        break;
      }
      case 'washer': {
        // A front-loader: white body, controls along the top, the porthole.
        turned((lw, lh, X, Y) => {
          lifted(() => rr(-X, -Y, lw, lh, 3, P.d ? '#a9b2bf' : '#fbfcfd'));
          rr(-X + 0.5, -Y + 0.5, lw - 1, lh - 1, 3, null, ink(0.3));
          if (!fine) return;
          rr(-X + 2, -Y + 2, lw - 4, lh * 0.18, 1, P.d ? '#8a94a3' : '#e6eaef');
          dot(X - 6, -Y + 2 + lh * 0.09, 1.8, P.steelDeep);
          g.fillStyle = rgba('#7dff7a', 0.9); g.fillRect(-X + 4, -Y + 2 + lh * 0.06, 5, 2);
          const r = Math.min(lw, lh) * 0.3;
          dot(0, lh * 0.1, r + 2, P.steel, ink(0.3), 0.8);
          dot(0, lh * 0.1, r, P.d ? '#1d3550' : '#4d7ea6');
          dot(-r * 0.3, lh * 0.1 - r * 0.3, r * 0.3, 'rgba(255,255,255,0.35)');
        });
        break;
      }
      case 'bench': {
        lifted(() => rr(x, y + (vertical ? 0 : h * 0.15), w, vertical ? h : h * 0.7, 2, P.wood));
        if (!fine) break;
        g.strokeStyle = P.grain; g.lineWidth = 1; g.beginPath();
        if (vertical) for (let k = 1; k < 3; k++) { g.moveTo(x + (w * k) / 3, y + 1); g.lineTo(x + (w * k) / 3, y + h - 1); }
        else for (let k = 1; k < 3; k++) { const yy = y + h * 0.15 + (h * 0.7 * k) / 3; g.moveTo(x + 1, yy); g.lineTo(x + w - 1, yy); }
        g.stroke();
        g.fillStyle = P.steelDeep;
        if (vertical) { g.fillRect(x - 1, y + 2, w + 2, 2.5); g.fillRect(x - 1, y + h - 4.5, w + 2, 2.5); } else { g.fillRect(x + 2, y + h * 0.1, 2.5, h * 0.8); g.fillRect(x + w - 4.5, y + h * 0.1, 2.5, h * 0.8); }
        break;
      }
      case 'claw': {
        lifted(() => rr(x, y, w, h, 2, P.d ? '#2a3140' : '#3a404b'));
        rr(x + 2.5, y + 2.5, w - 5, h - 5, 1.5, P.d ? '#2c3a52' : '#dbe9f5');
        if (!fine) break;
        const R2 = rng(H);
        for (let k = 0; k < (w * h) / 55; k++) {
          const px = x + 6 + R2() * (w - 12), py = y + 6 + R2() * (h - 12);
          const col = P.hues[Math.floor(R2() * 7)];
          dot(px, py, 3, col); dot(px - 2.2, py - 2.2, 1.2, col); dot(px + 2.2, py - 2.2, 1.2, col);
        }
        g.strokeStyle = P.gold; g.lineWidth = 1.4; g.beginPath();
        const cx0 = x + w * 0.55, cy0 = y + h * 0.45;
        for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU - Math.PI / 2; g.moveTo(cx0, cy0); g.lineTo(cx0 + Math.cos(a) * 4, cy0 + Math.sin(a) * 4); }
        g.stroke(); dot(cx0, cy0, 1.6, P.gold);
        rr(x + w - 9, y + h - 9, 6, 6, 1, P.black);
        break;
      }
      case 'ballpit': {
        const cush = [P.hues[4], P.red, P.hues[2], P.hues[3]];
        lifted(() => rr(x, y, w, h, 6, cush[0]));
        if (fine) {
          const seg = cell;
          g.save(); roundRect(g, x, y, w, h, 6); g.clip();
          for (let xx = x, k = 0; xx < x + w; xx += seg, k++) { g.fillStyle = cush[k % 4]; g.fillRect(xx, y, seg, h); }
          g.restore();
        }
        rr(x + 4, y + 4, w - 8, h - 8, 4, P.d ? '#1f2633' : '#f7f8fa');
        const R2 = rng(H);
        for (let k = 0; k < (w * h) / (fine ? 9 : 30); k++) dot(x + 6 + R2() * (w - 12), y + 6 + R2() * (h - 12), fine ? 2.3 : 1.2, P.hues[Math.floor(R2() * 5)]);
        break;
      }
      case 'gym': {
        const tread = H % 2 === 0;
        turned((lw, lh, X, Y) => {
          if (tread) {
            lifted(() => rr(-X, -Y, lw, lh, 2, P.steel));
            if (!fine) return;
            rr(-X + 3, -Y + lh * 0.18, lw - 6, lh * 0.64, 1.5, P.d ? '#0c1016' : '#2b3039');
            g.strokeStyle = 'rgba(255,255,255,0.1)'; g.lineWidth = 1; g.beginPath();
            for (let xx = -X + 6; xx < X - 4; xx += 3) { g.moveTo(xx, -Y + lh * 0.2); g.lineTo(xx, Y - lh * 0.2); }
            g.stroke();
            rr(X - 6, -Y + 1, 5, lh - 2, 1, P.d ? '#1a1f27' : '#3a404b');
            g.fillStyle = rgba(C.route, 0.7); g.fillRect(X - 5, -Y + lh * 0.35, 3, lh * 0.3);
          } else {
            lifted(() => rr(-X + lw * 0.15, -Y + lh * 0.2, lw * 0.7, lh * 0.6, 3, P.d ? '#1a1f27' : '#3a404b'));
            if (!fine) return;
            g.fillStyle = P.steel; g.fillRect(-X + lw * 0.3, -Y + 1, 2, lh - 2);
            for (const s of [-1, 1]) { rr(-X + lw * 0.3 - 2.5, s < 0 ? -Y : Y - 4, 7, 4, 1, P.black); }
          }
        });
        break;
      }
      case 'edge': {
        lifted(() => rr(x, y, w, h, 1, P.d ? '#c9a23a' : '#f0c63c'));
        if (!fine) break;
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let yy = y + 3; yy < y + h - 2; yy += 4) for (let xx = x + 3; xx < x + w - 2; xx += 4) g.fillRect(xx, yy, 1.4, 1.4);
        break;
      }
      case 'gutter': rr(x, y + h * 0.2, w, h * 0.6, h * 0.3, ink(P.d ? 0.3 : 0.18)); break;
      case 'pins': {
        // Ten pins in a triangle at the end of each lane.
        turned((lw, lh, X, Y) => {
          rr(-X, -Y, lw, lh, 2, P.d ? '#1a1f27' : '#2b3039');
          if (!fine) return;
          const sp = Math.min(lw / 4.2, lh / 4.2);
          for (let row = 0; row < 4; row++)
            for (let k = 0; k <= row; k++) {
              const px = (k - row / 2) * sp, py = Y - sp * 0.9 - row * sp * 0.86;
              dot(px, py, sp * 0.32, '#fbfbf7'); dot(px, py, sp * 0.13, P.red);
            }
        });
        break;
      }
      case 'plinth': {
        // A pedestal behind a rope, with something old on it.
        const cx0 = x + w / 2, cy0 = y + h / 2, s = Math.min(w, h);
        if (fine) {
          const pts = [[x + 2, y + 2], [x + w - 2, y + 2], [x + w - 2, y + h - 2], [x + 2, y + h - 2]];
          g.strokeStyle = P.lacquer; g.lineWidth = 1.4; g.beginPath();
          for (let k = 0; k < 4; k++) { const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % 4]; g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2 + (cx0 - (ax + bx) / 2) * 0.15, (ay + by) / 2 + (cy0 - (ay + by) / 2) * 0.15, bx, by); }
          g.stroke();
          for (const [px, py] of pts) dot(px, py, 2, P.gold);
        }
        const ps = s * 0.5;
        lifted(() => rr(cx0 - ps / 2, cy0 - ps / 2, ps, ps, 1.5, P.d ? '#c3cad3' : '#ffffff'));
        rr(cx0 - ps / 2 + 0.5, cy0 - ps / 2 + 0.5, ps - 1, ps - 1, 1.5, null, ink(0.2), 0.6);
        const kind = H % 4;
        if (kind === 0) { dot(cx0, cy0, ps * 0.3, P.clay); dot(cx0, cy0, ps * 0.15, P.d ? '#5a2f20' : '#7a3f2a'); if (fine) dot(cx0, cy0, ps * 0.24, null, P.d ? '#2a1a14' : '#3a2018', 0.8); }
        else if (kind === 1) { g.fillStyle = P.d ? '#8c96a3' : '#b7bec7'; g.beginPath(); g.ellipse(cx0, cy0 + ps * 0.1, ps * 0.32, ps * 0.18, 0, 0, TAU); g.fill(); dot(cx0, cy0 - ps * 0.06, ps * 0.16, P.d ? '#a5aeba' : '#cfd5dc'); }
        else if (kind === 2) { dot(cx0, cy0, ps * 0.3, P.d ? '#5f7a52' : '#7f9c6e'); dot(cx0, cy0, ps * 0.2, null, P.d ? '#a8c08f' : '#d2e0c4', 0.8); }
        else { g.fillStyle = P.hues[4]; g.beginPath(); g.moveTo(cx0, cy0 - ps * 0.3); g.lineTo(cx0 + ps * 0.25, cy0); g.lineTo(cx0, cy0 + ps * 0.3); g.lineTo(cx0 - ps * 0.25, cy0); g.fill(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(cx0, cy0 - ps * 0.3); g.lineTo(cx0 + ps * 0.25, cy0); g.lineTo(cx0, cy0); g.fill(); }
        break;
      }
      case 'frames': {
        // Paintings along a wall: gold and black frames, a few kinds of picture.
        turned((lw, lh, X, Y) => {
          rr(-X, -Y, lw, Math.max(2, lh * 0.25), 0.5, ink(P.d ? 0.3 : 0.15));
          if (!fine) return;
          const step = Math.max(cell * 2.2, 40);
          for (let xx = -X + step * 0.25, k = 0; xx + step * 0.6 < X; xx += step, k++) {
            const fw = step * (0.45 + ((k * 7 + H) % 3) * 0.08), fh = lh * 0.8;
            lifted(() => rr(xx, -Y + 1, fw, fh, 0.5, k % 3 === 1 ? P.black : P.gold));
            const ix = xx + 2, iy = -Y + 3, iw = fw - 4, ih = fh - 4;
            const kind = (k + H) % 4;
            if (kind === 0) { g.fillStyle = P.d ? '#4a6a8c' : '#a9cbe6'; g.fillRect(ix, iy, iw, ih * 0.55); g.fillStyle = P.d ? '#4f7a48' : '#8fbf72'; g.fillRect(ix, iy + ih * 0.55, iw, ih * 0.45); dot(ix + iw * 0.75, iy + ih * 0.25, ih * 0.14, P.d ? '#e0b24c' : '#f6d06b'); }
            else if (kind === 1) { g.fillStyle = P.d ? '#3a3f4a' : '#e9e2d0'; g.fillRect(ix, iy, iw, ih); dot(ix + iw / 2, iy + ih * 0.45, ih * 0.22, P.d ? '#a87c5a' : '#d9a982'); g.fillStyle = P.d ? '#2a3040' : '#41506a'; g.fillRect(ix + iw * 0.25, iy + ih * 0.68, iw * 0.5, ih * 0.32); }
            else if (kind === 2) { g.fillStyle = P.cream; g.fillRect(ix, iy, iw, ih); g.fillStyle = P.red; g.fillRect(ix + 1, iy + 1, iw * 0.4, ih * 0.5); g.fillStyle = P.hues[4]; g.fillRect(ix + iw * 0.5, iy + ih * 0.55, iw * 0.45, ih * 0.4); g.fillStyle = P.hues[2]; g.fillRect(ix + iw * 0.55, iy + 1, iw * 0.2, ih * 0.4); }
            else { g.fillStyle = P.d ? '#1d2a44' : '#2f4a7a'; g.fillRect(ix, iy, iw, ih); g.strokeStyle = P.d ? '#e0b24c' : '#f6d06b'; g.lineWidth = 1; g.beginPath(); for (let j = 0; j < 3; j++) { g.moveTo(ix, iy + ih * (0.3 + j * 0.2)); g.bezierCurveTo(ix + iw * 0.3, iy + ih * (0.1 + j * 0.2), ix + iw * 0.6, iy + ih * (0.5 + j * 0.2), ix + iw, iy + ih * (0.3 + j * 0.2)); } g.stroke(); }
          }
        });
        break;
      }
      case 'puddle': {
        const cx0 = x + w / 2, cy0 = y + h / 2;
        g.fillStyle = P.d ? 'rgba(120,150,220,0.25)' : 'rgba(110,160,220,0.3)';
        g.beginPath(); g.ellipse(cx0, cy0, Math.max(0.5, w / 2), Math.max(0.5, h / 2.4), 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(cx0 + w * 0.3, cy0 + h * 0.2, Math.max(0.5, w / 5), Math.max(0.5, h / 6), 0, 0, TAU); g.fill();
        if (fine) { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx0 - w * 0.1, cy0 - h * 0.08, w * 0.22, h * 0.12, 0, Math.PI * 1.1, Math.PI * 1.6); g.stroke(); }
        break;
      }
      case 'wetsign': {
        const cx0 = x + w / 2, cy0 = y + h / 2, s = Math.min(w, h) * 0.42;
        lifted(() => { g.fillStyle = P.d ? '#d9b23a' : '#f2c935'; g.beginPath(); g.moveTo(cx0, cy0 - s); g.lineTo(cx0 + s, cy0 + s * 0.8); g.lineTo(cx0 - s, cy0 + s * 0.8); g.closePath(); g.fill(); });
        if (fine) { g.fillStyle = P.black; g.fillRect(cx0 - 0.8, cy0 - s * 0.35, 1.6, s * 0.6); g.fillRect(cx0 - 0.8, cy0 + s * 0.38, 1.6, 1.6); }
        break;
      }
      case 'tank': {
        // A wall of tanks: water, gravel, weed and the odd bubble.
        lifted(() => rr(x, y, w, h, 3, P.steelDeep));
        const gr = g.createLinearGradient(x, y, x, y + h);
        gr.addColorStop(0, P.d ? '#2a5a85' : '#bfe0f2'); gr.addColorStop(1, P.d ? '#183552' : '#8fbfdf');
        rr(x + 2, y + 2, w - 4, h - 4, 2, gr);
        if (!fine) break;
        const R2 = rng(H);
        g.fillStyle = P.d ? '#6b6252' : '#d8c9a8';
        for (let xx = x + 3; xx < x + w - 3; xx += 2.5) dot(xx, y + h - 4 - R2() * 1.5, 1.4, R2() < 0.5 ? (P.d ? '#6b6252' : '#d8c9a8') : (P.d ? '#5a5244' : '#c2b28c'));
        g.strokeStyle = P.d ? '#3f7a4a' : '#5e9e5e'; g.lineWidth = 1.4; g.beginPath();
        for (let xx = x + 8; xx < x + w - 6; xx += 17 + R2() * 12) { g.moveTo(xx, y + h - 4); g.quadraticCurveTo(xx + 3, y + h * 0.6, xx - 1, y + h * 0.3); }
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 0.8;
        for (let k = 0; k < w / 30; k++) { g.beginPath(); g.arc(x + 10 + R2() * (w - 20), y + 5 + R2() * (h * 0.5), 1.4, 0, TAU); g.stroke(); }
        break;
      }
      case 'bbq': {
        // The sausage sizzle.
        lifted(() => rr(x, y, w, h, 2, P.d ? '#0e1218' : '#2b3039'));
        if (!fine) break;
        rr(x + 2.5, y + 2.5, w - 5, h - 5, 1, P.d ? '#2a2f38' : '#4a505b');
        for (let xx = x + 5; xx < x + w * 0.65; xx += 5) rr(xx, y + 4, 3.2, h - 8, 1.6, P.d ? '#8a4a2a' : '#a8582f');
        for (let k = 0; k < 7; k++) dot(x + w * 0.72 + R() * w * 0.2, y + 4 + R() * (h - 8), 1.2, P.d ? '#c9b08a' : '#efd9a8');
        break;
      }
      case 'cross': {
        lifted(() => rr(x + 1, y + 1, w - 2, h - 2, 3, P.d ? '#c9d0da' : '#ffffff'));
        g.fillStyle = '#2f9a5b'; const s = Math.min(w, h);
        g.fillRect(x + w / 2 - s * 0.12, y + h / 2 - s * 0.32, s * 0.24, s * 0.64); g.fillRect(x + w / 2 - s * 0.32, y + h / 2 - s * 0.12, s * 0.64, s * 0.24);
        break;
      }
      case 'seats': {
        // A row of seats, all facing the same way.
        const col = f.hue === 'blue' ? (P.d ? '#2f4a7a' : '#4f6fa8') : P.d ? '#8a2f2a' : '#b5443a';
        turned((lw, lh, X, Y) => {
          if (!fine) { rr(-X, -Y, lw, lh, 1, col); return; }
          const n = Math.max(1, Math.round(lw / cell));
          const sw = lw / n;
          for (let k = 0; k < n; k++) {
            const sx0 = -X + k * sw;
            lifted(() => rr(sx0 + 1.5, -Y + 1, sw - 3, lh - 2, 3, col));
            if (fine) { rr(sx0 + 1.5, -Y + 1, sw - 3, lh * 0.32, 2, 'rgba(0,0,0,0.2)'); rr(sx0 + 3.5, -Y + lh * 0.42, sw - 7, lh * 0.45, 2, 'rgba(255,255,255,0.12)'); }
          }
        });
        break;
      }
      case 'mopbucket': {
        const cx0 = x + w / 2, cy0 = y + h / 2, s = Math.min(w, h);
        lifted(() => rr(cx0 - s * 0.35, cy0 - s * 0.3, s * 0.7, s * 0.6, 3, P.d ? '#d9b23a' : '#f2c935'));
        dot(cx0 - s * 0.1, cy0, s * 0.18, P.d ? '#4a6a8c' : '#8fb5d9');
        g.strokeStyle = P.steelDeep; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx0 + s * 0.12, cy0); g.lineTo(cx0 + s * 0.5, cy0 - s * 0.45); g.stroke();
        break;
      }
      case 'crate': {
        // A crate of records, sleeves on edge, a couple pulled half out.
        lifted(() => rr(x, y, w, h, 2, P.woodDeep));
        rr(x + 2, y + 2, w - 4, h - 4, 1, P.d ? '#2a2018' : '#5a3f2a');
        if (!fine) break;
        const long = vertical ? h : w;
        for (let a = 4, k = 0; a < long - 4; a += 2.2, k++) {
          g.fillStyle = rgba(P.hues[Math.floor(R() * 7)], 0.85);
          if (vertical) g.fillRect(x + 3, y + a, w - 6, 1.6); else g.fillRect(x + a, y + 3, 1.6, h - 6);
        }
        const pull = 4 + Math.floor(R() * Math.max(1, long - 14));
        const [px, py] = vertical ? [x + w / 2, y + pull] : [x + pull, y + h / 2];
        lifted(() => rr(px - 5, py - 5, 10, 10, 0.5, P.hues[H % 7]));
        dot(px + (vertical ? 0 : 3), py + (vertical ? 3 : 0), 4, P.black); dot(px + (vertical ? 0 : 3), py + (vertical ? 3 : 0), 1.3, P.red);
        break;
      }
      case 'turntable': {
        // A listening post: a deck, a record spinning (not really), and headphones.
        lifted(() => rr(x, y, w, h, 2, P.wood));
        if (!fine) break;
        const s = Math.min(w, h);
        const cx0 = x + w / 2 - s * 0.1, cy0 = y + h / 2;
        rr(cx0 - s * 0.36, cy0 - s * 0.36, s * 0.72, s * 0.72, 2, P.d ? '#0e1218' : '#2b3039');
        dot(cx0, cy0, s * 0.3, P.black);
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.6;
        for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(cx0, cy0, s * 0.3 * (k / 4), 0, TAU); g.stroke(); }
        dot(cx0, cy0, s * 0.08, P.hues[H % 7]);
        g.strokeStyle = P.steel; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx0 + s * 0.3, cy0 - s * 0.3); g.lineTo(cx0 + s * 0.12, cy0 + s * 0.1); g.stroke();
        g.strokeStyle = P.black; g.lineWidth = 1.5; g.beginPath(); g.arc(x + w - s * 0.16, cy0, s * 0.12, -Math.PI / 2, Math.PI / 2); g.stroke();
        break;
      }
      default: box(C.shelf);
    }
  }

  // The parts that don't move. geom = { ox, oy, cell, W, H }.
  function renderStatic(g, L, geom, C) {
    const { ox, oy, cell } = geom;
    const P = materials(C);
    const px = (o) => [ox + o.c * cell + 2, oy + o.r * cell + 2, o.w * cell - 4, o.h * cell - 4];
    const safely = (fn) => { g.save(); try { fn(); } catch (e) {} g.restore(); };
    // The floor itself, then areas on it.
    if (L.floor) safely(() => paintFloor(g, L.floor, 0, 0, geom.W || ox * 2 + L.cols * cell, geom.H || oy * 2 + L.rows * cell, C, P, cell, ox, oy));
    for (const d of L.decos) safely(() => drawDeco(g, d, ox + d.c * cell, oy + d.r * cell, d.w * cell, d.h * cell, C, cell, P, ox, oy));
    g.fillStyle = rgba(C.ink3, L.floor ? (C.dark ? 0.26 : 0.2) : C.dark ? 0.32 : 0.26);
    for (let r = 0; r < L.rows; r++)
      for (let c = 0; c < L.cols; c++) {
        const v = L.grid[r * L.cols + c];
        if (v !== 0 && v !== 3) continue;
        g.beginPath();
        g.arc(ox + c * cell + cell / 2, oy + r * cell + cell / 2, 1, 0, Math.PI * 2);
        g.fill();
      }
    for (const d of L.decos) safely(() => drawOver(g, d, ox + d.c * cell, oy + d.r * cell, d.w * cell, d.h * cell, C, cell, P));
    // One badly drawn fixture shouldn't take the whole store down with it.
    for (const s of L.shelves) safely(() => drawShelf(g, s, ...px(s), C, cell, P));
    for (const f of L.fixtures) safely(() => drawFixture(g, f, ...px(f), C, cell, P));
    if (geom.labels === false) return;
    g.textBaseline = 'middle';
    g.fillStyle = C.ink3;
    g.font = FONT_UI(cell < 20 ? 10 : 11);
    g.textAlign = 'center';
    for (const n of L.numbers) g.fillText(String(n.n), ox + n.c * cell, oy + n.r * cell + cell / 2);
    // Labels sit on a little plate of floor colour, so they read on any floor.
    const plate = (text, tx, ty, align) => {
      const tw = g.measureText(text).width;
      const left = align === 'right' ? tx - tw : align === 'center' ? tx - tw / 2 : tx;
      g.fillStyle = rgba(C.panel, L.floor ? 0.85 : 0);
      if (L.floor) { roundRect(g, left - 3, ty - 7.5, tw + 6, 15, 3); g.fill(); }
      g.fillStyle = C.ink3;
      g.textAlign = align;
      g.fillText(text, tx, ty);
    };
    for (const f of L.fixtures) if (f.kind === 'counter' && f.label !== false) {
      const [x, y, w, h] = px(f);
      if (w > h && x > 60) plate('Checkout', x - 6, y + h / 2, 'right');
      else plate('Checkout', Math.min(geom.W - 30, Math.max(30, x + w / 2)), y > 14 ? y - 9 : y + h + 10, 'center');
    }
    for (const l of L.labels) {
      const tw = g.measureText(l.text).width;
      plate(l.text, Math.max(4, Math.min(geom.W - tw - 4, ox + l.c * cell + 2)), oy + l.r * cell + cell / 2, 'left');
    }
  }

  // The parts that do: lanterns, screens, steam, a cat. Called every frame.
  function drawLive(g, L, geom, C, now) {
    const { ox, oy, cell } = geom;
    for (const a of L.anims) {
      const x = ox + a.c * cell, y = oy + a.r * cell, w = a.w * cell, h = a.h * cell;
      const t = now / 1000;
      g.save();
      try {
      switch (a.kind) {
        case 'lantern': {
          const glow = 0.55 + 0.25 * Math.sin(t * 2 + a.c);
          g.fillStyle = rgba(C.gold, glow * 0.35); g.beginPath(); g.arc(x + cell / 2, y + cell / 2, cell * 0.55, 0, Math.PI * 2); g.fill();
          g.fillStyle = rgba(C.red, 0.85); g.beginPath(); g.ellipse(x + cell / 2, y + cell / 2, cell * 0.2, cell * 0.26, 0, 0, Math.PI * 2); g.fill();
          break;
        }
        case 'string': {
          // A string of red lanterns across the street, swaying a little.
          const along = w >= h;
          const len = along ? w : h;
          const x0 = along ? x : x + w / 2, y0 = along ? y + h / 2 : y;
          const sag = Math.min(cell * 0.6, len * 0.05);
          const pt = (u) => (along ? [x0 + u * len, y0 + Math.sin(u * Math.PI) * sag] : [x0 + Math.sin(u * Math.PI) * sag, y0 + u * len]);
          g.strokeStyle = rgba(C.ink, C.dark ? 0.4 : 0.35); g.lineWidth = 1; g.beginPath();
          for (let k = 0; k <= 20; k++) { const [px, py] = pt(k / 20); if (k) g.lineTo(px, py); else g.moveTo(px, py); }
          g.stroke();
          const n = Math.max(2, Math.round(len / (cell * 2.4)));
          for (let k = 0; k < n; k++) {
            const u = (k + 0.5) / n;
            const [px, py] = pt(u);
            const sway = cell >= 10 ? Math.sin(t * 1.4 + k * 0.9 + a.c) * 1.2 : 0;
            const lx = px + (along ? sway : 0), ly = py + (along ? 0 : sway);
            const rx = cell * 0.26, ry = cell * 0.32;
            g.fillStyle = rgba(C.gold, (0.22 + 0.08 * Math.sin(t * 2 + k)) * (C.dark ? 1.4 : 1));
            g.beginPath(); g.arc(lx, ly, cell * 0.5, 0, TAU); g.fill();
            g.fillStyle = C.dark ? '#d24a3a' : '#cf3b2e';
            g.beginPath(); g.ellipse(lx, ly, rx, ry, 0, 0, TAU); g.fill();
            if (cell >= 10) {
              g.strokeStyle = 'rgba(120,20,10,0.45)'; g.lineWidth = 0.7; g.beginPath(); g.ellipse(lx, ly, rx * 0.45, ry, 0, 0, TAU); g.stroke();
              g.fillStyle = C.dark ? '#e0b24c' : '#e2a93a';
              g.fillRect(lx - rx * 0.5, ly - ry - 1, rx, 2); g.fillRect(lx - rx * 0.5, ly + ry - 1, rx, 2);
              g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(lx, ly + ry + 1); g.lineTo(lx, ly + ry + 4); g.stroke();
            }
          }
          break;
        }
        case 'steam': {
          g.strokeStyle = rgba(C.ink3, 0.35); g.lineWidth = 1.2;
          for (let k = 0; k < 2; k++) {
            const p = (t * 0.6 + k * 0.5) % 1;
            g.globalAlpha = Math.sin(p * Math.PI);
            g.beginPath(); g.moveTo(x + cell / 2 + k * 6, y - p * cell * 1.2 + cell * 0.3);
            g.quadraticCurveTo(x + cell / 2 + k * 6 + 4, y - p * cell * 1.2, x + cell / 2 + k * 6, y - p * cell * 1.2 - 6);
            g.stroke();
          }
          g.globalAlpha = 1; break;
        }
        case 'screen': {
          const flick = 0.55 + 0.2 * Math.sin(t * 7 + a.c * 3) + 0.1 * Math.sin(t * 13);
          if (a.part === 'arcade') {
            // Only the screen at the back of the cabinet lights up.
            const [lw, lh] = orient(g, a.face, x + 2, y + 2, w - 4, h - 4);
            const pal = ['#4fd1ff', '#ff5fa2', '#7dff7a', '#ffe14d'];
            g.fillStyle = rgba(pal[(a.c + a.r) % 4], flick * (C.dark ? 0.8 : 0.7));
            roundRect(g, -lw / 2 + 4, -lh / 2 + 4, lw - 8, lh * 0.5 - 2, 1.5); g.fill();
            g.fillStyle = 'rgba(255,255,255,0.35)';
            g.fillRect(-lw / 2 + 6, -lh / 2 + 6 + ((t * 9 + a.c * 5) % Math.max(1, lh * 0.5 - 6)), lw - 12, 1);
            break;
          }
          g.fillStyle = rgba(C.route, flick); roundRect(g, x + 5, y + 5, w - 10, h - 10, 2); g.fill();
          break;
        }
        case 'fish': {
          for (let k = 0; k < Math.max(2, a.w / 4); k++) {
            const fx = x + 6 + (((t * (12 + k * 3) + k * 40) % (w - 12)) + (w - 12)) % (w - 12);
            const fy = y + h * (0.3 + 0.4 * ((k * 37) % 10) / 10) + Math.sin(t * 2 + k) * 2;
            g.fillStyle = rgba(HUES[k % HUES.length], 0.85);
            g.beginPath(); g.ellipse(fx, fy, 4, 2.2, 0, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.moveTo(fx - 4, fy); g.lineTo(fx - 7, fy - 2.5); g.lineTo(fx - 7, fy + 2.5); g.fill();
          }
          break;
        }
        case 'spin': {
          // Washing going round behind the glass.
          const [lw, lh] = orient(g, a.face, x + 2, y + 2, w - 4, h - 4);
          const r = Math.min(lw, lh) * 0.22;
          g.translate(0, lh * 0.1);
          g.rotate(t * 4);
          g.fillStyle = 'rgba(255,255,255,0.35)';
          g.beginPath(); g.arc(r * 0.35, 0, r * 0.4, 0, TAU); g.fill();
          g.fillStyle = rgba(HUES[(a.c + a.r) % HUES.length], 0.6);
          g.beginPath(); g.arc(-r * 0.4, r * 0.2, r * 0.35, 0, TAU); g.fill();
          break;
        }
        case 'frost': {
          g.fillStyle = 'rgba(255,255,255,0.6)';
          for (let k = 0; k < w / 14; k++) { const fx = x + 6 + k * 14, s = 1 + (Math.sin(t * 1.5 + k) + 1) * 0.8; g.fillRect(fx, y + h / 2 - s / 2, s, s); }
          break;
        }
        case 'confetti': {
          const n = Math.floor((w * h) / 3000);
          for (let k = 0; k < n; k++) {
            const sx = x + ((k * 97.3) % w) + Math.sin(t * 1.3 + k) * 8;
            const sy = y + (((k * 53.1) + t * (18 + (k % 5) * 5)) % h);
            g.save(); g.translate(sx, sy); g.rotate(t * 2 + k);
            g.fillStyle = rgba(HUES[k % HUES.length], 0.85); g.fillRect(-2.5, -1.2, 5, 2.4);
            g.restore();
          }
          break;
        }
        case 'snow': {
          g.fillStyle = C.dark ? 'rgba(255,255,255,0.7)' : 'rgba(150,170,200,0.75)';
          const n = Math.floor((w * h) / 2600);
          for (let k = 0; k < n; k++) {
            const sx = x + ((k * 97.3) % w) + Math.sin(t + k) * 6;
            const sy = y + (((k * 53.1) + t * (14 + (k % 5) * 4)) % h);
            g.beginPath(); g.arc(sx, sy, 1.4 + (k % 3) * 0.5, 0, Math.PI * 2); g.fill();
          }
          break;
        }
        case 'beam': {
          // The projector's light, from the back of the cinema to the screen.
          const along = w >= h;
          const gr = along ? g.createLinearGradient(x + w, 0, x, 0) : g.createLinearGradient(0, y + h, 0, y);
          gr.addColorStop(0, 'rgba(255,255,240,0)');
          gr.addColorStop(1, `rgba(255,255,240,${(C.dark ? 0.07 : 0.1) + 0.02 * Math.sin(t * 3)})`);
          g.fillStyle = gr;
          g.beginPath();
          if (along) { g.moveTo(x + w, y + h / 2 - 2); g.lineTo(x, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h / 2 + 2); }
          else { g.moveTo(x + w / 2 - 2, y + h); g.lineTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w / 2 + 2, y + h); }
          g.fill();
          break;
        }
        case 'cat': {
          // A sleeping cat, breathing.
          const breathe = 1 + 0.06 * Math.sin(t * 2.2);
          const cx = x + w / 2, cy = y + h / 2;
          g.fillStyle = C.dark ? '#c7cfdb' : '#4a5263';
          g.beginPath(); g.ellipse(cx, cy + 1, w * 0.38 * breathe, h * 0.32 * breathe, 0, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(cx + w * 0.32, cy - 1, h * 0.22, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(cx + w * 0.28, cy - h * 0.18); g.lineTo(cx + w * 0.31, cy - h * 0.42); g.lineTo(cx + w * 0.36, cy - h * 0.2); g.fill();
          g.beginPath(); g.moveTo(cx + w * 0.36, cy - h * 0.18); g.lineTo(cx + w * 0.42, cy - h * 0.4); g.lineTo(cx + w * 0.45, cy - h * 0.12); g.fill();
          g.strokeStyle = g.fillStyle; g.lineWidth = 2.2; g.lineCap = 'round';
          g.beginPath(); g.moveTo(cx - w * 0.36, cy + 2); g.quadraticCurveTo(cx - w * 0.5, cy - h * 0.1 + Math.sin(t * 1.3) * 2, cx - w * 0.42, cy - h * 0.3); g.stroke();
          g.lineWidth = 1; g.lineCap = 'butt';
          break;
        }
      }
      } catch (e) {}
      g.restore();
    }
    // Server lights blink on racks.
    for (const f of L.fixtures) {
      if (f.kind !== 'rack') continue;
      const x = ox + f.c * cell + 2, y = oy + f.r * cell + 2, w = f.w * cell - 4, h = f.h * cell - 4;
      const vertical = h > w;
      const n = Math.floor((vertical ? h : w) / 6);
      for (let k = 0; k < n; k++) {
        const on = Math.sin(now / (180 + ((k * 37) % 300)) + k * 1.7) > 0.2;
        if (!on) continue;
        g.fillStyle = k % 5 === 0 ? 'rgba(242,122,99,0.95)' : 'rgba(110,220,140,0.95)';
        if (vertical) g.fillRect(x + w - 6, y + 4 + k * 6, 2.5, 2.5);
        else g.fillRect(x + 4 + k * 6, y + h - 6, 2.5, 2.5);
      }
    }
  }

  window.StoreEngine = {
    count: S.length,
    info: (i) => ({ name: S[i].name, note: S[i].note }),
    list: () => S.map((s, i) => ({ number: i + 1, name: s.name, note: s.note })),
    build,
    renderStatic,
    drawLive,
    rgba,
  };
})();
