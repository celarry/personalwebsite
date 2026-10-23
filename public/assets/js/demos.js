// Interactive project demos, diagrams and the rows that open in place.

/* ---------- Valorant round win probability ---------- */
(() => {
  const root = document.querySelector('[data-valorant]');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const time = $('#vp-time');
  const timeLabel = $('[data-time-label]');
  const timeOut = $('[data-time-out]');
  const atkOut = $('[data-atk]');
  const defOut = $('[data-def]');
  const bar = $('[data-bar]');
  const decided = $('[data-decided]');
  const factorsWrap = $('[data-factors-wrap]');
  const factorsList = $('[data-factors]');

  // The clock means different things before and after the plant, so remember both.
  const clocks = { round: 60, spike: 30 };
  const radio = (name) => Number(root.querySelector(`input[name="${name}"]:checked`).value);
  const planted = () => root.querySelector('input[name="vp-plant"]:checked').value === 'yes';
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));

  function readState() {
    return { atk: radio('vp-atk'), def: radio('vp-def'), planted: planted(), round: clocks.round, spike: clocks.spike, atkBuy: radio('vp-abuy'), defBuy: radio('vp-dbuy') };
  }

  // A hand-tuned logistic model. Each factor adds to the log-odds that attackers win.
  function model(s) {
    if (s.def === 0) return { p: 1, note: 'Every defender is down, so attackers win the round.' };
    if (s.atk === 0 && !s.planted) return { p: 0, note: 'Attackers are wiped before planting, so defenders win.' };
    if (!s.planted && s.round === 0) return { p: 0, note: 'Time ran out without a plant, so defenders win.' };
    if (s.planted && s.spike === 0) return { p: 1, note: 'The spike detonates, so attackers win.' };
    if (s.atk === 0 && s.planted) {
      const p = sigmoid(3 * (7.5 - s.spike));
      return { p, note: s.spike < 7 ? 'No attackers left, but a full defuse takes 7 seconds and there isn’t enough time.' : 'No attackers left, so defenders just need to defuse in time.' };
    }
    const f = [
      { label: 'Defender edge', v: -0.08 },
      { label: 'Players alive', v: 0.8 * (s.atk - s.def) },
    ];
    if (s.planted) {
      f.push({ label: 'Spike planted', v: 1.4 });
      f.push({ label: 'Spike timer', v: 0.07 * (30 - s.spike) });
    } else {
      let v = -0.045 * Math.max(0, 35 - s.round);
      if (s.round < 8) v -= 0.25 * (8 - s.round);
      f.push({ label: 'Round clock', v });
    }
    f.push({ label: 'Economy', v: 0.7 * (s.atkBuy - s.defBuy) });
    const z = f.reduce((a, b) => a + b.v, 0);
    return { p: sigmoid(z), factors: f };
  }

  const pct = (p) => {
    const n = Math.round(p * 100);
    if (p > 0 && p < 1) return Math.min(99, Math.max(1, n));
    return n;
  };

  function syncTimeInput() {
    if (planted()) {
      timeLabel.textContent = 'Spike timer';
      time.max = 45;
      time.value = clocks.spike;
    } else {
      timeLabel.textContent = 'Round time left';
      time.max = 100;
      time.value = clocks.round;
    }
    timeOut.textContent = `${time.value}s`;
  }

  function render() {
    const s = readState();
    const r = model(s);
    const a = pct(r.p);
    atkOut.textContent = `${a}%`;
    defOut.textContent = `${100 - a}%`;
    bar.style.width = `${a}%`;
    if (r.note) {
      decided.hidden = false;
      decided.textContent = r.note;
      factorsWrap.hidden = true;
    } else {
      decided.hidden = true;
      factorsWrap.hidden = false;
      const max = 2;
      factorsList.innerHTML = r.factors
        .map((f) => {
          const w = (Math.min(Math.abs(f.v), max) / max) * 50;
          const left = f.v >= 0 ? 50 : 50 - w;
          const color = f.v >= 0 ? 'var(--atk)' : 'var(--def)';
          const sign = f.v > 0.004 ? '+' : f.v < -0.004 ? '−' : '';
          return `<li><span>${f.label}</span><span class="track"><span class="fill" style="left:${left}%;width:${w}%;background:${color}"></span></span><span class="val">${sign}${Math.abs(f.v).toFixed(2)}</span></li>`;
        })
        .join('');
    }
  }

  root.addEventListener('change', (e) => {
    if (e.target.name === 'vp-plant') syncTimeInput();
    render();
  });
  time.addEventListener('input', () => {
    clocks[planted() ? 'spike' : 'round'] = Number(time.value);
    timeOut.textContent = `${time.value}s`;
    render();
  });

  const presets = {
    start: { atk: 5, def: 5, plant: 'no', round: 100, abuy: 2, dbuy: 2 },
    eco: { atk: 5, def: 5, plant: 'no', round: 100, abuy: 0, dbuy: 2 },
    postplant: { atk: 2, def: 3, plant: 'yes', spike: 32, abuy: 2, dbuy: 2 },
    clutch: { atk: 1, def: 1, plant: 'no', round: 12, abuy: 2, dbuy: 2 },
  };
  const set = (name, value) => {
    const el = root.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  };
  root.querySelectorAll('[data-preset]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const p = presets[btn.dataset.preset];
      set('vp-atk', p.atk);
      set('vp-def', p.def);
      set('vp-plant', p.plant);
      set('vp-abuy', p.abuy);
      set('vp-dbuy', p.dbuy);
      if (p.round != null) clocks.round = p.round;
      if (p.spike != null) clocks.spike = p.spike;
      syncTimeInput();
      render();
    })
  );

  syncTimeInput();
  render();
})();

