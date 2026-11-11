// Live Wikipedia edits, scored in the browser.
//
// The stream: Wikimedia's public EventStreams feed of every change on every
// wiki. Only English Wikipedia article edits by accounts without the bot flag
// are scored, as in training.
// The diffs: Wikipedia's Action API, which allows a browser about 1,000
// requests an hour, so every 20 seconds a few of the new edits are picked at
// random and scored (4 requests: one for editor details and tags, one diff
// each). That stays under 750 requests an hour.
// The model: BERT-mini distilled from a DeBERTa-v3 teacher, int8 ONNX, run
// with onnxruntime-web. Its input is cut to 128 tokens, as measured in the
// project's phase 3 report.
//
// Nothing about editors is shown: no usernames, no IP addresses, no edit
// summaries and no diff text. Nothing is stored in the browser.

import { parseEdit, extractDiff, parseEnrich, studentText, isIp } from './edit-text.mjs';
import { WordPiece } from './wordpiece.mjs';

const STREAM = 'https://stream.wikimedia.org/v2/stream/recentchange';
const API = 'https://en.wikipedia.org/w/api.php';
const TICK_MS = 20000; // how often a few edits are picked and scored
const FIRST_TICK_MS = 6000;
const PER_TICK = 3; // edits scored per tick
const RUN_LIMIT_MS = 15 * 60 * 1000; // pause after 15 minutes of watching, to save data
const STALL_MS = 45000; // reconnect if the stream goes quiet this long
const KEEP = 40; // edits kept in the list

const fmt = new Intl.NumberFormat('en-AU');
const pctFmt = (p) => (p < 0.01 ? 'under 1%' : `${Math.round(p * 100)}%`);

