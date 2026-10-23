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
  ['⌘ K', 'Open the command palette'],
  ['/', 'Open the command palette'],
  ['g h', 'Go to the homepage'],
  ['g p', 'Go to projects'],
  ['g b', 'Go to the blog'],
  ['g n', 'Go to the Now page'],
  ['g r', 'Go to the resume'],
  ['t', 'Switch between light and dark'],
  ['?', 'Show these shortcuts'],
];

function nav(L, { onHero = false, current = '' } = {}) {
  const home = L('');
  const ob = onHero ? ' data-obstacle="box"' : '';
  const cur = (k) => (current === k ? ' aria-current="page"' : '');
  return `<header class="nav${onHero ? ' nav--hero' : ''}">
  <a class="nav__mark" href="${home}"${ob}>Lawrence Qi</a>
  <nav aria-label="Main"${ob}>
    <a class="nav__link" href="${L('projects/')}"${cur('projects')}>Projects</a>
    <a class="nav__link" href="${L('blog/')}"${cur('blog')}>Blog</a>
    <a class="nav__link" href="${L('now/')}"${cur('now')}>Now</a>
    <a class="nav__link" href="${L('resume/')}"${cur('resume')}>Resume</a>
    <button class="nav__search" type="button" data-palette-open aria-haspopup="dialog">${icon.search}<span class="nav__search-label">Search</span><span class="nav__menu-label">Menu</span><kbd data-kbd-mod>⌘K</kbd></button>
    <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch colour theme">${icon.sun}${icon.moon}</button>
  </nav>
</header>`;
}

function footer(site, L, build) {
  const elsewhere = [
    `<a href="mailto:${esc(site.email)}">Email</a>`,
    site.github && `<a href="${esc(site.github)}">GitHub</a>`,
    site.linkedin && `<a href="${esc(site.linkedin)}">LinkedIn</a>`,
    `<a href="${L('feed.xml')}">RSS feed</a>`,
  ].filter(Boolean);
  return `<footer class="footer">
  <div class="wrap footer__grid">
    <div class="footer__about">
      <p class="footer__name">${esc(site.name)}</p>
      <p>${esc(site.location || '')}</p>
      <p class="footer__hint">Press <kbd data-kbd-mod>⌘K</kbd> to find anything, or <kbd>?</kbd> for shortcuts.</p>
    </div>
    <nav class="footer__col" aria-label="Site">
      <p>On this site</p>
      <a href="${L('projects/')}">Projects</a>
      <a href="${L('blog/')}">Blog</a>
      <a href="${L('now/')}">Now</a>
      <a href="${L('resume/')}">Resume</a>
      <a href="${L('colophon/')}">How this site works</a>
    </nav>
    <nav class="footer__col" aria-label="Elsewhere">
      <p>Elsewhere</p>
      ${elsewhere.join('\n      ')}
    </nav>
  </div>
  <div class="wrap footer__base">
    <p>© ${build.year} ${esc(site.name)}</p>
    <p class="footer__build">Built ${esc(build.dateLabel)}${build.sha ? ` from <a href="${esc(build.commitUrl)}"><code>${esc(build.sha)}</code></a>` : ''}</p>
  </div>
</footer>`;
}

