// HTML templates for every page. build.mjs fills these with content from /content.

export const esc = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const list = (s = '') =>
  (Array.isArray(s) ? s : String(s).split(','))
    .map((x) => String(x).trim())
    .filter(Boolean);

// Turns a site path ('' for home, 'blog/', 'assets/x.css') into a link that works
// from a page `depth` folders deep. Relative links keep the site portable.
export function linker(depth, preview) {
  const up = depth === 0 ? '' : '../'.repeat(depth);
  const L = (path = '') => {
    let p = path;
    const [base, hash] = p.split('#');
    p = base;
    if (preview && (p === '' || p.endsWith('/'))) p += 'index.html';
    let out = up + p;
    if (out === '') out = './';
    return hash !== undefined ? `${out}#${hash}` : out;
  };
  L.root = up || './';
  L.preview = !!preview;
  L.depth = depth;
  return L;
}

// Uploaded files are saved as /uploads/...; full URLs are left alone.
export const asset = (L, url = '') =>
  /^(https?:)?\/\//.test(url) || url.startsWith('mailto:') ? url : L(String(url).replace(/^\//, ''));

export function fmtDate(iso, style = 'long') {
  const s = String(iso);
  const ym = /^\d{4}-\d{2}$/.test(s);
  const d = new Date((ym ? s + '-15' : s.slice(0, 10)) + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return s;
  const opts = ym
    ? { month: style === 'short' ? 'short' : 'long', year: 'numeric', timeZone: 'UTC' }
    : style === 'short'
      ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
      : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  return new Intl.DateTimeFormat('en-AU', opts).format(d);
}

const icon = {
  sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>',
};

// The tags offered in the editor. Filters for these always show on the blog page.
export const BLOG_TAGS = ['Life', 'Projects', 'Tech', 'Travel'];

export const SHORTCUTS = [
  ['⌘ K', 'Search, or run a command'],
  ['/', 'Search, or run a command'],
  ['1', 'Homepage'],
  ['2', 'Projects'],
  ['3', 'Blog'],
  ['4', 'Now'],
  ['5', 'Resume'],
  ['g h', 'Homepage, if you prefer letters (also g p, g b, g n, g r)'],
  ['t', 'Switch between light and dark'],
  ['?', 'Show these shortcuts'],
];

/* ---------- Page frame ---------- */

function header(site, L, current = '') {
  const cur = (k) => (current === k ? ' aria-current="page"' : '');
  return `<header class="top">
  <a class="top__name" href="${L('')}"${cur('home')}>${esc(site.name)}</a>
  <nav class="top__nav" aria-label="Main">
    <a href="${L('projects/')}"${cur('projects')}>Projects</a>
    <a href="${L('blog/')}"${cur('blog')}>Blog</a>
    <a href="${L('now/')}"${cur('now')}>Now</a>
    <a href="${L('resume/')}"${cur('resume')}>Resume</a>
  </nav>
  <div class="top__tools">
    <button class="top__search" type="button" data-palette-open aria-haspopup="dialog">${icon.search}<span class="top__search-label">Search</span><span class="top__menu-label">Menu</span><kbd data-kbd-mod>⌘K</kbd></button>
    <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch colour theme">${icon.sun}${icon.moon}</button>
  </div>
</header>`;
}

function footer(site, L, build) {
  const links = [
    `<a href="mailto:${esc(site.email)}">Email</a>`,
    site.github && `<a href="${esc(site.github)}">GitHub</a>`,
    site.linkedin && `<a href="${esc(site.linkedin)}">LinkedIn</a>`,
    `<a href="${L('feed.xml')}">RSS</a>`,
    `<a href="${L('colophon/')}">How this site works</a>`,
  ].filter(Boolean);
  return `<footer class="foot">
  <div class="foot__inner">
    <p class="foot__links">${links.join('')}</p>
    <p>${esc(site.name)}, in ${esc((site.location || '').split(',')[0])}<span data-clock-tail></span>. Built ${esc(build.dateLabel)}${build.sha ? ` from <a href="${esc(build.commitUrl)}"><code>${esc(build.sha)}</code></a>` : ''}.<span class="foot__hint"> Press <kbd>?</kbd> for keyboard shortcuts.</span></p>
  </div>
</footer>`;
}

export function layout({ site, L, build, title, description, body, page = '', current = '', canonical = '', extraHead = '', scripts = [] }) {
  const fullTitle = title ? `${title} | ${site.name}` : `${site.name}`;
  const desc = description || site.headline;
  const absOg = site.url ? site.url.replace(/\/$/, '') + '/assets/og.png' : '';
  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
${extraHead}<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#edf0ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f151e" media="(prefers-color-scheme: dark)">
<meta name="author" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${page === 'post' ? 'article' : 'website'}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n<meta property="og:url" content="${esc(canonical)}">\n` : ''}${absOg ? `<meta property="og:image" content="${esc(absOg)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<link rel="icon" href="${L('favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}'s blog" href="${L('feed.xml')}">
<link rel="preload" href="${L('assets/fonts/newsreader-display.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${L('assets/fonts/atkinson-next.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${L('assets/css/site.css')}">
<script>
  try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
</script>
</head>
<body class="page-${page}" data-root="${esc(L.root)}"${L.preview ? ' data-preview="1"' : ''} data-email="${esc(site.email)}" data-tz="${esc(site.timezone || 'Australia/Melbourne')}" data-place="${esc((site.location || '').split(',')[0])}" data-resume="${esc(site.resume ? asset(L, site.resume) : '')}" data-repo="${esc(build.repoUrl || '')}"${site.now_api ? ` data-now-api="${esc(site.now_api)}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${header(site, L, current)}
${body}
${footer(site, L, build)}
<script src="${L('assets/js/site.js')}" defer></script>
<script src="${L('assets/js/palette.js')}" defer></script>
${scripts.map((s) => `<script src="${L(s)}" defer></script>`).join('\n')}
</body>
</html>
`;
}

/* ---------- Shared pieces ---------- */

// A section with its name hanging in the left margin on wide screens.
const block = (id, label, inner, { cls = '', attrs = '' } = {}) => `<section class="block${cls ? ` ${cls}` : ''}" id="${id}" aria-labelledby="${id}-h"${attrs}>
  <h2 class="block__label" id="${id}-h">${label}</h2>
  <div class="block__body">
    ${inner}
  </div>
</section>`;

const year = (p) => String(p.started || p.dates || '').match(/\d{4}/)?.[0] || '';

const sentenceList = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

function projectLinks(p, L, { page = true } = {}) {
  const out = [];
  if (page) out.push(`<a href="${L(`projects/${p.slug}/`)}">Read the write-up</a>`);
  if (p.live) out.push(`<a href="${esc(p.live)}">Visit the site</a>`);
  if (p.repo) out.push(`<a href="${esc(p.repo)}">Code on GitHub</a>`);
  return out.length ? `<p class="links">${out.join('')}</p>` : '';
}

const tagLinks = (tags, L) =>
  tags && tags.length ? tags.map((t) => `<a href="${L('blog/')}#${esc(t.toLowerCase())}">${esc(t)}</a>`).join(', ') : '';

/* ---------- The store: the A* shop floor ---------- */

const radios = (name, values, checked, labels = values) =>
  values
    .map(
      (v, i) =>
        `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(checked) ? ' checked' : ''}><span>${labels[i]}</span></label>`
    )
    .join('');

export function storeFigure() {
  return `<section class="store" id="store" data-floor aria-label="A small store where a cart plans its routes">
  <div class="store__floor">
    <canvas aria-hidden="true"></canvas>
  </div>
  <div class="receipt" data-receipt role="region" aria-label="Receipt" hidden></div>
  <div class="tray" data-tray role="group" aria-label="Give the cart something to fetch" hidden><span class="tray__items" data-tray-items></span></div>
  <fieldset class="algo" data-algo hidden>
    <legend>Plan routes with</legend>
    <div class="seg">${radios('store-algo', ['astar', 'dijkstra', 'greedy'], 'astar', ['A*', 'Dijkstra', 'Greedy'])}</div>
  </fieldset>
  <p class="store__text" data-caption>The cart in this little store plans every trip with A*, the search I wrote for a self-driving shopping cart at UNIHACK&nbsp;2025. The blue wash is every square it checked, and the line is the route it chose. Click the floor to send it somewhere, or give it something from the list and it’ll print you a receipt.</p>
  <p class="store__readout" data-readout aria-hidden="true"></p>
  <span class="visually-hidden" aria-live="polite" data-floor-live></span>
</section>`;
}

/* ---------- Interactive demos ---------- */

const demos = {
  valorant: () => `<div class="demo vp" data-valorant>
  <div class="vp__controls">
    <fieldset><legend>Attackers alive</legend><div class="seg">${radios('vp-atk', [0, 1, 2, 3, 4, 5], 4)}</div></fieldset>
    <fieldset><legend>Defenders alive</legend><div class="seg">${radios('vp-def', [0, 1, 2, 3, 4, 5], 3)}</div></fieldset>
    <fieldset><legend>Spike</legend><div class="seg">${radios('vp-plant', ['no', 'yes'], 'no', ['Not planted', 'Planted'])}</div></fieldset>
    <div class="vp__time">
      <label for="vp-time"><span data-time-label>Round time left</span> <output for="vp-time" data-time-out>60s</output></label>
      <input id="vp-time" type="range" min="0" max="100" value="60" step="1">
    </div>
    <fieldset><legend>Attack buy</legend><div class="seg">${radios('vp-abuy', [0, 1, 2], 2, ['Eco', 'Half', 'Full'])}</div></fieldset>
    <fieldset><legend>Defence buy</legend><div class="seg">${radios('vp-dbuy', [0, 1, 2], 2, ['Eco', 'Half', 'Full'])}</div></fieldset>
  </div>
  <div class="vp__result" aria-live="polite">
    <p class="vp__odds"><span class="vp__atk"><span>Attack</span> <b data-atk>63%</b></span><span class="vp__def"><b data-def>37%</b> <span>Defence</span></span></p>
    <div class="vp__bar" aria-hidden="true"><span data-bar></span></div>
    <p class="vp__decided" data-decided hidden></p>
    <div class="vp__factors" data-factors-wrap>
      <p class="vp__factors-h">What's moving the number <span>(log-odds, positive favours attack)</span></p>
      <ul data-factors></ul>
    </div>
    <div class="vp__presets">
      <p>Try a situation</p>
      <button type="button" data-preset="start">Round start</button>
      <button type="button" data-preset="eco">Eco round</button>
      <button type="button" data-preset="postplant">2v3 post-plant</button>
      <button type="button" data-preset="clutch">1v1, 12 seconds left</button>
    </div>
  </div>
  <p class="demo__note">This in-browser version uses a small logistic model with hand-set weights so it can run instantly. The real project reads these features off VCT broadcast footage and learns the weights with gradient-boosted trees.</p>
</div>`,

  homelab: () => `<div class="demo lab">
  <ol class="lab__flow" aria-label="How a request reaches my homelab">
    <li class="lab__node">Internet</li>
    <li class="lab__node">Cloudflare <span>DNS and HTTPS</span></li>
    <li class="lab__node">Nginx <span>reverse proxy</span></li>
    <li class="lab__cluster">
      <p>Kubernetes cluster</p>
      <ul>
        <li>Jellyfin</li><li>Databases</li><li>Game servers</li><li>ML workloads</li><li>Local LLM chatbot</li><li>My own apps</li>
      </ul>
      <p class="lab__hosts">Proxmox VMs spread across several machines</p>
    </li>
    <li class="lab__node lab__node--store">Multi-terabyte storage</li>
  </ol>
  <figure class="lab__speed">
    <figcaption>Large-file transfer speed, before and after I tracked down the bottleneck</figcaption>
    <div class="lab__bars">
      <p><span>Before</span><i style="--w:14.3%"></i><b>~10 MB/s</b></p>
      <p><span>After</span><i style="--w:100%"></i><b>~70 MB/s</b></p>
    </div>
  </figure>
</div>`,

  email: () => `<div class="demo em" data-email-demo>
  <div class="em__mail">
    <p class="em__from">From <b>Lab Operations</b></p>
    <p class="em__subject">Your building access card expires this Friday</p>
    <p class="em__snippet">Hi Lawrence, our records show your access card for the engineering building expires on Friday. To keep access, please renew it at the service desk before then, bringing your student ID…</p>
  </div>
  <ol class="em__steps">
    <li><span class="em__step">Priority</span><span class="em__tag">Needs action this week</span></li>
    <li><span class="em__step">Summary</span><span>Access card expires Friday. Renew at the service desk with your student ID.</span></li>
    <li><span class="em__step">Draft reply</span><label class="em__draft"><span class="visually-hidden">AI-drafted reply, editable</span><textarea rows="3" data-draft>Thanks for the reminder. I'll renew it at the service desk on Thursday.</textarea></label></li>
  </ol>
  <div class="em__actions">
    <button type="button" class="btn btn--primary" data-send>Send reply</button>
    <div class="em__confirm" data-confirm hidden>
      <p>This reply was written by AI. Send it as it is?</p>
      <button type="button" class="btn" data-cancel>Keep editing</button>
      <button type="button" class="btn btn--primary" data-confirm-send>Send</button>
    </div>
    <p class="em__status" data-status aria-live="polite"></p>
  </div>
  <p class="demo__note">A mock of the approval step, so nothing here is actually sent. The real extension does the classifying, summarising and drafting with an LLM.</p>
</div>`,

  // On the homepage the store is already at the top, so the cart's row points there.
  cart: () => `<div class="cartnote">
  <p>The store at the top of this page runs the same planner, cut down to fit in a browser.</p>
  <p><button type="button" class="btn btn--primary" data-shop>Send the cart shopping</button></p>
</div>`,
};

function diagram(p) {
  const nodes = (p.diagram || []).filter((n) => n && n.label);
  if (!nodes.length) return '';
  const id = `dg-${p.slug}`;
  return `<figure class="diagram wide" data-diagram>
  ${p.diagram_title ? `<figcaption class="diagram__title">${esc(p.diagram_title)}</figcaption>` : ''}
  <div class="diagram__scroll">
    <ol class="diagram__track" role="tablist" aria-label="${esc(p.diagram_title || 'Steps')}">
      ${nodes
        .map(
          (n, i) => `<li role="presentation"><button type="button" role="tab" id="${id}-t${i}" aria-controls="${id}-p${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" class="diagram__node">
        <span class="diagram__label">${esc(n.label)}</span>${n.note ? `<span class="diagram__note">${esc(n.note)}</span>` : ''}
      </button></li>`
        )
        .join('\n      ')}
    </ol>
  </div>
  ${nodes
    .map(
      (n, i) => `<div class="diagram__detail" role="tabpanel" id="${id}-p${i}" aria-labelledby="${id}-t${i}"${i === 0 ? '' : ' hidden'}>
    <p class="diagram__step">Step ${i + 1} of ${nodes.length}</p>
    <p class="diagram__head">${esc(n.label)}</p>
    <p>${esc(n.detail || n.note || '')}</p>
    <p class="diagram__nav"><button type="button" data-step="-1"${i === 0 ? ' disabled' : ''}>Previous step</button><button type="button" data-step="1"${i === nodes.length - 1 ? ' disabled' : ''}>Next step</button></p>
  </div>`
    )
    .join('\n  ')}
</figure>`;
}

function hudFigure(L) {
  // Boxes are positions on the 600×120 crop, as percentages.
  const boxes = [
    { k: 'round', x: 43.5, y: 9, w: 14.5, h: 15, label: 'Round label', field: 'round_number', value: '3' },
    { k: 'def', x: 24.5, y: 11, w: 7.5, h: 41, label: 'Left score', field: 'defender_score', value: '2' },
    { k: 'timer', x: 43.5, y: 25, w: 13, h: 36, label: 'Round timer', field: 'round_timer_sec', value: '85' },
    { k: 'atk', x: 68.6, y: 11, w: 7.5, h: 41, label: 'Right score', field: 'attacker_score', value: '0' },
  ];
  return `<figure class="hud col" data-hud>
  <figcaption class="hud__title">What the HUD reader sees</figcaption>
  <div class="hud__frame">
    <img src="${L('assets/img/valorant-hud.jpg')}" width="600" height="120" alt="The score bar from a VCT broadcast: 2 to 0, round 3, 1:25 left on the timer.">
    ${boxes
      .map(
        (b, i) => `<button type="button" class="hud__box" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%" aria-pressed="${i === 2}" data-field="${b.field}" data-value="${b.value}" data-label="${b.label}"><span class="visually-hidden">${b.label}</span></button>`
      )
      .join('\n    ')}
  </div>
  <div class="hud__out" aria-live="polite">
    <p><span data-hud-label>Round timer</span> <code data-hud-field>round_timer_sec</code> <b data-hud-value>85</b></p>
    <p class="hud__note">Select a box to see what the pipeline extracts. Calibrated for the 1080p VCT broadcast; team logos blurred here.</p>
  </div>
</figure>`;
}

function historyList(entries, L, { showProject = false } = {}) {
  if (!entries.length) return '';
  return `<ol class="history">${entries
    .map(
      (e) => `<li>
      <time datetime="${esc(e.date)}">${esc(fmtDate(e.date, 'short'))}</time>
      <p>${showProject ? `<a href="${L(`projects/${e.slug}/`)}">${esc(e.project)}</a>. ` : ''}${esc(e.text)}</p>
    </li>`
    )
    .join('')}</ol>`;
}

/* ---------- Rows: the list style used for projects, jobs and posts ---------- */

// A project that opens in place. Featured projects open into their working demo.
function projectRow(p, L) {
  const demo = p.featured && demos[p.demo] ? demos[p.demo](L) : '';
  const stack = p.stack.length ? `<p class="row__stack">Made with ${esc(sentenceList(p.stack))}.</p>` : '';
  return `<li>
    <details class="row" id="${esc(p.slug)}" data-row>
      <summary class="row__head">
        <span class="row__title">${esc(p.title)}</span>
        <span class="row__meta">${esc(year(p))}</span>
        <span class="row__lead">${esc(p.lead)}</span>
        <span class="row__toggle" aria-hidden="true"></span>
      </summary>
      <div class="row__body">
        ${p.more ? `<p class="row__more">${esc(p.more)}</p>` : ''}
        ${demo}
        ${(p.points || []).length ? `<ul class="row__points">${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${stack}
        ${projectLinks(p, L)}
      </div>
    </details>
  </li>`;
}

const postRow = (p, L, { showYear = true } = {}) => `<li class="row row--link"${p.tags ? ` data-tags="${esc(p.tags.map((t) => t.toLowerCase()).join(' '))}"` : ''}>
    <div class="row__head">
      <a class="row__title" href="${L(`blog/${p.slug}/`)}">${esc(p.title)}</a>
      <time class="row__meta" datetime="${p.date}">${fmtDate(p.date, showYear ? 'long' : 'short')}</time>
      ${p.summary ? `<span class="row__lead">${esc(p.summary)}</span>` : ''}
    </div>
  </li>`;

export function postList(posts, L, opts = {}) {
  if (!posts.length) return `<p class="muted">No posts yet.</p>`;
  return `<ul class="rows">${posts.map((p) => postRow(p, L, opts)).join('')}</ul>`;
}

/* ---------- Home page ---------- */

function intro(site, L) {
  const links = [
    `<a href="mailto:${esc(site.email)}">Email</a>`,
    site.github && `<a href="${esc(site.github)}">GitHub</a>`,
    site.linkedin && `<a href="${esc(site.linkedin)}">LinkedIn</a>`,
    `<a href="${L('resume/')}">Resume</a>`,
  ].filter(Boolean);
  return `<div class="intro">
  <h1 class="visually-hidden">${esc(site.name)}</h1>
  <p class="intro__statement">${esc(site.headline)}</p>
  <p class="intro__text">${site.introHtml || esc(site.intro)}</p>
  <p class="links intro__links">${links.join('')}</p>
</div>`;
}

function nowBlock(site, now, L) {
  if (!site.now) return '';
  const updated = now.updated ? ` <span class="muted">Updated <time datetime="${esc(now.updated)}" data-ago>${fmtDate(now.updated)}</time>.</span>` : '';
  return block('now', 'Now', `<p>${esc(site.now)} <a href="${L('now/')}">More on the Now page</a>.${updated}</p>`);
}

function projectsBlock(projects, L) {
  return block(
    'projects',
    'Projects',
    `<p class="block__intro">Open one to see more. The first few have something you can play with.</p>
    <ul class="rows rows--open">${projects.map((p) => projectRow(p, L)).join('')}</ul>
    <p class="links"><a href="${L('projects/')}">All ${projects.length} projects, with their history</a></p>`
  );
}

function aboutBlock(site) {
  const skills = (site.skills || []).map((g) => `<div><dt>${esc(g.group)}</dt><dd>${list(g.items).map(esc).join(', ')}</dd></div>`).join('');
  const langs = site.languages ? `<div><dt>Languages</dt><dd>${list(site.languages).map(esc).join(', ')}</dd></div>` : '';
  return block(
    'about',
    'About',
    `${site.about ? `<p>${esc(site.about)}</p>` : ''}
    ${site.about_more ? `<p>${esc(site.about_more)}</p>` : ''}
    ${skills || langs ? `<dl class="pairs">${skills}${langs}</dl>` : ''}`
  );
}

function experienceBlock(site, L) {
  const jobs = (site.experience || []).filter((j) => j && j.role);
  if (!jobs.length) return '';
  return block(
    'experience',
    'Experience',
    `<ol class="rows">${jobs
      .map(
        (j) => `<li class="row">
      <div class="row__head">
        <span class="row__title">${esc(j.role)}<span class="row__org">, ${esc(j.org)}</span></span>
        <span class="row__meta">${esc(j.dates)}</span>
        ${j.summary ? `<span class="row__lead">${esc(j.summary)}</span>` : ''}
      </div>
    </li>`
      )
      .join('')}</ol>
    <p class="links"><a href="${L('resume/')}">The full resume</a></p>`
  );
}

function blogBlock(posts, L) {
  return block(
    'blog',
    'Blog',
    `${postList(posts.slice(0, 4), L)}
    <p class="links"><a href="${L('blog/')}">${posts.length > 4 ? `All ${posts.length} posts` : 'Go to the blog'}</a><a href="${L('blog/')}#life">Just the personal ones</a></p>`
  );
}

// Books and manga, with their covers.
function covers(items, L) {
  if (!items || !items.length) return '';
  return `<ul class="covers">${items
    .map((b) => {
      const label = `${b.title}${b.author ? `, ${b.author}` : ''}`;
      const art = b.cover
        ? `<img src="${esc(asset(L, b.cover))}" alt="" width="240" height="360" loading="lazy">`
        : `<span class="covers__blank" aria-hidden="true">${esc(b.title)}</span>`;
      const inner = `<span class="covers__art">${art}</span><span class="covers__title">${esc(b.title)}</span>${b.author ? `<span class="covers__by">${esc(b.author)}</span>` : ''}${b.note ? `<span class="covers__note">${esc(b.note)}</span>` : ''}`;
      return `<li>${b.link ? `<a href="${esc(b.link)}" aria-label="${esc(label)}">${inner}</a>` : inner}</li>`;
    })
    .join('')}</ul>`;
}

// Off the clock. Rows marked live get filled in from the worker in now.js:
// Steam for games, Last.fm for music. Rows with nothing but live data stay hidden until it arrives.
function offClockBlock(site, L) {
  const live = !!site.now_api;
  const rows = (site.offclock || []).filter((r) => r.text || r.live === 'reading' || (live && (r.live === 'steam' || r.live === 'music')));
  if (!rows.length) return '';
  const row = (r) => {
    const text = r.html ? `<p>${r.html}</p>` : '';
    let extra = '';
    if (live && (r.live === 'steam' || r.live === 'music')) extra = `<div class="live live--${r.live}" data-live="${r.live}" aria-live="polite" hidden></div>`;
    if (r.live === 'reading') extra = covers(site.reading, L);
    const waits = !r.text && r.live !== 'reading';
    return `<div${waits ? ' data-live-row hidden' : ''}><dt>${esc(r.label)}</dt><dd>${extra}${text}</dd></div>`;
  };
  return block('offclock', 'Off the clock', `<dl class="pairs pairs--loose">${rows.map(row).join('')}</dl>`);
}

function contactBlock(site) {
  const email = esc(site.email);
  return block(
    'contact',
    'Contact',
    `<div class="chat" data-chat hidden>
      <ol class="chat__log" data-chat-log aria-live="polite">
        <li class="msg msg--them">Hi! I'm Lawrence. What's your name?</li>
      </ol>
      <form class="chat__form" data-chat-form>
        <label class="visually-hidden" for="chat-input" data-chat-label>Your name</label>
        <textarea id="chat-input" rows="1" maxlength="2000" autocomplete="name" placeholder="Your name" data-chat-input></textarea>
        <button type="submit" class="chat__send">Send</button>
      </form>
    </div>
    <p class="contact__direct">The quickest way to reach me is email: <a href="mailto:${email}">${email.replace('@', '<wbr>@')}</a> <button type="button" class="copy" data-copy="${email}">Copy</button></p>`
  );
}

export function homePage(ctx) {
  const { site, projects, posts, now, L } = ctx;
  const body = `<main id="main" class="page home">
${intro(site, L)}
${storeFigure()}
${nowBlock(site, now, L)}
${projectsBlock(projects, L)}
${aboutBlock(site)}
${experienceBlock(site, L)}
${blogBlock(posts, L)}
${offClockBlock(site, L)}
${contactBlock(site)}
</main>`;
  return layout({ ...ctx, body, page: 'home', current: 'home', canonical: site.url ? site.url.replace(/\/?$/, '/') : '', scripts: ['assets/js/floor.js', 'assets/js/demos.js', ...(site.now_api ? ['assets/js/now.js'] : [])] });
}

/* ---------- Projects ---------- */

export function projectsIndexPage(ctx) {
  const { site, projects, history, L } = ctx;
  const byYear = {};
  for (const p of [...projects].sort((a, b) => (a.started < b.started ? 1 : -1))) (byYear[year(p) || 'Undated'] ||= []).push(p);
  const years = Object.keys(byYear).sort().reverse();
  const first = [...projects].map((p) => p.started).filter(Boolean).sort()[0];
  const body = `<main id="main" class="page">
  <header class="col page-head">
    <h1>Projects</h1>
    <p>${projects.length} things I've built since ${esc(fmtDate(first || '2025-01'))}, from hackathon hardware to a Kubernetes cluster at home. Each one has a write-up, a diagram of how it works, and its history.</p>
  </header>
  ${years
    .map((y) =>
      block(
        `y${y}`,
        y,
        `<ul class="rows">${byYear[y]
          .map(
            (p) => `<li class="row row--link">
        <div class="row__head">
          <a class="row__title" href="${L(`projects/${p.slug}/`)}">${esc(p.title)}</a>
          <span class="row__meta">${esc(p.dates)}</span>
          <span class="row__lead">${esc(p.summary)}</span>
        </div>
      </li>`
          )
          .join('')}</ul>`,
        { cls: 'block--year' }
      )
    )
    .join('\n')}
  ${history.length ? block('history', 'History', `<p class="block__intro">Every milestone across every project, newest first.</p>${historyList(history, L, { showProject: true })}`) : ''}
</main>`;
  return layout({ ...ctx, title: 'Projects', description: `Everything ${site.name} has built, with write-ups, diagrams and history.`, body, page: 'projects', current: 'projects', canonical: site.url ? site.url.replace(/\/$/, '') + '/projects/' : '' });
}

export function projectPage(ctx) {
  const { site, project: p, prev, next, L } = ctx;
  const facts = [
    p.dates && ['When', esc(p.dates)],
    p.team && ['Team', esc(p.team)],
    p.status && ['Status', esc(p.status)],
    p.stack.length && ['Made with', esc(sentenceList(p.stack))],
  ].filter(Boolean);
  const pn = [
    prev && `<a class="pn pn--prev" href="${L(`projects/${prev.slug}/`)}"><span>Previous project</span>${esc(prev.title)}</a>`,
    next && `<a class="pn pn--next" href="${L(`projects/${next.slug}/`)}"><span>Next project</span>${esc(next.title)}</a>`,
  ].filter(Boolean);
  let demo = '';
  if (p.demo === 'cart') demo = `<section class="project__demo wide" aria-labelledby="demo-h"><h2 id="demo-h" class="col">Try it</h2>${storeFigure()}</section>`;
  else if (demos[p.demo]) demo = `<section class="project__demo wide" aria-labelledby="demo-h"><h2 id="demo-h" class="col">${p.demo === 'homelab' ? 'How it fits together' : 'Try it'}</h2>${demos[p.demo](L)}</section>`;
  const body = `<main id="main" class="page project">
  <header class="col page-head">
    <p class="back"><a href="${L('projects/')}">All projects</a></p>
    <h1>${esc(p.title)}</h1>
    <p class="lede">${esc(p.summary)}</p>
    ${facts.length ? `<dl class="pairs pairs--facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
    ${projectLinks(p, L, { page: false })}
  </header>
  ${(p.points || []).length ? `<section class="col project__points" aria-label="Highlights"><ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
  ${p.demo === 'valorant' ? hudFigure(L) : ''}
  ${diagram(p)}
  ${demo}
  ${p.html.trim() ? `<div class="col prose project__body">${p.html}</div>` : ''}
  ${(p.log || []).length ? block('history', 'History', historyList([...p.log].sort((a, b) => (a.date < b.date ? 1 : -1)), L)) : ''}
  ${pn.length ? `<nav class="col pn-nav" aria-label="More projects">${pn.join('')}</nav>` : ''}
</main>`;
  return layout({
    ...ctx,
    title: p.title,
    description: p.summary,
    body,
    page: 'project',
    current: 'projects',
    canonical: site.url ? `${site.url.replace(/\/$/, '')}/projects/${p.slug}/` : '',
    scripts: p.demo === 'cart' ? ['assets/js/floor.js', 'assets/js/demos.js'] : ['assets/js/demos.js'],
  });
}

/* ---------- Blog ---------- */

export function blogIndexPage(ctx) {
  const { site, posts, L } = ctx;
  const tags = [...new Set([...BLOG_TAGS, ...posts.flatMap((p) => p.tags)])];
  const byYear = {};
  for (const p of posts) (byYear[p.date.slice(0, 4)] ||= []).push(p);
  const years = Object.keys(byYear).sort().reverse();
  const words = posts.reduce((a, p) => a + p.words, 0);
  const groups = years.length
    ? years.map((y) => block(`y${y}`, y, postList(byYear[y], L, { showYear: false }), { cls: 'block--year', attrs: ' data-year' })).join('\n')
    : `<p class="col muted">No posts yet. Check back soon.</p>`;
  const body = `<main id="main" class="page blog">
  <header class="col page-head">
    <h1>Blog</h1>
    <p>What I'm working on, and life in general. ${posts.length} post${posts.length === 1 ? '' : 's'} and about ${words.toLocaleString('en-AU')} words so far. Follow along with <a href="${L('feed.xml')}">RSS</a>.</p>
    ${tags.length ? `<div class="filters" data-filters role="group" aria-label="Filter posts by tag"><button type="button" aria-pressed="true" data-filter="">All</button>${tags.map((t) => `<button type="button" aria-pressed="false" data-filter="${esc(t.toLowerCase())}">${esc(t)}</button>`).join('')}</div><p class="muted" data-filter-empty hidden>No posts with that tag yet.</p>` : ''}
  </header>
  ${groups}
</main>`;
  return layout({
    ...ctx,
    title: 'Blog',
    description: `${site.name}'s blog: what I'm working on, and life in general.`,
    body,
    page: 'blog',
    current: 'blog',
    canonical: site.url ? site.url.replace(/\/$/, '') + '/blog/' : '',
  });
}

export function postPage(ctx) {
  const { site, post, prev, next, L } = ctx;
  const cover = post.cover ? `<img class="post__cover wide" src="${esc(asset(L, post.cover))}" alt="">` : '';
  const pn = [
    prev && `<a class="pn pn--prev" href="${L(`blog/${prev.slug}/`)}"><span>Older</span>${esc(prev.title)}</a>`,
    next && `<a class="pn pn--next" href="${L(`blog/${next.slug}/`)}"><span>Newer</span>${esc(next.title)}</a>`,
  ].filter(Boolean);
  const tags = tagLinks(post.tags, L);
  const body = `<main id="main" class="page post">
  <article>
    <header class="col page-head">
      <p class="back"><a href="${L('blog/')}">All posts</a></p>
      <h1>${esc(post.title)}</h1>
      <p class="post__meta"><time datetime="${post.date}">${fmtDate(post.date)}</time>. ${post.minutes} minute read.${tags ? ` Filed under ${tags}.` : ''}</p>
    </header>
    ${cover}
    <div class="col prose">${post.html}</div>
  </article>
  ${pn.length ? `<nav class="col pn-nav" aria-label="More posts">${pn.join('')}</nav>` : ''}
</main>`;
  return layout({
    ...ctx,
    title: post.title,
    description: post.summary || post.excerpt,
    body,
    page: 'post',
    current: 'blog',
    canonical: site.url ? `${site.url.replace(/\/$/, '')}/blog/${post.slug}/` : '',
  });
}

/* ---------- Now, resume, colophon ---------- */

export function nowPage(ctx) {
  const { site, now, L } = ctx;
  const body = `<main id="main" class="page nowpage">
  <header class="col page-head">
    <h1>${esc(now.title || 'Now')}</h1>
    <p class="post__meta">${now.updated ? `Updated <time datetime="${esc(now.updated)}" data-ago>${fmtDate(now.updated)}</time>. ` : ''}<span data-clock></span></p>
  </header>
  <div class="col prose">${now.html}</div>
  <p class="col muted nowpage__about">This is a <a href="https://nownownow.com/about">now page</a>: what I'd tell a friend I hadn't seen in a while.</p>
</main>`;
  return layout({ ...ctx, title: 'Now', description: `What ${site.name} is up to right now.`, body, page: 'now', current: 'now', canonical: site.url ? site.url.replace(/\/$/, '') + '/now/' : '' });
}

export function resumePage(ctx) {
  const { site, projects, L } = ctx;
  const work = (site.experience || []).filter((e) => (e.type || 'work') === 'work');
  const edu = (site.experience || []).filter((e) => e.type === 'education');
  const domain = site.url ? site.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
  const entry = (e) => `<li class="cv__entry">
      <div class="cv__line"><h3>${esc(e.role)}, ${esc(e.org)}</h3><p class="cv__dates">${esc(e.dates)}</p></div>
      ${e.summary ? `<p>${esc(e.summary)}</p>` : ''}
      ${(e.points || []).length ? `<ul>${e.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </li>`;
  const projs = projects.filter((p) => p.featured);
  const body = `<main id="main" class="page cv">
  <div class="cv__actions">
    ${site.resume ? `<a class="btn btn--primary" href="${esc(asset(L, site.resume))}">Download the PDF</a>` : ''}
    <p class="muted">This page also prints cleanly on A4.</p>
  </div>
  <article class="cv__sheet">
    <header class="cv__head">
      <h1>${esc(site.name)}</h1>
      <p class="cv__contact">
        <span>${esc(site.location || '')}</span>
        <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
        ${domain ? `<a href="${esc(site.url)}">${esc(domain)}</a>` : ''}
        ${site.github ? `<a href="${esc(site.github)}">${esc(site.github.replace(/^https?:\/\//, ''))}</a>` : ''}
        ${site.linkedin ? `<a href="${esc(site.linkedin)}">LinkedIn</a>` : ''}
      </p>
      <p class="cv__summary">${esc(site.intro)}</p>
    </header>
    <section aria-labelledby="cv-exp"><h2 id="cv-exp">Experience</h2><ul class="cv__list">${work.map(entry).join('')}</ul></section>
    <section aria-labelledby="cv-proj"><h2 id="cv-proj">Projects</h2><ul class="cv__list">${projs
      .map(
        (p) => `<li class="cv__entry">
      <div class="cv__line"><h3><a href="${L(`projects/${p.slug}/`)}">${esc(p.title)}</a></h3><p class="cv__dates">${esc(p.dates)}</p></div>
      <p class="cv__stack">${esc(list(p.stack).join(', '))}${p.team ? `. ${esc(p.team)}` : ''}</p>
      ${(p.points || []).length ? `<ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    </li>`
      )
      .join('')}</ul></section>
    ${edu.length ? `<section aria-labelledby="cv-edu"><h2 id="cv-edu">Education</h2><ul class="cv__list">${edu.map(entry).join('')}</ul></section>` : ''}
    <section aria-labelledby="cv-skills"><h2 id="cv-skills">Skills</h2><dl class="cv__skills">${(site.skills || [])
      .map((g) => `<div><dt>${esc(g.group)}</dt><dd>${list(g.items).map(esc).join(', ')}</dd></div>`)
      .join('')}${site.languages ? `<div><dt>Languages</dt><dd>${list(site.languages).map(esc).join(', ')}</dd></div>` : ''}</dl></section>
  </article>
</main>`;
  return layout({ ...ctx, title: 'Resume', description: `${site.name}'s resume: experience, projects and skills.`, body, page: 'resume', current: 'resume', canonical: site.url ? site.url.replace(/\/$/, '') + '/resume/' : '' });
}

export function colophonPage(ctx) {
  const { site, colophon, build, stats } = ctx;
  const body = `<main id="main" class="page colophon">
  <header class="col page-head">
    <h1>${esc(colophon.title || 'How this site works')}</h1>
    <p>${esc(colophon.summary || '')}</p>
  </header>
  <dl class="col facts">
    <div><dt>Last built</dt><dd>${esc(build.dateLabel)}${build.sha ? `, from commit <a href="${esc(build.commitUrl)}"><code>${esc(build.sha)}</code></a>` : ''}</dd></div>
    <div><dt>Build time</dt><dd data-build-ms>${build.ms} ms</dd></div>
    <div><dt>Pages</dt><dd>${stats.pages}</dd></div>
    <div><dt>Projects</dt><dd>${stats.projects}</dd></div>
    <div><dt>Blog posts</dt><dd>${stats.posts}, about ${stats.words.toLocaleString('en-AU')} words</dd></div>
    <div><dt>Dependencies to install</dt><dd>0</dd></div>
  </dl>
  <div class="col prose">${colophon.html}</div>
  <section class="col shortcuts" aria-labelledby="keys-h">
    <h2 id="keys-h">Keyboard shortcuts</h2>
    <table>
      <tbody>${SHORTCUTS.map(([k, d]) => `<tr><td>${k.split(' ').map((x) => `<kbd${x === '⌘' ? ' data-kbd-mod-only' : ''}>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(d)}</td></tr>`).join('')}</tbody>
    </table>
  </section>
</main>`;
  return layout({ ...ctx, title: 'How this site works', description: 'The build, the fonts, the A* store and the keyboard shortcuts behind this site.', body, page: 'colophon', canonical: site.url ? site.url.replace(/\/$/, '') + '/colophon/' : '' });
}

export function notFoundPage(ctx) {
  const { site, L } = ctx;
  const body = `<main id="main" class="page notfound">
  <div class="col page-head">
    <h1>This aisle is empty</h1>
    <p>The page you're looking for doesn't exist, or it has moved. Press <kbd data-kbd-mod>⌘K</kbd> to search the site.</p>
    <p class="notfound__actions"><a class="btn btn--primary" href="${L('')}">Go to the homepage</a> <button type="button" class="btn" data-palette-open>Search the site</button></p>
  </div>
</main>`;
  const basePath = site.url ? new URL(site.url).pathname.replace(/\/?$/, '/') : '/';
  return layout({ ...ctx, title: 'Page not found', body, page: 'notfound', extraHead: `<base href="${esc(basePath)}">\n` });
}