// Errors that mean "wait before asking again" carry retryAfter (seconds). A
// rate-limited response doesn't always carry CORS headers, and then the
// browser only reports a failed request, so those wait too.
async function api(params) {
  const q = new URLSearchParams({ ...params, format: 'json', formatversion: '2', origin: '*' });
  let r;
  try {
    r = await fetch(`${API}?${q}`, { credentials: 'omit' });
  } catch {
    throw Object.assign(new Error('unreachable'), { retryAfter: 60, unreachable: true });
  }
  if (r.status === 429 || r.status === 503) {
    throw Object.assign(new Error('rate limited'), { retryAfter: Number(r.headers.get('retry-after')) || 60 });
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const parseHtml = (html) => new DOMParser().parseFromString(html, 'text/html');

// The model's size is known in advance (config.json), so progress works even
// when the server sends it compressed.
async function fetchWithProgress(url, total, onProgress) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  if (!r.body) return new Uint8Array(await r.arrayBuffer());
  const reader = r.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(got, total), total);
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export function mount(root, { assets, vendor }) {
  const $ = (s) => root.querySelector(s);
  const ui = {
    status: $('[data-we-status]'),
    toggle: $('[data-we-toggle]'),
    numbers: $('[data-we-numbers]'),
    list: $('[data-we-list]'),
    empty: $('[data-we-empty]'),
    digest: $('[data-we-digest]'),
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    running: false, // the visitor wants it running
    hidden: false, // paused while the tab is in the background
    source: null,
    retry: 0,
    reconnectTimer: 0,
    stallTimer: 0,
    tickTimer: 0,
    apiPausedUntil: 0,
    runStarted: 0,
    runMs: 0, // time spent watching, across pauses
    limitFrom: 0, // watching time when the visitor last pressed start or resume
    buffer: [], // new edits since the last tick
    recent: new Set(), // revision ids already seen, in case the stream repeats one
    model: null,
    modelError: '',
    counts: { seen: 0, bots: 0, scored: 0, flagged: 0, failed: 0, flaggedAnon: 0, flaggedRegistered: 0 },
    items: [], // scored edits, newest first
    pages: new Map(), // title -> scored edits this session
    statusText: '',
    view: 'all',
  };

  // ---------- model ----------

  async function loadModel() {
    const [config, vocab] = await Promise.all([
      fetch(`${assets}config.json`).then((r) => r.json()),
      fetch(`${assets}vocab.txt`).then((r) => r.text()),
    ]);
    const mb = (n) => (n / 1e6).toFixed(1);
    const bytes = await fetchWithProgress(`${assets}model.onnx`, config.model_bytes, (got, total) =>
      setStatus(`Downloading the model: ${mb(got)} of ${mb(total)} MB`)
    );
    setStatus('Starting the model');
    const ort = await import(`${vendor}ort.wasm.min.mjs`);
    ort.env.wasm.wasmPaths = vendor;
    ort.env.wasm.numThreads = 1;
    const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    const tok = new WordPiece(vocab, { lowercase: config.lowercase, maxLen: config.max_len });
    state.model = { ort, session, tok, config };
    if (active()) {
      clearTimeout(state.tickTimer);
      state.tickTimer = setTimeout(tick, 1000);
    }
    render();
  }

  async function score(row) {
    const { ort, session, tok, config } = state.model;
    const ids = tok.encode(studentText(row, config.diff_chars));
    const n = ids.length;
    const res = await session.run({
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, n]),
      attention_mask: new ort.Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]),
    });
    const z = config.platt.a * res.logit.data[0] + config.platt.b;
    const p = 1 / (1 + Math.exp(-z));
    return { p, flagged: p >= config.threshold };
  }

  // ---------- stream ----------

  function connect() {
    disconnect();
    setStatus(state.retry ? 'Reconnecting to the stream' : 'Connecting to the stream');
    const es = new EventSource(STREAM);
    state.source = es;
    es.onopen = () => {
      state.retry = 0;
      setStatus('');
      watchStall();
    };
    es.onmessage = (e) => {
      watchStall();
      let ev;
      try {
        ev = JSON.parse(e.data);
      } catch {
        return;
      }
      const row = parseEdit(ev);
      if (!row || state.recent.has(row.rev_id)) return;
      state.recent.add(row.rev_id);
      if (state.recent.size > 5000) state.recent.delete(state.recent.values().next().value);
      state.counts.seen++;
      if (row.is_bot) state.counts.bots++;
      else state.buffer.push(row);
    };
    es.onerror = () => {
      // EventSource retries by itself, but on its own schedule and silently;
      // this way the status line says what's happening.
      if (state.source !== es) return;
      scheduleReconnect();
    };
  }

  function disconnect() {
    clearTimeout(state.reconnectTimer);
    clearTimeout(state.stallTimer);
    if (state.source) {
      state.source.onopen = state.source.onmessage = state.source.onerror = null;
      state.source.close();
      state.source = null;
    }
  }

  function scheduleReconnect() {
    disconnect();
    const wait = Math.min(60, 2 ** state.retry * 2);
    state.retry++;
    let left = wait;
    const count = () => {
      setStatus(`Lost the stream. Trying again in ${left} s`);
      if (left-- <= 0) connect();
      else state.reconnectTimer = setTimeout(count, 1000);
    };
    count();
  }

  function watchStall() {
    clearTimeout(state.stallTimer);
    state.stallTimer = setTimeout(scheduleReconnect, STALL_MS);
  }

  // ---------- scoring a few edits every tick ----------

  async function tick() {
    state.tickTimer = setTimeout(tick, TICK_MS);
    if (!active() || !state.model) return;
    const pool = state.buffer;
    state.buffer = [];
    if (Date.now() < state.apiPausedUntil || !pool.length) return;
    const picked = [];
    while (picked.length < PER_TICK && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    try {
      const users = [...new Set(picked.filter((r) => r.user && !isIp(r.user)).map((r) => r.user))];
      const params = { action: 'query', prop: 'revisions', revids: picked.map((r) => r.rev_id).join('|'), rvprop: 'ids|tags' };
      if (users.length) Object.assign(params, { list: 'users', ususers: users.join('|'), usprop: 'registration|editcount|groups' });
      const { tags, users: info } = parseEnrich(await api(params));
      for (const row of picked) {
        if (!active()) return;
        const u = info.get(row.user || '') || {};
        const t = tags.get(row.rev_id);
        let diff;
        try {
          const data = await api({ action: 'compare', fromrev: row.old_rev_id, torev: row.rev_id, prop: 'diff|ids|title', difftype: 'table' });
          if (!data.compare) throw new Error('no diff');
          diff = extractDiff(data.compare.body || '', parseHtml);
        } catch (err) {
          if (err.retryAfter) throw err;
          state.counts.failed++;
          continue;
        }
        const full = {
          ...row,
          user_registration: u.registration ?? null,
          user_editcount: u.editcount ?? null,
          user_groups: u.groups ?? null,
          tags_at_save: t === undefined ? null : t.join(','),
          ...diff,
        };
        const s = await score(full);
        add(full, s);
      }
    } catch (err) {
      if (err.retryAfter) {
        state.apiPausedUntil = Date.now() + err.retryAfter * 1000;
        const msg = err.unreachable ? `Couldn’t reach Wikipedia’s API, so scoring waits ${err.retryAfter} s` : `Wikipedia asked for fewer requests, so scoring waits ${err.retryAfter} s`;
        setStatus(msg);
        setTimeout(() => state.statusText === msg && setStatus(''), err.retryAfter * 1000);
      } else state.counts.failed += picked.length;
    }
  }

  function add(row, s) {
    state.counts.scored++;
    if (s.flagged) {
      state.counts.flagged++;
      if (row.is_anon) state.counts.flaggedAnon++;
      else state.counts.flaggedRegistered++;
    }
    const item = {
      title: row.title,
      anon: !!row.is_anon,
      delta: row.size_delta,
      p: s.p,
      flagged: s.flagged,
      at: row.ts ? new Date(row.ts * 1000) : new Date(),
    };
    state.items.unshift(item);
    state.items.length = Math.min(state.items.length, KEEP);
    const seen = state.pages.get(row.title) || { scored: 0, flagged: 0 };
    seen.scored++;
    if (s.flagged) seen.flagged++;
    state.pages.set(row.title, seen);
    renderItem(item, true);
    render();
  }

  // ---------- running, pausing ----------

  const active = () => state.running && !state.hidden;

  function elapsed() {
    return state.runMs + (active() && state.runStarted ? Date.now() - state.runStarted : 0);
  }

  function resume() {
    if (state.running) return;
    state.limitFrom = elapsed(); // a fresh 15 minutes from here
    state.running = true;
    if (!state.hidden) begin();
    render();
  }

  function begin() {
    state.runStarted = Date.now();
    connect();
    clearTimeout(state.tickTimer);
    state.tickTimer = setTimeout(tick, FIRST_TICK_MS);
    if (!state.model && !state.loading) {
      state.loading = loadModel()
        .catch((err) => {
          state.modelError = 'The model didn’t load, so edits can’t be scored. Reload the page to try again.';
          console.error(err);
          render();
        });
    }
  }

  function halt() {
    if (state.runStarted) state.runMs += Date.now() - state.runStarted;
    state.runStarted = 0;
    disconnect();
    clearTimeout(state.tickTimer);
    state.buffer = [];
  }

  function pause(reason = '') {
    if (active()) halt();
    state.running = false;
    setStatus(reason);
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (!state.running) return;
    if (document.hidden) {
      halt();
      state.hidden = true;
    } else {
      state.hidden = false;
      begin();
    }
    render();
  });

  ui.toggle.addEventListener('click', () => (state.running ? pause() : resume()));
  root.querySelectorAll('input[name="we-view"]').forEach((r) =>
    r.addEventListener('change', () => {
      state.view = r.value;
      ui.list.dataset.view = r.value;
      render();
    })
  );

  // ---------- drawing ----------

  function setStatus(text) {
    state.statusText = text;
    renderStatus();
  }

  function renderStatus() {
    let text = state.statusText;
    if (!text) {
      if (state.modelError) text = state.modelError;
      else if (!state.running) text = state.counts.seen ? 'Paused' : 'Not started';
      else if (state.hidden) text = 'Paused while this tab is in the background';
      else if (!state.model) text = 'Loading the model';
      else text = 'Live';
    }
    ui.status.textContent = text;
    ui.status.dataset.live = String(text === 'Live');
  }

  function renderItem(item, fresh) {
    const li = document.createElement('li');
    li.className = `we__item${item.flagged ? ' we__item--flag' : ''}${fresh && !reduced.matches ? ' we__item--new' : ''}`;
    const a = document.createElement('a');
    a.className = 'we__title';
    a.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
    a.textContent = item.title;
    const meta = document.createElement('span');
    meta.className = 'we__meta';
    const time = item.at.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const size = item.delta == null ? null : Math.abs(item.delta);
    const delta = size == null ? '' : ` · ${item.delta > 0 ? '+' : item.delta < 0 ? '−' : ''}${fmt.format(size)} byte${size === 1 ? '' : 's'}`;
    meta.textContent = `${time} · ${item.anon ? 'anonymous editor' : 'registered editor'}${delta}`;
    const score = document.createElement('span');
    score.className = 'we__score';
    score.innerHTML = `<span class="we__bar" aria-hidden="true"><i style="width:${Math.max(2, Math.round(item.p * 100))}%"></i></span>`;
    const label = document.createElement('span');
    label.className = 'we__p';
    label.textContent = item.flagged ? `Likely to be reverted, ${pctFmt(item.p)}` : pctFmt(item.p);
    score.append(label);
    li.append(a, meta, score);
    ui.list.prepend(li);
    while (ui.list.children.length > KEEP) ui.list.lastElementChild.remove();
  }

  function render() {
    renderStatus();
    ui.toggle.textContent = state.running ? 'Pause' : state.counts.seen ? 'Resume' : 'Start';
    ui.toggle.setAttribute('aria-pressed', String(!state.running && state.counts.seen > 0));
    const c = state.counts;
    const mins = Math.max(1, Math.round(elapsed() / 60000));
    ui.numbers.textContent = c.seen
      ? `${fmt.format(c.seen - c.bots)} article edits in ${mins} min · ${fmt.format(c.scored)} scored · ${fmt.format(c.flagged)} likely to be reverted · ${fmt.format(c.bots)} bot edits skipped`
      : 'No edits yet';
    const shown = state.view === 'flagged' ? state.items.filter((i) => i.flagged).length : state.items.length;
    ui.empty.hidden = shown > 0;
    ui.empty.textContent = state.view === 'flagged' && state.items.length ? 'Nothing scored so far looks likely to be reverted.' : 'Scored edits will appear here.';
    renderDigest();
  }

  function renderDigest() {
    const c = state.counts;
    const cfg = state.model && state.model.config;
    if (!c.scored) {
      ui.digest.textContent = 'A summary appears once a few edits have been scored.';
      return;
    }
    const mins = Math.max(1, Math.round(elapsed() / 60000));
    const parts = [];
    parts.push(`In ${mins} minute${mins === 1 ? '' : 's'} of watching, ${fmt.format(c.seen - c.bots)} edits were made to English Wikipedia articles by editors who aren’t bots, and this page scored ${fmt.format(c.scored)} of them, picked at random.`);
    if (!c.flagged) parts.push('None of them look likely to be reverted.');
    else {
      const who =
        c.flaggedAnon && c.flaggedRegistered
          ? `${fmt.format(c.flaggedAnon)} by anonymous editors and ${fmt.format(c.flaggedRegistered)} by registered editors`
          : c.flaggedAnon
            ? (c.flagged === 1 ? 'by an anonymous editor' : 'all by anonymous editors')
            : (c.flagged === 1 ? 'by a registered editor' : 'all by registered editors');
      parts.push(`${fmt.format(c.flagged)} look${c.flagged === 1 ? 's' : ''} likely to be reverted (${pctFmt(c.flagged / c.scored)} of those scored), ${who}.`);
    }
    const repeat = [...state.pages].filter(([, v]) => v.scored > 1).sort((a, b) => b[1].scored - a[1].scored);
    if (repeat.length) parts.push(`${repeat[0][0]} had the most scored edits (${repeat[0][1].scored}).`);
    if (cfg && cfg.test) {
      const t = cfg.test;
      parts.push(`On three days of test edits, the model flagged ${(t.flagged_share * 100).toFixed(1)}% of edits, and ${Math.round(t.precision * 100)}% of the edits it flagged were reverted within 48 hours.`);
    }
    ui.digest.textContent = parts.join(' ');
  }

  // Minutes and the digest move on even when nothing new is scored.
  setInterval(() => {
    if (active()) {
      render();
      if (elapsed() - state.limitFrom >= RUN_LIMIT_MS) pause('Paused after 15 minutes to save data. Resume to keep watching.');
    }
  }, 5000);

  render();
  return { start: resume, pause };
}