export function layout({ site, L, build, title, description, body, page = '', canonical = '', extraHead = '', scripts = [] }) {
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
<meta name="author" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="${page === 'post' ? 'article' : 'website'}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n<meta property="og:url" content="${esc(canonical)}">\n` : ''}${absOg ? `<meta property="og:image" content="${esc(absOg)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<link rel="icon" href="${L('favicon.svg')}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}'s blog" href="${L('feed.xml')}">
<link rel="preload" href="${L('assets/fonts/anybody.woff')}" as="font" type="font/woff" crossorigin>
<link rel="preload" href="${L('assets/fonts/atkinson-next.woff')}" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="${L('assets/css/site.css')}">
<script>
  try { var t = localStorage.getItem('theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) {}
</script>
</head>
<body class="page-${page}" data-root="${esc(L.root)}"${L.preview ? ' data-preview="1"' : ''} data-email="${esc(site.email)}" data-tz="${esc(site.timezone || 'Australia/Melbourne')}" data-place="${esc((site.location || '').split(',')[0])}" data-resume="${esc(site.resume ? asset(L, site.resume) : '')}" data-repo="${esc(build.repoUrl || '')}">
<a class="skip" href="#main">Skip to content</a>
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

const stackChips = (stack) => `<p class="stack">${list(stack).map((s) => `<span>${esc(s)}</span>`).join('')}</p>`;

export function statusChip(status) {
  if (!status) return '';
  const k = String(status).toLowerCase().replace(/[^a-z]+/g, '-');
  return `<span class="status status--${k}">${esc(status)}</span>`;
}

const tagChips = (tags, L) =>
  tags && tags.length
    ? `<span class="tags">${tags.map((t) => `<a class="tag" href="${L('blog/')}#${esc(t.toLowerCase())}">${esc(t)}</a>`).join('')}</span>`
    : '';

function projectLinks(p, L, { full = false } = {}) {
  const out = [];
  if (full) out.push(`<a href="${L(`projects/${p.slug}/`)}">Read the full story</a>`);
  if (p.live) out.push(`<a href="${esc(p.live)}">Visit the site</a>`);
  if (p.repo) out.push(`<a href="${esc(p.repo)}">Code on GitHub</a>`);
  return out.length ? `<p class="proj__links">${out.join('')}</p>` : '';
}

/* ---------- Interactive bits ---------- */

const radios = (name, values, checked, labels = values) =>
  values
    .map(
      (v, i) =>
        `<label><input type="radio" name="${name}" value="${v}"${String(v) === String(checked) ? ' checked' : ''}><span>${labels[i]}</span></label>`
    )
    .join('');

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
      <p class="vp__factors-h">What's moving the number <span>(log-odds, + favours attack)</span></p>
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
    <li><span class="em__step">Draft reply</span><label class="em__draft"><span class="visually-hidden">AI-drafted reply, editable</span><textarea id="em-draft" rows="3" data-draft>Thanks for the reminder. I'll renew it at the service desk on Thursday.</textarea></label></li>
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

  cart: (L, { onHome = true } = {}) => `<div class="demo cartdemo">
  <p>The cart at the top of the homepage runs a smaller version of the same planner.</p>
  <ul class="legend" aria-label="What the floor shows">
    <li><i class="lg lg--cart"></i>The cart</li>
    <li><i class="lg lg--shopper"></i>A shopper who wanders into aisles</li>
    <li><i class="lg lg--searched"></i>Cells A* expanded before choosing a route</li>
    <li><i class="lg lg--open"></i>Cells still waiting in the open set</li>
    <li><i class="lg lg--route"></i>The route it chose</li>
    <li><i class="lg lg--item"></i>Items on the shopping list</li>
  </ul>
  ${onHome ? `<button type="button" class="btn btn--primary" data-shop>Send the cart shopping</button>` : `<a class="btn btn--primary" href="${L('')}">Try it on the homepage</a>`}
</div>`,
};

function diagram(p) {
  const nodes = (p.diagram || []).filter((n) => n && n.label);
  if (!nodes.length) return '';
  const id = `dg-${p.slug}`;
  return `<figure class="diagram" data-diagram>
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
  return `<figure class="hud" data-hud>
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
      <p>${showProject ? `<a href="${L(`projects/${e.slug}/`)}">${esc(e.project)}</a> ` : ''}${esc(e.text)}</p>
    </li>`
    )
    .join('')}</ol>`;
}

/* ---------- Home page ---------- */

function hero(site, L) {
  const actions = [
    `<a class="btn btn--primary" href="mailto:${esc(site.email)}">Email me</a>`,
    `<a class="btn" href="${L('resume/')}">Resume</a>`,
    site.github && `<a class="btn" href="${esc(site.github)}">GitHub</a>`,
    site.linkedin && `<a class="btn" href="${esc(site.linkedin)}">LinkedIn</a>`,
  ].filter(Boolean);
  return `<section class="hero" data-floor aria-labelledby="hero-name">
  <canvas class="hero__floor" aria-hidden="true"></canvas>
  ${nav(L, { onHero: true })}
  <div class="hero__body wrap">
    <h1 id="hero-name" class="hero__name" data-obstacle>${esc(site.name)}</h1>
    <p class="hero__headline" data-obstacle>${esc(site.headline)}</p>
    <p class="hero__intro" data-obstacle>${esc(site.intro)}</p>
    <p class="hero__actions">${actions.map((a) => a.replace('class="btn', 'data-obstacle="box" class="btn')).join('')}</p>
  </div>
  <div class="hero__foot wrap">
    <p class="hero__caption" data-obstacle="box">Click anywhere on the floor. The cart plans a route there with A*, the search I wrote for a self-driving shopping cart at UNIHACK&nbsp;2025.</p>
    <p class="hero__readout" data-obstacle="box" aria-hidden="true"><span>Searched <b data-searched>0</b> cells</span><span>Route <b data-route>0</b> cells</span><span>Reroutes <b data-reroutes>0</b></span></p>
  </div>
</section>`;
}

function nowBand(site, now, L) {
  return `<div class="now wrap">
  <p class="now__text"><strong>Now</strong> ${esc(site.now)} <a href="${L('now/')}">More on my Now page</a></p>
  <p class="now__clock" data-clock></p>
</div>`;
}

function aboutWork(site) {
  const skills = (site.skills || [])
    .map((g) => `<div><dt>${esc(g.group)}</dt><dd>${list(g.items).map(esc).join(', ')}</dd></div>`)
    .join('');
  const langs = site.languages ? `<div><dt>Languages</dt><dd>${list(site.languages).map(esc).join(', ')}</dd></div>` : '';
  const jobs = (site.experience || [])
    .map(
      (j) => `<li class="job">
      <p class="job__dates">${esc(j.dates)}</p>
      <div class="job__body">
        <h3>${esc(j.role)} <span class="job__org">${esc(j.org)}</span></h3>
        ${j.summary ? `<p>${esc(j.summary)}</p>` : ''}
        ${(j.points || []).length ? `<ul>${j.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      </div>
    </li>`
    )
    .join('');
  return `<section class="section wrap split" id="about" aria-labelledby="about-h">
  <h2 id="about-h">About</h2>
  <div class="split__body">
    <p class="lede">${esc(site.about)}</p>
    ${site.about_more ? `<p>${esc(site.about_more)}</p>` : ''}
    <dl class="skills">${skills}${langs}</dl>
  </div>
</section>
<section class="section wrap split" id="work" aria-labelledby="work-h">
  <h2 id="work-h">Experience</h2>
  <ol class="split__body jobs">${jobs}</ol>
</section>`;
}

function homeProjects(projects, L) {
  const featured = projects.filter((p) => p.featured && demos[p.demo]);
  const rest = projects.filter((p) => !featured.includes(p));
  const feat = featured
    .map(
      (p) => `<article class="proj" id="project-${p.demo}">
    <div class="proj__text">
      <h3><a class="proj__title" href="${L(`projects/${p.slug}/`)}">${esc(p.title)}</a></h3>
      <p class="proj__meta">${[esc(p.dates), esc(p.team)].filter(Boolean).map((m) => `<span>${m}</span>`).join('')}${statusChip(p.status)}</p>
      <p>${esc(p.summary)}</p>
      ${(p.points || []).length ? `<ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${stackChips(p.stack)}
      ${projectLinks(p, L, { full: true })}
    </div>
    ${demos[p.demo](L)}
  </article>`
    )
    .join('');
  const more = rest
    .map(
      (p) => `<li class="more__item">
      <h4><a href="${L(`projects/${p.slug}/`)}">${esc(p.title)}</a></h4>
      <p>${esc(p.summary)}</p>
      ${stackChips(p.stack)}
    </li>`
    )
    .join('');
  return `<section class="section wrap" id="projects" aria-labelledby="projects-h">
  <h2 id="projects-h">Projects</h2>
  <p class="section__intro">Most of these have something you can poke at. Each one has a full write-up with a diagram and its history.</p>
  ${feat}
  ${rest.length ? `<div class="more"><h3>More things I've built</h3><ul class="more__list">${more}</ul><p class="more__all"><a class="textlink" href="${L('projects/')}">All ${projects.length} projects, with their history</a></p></div>` : ''}
</section>`;
}

export function postList(posts, L, { showYear = true, filterable = false } = {}) {
  if (!posts.length) return `<p class="empty">No posts yet.</p>`;
  return `<ul class="posts">${posts
    .map(
      (p) => `<li class="posts__item"${filterable ? ` data-tags="${esc(p.tags.map((t) => t.toLowerCase()).join(' '))}"` : ''}>
      <time datetime="${p.date}">${fmtDate(p.date, showYear ? 'long' : 'short')}</time>
      <div>
        <h3><a href="${L(`blog/${p.slug}/`)}">${esc(p.title)}</a></h3>
        ${p.summary ? `<p>${esc(p.summary)}</p>` : ''}
        <p class="posts__meta">${tagChips(p.tags, L)}<span>${p.minutes} min read</span></p>
      </div>
    </li>`
    )
    .join('')}</ul>`;
}

function blogTeaser(posts, L) {
  return `<section class="section wrap split" id="blog" aria-labelledby="blog-h">
  <h2 id="blog-h">Blog</h2>
  <div class="split__body">
    <p class="section__intro">What I'm working on, and life in general. Friends and family: posts tagged <a href="${L('blog/')}#life">Life</a> are the ones for you.</p>
    ${postList(posts.slice(0, 3), L)}
    ${posts.length ? `<p><a class="textlink" href="${L('blog/')}">${posts.length > 3 ? `All ${posts.length} posts` : 'Go to the blog'}</a></p>` : ''}
  </div>
</section>`;
}

function contact(site) {
  return `<section class="section wrap contact" id="contact" aria-labelledby="contact-h">
  <h2 id="contact-h">Get in touch</h2>
  <p>I'm open to graduate roles and projects in machine learning and infrastructure. The fastest way to reach me is email.</p>
  <p class="contact__row"><a class="contact__email" href="mailto:${esc(site.email)}">${esc(site.email).replace('@', '<wbr>@')}</a><button type="button" class="btn contact__copy" data-copy="${esc(site.email)}">Copy address</button></p>
</section>`;
}

export function homePage(ctx) {
  const { site, projects, posts, now, L } = ctx;
  const body = `${hero(site, L)}
<main id="main">
${nowBand(site, now, L)}
${aboutWork(site)}
${homeProjects(projects, L)}
${blogTeaser(posts, L)}
${contact(site)}
</main>`;
  return layout({ ...ctx, body, page: 'home', canonical: site.url ? site.url.replace(/\/?$/, '/') : '', scripts: ['assets/js/floor.js', 'assets/js/demos.js'] });
}

/* ---------- Projects ---------- */

export function projectsIndexPage(ctx) {
  const { site, projects, history, L } = ctx;
  const byYear = {};
  for (const p of [...projects].sort((a, b) => (a.started < b.started ? 1 : -1))) (byYear[String(p.started).slice(0, 4)] ||= []).push(p);
  const years = Object.keys(byYear).sort().reverse();
  const first = [...projects].map((p) => p.started).filter(Boolean).sort()[0];
  const body = `${nav(L, { current: 'projects' })}
<main id="main" class="wrap archive">
  <header class="page-head">
    <h1>Projects</h1>
    <p>${projects.length} things I've built since ${esc(fmtDate(first || '2025-01'))}, from hackathon hardware to a Kubernetes cluster at home. Each one has a write-up, a diagram of how it works, and its history.</p>
  </header>
  ${years
    .map(
      (y) => `<section class="year" aria-labelledby="py${y}">
    <h2 id="py${y}">${y}</h2>
    <ul class="plist">
      ${byYear[y]
        .map(
          (p) => `<li class="plist__item">
        <p class="plist__when">${esc(p.dates)}</p>
        <div>
          <h3><a href="${L(`projects/${p.slug}/`)}">${esc(p.title)}</a> ${statusChip(p.status)}</h3>
          <p>${esc(p.summary)}</p>
          ${stackChips(p.stack)}
        </div>
      </li>`
        )
        .join('')}
    </ul>
  </section>`
    )
    .join('')}
  <section class="year" aria-labelledby="history-h">
    <h2 id="history-h">History</h2>
    <p class="section__intro">Every milestone across every project, newest first.</p>
    ${historyList(history, L, { showProject: true })}
  </section>
</main>`;
  return layout({ ...ctx, title: 'Projects', description: `Everything ${site.name} has built, with write-ups, diagrams and history.`, body, page: 'projects', canonical: site.url ? site.url.replace(/\/$/, '') + '/projects/' : '', scripts: [] });
}

export function projectPage(ctx) {
  const { site, project: p, prev, next, L } = ctx;
  const hasDemo = demos[p.demo];
  const pn = [
    prev && `<a class="pn pn--prev" href="${L(`projects/${prev.slug}/`)}"><span>Previous project</span>${esc(prev.title)}</a>`,
    next && `<a class="pn pn--next" href="${L(`projects/${next.slug}/`)}"><span>Next project</span>${esc(next.title)}</a>`,
  ].filter(Boolean);
  const body = `${nav(L, { current: 'projects' })}
<main id="main" class="wrap project">
  <header class="project__head">
    <p class="post__back"><a href="${L('projects/')}">All projects</a></p>
    <h1>${esc(p.title)}</h1>
    <p class="proj__meta">${[esc(p.dates), esc(p.team)].filter(Boolean).map((m) => `<span>${m}</span>`).join('')}${statusChip(p.status)}</p>
    <p class="lede">${esc(p.summary)}</p>
    ${stackChips(p.stack)}
    ${projectLinks(p, L)}
  </header>
  ${(p.points || []).length ? `<section class="project__points" aria-label="Highlights"><ul>${p.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
  ${p.demo === 'valorant' ? hudFigure(L) : ''}
  ${diagram(p)}
  ${hasDemo ? `<section class="project__demo" aria-labelledby="demo-h"><h2 id="demo-h">${p.demo === 'homelab' ? 'How it fits together' : 'Try it'}</h2>${demos[p.demo](L, { onHome: false })}</section>` : ''}
  <div class="prose project__body">${p.html}</div>
  ${(p.log || []).length ? `<section class="project__history" aria-labelledby="hist-h"><h2 id="hist-h">History</h2>${historyList([...p.log].sort((a, b) => (a.date < b.date ? 1 : -1)), L)}</section>` : ''}
  ${pn.length ? `<nav class="post__pn" aria-label="More projects">${pn.join('')}</nav>` : ''}
</main>`;
  return layout({
    ...ctx,
    title: p.title,
    description: p.summary,
    body,
    page: 'project',
    canonical: site.url ? `${site.url.replace(/\/$/, '')}/projects/${p.slug}/` : '',
    scripts: ['assets/js/demos.js'],
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
    ? years
        .map(
          (y) =>
            `<section class="year" data-year aria-labelledby="y${y}"><h2 id="y${y}">${y} <span class="year__count">${byYear[y].length} post${byYear[y].length === 1 ? '' : 's'}</span></h2>${postList(byYear[y], L, { showYear: false, filterable: true })}</section>`
        )
        .join('')
    : `<p class="empty">No posts yet. Check back soon.</p>`;
  const body = `${nav(L, { current: 'blog' })}
<main id="main" class="wrap blog">
  <header class="page-head">
    <h1>Blog</h1>
    <p>What I'm working on, and life in general. ${posts.length} post${posts.length === 1 ? '' : 's'} and about ${words.toLocaleString('en-AU')} words so far. Follow along with <a href="${L('feed.xml')}">RSS</a>.</p>
  </header>
  ${tags.length ? `<div class="filters" data-filters role="group" aria-label="Filter posts by tag"><button type="button" aria-pressed="true" data-filter="">All</button>${tags.map((t) => `<button type="button" aria-pressed="false" data-filter="${esc(t.toLowerCase())}">${esc(t)}</button>`).join('')}</div><p class="filters__empty" data-filter-empty hidden>No posts with that tag yet.</p>` : ''}
  ${groups}
</main>`;
  return layout({
    ...ctx,
    title: 'Blog',
    description: `${site.name}'s blog: what I'm working on, and life in general.`,
    body,
    page: 'blog',
    canonical: site.url ? site.url.replace(/\/$/, '') + '/blog/' : '',
  });
}

export function postPage(ctx) {
  const { site, post, prev, next, L } = ctx;
  const cover = post.cover ? `<img class="post__cover" src="${esc(asset(L, post.cover))}" alt="">` : '';
  const pn = [
    prev && `<a class="pn pn--prev" href="${L(`blog/${prev.slug}/`)}"><span>Older</span>${esc(prev.title)}</a>`,
    next && `<a class="pn pn--next" href="${L(`blog/${next.slug}/`)}"><span>Newer</span>${esc(next.title)}</a>`,
  ].filter(Boolean);
  const body = `${nav(L, { current: 'blog' })}
<main id="main" class="wrap post">
  <article>
    <header class="post__head">
      <p class="post__back"><a href="${L('blog/')}">All posts</a></p>
      <h1>${esc(post.title)}</h1>
      <p class="post__meta"><time datetime="${post.date}">${fmtDate(post.date)}</time><span>${post.minutes} min read</span>${tagChips(post.tags, L)}</p>
    </header>
    ${cover}
    <div class="prose">${post.html}</div>
  </article>
  ${pn.length ? `<nav class="post__pn" aria-label="More posts">${pn.join('')}</nav>` : ''}
</main>`;
  return layout({
    ...ctx,
    title: post.title,
    description: post.summary || post.excerpt,
    body,
    page: 'post',
    canonical: site.url ? `${site.url.replace(/\/$/, '')}/blog/${post.slug}/` : '',
  });
}

/* ---------- Now, resume, colophon ---------- */

export function nowPage(ctx) {
  const { site, now, L } = ctx;
  const body = `${nav(L, { current: 'now' })}
<main id="main" class="wrap post nowpage">
  <header class="page-head">
    <h1>${esc(now.title || 'Now')}</h1>
    <p class="post__meta">${now.updated ? `<span>Updated <time datetime="${esc(now.updated)}" data-ago>${fmtDate(now.updated)}</time></span>` : ''}<span data-clock></span></p>
  </header>
  <div class="prose">${now.html}</div>
  <p class="nowpage__about">This is a <a href="https://nownownow.com/about">now page</a>: what I'd tell a friend I hadn't seen in a while.</p>
</main>`;
  return layout({ ...ctx, title: 'Now', description: `What ${site.name} is up to right now.`, body, page: 'now', canonical: site.url ? site.url.replace(/\/$/, '') + '/now/' : '' });
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
  const body = `${nav(L, { current: 'resume' })}
<main id="main" class="wrap cv">
  <div class="cv__actions">
    ${site.resume ? `<a class="btn btn--primary" href="${esc(asset(L, site.resume))}">Download PDF</a>` : ''}
    <p>Prints cleanly on A4.</p>
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
  return layout({ ...ctx, title: 'Resume', description: `${site.name}'s resume: experience, projects and skills.`, body, page: 'resume', canonical: site.url ? site.url.replace(/\/$/, '') + '/resume/' : '' });
}

export function colophonPage(ctx) {
  const { site, colophon, build, stats, L } = ctx;
  const body = `${nav(L)}
<main id="main" class="wrap post colophon">
  <header class="page-head">
    <h1>${esc(colophon.title || 'How this site works')}</h1>
    <p>${esc(colophon.summary || '')}</p>
  </header>
  <dl class="facts">
    <div><dt>Last built</dt><dd>${esc(build.dateLabel)}${build.sha ? `, from commit <a href="${esc(build.commitUrl)}"><code>${esc(build.sha)}</code></a>` : ''}</dd></div>
    <div><dt>Build time</dt><dd data-build-ms>${build.ms} ms</dd></div>
    <div><dt>Pages</dt><dd>${stats.pages}</dd></div>
    <div><dt>Projects</dt><dd>${stats.projects}</dd></div>
    <div><dt>Blog posts</dt><dd>${stats.posts}, about ${stats.words.toLocaleString('en-AU')} words</dd></div>
    <div><dt>Dependencies to install</dt><dd>0</dd></div>
  </dl>
  <div class="prose">${colophon.html}</div>
  <section class="shortcuts" aria-labelledby="keys-h">
    <h2 id="keys-h">Keyboard shortcuts</h2>
    <table>
      <tbody>${SHORTCUTS.map(([k, d]) => `<tr><td>${k.split(' ').map((x) => `<kbd${x === '⌘' ? ' data-kbd-mod-only' : ''}>${esc(x)}</kbd>`).join(' ')}</td><td>${esc(d)}</td></tr>`).join('')}</tbody>
    </table>
  </section>
</main>`;
  return layout({ ...ctx, title: 'How this site works', description: 'The build, the fonts, the A* shop floor and the keyboard shortcuts behind this site.', body, page: 'colophon', canonical: site.url ? site.url.replace(/\/$/, '') + '/colophon/' : '' });
}

export function notFoundPage(ctx) {
  const { site, L } = ctx;
  const body = `${nav(L)}
<main id="main" class="wrap notfound">
  <h1>This aisle is empty</h1>
  <p>The page you're looking for doesn't exist or has moved. Press <kbd data-kbd-mod>⌘K</kbd> to search the site.</p>
  <p class="notfound__actions"><a class="btn btn--primary" href="${L('')}">Go to the homepage</a> <button type="button" class="btn" data-palette-open>Search the site</button></p>
</main>`;
  const basePath = site.url ? new URL(site.url).pathname.replace(/\/?$/, '/') : '/';
  return layout({ ...ctx, title: 'Page not found', body, page: 'notfound', extraHead: `<base href="${esc(basePath)}">\n` });
}
