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
        const placed = [];
        for (let k = 0, tries = 0; k < n && tries < n * 40; tries++) {
          const w = api.int(minW, maxW), h = api.int(minH, maxH);
          const c = api.int(x0, Math.max(x0, x1 - w)), r = api.int(y0, Math.max(y0, y1 - h));
          if (placed.some((p) => c < p.c + p.w + margin && c + w + margin > p.c && r < p.r + p.h + margin && r + h + margin > p.r)) continue;
          placed.push({ c, r, w, h });
          if (kind === 'shelf') api.shelf(c, r, w, h);
          else api.fix(kind, c, r, w, h);
          k++;
        }
        return placed;
      },
      // Round tables with room around them.
      tables(x0, y0, x1, y1, size = 2, gap = 2, kind = 'table') {
        for (let r = y0; r + size <= y1; r += size + gap)
          for (let c = x0; c + size <= x1; c += size + gap) api.fix(kind, c, r, size, size);
      },
    };
    return { api, L };
  }

  // ---------- The stores ----------
  const S = [];
  const store = (name, note, build, opts = {}) => S.push({ name, note, build, ...opts });
  const front = (a) => Math.max(7, Math.round(a.cols * 0.24));

  // 1. The original.
  store('The corner store', 'The first one. Aisles at the back, fruit by the door.', (a) => {
    const f = front(a);
    a.aisles({ x1: a.cols - f });
    if (a.cols >= 30) a.fix('fruit', a.cols - f + 1, 3, 3, 2);
    a.checkout();
  });
  store('Long aisles', 'No cross aisle, so every trip goes the long way round.', (a) => {
    a.aisles({ x1: a.cols - front(a), cross: 0, y1: a.rows - 3 });
    a.checkout();
  });
  store('The cut-through', 'Three cross aisles. Shortcuts everywhere.', (a) => {
    a.aisles({ x1: a.cols - front(a), cross: a.rows >= 18 ? 3 : 2, crossW: 1 });
    a.checkout();
  });
  store('Wide aisles', 'Room for two carts to pass. Rare in real life.', (a) => {
    a.aisles({ x1: a.cols - front(a), gap: 6 });
    a.checkout();
  });
  store('Tight squeeze', 'Aisles one cart wide. The shopper is a real problem here.', (a) => {
    a.aisles({ x1: a.cols - front(a), gap: 2, cross: 1 });
    a.checkout();
  });
  store('Big gondolas', 'Thick double-sided shelving, stocked both ways.', (a) => {
    a.aisles({ x1: a.cols - front(a), w: 3, gap: 4 });
    a.checkout();
  });
  store('Staggered', 'Every other aisle starts lower, so no two cross aisles line up.', (a) => {
    a.aisles({ x1: a.cols - front(a), stagger: 2, y1: a.rows - 3 });
    a.checkout();
  });
  store('Produce first', 'Fruit and veg up the front, dry goods behind.', (a) => {
    const f = Math.max(9, Math.round(a.cols * 0.36));
    a.aisles({ x1: a.cols - f });
    for (let r = 2; r + 2 <= a.rows - 6; r += 4) a.fix('fruit', a.cols - f + 2, r, 3, 2);
    for (let r = 2; r + 2 <= a.rows - 6; r += 4) if (a.cols - f + 7 < a.cols - 4) a.fix('fruit', a.cols - f + 7, r + 1, 2, 2);
    a.checkout();
  });
  store('Endcaps', 'Specials at the end of every aisle. Somebody paid for that spot.', (a) => {
    a.aisles({ x1: a.cols - front(a), endcaps: true, y1: a.rows - 4 });
    a.checkout();
  });
  store('Saturday rush', 'Every checkout open, still a queue.', (a) => {
    a.aisles({ x1: a.cols - 2, y1: a.rows - 7, cross: 0 });
    const n = Math.floor((a.cols - 6) / 5);
    for (let k = 0; k < n; k++) a.fix('counter', 3 + k * 5, a.rows - 4, 3, 1, { label: false });
    a.park(a.cols - 3, a.rows - 2);
    a.label('Checkouts', 3, a.rows - 5);
  });
  store('Self-serve', 'Six self-checkouts and one person watching them all.', (a) => {
    a.aisles({ x1: a.cols - front(a) - 2, y1: a.rows - 2 });
    const x = a.cols - front(a) + 1;
    for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) a.fix('kiosk', x + j * 3, 3 + k * 3, 1, 1);
    a.checkout();
  });
  store('Mirror image', 'The same store twice, back to back, with the tills in the middle.', (a) => {
    const mid = Math.floor(a.cols / 2);
    a.aisles({ x0: 2, x1: mid - 3, numbers: false });
    a.aisles({ x0: mid + 3, x1: a.cols - 1, numbers: false });
    a.checkout({ c: mid, r: a.rows - 6 });
  });
  store('The frozen section', 'A long wall of freezers. The cart keeps its distance.', (a) => {
    a.fix('freezer', 2, 1, a.cols - 4, 1);
    a.aisles({ y0: 4, x1: a.cols - front(a) });
    a.anim('frost', 2, 1, a.cols - 4, 1);
    a.checkout();
  });
  store('The long thin shop', 'A shopfront on a busy street, all depth and no width.', (a) => {
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
  store('Perimeter', 'Shelves round the walls and one big island in the middle.', (a) => {
    a.shelf(1, 1, a.cols - 9, 1);
    a.shelf(1, a.rows - 2, a.cols - 9, 1);
    a.shelf(1, 3, 1, a.rows - 6);
    const iw = Math.max(4, a.cols - 22), ih = Math.max(2, a.rows - 12);
    a.fix('display', Math.floor((a.cols - 8 - iw) / 2) + 2, Math.floor((a.rows - ih) / 2), iw, ih);
    a.checkout();
  });
  store('Stairs', 'Shelves stepped on the diagonal, like someone pushed them.', (a) => {
    const f = front(a);
    for (let c = 2, k = 0; c + 2 <= a.cols - f; c += 5, k++) {
      for (let r = 1 + (k % 3), s = 0; r + 2 <= a.rows - 2; r += 3, s++) a.shelf(c + (s % 2), r, 2, 2);
    }
    a.checkout();
  });
  store('Herringbone', 'Short shelves at alternating angles. Pretty, and a pain to shop.', (a) => {
    const f = front(a);
    for (let c = 2, k = 0; c + 3 <= a.cols - f; c += 4, k++) {
      for (let r = 2 + (k % 2) * 2; r + 1 <= a.rows - 3; r += 4) { a.shelf(c, r, 2, 1); a.shelf(c + 1, r + 1, 2, 1); }
    }
    a.checkout();
  });
  store('Old warehouse', 'Pillars every few metres. The aisles were laid out around them.', (a) => {
    const f = front(a);
    a.aisles({ x1: a.cols - f, gap: 5 });
    for (let c = 6; c < a.cols - f; c += 7) for (let r = 3; r < a.rows - 3; r += 5) a.fix('pillar', c, r, 1, 1);
    a.checkout();
  });
  store('Two shops', 'A wall down the middle and one doorway between them.', (a) => {
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
    for (let c = 2; c + 3 <= a.cols - 6; c += 5) {
      a.fix('stall', c, 2, 3, 2);
      if (a.rows >= 16) a.fix('stall', c, a.rows - 4, 3, 2);
    }
    for (let c = 2; c < a.cols - 6; c += 2) { a.anim('lantern', c, 5); if (a.rows >= 16) a.anim('lantern', c + 1, a.rows - 6); }
    a.tables(4, Math.floor(a.rows / 2) - 1, a.cols - 8, Math.floor(a.rows / 2) + 2, 2, 4);
    a.checkout({ r: Math.floor(a.rows / 2) - 1, len: 3 });
  }, { dim: true });
  store('Hawker centre', 'Stalls round the edge, tables in the middle. Singapore, soon.', (a) => {
    a.stock(['chicken rice', 'laksa', 'kaya toast', 'char kway teow', 'teh tarik', 'satay', 'carrot cake']);
    for (let c = 2; c + 3 <= a.cols - 2; c += 4) a.fix('stall', c, 1, 3, 2);
    a.tables(3, 5, a.cols - 7, a.rows - 2, 2, 2);
    a.checkout({ r: a.rows - 6, len: 3 });
    a.label('Wash your tray', a.cols - 9, a.rows - 1);
  });
  store("Farmers' market", 'Crates of fruit in rows, and one person selling honey.', (a) => {
    a.stock(['honey', 'peaches', 'apples', 'sourdough', 'eggs', 'tomatoes', 'cherries']);
    for (let c = 2; c + 3 <= a.cols - 7; c += 5) for (let r = 2; r + 2 <= a.rows - 2; r += 4) a.fix('fruit', c, r, 3, 2);
    a.checkout();
  });
  store('The bakery', 'Ovens on the back wall, racks of bread cooling everywhere else.', (a) => {
    a.stock(['sourdough', 'croissants', 'hot cross buns', 'baguette', 'lamingtons', 'pies']);
    for (let c = 2; c + 3 <= a.cols - 8; c += 5) { a.fix('oven', c, 1, 3, 2); a.anim('steam', c + 1, 1); }
    a.aisles({ y0: 5, x1: a.cols - front(a), w: 1, gap: 4, numbers: false, style: 'bread' });
    a.checkout();
  });
  store('The deli', 'Long glass counters. Take a number.', (a) => {
    a.stock(['salami', 'olives', 'brie', 'prosciutto', 'pickles', 'sourdough']);
    a.fix('deli', 2, 2, a.cols - 12, 1);
    a.fix('deli', 2, a.rows - 4, a.cols - 12, 1);
    a.tables(4, 5, a.cols - 10, a.rows - 5, 2, 3);
    a.checkout();
    a.label('Now serving 42', 2, 1);
  });
  store('Bubble tea', 'One counter, a lot of tables, and a lot of tapioca.', (a) => {
    a.stock(['bubble tea', 'brown sugar milk', 'taro slush', 'jasmine green tea', 'pudding']);
    a.fix('bar', 2, 1, a.cols - 12, 1);
    a.tables(3, 4, a.cols - 8, a.rows - 1, 2, 3);
    a.checkout();
  });
  store('Dumpling house', 'Round tables and steaming baskets.', (a) => {
    a.stock(['xiao long bao', 'pork buns', 'har gow', 'potstickers', 'wontons', 'chilli oil']);
    a.tables(3, 2, a.cols - 8, a.rows - 2, 3, 3);
    for (let c = 4; c < a.cols - 8; c += 6) a.anim('steam', c, 2);
    a.checkout();
  });
  store('The fish market', 'Tanks along the wall. Somebody is watching you.', (a) => {
    a.stock(['salmon', 'prawns', 'oysters', 'squid', 'barramundi', 'scallops']);
    a.fix('tank', 2, 1, a.cols - 10, 2);
    a.anim('fish', 2, 1, a.cols - 10, 2);
    a.aisles({ y0: 5, x1: a.cols - front(a), style: 'ice', numbers: false });
    a.checkout();
  });
  store('Food court', 'Counters round three walls and every table taken.', (a) => {
    a.fix('stall', 1, 1, 1, a.rows - 2);
    for (let c = 4; c + 3 <= a.cols - 6; c += 5) a.fix('stall', c, 1, 3, 2);
    a.tables(4, 5, a.cols - 7, a.rows - 1, 2, 2);
    a.checkout();
  });
  store('Cat café', 'Couches, coffee, and a cat asleep exactly where the cart wants to go.', (a) => {
    a.stock(['flat white', 'banana bread', 'matcha latte', 'toastie', 'cat treats']);
    a.fix('bar', 2, 1, Math.floor(a.cols / 3), 1);
    a.fix('sofa', 2, a.rows - 4, 5, 2);
    a.fix('sofa', Math.floor(a.cols / 2), a.rows - 4, 5, 2);
    a.tables(4, 5, a.cols - 9, a.rows - 6, 2, 4);
    a.fix('cat', Math.floor(a.cols / 2) - 2, Math.floor(a.rows / 2), 2, 1);
    a.anim('cat', Math.floor(a.cols / 2) - 2, Math.floor(a.rows / 2), 2, 1);
    a.checkout();
  });
  store('The milk bar', 'Tiny, a bit dusty, sells everything. Classic Melbourne.', (a) => {
    a.stock(['milk', 'the paper', 'a sausage roll', 'mixed lollies', 'bread', 'a Chiko roll']);
    const w = Math.max(14, Math.floor(a.cols * 0.55)), h = Math.max(9, a.rows - 6);
    const c0 = Math.floor((a.cols - w) / 2) - 2, r0 = Math.floor((a.rows - h) / 2);
    a.deco('path', 0, 0, a.cols, a.rows);
    a.deco('floor', c0, r0, w, h);
    const door = c0 + Math.floor(w / 2) - 1;
    a.fix('wall', c0, r0, w, 1);
    a.fix('wall', c0, r0 + h - 1, door - c0, 1);
    a.fix('wall', door + 3, r0 + h - 1, c0 + w - door - 3, 1);
    a.fix('wall', c0, r0 + 1, 1, h - 2);
    a.fix('wall', c0 + w - 1, r0 + 1, 1, h - 2);
    a.shelf(c0 + 2, r0 + 2, w - 4, 1);
    a.shelf(c0 + 2, r0 + 4, 1, h - 7);
    a.shelf(c0 + 5, r0 + 5, Math.max(2, w - 12), 1);
    a.fix('counter', c0 + w - 3, r0 + h - 5, 1, 3);
    a.park(c0 + w - 5, r0 + h - 4);
  });
  store('The servo', 'A petrol station. The shop part, anyway.', (a) => {
    a.stock(['a pie', 'iced coffee', 'chips', 'ice', 'a phone charger', 'jerky']);
    for (let c = 3; c + 1 <= a.cols - 12; c += 5) { a.fix('pump', c, 2, 1, 1); a.fix('pump', c, a.rows - 3, 1, 1); }
    a.deco('bay', 1, 1, a.cols - 12, a.rows - 2);
    const x = a.cols - 10;
    a.fix('wall', x, 0, 1, a.rows - 5);
    a.shelf(x + 2, 2, 1, a.rows - 9);
    a.checkout({ c: a.cols - 3, len: 3 });
  });

  // Things I like.
  store('The bookshop', 'Root Rot is face-out by the door.', (a) => {
    a.stock(['a novel', 'a cookbook', 'a travel guide', 'poetry', 'a manga volume', 'a bookmark']);
    a.aisles({ x1: a.cols - front(a), w: 1, gap: 3, style: 'books' });
    a.deco('rug', a.cols - front(a) + 1, 2, 5, 4);
    a.fix('sofa', a.cols - front(a) + 2, 3, 3, 1);
    a.checkout();
  });
  store('The library', 'Long shelves, quiet desks. The cart is asked to keep it down.', (a) => {
    a.stock(['a reserve', 'a returned book', 'a quiet desk', 'a library card']);
    for (let r = 2; r + 1 <= a.rows - 3; r += 3) a.shelf(2, r, Math.floor(a.cols * 0.45), 1, 'books');
    a.tables(Math.floor(a.cols * 0.45) + 5, 2, a.cols - 7, a.rows - 2, 2, 2, 'desk');
    a.checkout();
  });
  store('Manga corner', 'Stacks and stacks of volumes. Somebody is still on volume one.', (a) => {
    a.stock(['volume 1', 'volume 52', 'volume 104', 'a box set', 'an art book']);
    for (let c = 2; c + 2 <= a.cols - 8; c += 4) for (let r = 2; r + 2 <= a.rows - 3; r += 4) a.shelf(c, r, 2, 2, 'books');
    a.checkout();
  });
  store('The music shop', 'Guitars on the wall, a piano no one is allowed to play, and one tenor sax.', (a) => {
    a.stock(['reeds', 'a capo', 'strings', 'a metronome', 'valve oil', 'a mouthpiece']);
    a.fix('guitars', 1, 1, a.cols - 10, 1);
    a.fix('piano', 3, Math.floor(a.rows / 2) - 1, 5, 2);
    a.fix('sax', Math.floor(a.cols / 2), Math.floor(a.rows / 2) - 1, 2, 3);
    a.shelf(3, a.rows - 4, a.cols - 14, 1);
    a.checkout();
  });
  store('The arcade', 'Fighting games on the left, and locals start at seven.', (a) => {
    a.stock(['tokens', 'a soft drink', 'a fight stick', 'tickets']);
    a.lightsOff();
    for (let c = 2; c + 2 <= a.cols - 8; c += 3) {
      a.fix('arcade', c, 1, 2, 2);
      a.anim('screen', c, 1, 2, 2);
      if (a.rows >= 16) { a.fix('arcade', c, a.rows - 3, 2, 2); a.anim('screen', c, a.rows - 3, 2, 2); }
    }
    a.label('Locals tonight, 7 pm', 3, Math.floor(a.rows / 2));
    a.checkout({ r: Math.floor(a.rows / 2) - 1, len: 3 });
  }, { dim: true });
  store('Board game café', 'Every table mid-game. Nobody wants to be the banker.', (a) => {
    a.stock(['a board game', 'chips', 'iced tea', 'extra dice', 'a rulebook']);
    a.shelf(1, 1, a.cols - 9, 1, 'books');
    a.tables(3, 4, a.cols - 8, a.rows - 1, 3, 3, 'gametable');
    a.checkout();
  });
  store('The server room', 'Racks of blinking lights. The homelab, minus the downtime.', (a) => {
    a.stock(['a patch cable', 'a hard drive', 'thermal paste', 'a spare fan', 'zip ties']);
    a.lightsOff();
    for (let c = 3; c + 2 <= a.cols - 8; c += 5) {
      a.fix('rack', c, 2, 2, Math.floor((a.rows - 6) / 2));
      a.fix('rack', c, a.rows - 2 - Math.floor((a.rows - 6) / 2), 2, Math.floor((a.rows - 6) / 2));
    }
    a.checkout();
  }, { dim: true });
  store('Cold aisle', 'A data centre. The blue squares are cold air, which the cart enjoys.', (a) => {
    a.stock(['a server', 'a rail kit', 'a fibre patch', 'a label maker']);
    for (let r = 2; r + 2 <= a.rows - 3; r += 6) {
      a.fix('rack', 2, r, a.cols - 12, 1);
      a.deco('cold', 2, r + 1, a.cols - 12, 2);
      if (r + 3 < a.rows - 2) a.fix('rack', 2, r + 3, a.cols - 12, 1);
    }
    a.checkout();
  });
  store('Hackathon hall', 'Hour 31 of 48. Where the original cart was built.', (a) => {
    a.stock(['an energy drink', 'cold pizza', 'a jumper lead', 'an Arduino', 'sleep']);
    a.tables(2, 2, a.cols - 8, a.rows - 2, 3, 2, 'desk');
    a.label('UNIHACK', 2, a.rows - 1);
    a.checkout();
  });
  store('The exam hall', 'Rows of single desks. Pens down.', (a) => {
    a.stock(['a pen', 'a calculator', 'a water bottle', 'a student ID']);
    for (let r = 2; r < a.rows - 2; r += 2) for (let c = 2; c < a.cols - 8; c += 3) a.fix('desk', c, r, 1, 1);
    a.checkout();
  });
  store('The tutoring room', 'Small desks, a whiteboard, and a lot of fractions.', (a) => {
    a.stock(['a workbook', 'a whiteboard marker', 'a times table', 'a gold star']);
    a.fix('board', 2, 1, Math.floor(a.cols / 2), 1);
    a.tables(3, 4, a.cols - 9, a.rows - 2, 2, 3, 'desk');
    a.checkout();
  });
  store('The esports stage', 'Two teams of five facing off, and the casters on the left.', (a) => {
    a.stock(['a headset', 'an energy drink', 'a mousepad', 'a jersey']);
    a.lightsOff();
    const mid = Math.floor(a.rows / 2);
    a.fix('stage', 4, mid - 4, Math.min(12, a.cols - 18), 1);
    a.fix('stage', 4, mid + 3, Math.min(12, a.cols - 18), 1);
    a.fix('desk', 1, mid - 1, 1, 2);
    a.label('Casters', 1, mid - 2);
    a.anim('screen', Math.min(12, a.cols - 18) + 6, mid - 1, 3, 2);
    a.fix('screen', Math.min(12, a.cols - 18) + 6, mid - 1, 3, 2);
    a.checkout();
  }, { dim: true });
  store('Moving day', 'Everything in boxes. Most of them say SG.', (a) => {
    a.stock(['tape', 'bubble wrap', 'a marker', 'a passport', 'a plug adapter']);
    a.scatter('box', Math.floor((a.cols * a.rows) / 30), { x1: a.cols - 7, maxW: 2, maxH: 2 });
    a.checkout();
  });
  store('The gate', 'Rows of seats, and a flight to Singapore boarding soon.', (a) => {
    a.stock(['a neck pillow', 'a coffee', 'a boarding pass', 'snacks']);
    for (let r = 2; r + 1 <= a.rows - 2; r += 3) a.fix('seats', 3, r, a.cols - 15, 1);
    a.fix('bar', a.cols - 9, 2, 1, 3);
    a.label('Gate 7: SIN', a.cols - 11, 1);
    a.checkout();
  });
  store('The laneway', 'Coffee, a mural, and nowhere to sit.', (a) => {
    a.stock(['a long black', 'a croissant', 'a vinyl record', 'a tote bag']);
    a.fix('mural', 0, 0, a.cols, 2);
    a.fix('mural', 0, a.rows - 2, a.cols, 2);
    a.tables(3, 4, a.cols - 8, a.rows - 3, 1, 4);
    a.checkout({ r: 4, len: 3 });
  });

  // Puzzles.
  store('The maze', 'Hedges. A* earns its keep in here.', (a) => {
    a.maze(1, 0, a.cols - 6, a.rows);
    a.checkout({ c: a.cols - 2, r: a.rows - 6, len: 3 });
  });
  store('The other maze', 'Same idea, different hedges. Try Dijkstra and watch it flood.', (a) => {
    a.maze(1, 0, a.cols - 6, a.rows);
    a.checkout({ c: a.cols - 2, r: 2, len: 3 });
  });
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
  store('The greedy trap', 'Switch to greedy search and send the cart to the far side. It walks straight into the U.', (a) => {
    const cx = Math.floor((a.cols - 8) / 2), h = Math.floor(a.rows * 0.6), top = Math.floor((a.rows - h) / 2);
    a.fix('wall', cx, top, 1, h);
    a.fix('wall', cx + 1, top, 6, 1);
    a.fix('wall', cx + 1, top + h - 1, 6, 1);
    a.checkout();
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
    for (let r = 1; r + 1 <= a.rows - 5; r += 3) { a.deco('lane', 1, r, a.cols - 12, 2); a.fix('gutter', 1, r + 2, a.cols - 12, 1); }
    a.fix('pins', a.cols - 11, 1, 1, a.rows - 6);
    a.checkout();
  });
  store('Car park', 'Level 2. Somebody always parks across two bays.', (a) => {
    a.stock(['a parking ticket', 'loose change', 'a trolley coin']);
    a.deco('bay', 1, 1, a.cols - 9, a.rows - 2);
    for (let c = 2; c + 2 <= a.cols - 10; c += 3) {
      if (a.rand() < 0.65) a.fix('car', c, 1, 2, 3, { hue: a.int(0, 5) });
      if (a.rand() < 0.65) a.fix('car', c, a.rows - 4, 2, 3, { hue: a.int(0, 5) });
    }
    for (let c = 5; c < a.cols - 9; c += 9) a.fix('pillar', c, Math.floor(a.rows / 2), 1, 1);
    a.checkout();
  });
  store('Garden centre', 'Rows of plants. Mind the root rot.', (a) => {
    a.stock(['potting mix', 'a monstera', 'seedlings', 'a watering can', 'snail pellets']);
    for (let r = 2; r + 1 <= a.rows - 2; r += 3) for (let c = 2; c < a.cols - 8; c += 2) a.fix('plant', c, r, 1, 1, { hue: a.int(0, 3) });
    a.checkout();
  });
  store('The hardware store', 'Tall racking and a sausage sizzle out the front.', (a) => {
    a.stock(['a sausage in bread', 'screws', 'timber', 'cable ties', 'a drill bit', 'paint']);
    a.aisles({ x1: a.cols - front(a), w: 3, gap: 4, cross: 0, style: 'racking' });
    a.fix('bbq', a.cols - 6, 2, 2, 1);
    a.anim('steam', a.cols - 6, 2);
    a.checkout();
  });
  store('The chemist', 'Aisles of everything, and a counter at the back for the real stuff.', (a) => {
    a.stock(['sunscreen', 'tissues', 'ibuprofen', 'lip balm', 'a toothbrush', 'vitamins']);
    a.aisles({ x1: a.cols - front(a), y0: 4, w: 1, gap: 4 });
    a.fix('bar', 2, 1, a.cols - 12, 1);
    a.fix('cross', a.cols - 9, 1, 1, 1);
    a.checkout();
  });
  store('The laundromat', 'Rows of machines, all spinning.', (a) => {
    a.stock(['detergent', 'coins', 'a dryer sheet', 'a lost sock']);
    for (let c = 2; c < a.cols - 8; c += 2) { a.fix('washer', c, 1, 2, 2); a.anim('spin', c, 1, 2, 2); }
    for (let c = 2; c < a.cols - 8; c += 2) if (a.rows >= 15) { a.fix('washer', c, a.rows - 3, 2, 2); a.anim('spin', c, a.rows - 3, 2, 2); }
    a.fix('bench', 3, Math.floor(a.rows / 2), a.cols - 14, 1);
    a.checkout({ r: Math.floor(a.rows / 2) - 1, len: 3 });
  });
  store('The toy shop', 'A claw machine, a ball pit and nobody over the age of nine.', (a) => {
    a.stock(['a yo-yo', 'a plushie', 'a puzzle', 'a kite', 'bubbles']);
    a.fix('claw', 2, 2, 2, 2);
    a.fix('claw', 5, 2, 2, 2);
    a.fix('ballpit', Math.floor(a.cols / 2) - 3, Math.floor(a.rows / 2) - 2, 5, 4);
    a.shelf(2, a.rows - 3, a.cols - 12, 1, 'toys');
    a.checkout();
  });
  store('The florist', 'Buckets of flowers, all over the floor.', (a) => {
    a.stock(['roses', 'sunflowers', 'eucalyptus', 'tulips', 'a vase', 'wattle']);
    a.scatter('flowers', Math.floor((a.cols * a.rows) / 18), { x1: a.cols - 7, maxW: 1, maxH: 1, margin: 1 });
    a.checkout();
  });
  store('The gym', 'Machines in rows. The cart is here for the cardio.', (a) => {
    a.stock(['a protein bar', 'a towel', 'a shaker', 'chalk']);
    for (let c = 2; c + 2 <= a.cols - 8; c += 4) for (let r = 2; r + 1 <= a.rows - 2; r += 4) a.fix('gym', c, r, 2, 1);
    a.deco('mat', a.cols - 14, a.rows - 5, 5, 3);
    a.checkout();
  });
  store('The station', 'A platform, two tracks and a train that is ten minutes late.', (a) => {
    a.stock(['a myki top-up', 'a coffee', 'a newspaper', 'a timetable']);
    const p = Math.floor(a.rows / 2);
    a.deco('tracks', 0, 1, a.cols, 2);
    a.fix('edge', 0, 3, a.cols - 7, 1);
    a.fix('edge', 0, a.rows - 4, a.cols - 7, 1);
    a.deco('tracks', 0, a.rows - 3, a.cols, 2);
    for (let c = 4; c < a.cols - 9; c += 7) a.fix('bench', c, p, 3, 1);
    a.checkout({ r: p - 1, len: 3 });
  });
  store('The museum', 'Exhibits on plinths, behind ropes. Please do not touch.', (a) => {
    a.stock(['a postcard', 'an audio guide', 'a fridge magnet', 'a catalogue']);
    for (let c = 3; c + 2 <= a.cols - 8; c += 6) for (let r = 2; r + 2 <= a.rows - 2; r += 5) a.fix('plinth', c, r, 2, 2);
    a.checkout();
  });
  store('The gallery', 'Paintings on the walls and a bench in the middle for staring.', (a) => {
    a.stock(['a print', 'a postcard', 'a tote bag', 'an exhibition book']);
    a.fix('frames', 1, 0, a.cols - 9, 1);
    a.fix('frames', 1, a.rows - 1, a.cols - 9, 1);
    a.fix('wall', Math.floor((a.cols - 8) / 2), 3, 1, a.rows - 6);
    a.fix('bench', 4, Math.floor(a.rows / 2), 4, 1);
    a.checkout();
  });

  // Odd days.
  store('Opening day', 'One shelf, mostly empty. Stock arrives Tuesday.', (a) => {
    a.shelf(4, 3, 2, a.rows - 7);
    a.scatter('box', 6, { x0: 9, x1: a.cols - 8, maxW: 2, maxH: 2, margin: 2 });
    a.checkout();
  });
  store('Stocktake', 'Pallets everywhere. Nobody can find anything.', (a) => {
    a.scatter('pallet', Math.floor((a.cols * a.rows) / 26), { x1: a.cols - 7, minW: 2, maxW: 3, minH: 2, maxH: 2 });
    a.checkout();
  });
  store('Clearance sale', 'Everything must go, including the layout.', (a) => {
    a.scatter('shelf', Math.floor((a.cols * a.rows) / 34), { x1: a.cols - 7, minW: 1, maxW: 4, minH: 1, maxH: 3 });
    a.label('Everything 50% off', 2, a.rows - 1);
    a.checkout();
  });
  store('Blackout', 'The power is out. The cart has a torch.', (a) => {
    a.aisles({ x1: a.cols - front(a) });
    a.lightsOff();
    a.checkout();
  }, { torch: true });
  store('Wet floor', 'Someone dropped the milk. Several times.', (a) => {
    a.aisles({ x1: a.cols - front(a), gap: 5 });
    a.scatter('puddle', 5, { x1: a.cols - 8, minW: 1, maxW: 2, minH: 1, maxH: 1, margin: 2 });
    a.checkout();
  });
  store('Tiny shop', 'The rest of the building is for lease.', (a) => {
    const w = 12, h = Math.min(9, a.rows - 4);
    const c0 = Math.floor((a.cols - w) / 2), r0 = Math.floor((a.rows - h) / 2);
    a.ring(c0 - 1, r0 - 1, w + 2, h + 2, 1, 'plain');
    a.shelf(c0 + 2, r0 + 2, 1, h - 4);
    a.shelf(c0 + 5, r0 + 2, 1, h - 4);
    a.fix('counter', c0 + w - 2, r0 + h - 4, 1, 3, { label: false });
    a.park(c0 + w - 4, r0 + h - 3);
  });
  store('Giant shelves', 'Built for someone much bigger.', (a) => {
    const f = front(a);
    a.aisles({ x1: a.cols - f, w: 5, gap: 5, cross: 1, crossW: 3 });
    a.checkout();
  });
  store('Hall of pillars', 'More pillar than floor.', (a) => {
    for (let c = 2; c < a.cols - 7; c += 3) for (let r = 1 + (c % 2); r < a.rows - 1; r += 3) a.fix('pillar', c, r, 1, 1);
    a.checkout();
  });
  store('Aisle thirteen', "Aisle 13 isn't on the map. The cart won't go down it.", (a) => {
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
  });
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
  store('After hours', 'Closed, but the cleaner left the radio on.', (a) => {
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
    ['Chinatown', 'Dried goods floor to ceiling.'],
  ];
  SUBURBS.forEach(([name, note], k) => {
    store(name, note, (a) => {
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

  // The last one.
  store('See you in Singapore', 'Store one hundred. You found them all, or you cheated. Either way, thanks for looking.', (a) => {
    a.spell('SG', 2, 'hedge');
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
    const T = (o) => (portrait ? { ...o, c: o.r, r: o.c, w: o.h, h: o.w } : o);
    const P = (p) => (portrait ? { c: p.r, r: p.c } : p);
    const inside = (o) => {
      const c0 = Math.max(0, Math.floor(o.c)), r0 = Math.max(0, Math.floor(o.r));
      const c1 = Math.min(cols, Math.floor(o.c) + Math.max(1, Math.round(o.w))), r1 = Math.min(rows, Math.floor(o.r) + Math.max(1, Math.round(o.h)));
      return c1 > c0 && r1 > r0 ? { ...o, c: c0, r: r0, w: c1 - c0, h: r1 - r0 } : null;
    };
    const shelves = L.shelves.map(T).map(inside).filter(Boolean);
    const fixtures = L.fixtures.map(T).map(inside).filter(Boolean);
    const decos = L.decos.map(T).map(inside).filter(Boolean);
    const anims = L.anims.map(T).map(inside).filter(Boolean);
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

  // Floor markings, drawn under everything else.
  function drawDeco(g, d, x, y, w, h, C, cell) {
    switch (d.kind) {
      case 'rug': g.fillStyle = rgba(C.red, 0.12); roundRect(g, x + 2, y + 2, w - 4, h - 4, 4); g.fill(); break;
      case 'mat': g.fillStyle = rgba(C.ink, 0.08); g.fillRect(x + 2, y + 2, w - 4, h - 4); break;
      case 'cold': g.fillStyle = rgba(C.route, 0.08); g.fillRect(x, y, w, h); break;
      case 'grass': g.fillStyle = rgba('#8fb453', C.dark ? 0.1 : 0.14); g.fillRect(x, y, w, h); break;
      case 'path': g.fillStyle = rgba(C.ink, C.dark ? 0.12 : 0.06); g.fillRect(x, y, w, h); break;
      case 'floor': g.fillStyle = C.panel; g.fillRect(x, y, w, h); break;
      case 'tent':
        g.fillStyle = C.panel; g.strokeStyle = rgba(C.ink, 0.35); g.setLineDash([4, 3]); g.lineWidth = 1;
        g.fillRect(x, y, w, h); g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); g.setLineDash([]); break;
      case 'lane':
        g.fillStyle = rgba(C.gold, C.dark ? 0.12 : 0.16); g.fillRect(x, y + 2, w, h - 4);
        g.strokeStyle = rgba(C.ink, 0.12); g.beginPath();
        for (let k = 1; k < 6; k++) { const xx = x + w * 0.15 + k * 6; g.moveTo(xx, y + h / 2 - 3); g.lineTo(xx + 3, y + h / 2); g.lineTo(xx, y + h / 2 + 3); }
        g.stroke(); break;
      case 'bay':
        g.strokeStyle = rgba(C.ink, 0.18); g.lineWidth = 1; g.beginPath();
        for (let xx = x; xx <= x + w; xx += cell * 3) { g.moveTo(xx + 0.5, y); g.lineTo(xx + 0.5, y + cell * 3.5); g.moveTo(xx + 0.5, y + h - cell * 3.5); g.lineTo(xx + 0.5, y + h); }
        g.stroke(); break;
      case 'tracks':
        g.strokeStyle = rgba(C.ink, 0.3); g.lineWidth = 1.5; g.beginPath();
        g.moveTo(x, y + h * 0.3); g.lineTo(x + w, y + h * 0.3); g.moveTo(x, y + h * 0.7); g.lineTo(x + w, y + h * 0.7);
        for (let xx = x; xx < x + w; xx += 8) { g.moveTo(xx, y + h * 0.2); g.lineTo(xx, y + h * 0.8); }
        g.stroke(); break;
    }
  }

  function drawShelf(g, s, x, y, w, h, C, cell) {
    g.fillStyle = s.style === 'ice' ? rgba(C.route, 0.18) : C.shelf;
    g.strokeStyle = C.rule;
    g.lineWidth = 1;
    roundRect(g, x, y, w, h, 3);
    g.fill();
    g.stroke();
    if (s.style === 'plain') return;
    if (s.style === 'books' || s.style === 'toys') {
      // Spines in a few colours.
      const vertical = h > w;
      const n = Math.floor((vertical ? h : w) / 4);
      for (let k = 0; k < n; k++) {
        g.fillStyle = rgba(HUES[(k * 7 + Math.floor(x + y)) % HUES.length], C.dark ? 0.55 : 0.5);
        if (vertical) g.fillRect(x + 2, y + 2 + k * 4, w - 4, 3);
        else g.fillRect(x + 2 + k * 4, y + 2, 3, h - 4);
      }
      return;
    }
    if (s.style === 'bread') {
      g.fillStyle = rgba('#c98a4b', 0.6);
      const vertical = h > w;
      for (let k = 0; k < (vertical ? h : w) / 9; k++) {
        g.beginPath();
        if (vertical) g.ellipse(x + w / 2, y + 6 + k * 9, Math.max(0.5, w / 2 - 2), 3, 0, 0, Math.PI * 2);
        else g.ellipse(x + 6 + k * 9, y + h / 2, 3, Math.max(0.5, h / 2 - 2), 0, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    g.beginPath();
    if (s.style === 'racking') {
      g.strokeStyle = rgba(C.pumpkin, 0.6);
      g.rect(x + 2, y + 2, w - 4, h - 4);
    }
    if (h > w) {
      g.moveTo(x + w / 2, y + 4);
      g.lineTo(x + w / 2, y + h - 4);
      for (let yy = y + cell * 0.75; yy < y + h - 4; yy += cell * 0.75) { g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); }
    } else {
      for (let xx = x + cell * 0.75; xx < x + w - 4; xx += cell * 0.75) { g.moveTo(xx, y + 4); g.lineTo(xx, y + h - 4); }
    }
    g.stroke();
  }

  function drawFixture(g, f, x, y, w, h, C, cell) {
    const ink = (a) => rgba(C.ink, a);
    const box = (fill, stroke = C.rule, r = 3) => { g.fillStyle = fill; g.strokeStyle = stroke; g.lineWidth = 1; roundRect(g, x, y, w, h, r); g.fill(); g.stroke(); };
    const vertical = h > w;
    switch (f.kind) {
      case 'counter': {
        box(ink(C.dark ? 0.32 : 0.14), ink(0.35));
        g.strokeStyle = ink(0.18);
        g.beginPath();
        if (vertical) for (let yy = y + 16; yy < y + h - 3; yy += 5) { g.moveTo(x + 3, yy); g.lineTo(x + w - 3, yy); }
        else for (let xx = x + 16; xx < x + w - 3; xx += 5) { g.moveTo(xx, y + 3); g.lineTo(xx, y + h - 3); }
        g.stroke();
        g.fillStyle = ink(C.dark ? 0.6 : 0.5);
        roundRect(g, vertical ? x + w / 2 - 5 : x + 4, vertical ? y + 4 : y + h / 2 - 4, 10, 8, 2);
        g.fill();
        break;
      }
      case 'kiosk': box(ink(0.12), ink(0.3)); g.fillStyle = rgba(C.route, 0.5); g.fillRect(x + w / 2 - 3, y + 3, 6, 4); break;
      case 'display': box(C.shelf); g.strokeStyle = C.rule; g.beginPath(); g.moveTo(x + 3, y + h / 2); g.lineTo(x + w - 3, y + h / 2); g.stroke(); break;
      case 'fruit': case 'flowers': {
        box(f.kind === 'flowers' ? rgba(C.ink, 0.06) : C.shelf);
        const r = Math.min(4, cell * 0.17);
        let k = Math.floor(x + y);
        for (let yy = y + r + 3; yy <= y + h - r - 2; yy += r * 2 + 3)
          for (let xx = x + r + 3; xx <= x + w - r - 2; xx += r * 2 + 3) {
            g.fillStyle = rgba(HUES[k++ % HUES.length], C.dark ? 0.75 : 0.85);
            g.beginPath(); g.arc(xx, yy, r, 0, Math.PI * 2); g.fill();
          }
        break;
      }
      case 'freezer': box(rgba(C.route, 0.14), rgba(C.route, 0.4)); break;
      case 'table': case 'gametable': {
        g.fillStyle = C.shelf; g.strokeStyle = C.rule;
        g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.max(0.5, Math.min(w, h) / 2), 0, Math.PI * 2); g.fill(); g.stroke();
        if (f.kind === 'gametable') {
          g.fillStyle = rgba(HUES[Math.floor(x) % HUES.length], 0.8);
          g.fillRect(x + w / 2 - 6, y + h / 2 - 3, 5, 5);
          g.fillStyle = ink(0.5); g.fillRect(x + w / 2 + 1, y + h / 2 - 1, 4, 4);
        }
        break;
      }
      case 'stall': {
        box(C.shelf);
        const stripe = 5;
        for (let k = 0; k * stripe < (vertical ? h : w); k++) {
          g.fillStyle = k % 2 ? rgba(C.red, 0.55) : C.panel;
          if (vertical) g.fillRect(x, y + k * stripe, Math.min(6, w), stripe);
          else g.fillRect(x + k * stripe, y, Math.min(stripe, w - k * stripe), Math.min(6, h));
        }
        break;
      }
      case 'box': {
        box('#c9a77c', 'rgba(90,60,30,0.45)', 2);
        g.strokeStyle = 'rgba(90,60,30,0.35)'; g.beginPath(); g.moveTo(x + w / 2, y + 1); g.lineTo(x + w / 2, y + h - 1); g.stroke();
        if (w >= cell * 2 - 4) { g.fillStyle = 'rgba(60,40,20,0.7)'; g.font = FONT_UI(9, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SG', x + w / 2, y + h / 2 + 4); }
        break;
      }
      case 'pallet': {
        box('#d8bf94', 'rgba(90,60,30,0.4)', 1);
        g.strokeStyle = 'rgba(90,60,30,0.3)'; g.beginPath();
        for (let yy = y + 4; yy < y + h - 2; yy += 5) { g.moveTo(x + 2, yy); g.lineTo(x + w - 2, yy); }
        g.stroke(); break;
      }
      case 'rack': {
        box(ink(C.dark ? 0.5 : 0.75), ink(0.8), 2);
        g.fillStyle = 'rgba(255,255,255,0.15)';
        if (vertical) for (let yy = y + 4; yy < y + h - 3; yy += 6) g.fillRect(x + 3, yy, w - 6, 2);
        else for (let xx = x + 4; xx < x + w - 3; xx += 6) g.fillRect(xx, y + 3, 2, h - 6);
        break;
      }
      case 'oven': box(ink(0.7), ink(0.8)); g.fillStyle = rgba(C.pumpkin, 0.85); roundRect(g, x + 4, y + 4, w - 8, h - 8, 3); g.fill(); break;
      case 'deli': box(rgba(C.route, 0.1), rgba(C.route, 0.35)); g.fillStyle = rgba(C.red, 0.35); for (let xx = x + 4; xx < x + w - 6; xx += 10) g.fillRect(xx, y + 4, 6, h - 8); break;
      case 'plant': case 'tree': {
        const hue = ['#5e9a4b', '#7cad55', '#4c8a5c', '#95b85a'][(f.hue || 0) % 4];
        g.fillStyle = rgba('#b07a4f', 0.8); g.beginPath(); g.arc(x + w / 2, y + h / 2 + 2, Math.min(w, h) * 0.22, 0, Math.PI * 2); g.fill();
        g.fillStyle = rgba(hue, 0.85);
        for (let k = 0; k < 4; k++) { const ang = (k / 4) * Math.PI * 2 + 0.6; g.beginPath(); g.arc(x + w / 2 + Math.cos(ang) * w * 0.2, y + h / 2 - 2 + Math.sin(ang) * h * 0.18, Math.min(w, h) * 0.2, 0, Math.PI * 2); g.fill(); }
        break;
      }
      case 'planter': case 'hedge': {
        box(rgba('#6f9a52', C.dark ? 0.45 : 0.5), rgba('#4c7a3a', 0.6), f.kind === 'hedge' ? 2 : 3);
        if (f.kind === 'planter') { g.fillStyle = rgba('#8fb453', 0.8); for (let xx = x + 5; xx < x + w - 3; xx += 7) { g.beginPath(); g.arc(xx, y + h / 2, 3, 0, Math.PI * 2); g.fill(); } }
        break;
      }
      case 'wall': box(ink(C.dark ? 0.32 : 0.42), ink(C.dark ? 0.45 : 0.55), 1); break;
      case 'bar': box(ink(C.dark ? 0.2 : 0.08), ink(0.3)); break;
      case 'mural': {
        box(ink(C.dark ? 0.25 : 0.12), ink(0.25), 1);
        for (let k = 0; k < w / 10; k++) { g.fillStyle = rgba(HUES[k % HUES.length], 0.7); g.beginPath(); g.arc(x + 6 + k * 10, y + h / 2 + Math.sin(k) * 3, 4, 0, Math.PI * 2); g.fill(); }
        break;
      }
      case 'pillar': g.fillStyle = ink(C.dark ? 0.4 : 0.55); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.38, 0, Math.PI * 2); g.fill(); break;
      case 'sofa': box(rgba(C.route, 0.22), rgba(C.route, 0.45), 6); break;
      case 'cat': break; // drawn as an animation
      case 'desk': box(C.shelf); g.fillStyle = ink(0.45); g.fillRect(x + w / 2 - 4, y + h / 2 - 3, 8, 5); break;
      case 'board': box('#ffffff', ink(0.4), 1); g.strokeStyle = rgba(C.route, 0.5); g.beginPath(); for (let xx = x + 6; xx < x + w - 8; xx += 14) { g.moveTo(xx, y + h / 2); g.lineTo(xx + 8, y + h / 2 - 2); } g.stroke(); break;
      case 'arcade': case 'screen': box(ink(0.8), ink(0.9), 2); break;
      case 'stage': box(ink(0.75), ink(0.85), 2); g.fillStyle = rgba(C.route, 0.6); for (let xx = x + 4; xx < x + w - 6; xx += cell) g.fillRect(xx, y + 3, cell - 8, 3); break;
      case 'guitars': box(C.shelf); for (let xx = x + 6; xx < x + w - 4; xx += 12) { g.fillStyle = rgba('#b5733d', 0.85); g.beginPath(); g.ellipse(xx, y + h / 2 + 2, 4, 5, 0, 0, Math.PI * 2); g.fill(); } break;
      case 'piano': {
        box(ink(0.85), ink(0.9), 2);
        const keyY = vertical ? x : y;
        g.fillStyle = '#f4f4ef';
        if (vertical) g.fillRect(x + w - 8, y + 2, 6, h - 4); else g.fillRect(x + 2, keyY + h - 8, w - 4, 6);
        g.fillStyle = ink(0.9);
        if (vertical) for (let yy = y + 4; yy < y + h - 4; yy += 4) g.fillRect(x + w - 8, yy, 3, 2);
        else for (let xx = x + 4; xx < x + w - 4; xx += 4) g.fillRect(xx, y + h - 8, 2, 3);
        break;
      }
      case 'sax': {
        // A tenor sax on a stand: a curved brass body and a bell.
        g.strokeStyle = rgba(C.gold, 0.95); g.lineWidth = Math.max(3, cell * 0.22); g.lineCap = 'round';
        const cx0 = x + w / 2, top = y + 3, bot = y + h - 5;
        g.beginPath(); g.moveTo(cx0 - 2, top); g.lineTo(cx0, bot - 6); g.quadraticCurveTo(cx0 + 1, bot, cx0 + 7, bot - 4); g.stroke();
        g.fillStyle = rgba(C.gold, 0.95); g.beginPath(); g.arc(cx0 + 8, bot - 6, 4, 0, Math.PI * 2); g.fill();
        g.lineCap = 'butt'; g.lineWidth = 1; break;
      }
      case 'pump': box(rgba(C.red, 0.5), rgba(C.red, 0.7), 2); break;
      case 'washer': box(C.panel, ink(0.35), 3); g.strokeStyle = ink(0.4); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.3, 0, Math.PI * 2); g.stroke(); break;
      case 'bench': box(rgba('#b5733d', 0.45), rgba('#8a5a30', 0.5), 2); break;
      case 'claw': box(rgba(C.route, 0.12), ink(0.4), 2); for (let k = 0; k < 4; k++) { g.fillStyle = rgba(HUES[k], 0.85); g.beginPath(); g.arc(x + 6 + (k % 2) * (w - 12), y + h - 6 - Math.floor(k / 2) * 6, 3, 0, Math.PI * 2); g.fill(); } break;
      case 'ballpit': box(C.panel, ink(0.35), 6); for (let k = 0; k < (w * h) / 40; k++) { g.fillStyle = rgba(HUES[k % HUES.length], 0.8); g.beginPath(); g.arc(x + 5 + ((k * 37) % (w - 10)), y + 5 + ((k * 23) % (h - 10)), 2.6, 0, Math.PI * 2); g.fill(); } break;
      case 'gym': box(ink(0.55), ink(0.7), 2); g.fillStyle = ink(0.85); g.fillRect(x - 1, y + h / 2 - 4, 4, 8); g.fillRect(x + w - 3, y + h / 2 - 4, 4, 8); break;
      case 'edge': box(rgba(C.gold, 0.6), rgba(C.gold, 0.8), 1); break;
      case 'gutter': box(ink(0.12), ink(0.2), 1); break;
      case 'pins': box(C.panel, ink(0.3), 2); g.fillStyle = ink(0.5); for (let yy = y + 5; yy < y + h - 3; yy += 6) { g.beginPath(); g.arc(x + w / 2, yy, 1.8, 0, Math.PI * 2); g.fill(); } break;
      case 'car': {
        const hue = HUES[(f.hue || 0) % HUES.length];
        box(rgba(hue, 0.7), rgba(hue, 0.9), 5);
        g.fillStyle = 'rgba(255,255,255,0.45)';
        if (vertical) { g.fillRect(x + 3, y + 5, w - 6, 5); g.fillRect(x + 3, y + h - 10, w - 6, 4); } else { g.fillRect(x + 5, y + 3, 5, h - 6); g.fillRect(x + w - 10, y + 3, 4, h - 6); }
        break;
      }
      case 'plinth': box(C.panel, ink(0.35), 2); g.fillStyle = rgba(HUES[Math.floor(x) % HUES.length], 0.7); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2); g.fill(); break;
      case 'frames': box(ink(0.06), ink(0.15), 1); for (let k = 0, xx = x + 4; xx < x + w - 12; xx += 22, k++) { g.fillStyle = rgba(HUES[k % HUES.length], 0.7); g.fillRect(xx, y + 3, 14, h - 6); } break;
      case 'puddle': g.fillStyle = rgba(C.route, 0.25); g.beginPath(); g.ellipse(x + w / 2, y + h / 2, Math.max(0.5, w / 2), Math.max(0.5, h / 2.4), 0, 0, Math.PI * 2); g.fill(); break;
      case 'tank': box(rgba(C.route, 0.18), rgba(C.route, 0.5), 3); break;
      case 'bbq': box(ink(0.7), ink(0.8), 2); g.fillStyle = rgba('#b5733d', 0.9); for (let xx = x + 4; xx < x + w - 4; xx += 6) g.fillRect(xx, y + h / 2 - 1.5, 4, 3); break;
      case 'cross': g.fillStyle = '#3d9a5b'; g.fillRect(x + w / 2 - 2, y + 3, 4, h - 6); g.fillRect(x + 3, y + h / 2 - 2, w - 6, 4); break;
      case 'seats': box(rgba(C.route, 0.18), rgba(C.route, 0.35), 2); g.strokeStyle = rgba(C.route, 0.35); g.beginPath(); for (let xx = x + cell; xx < x + w; xx += cell) { g.moveTo(xx, y + 2); g.lineTo(xx, y + h - 2); } g.stroke(); break;
      case 'mopbucket': g.fillStyle = rgba(C.gold, 0.9); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.32, 0, Math.PI * 2); g.fill(); break;
      default: box(C.shelf);
    }
  }

  // The parts that don't move. geom = { ox, oy, cell, W, H }.
  function renderStatic(g, L, geom, C) {
    const { ox, oy, cell } = geom;
    const px = (o) => [ox + o.c * cell + 2, oy + o.r * cell + 2, o.w * cell - 4, o.h * cell - 4];
    for (const d of L.decos) drawDeco(g, d, ox + d.c * cell, oy + d.r * cell, d.w * cell, d.h * cell, C, cell);
    g.fillStyle = rgba(C.ink3, C.dark ? 0.32 : 0.26);
    for (let r = 0; r < L.rows; r++)
      for (let c = 0; c < L.cols; c++) {
        const v = L.grid[r * L.cols + c];
        if (v !== 0 && v !== 3) continue;
        g.beginPath();
        g.arc(ox + c * cell + cell / 2, oy + r * cell + cell / 2, 1, 0, Math.PI * 2);
        g.fill();
      }
    // One badly drawn fixture shouldn't take the whole store down with it.
    const safely = (fn) => { g.save(); try { fn(); } catch (e) {} g.restore(); };
    for (const s of L.shelves) safely(() => drawShelf(g, s, ...px(s), C, cell));
    for (const f of L.fixtures) safely(() => drawFixture(g, f, ...px(f), C, cell));
    if (geom.labels === false) return;
    g.textBaseline = 'middle';
    g.fillStyle = C.ink3;
    g.font = FONT_UI(cell < 20 ? 10 : 11);
    g.textAlign = 'center';
    for (const n of L.numbers) g.fillText(String(n.n), ox + n.c * cell, oy + n.r * cell + cell / 2);
    for (const f of L.fixtures) if (f.kind === 'counter' && f.label !== false) {
      const [x, y, w, h] = px(f);
      if (w > h && x > 60) {
        // A sideways counter: label it on the left, clear of the cart's spot above it.
        g.textAlign = 'right';
        g.fillText('Checkout', x - 6, y + h / 2);
        g.textAlign = 'center';
      } else g.fillText('Checkout', Math.min(geom.W - 30, Math.max(30, x + w / 2)), y > 14 ? y - 9 : y + h + 10);
    }
    g.textAlign = 'left';
    for (const l of L.labels) {
      const tw = g.measureText(l.text).width;
      g.fillText(l.text, Math.max(4, Math.min(geom.W - tw - 4, ox + l.c * cell + 2)), oy + l.r * cell + cell / 2);
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
          const r = Math.min(w, h) * 0.22;
          g.strokeStyle = rgba(C.route, 0.6); g.lineWidth = 2;
          g.beginPath(); g.arc(x + w / 2, y + h / 2, r, t * 4, t * 4 + Math.PI * 1.2); g.stroke(); g.lineWidth = 1;
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
