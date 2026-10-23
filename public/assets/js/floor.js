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

  const SHOPPING_LIST = ['milk', 'eggs', 'rice', 'tofu', 'bread', 'apples', 'coffee', 'noodles', 'bok choy', 'dumplings', 'soy sauce', 'oranges', 'kimchi', 'yoghurt'];
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
    colors = { paper: v('--paper'), ink: v('--ink'), ink2: v('--ink-2'), ink3: v('--ink-3'), rule: v('--rule'), shelf: v('--shelf'), route: v('--route') };
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

    // Cart starts near the bottom right, the shopper somewhere else.
    cart.cell = nearestFree(idx(Math.max(1, cols - 4), Math.max(1, rows - 4)));
    if (cart.cell < 0) return false;
    cart.x = cx(cart.cell);
    cart.y = cy(cart.cell);
    cart.path = [];
    cart.pi = 0;
    cart.mode = 'shop';
    cart.wait = 0.4;
    cart.item = null;
    cart.retry = -1;

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
    if (!res.path) {
      cart.path = [];
      updateReadout();
      if (!astar(cart.cell, goal).path) {
        // Walled in by shelves or text: drop this goal and move on.
        cart.retry = -1;
        if (cart.item && cart.item.cell === goal) {
          items = items.filter((it) => it !== cart.item);
          cart.item = null;
          spawnItem();
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
    if (!items.length) spawnItem();
    // Head for the closest item on the list.
    let best = null, bestD = Infinity;
    for (const it of items) {
      const d = dist(it.cell, cart.cell);
      if (d < bestD) { bestD = d; best = it; }
    }
    if (!best) return;
    cart.item = best;
    cart.mode = 'shop';
    pin = null;
    plan(best.cell);
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
    if (moveAlong(cart, 5.2, dt) === 'done') arrive();
  }

  function arrive() {
    if (cart.mode === 'shop' && cart.item && cart.cell === cart.item.cell) {
      items = items.filter((it) => it !== cart.item);
      cart.item = null;
      spawnItem();
      cart.wait = 0.5;
      cart.path = [];
      return;
    }
    if (cart.mode === 'pin') {
      cart.mode = 'idle';
      cart.wait = 1.6;
      cart.path = [];
      return;
    }
    nextItem();
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
      ctx.fillStyle = colors.ink;
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
      ctx.fillStyle = target ? colors.ink : colors.ink3;
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

    // Shopper
    ctx.strokeStyle = colors.ink2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(shopper.x, shopper.y, CELL * 0.26, 0, Math.PI * 2);
    ctx.stroke();

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

  function init() {
    stop();
    ready = build();
    if (!ready) return;
    if (reduce) {
      nextItem();
      draw(performance.now());
    } else {
      start();
    }
  }

  // ---------- Input ----------
  hero.addEventListener('click', (e) => {
    if (!ready || e.target.closest('a, button, input, label, textarea, select')) return;
    if (window.getSelection && String(window.getSelection()).length) return;
    const rect = hero.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left - ox) / CELL);
    const r = Math.floor((e.clientY - rect.top - oy) / CELL);
    if (!inb(c, r)) return;
    const goal = nearestFree(idx(c, r), shopperBlocks);
    if (goal < 0) return;
    pin = goal;
    cart.mode = 'pin';
    cart.item = null;
    if (plan(goal)) cart.wait = reduce ? 0 : 0.45;
    if (reduce) draw(performance.now());
  });

  window.floorDemo = {
    shop() {
      if (!ready) return;
      cart.wait = 0;
      nextItem();
      if (reduce) draw(performance.now());
    },
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
    init();
    // Arriving from "Send the cart shopping" on another page.
    if (location.hash === '#shop') setTimeout(() => window.floorDemo.shop(), 300);
  };
  window.addEventListener('hashchange', () => { if (location.hash === '#shop') window.floorDemo.shop(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
  else window.addEventListener('load', go);
})();