/* ---------- Email assistant: approve before sending ---------- */
(() => {
  const root = document.querySelector('[data-email-demo]');
  if (!root) return;
  const send = root.querySelector('[data-send]');
  const confirmBox = root.querySelector('[data-confirm]');
  const status = root.querySelector('[data-status]');
  const draft = root.querySelector('[data-draft]');
  const original = draft.value;

  send.addEventListener('click', () => {
    if (!draft.value.trim()) {
      status.textContent = 'Write a reply first.';
      draft.focus();
      return;
    }
    send.hidden = true;
    confirmBox.hidden = false;
    status.textContent = '';
    root.querySelector('[data-confirm-send]').focus();
  });
  root.querySelector('[data-cancel]').addEventListener('click', () => {
    confirmBox.hidden = true;
    send.hidden = false;
    draft.focus();
  });
  root.querySelector('[data-confirm-send]').addEventListener('click', () => {
    confirmBox.hidden = true;
    send.hidden = false;
    status.textContent = draft.value.trim() === original ? 'Sent, after you approved it. (Demo only.)' : 'Sent with your edits. (Demo only.)';
    send.focus();
  });
  draft.addEventListener('input', () => (status.textContent = ''));
})();

/* ---------- "Send the cart shopping" ---------- */
document.querySelectorAll('[data-shop]').forEach((btn) =>
  btn.addEventListener('click', () => {
    const store = document.querySelector('[data-floor]');
    if (!store || !window.floorDemo) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    store.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
    setTimeout(() => window.floorDemo.shop(), smooth ? 450 : 0);
  })
);

/* ---------- Rows that open in place: linkable as /#project-name ---------- */
(() => {
  const rows = [...document.querySelectorAll('details[data-row]')];
  if (!rows.length) return;
  // Hashes the store uses for previews; leave those alone.
  const storeKeys = ['closed', 'open', 'shop', 'lunar', 'midautumn', 'christmas', 'halloween', 'easter'];
  const openFromHash = (scroll) => {
    const id = decodeURIComponent(location.hash.slice(1));
    const row = id && rows.find((r) => r.id === id);
    if (!row) return;
    row.open = true;
    if (scroll) row.scrollIntoView({ block: 'start' });
  };
  rows.forEach((row) =>
    row.addEventListener('toggle', () => {
      const current = location.hash.slice(1).toLowerCase();
      if (storeKeys.includes(current)) return;
      if (row.open) history.replaceState(null, '', `#${row.id}`);
      else if (current === row.id) history.replaceState(null, '', location.pathname + location.search);
    })
  );
  window.addEventListener('hashchange', () => openFromHash(true));
  openFromHash(true);
})();

/* ---------- Project diagrams: step through with clicks or arrow keys ---------- */
document.querySelectorAll('[data-diagram]').forEach((fig) => {
  const tabs = [...fig.querySelectorAll('[role="tab"]')];
  const select = (i, focus) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tabs[i].focus();
    tabs[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const scroller = fig.querySelector('.diagram__scroll');
  const fade = () => scroller.classList.toggle('has-more', scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft > 4);
  scroller.addEventListener('scroll', fade, { passive: true });
  window.addEventListener('resize', fade);
  fade();
  fig.querySelectorAll('[data-step]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const next = Math.min(tabs.length - 1, Math.max(0, cur + Number(b.dataset.step)));
      select(next, false);
      const panelBtn = document.getElementById(tabs[next].getAttribute('aria-controls')).querySelector(`[data-step="${b.dataset.step}"]`);
      (panelBtn && !panelBtn.disabled ? panelBtn : tabs[next]).focus();
    })
  );
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i, false));
    t.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 };
      if (e.key in keys) {
        e.preventDefault();
        select((keys[e.key] + tabs.length) % tabs.length, true);
      }
    });
  });
});

/* ---------- Valorant HUD reader ---------- */
document.querySelectorAll('[data-hud]').forEach((fig) => {
  const boxes = [...fig.querySelectorAll('.hud__box')];
  const out = {
    label: fig.querySelector('[data-hud-label]'),
    field: fig.querySelector('[data-hud-field]'),
    value: fig.querySelector('[data-hud-value]'),
  };
  boxes.forEach((b) =>
    b.addEventListener('click', () => {
      boxes.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      out.label.textContent = b.dataset.label;
      out.field.textContent = b.dataset.field;
      out.value.textContent = b.dataset.value;
    })
  );
});
