// Builds the site into /dist. No npm install needed: run `node build.mjs`.
// Add --preview to make links point at index.html files (for opening pages without a web server).

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from './lib/vendor/js-yaml.mjs';
import { marked } from './lib/vendor/marked.esm.js';
import * as T from './lib/templates.mjs';

const t0 = performance.now();
const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
const preview = process.argv.includes('--preview');

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const write = (p, s) => {
  const f = path.join(out, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, s);
};

// ---------- helpers ----------
function frontMatter(raw) {
  const text = raw.replace(/^﻿/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return m ? { data: loadYaml(m[1]) || {}, body: m[2] } : { data: {}, body: text };
}

const asDate = (v, len) => {
  if (v instanceof Date) return v.toISOString().slice(0, len);
  return String(v ?? '').slice(0, len);
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k.startsWith('#x')) return String.fromCodePoint(parseInt(k.slice(2), 16));
    if (k.startsWith('#')) return String.fromCodePoint(parseInt(k.slice(1), 10));
    return ENTITIES[k] ?? m;
  });
const textOf = (html) => decode(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Site-absolute links (/blog/..., /uploads/...) become relative so the site works at any address.
const relativeLinks = (html, depth) => {
  const L = T.linker(depth, preview);
  return html.replace(/(src|href)="\/(?!\/)([^"]*)"/g, (_, a, rest) => `${a}="${L(rest)}"`);
};

// Render Markdown for a page `depth` folders deep.
function renderMarkdown(md, depth) {
  let html = relativeLinks(marked.parse(md || '', { gfm: true, breaks: false }), depth);
  html = html.replace(/<img /g, '<img loading="lazy" ');
  // Tables can be wider than a phone screen; let them scroll on their own.
  html = html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  // Headings get an id and a small link, so any section can be linked to.
  const ids = new Set();
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, n, inner) => {
    let id = slugify(textOf(inner)) || 'section';
    for (let k = 2; ids.has(id); k++) id = `${slugify(textOf(inner))}-${k}`;
    ids.add(id);
    return `<h${n} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to this section">#</a></h${n}>`;
  });
  return html;
}

// One line of Markdown (links, bold, italics), for short fields like the intro.
const inlineMarkdown = (md, depth) => relativeLinks(marked.parseInline(String(md || '').trim()), depth);

// The first sentence of a summary, for lists. Skips abbreviations like "Bros." so a
// title such as Super Smash Bros. Ultimate stays in one piece.
function splitLead(text) {
  const s = String(text || '').trim();
  const re = /[.!?](?=\s+[A-Z0-9"“‘(])/g;
  let m;
  while ((m = re.exec(s))) {
    const head = s.slice(0, m.index + 1);
    if (/\b(?:Bros|Mr|Mrs|Ms|Dr|St|vs|etc|Inc|Ltd|No|approx|e\.g|i\.e)\.$/i.test(head)) continue;
    return [head, s.slice(m.index + 1).trim()];
  }
  return [s, ''];
}

const mdFiles = (dir) =>
  exists(dir) ? fs.readdirSync(path.join(root, dir)).filter((f) => /\.(md|markdown)$/i.test(f)) : [];

// ---------- content ----------
const site = loadYaml(read('content/site.yml')) || {};
site.introHtml = inlineMarkdown(site.intro, 0);
site.intro = decode(site.introHtml.replace(/<[^>]+>/g, '')).trim(); // plain text, for the resume
site.now_api = String(site.now_api || '').trim().replace(/\/$/, '');
const arr = (v) => (Array.isArray(v) ? v : []);
site.offclock = arr(site.offclock)
  .map((r) => ({
    label: String(r?.label || ''),
    text: String(r?.text || '').trim(),
    live: String(r?.live || '').trim().replace(/^none$/, ''),
    // What opens under a row: more words, the projects it connects to, links, or a setup.
    more: String(r?.more || '').trim(),
    more_label: String(r?.more_label || '').trim(),
    projects: arr(r?.projects).map(String).filter(Boolean),
    links: arr(r?.links).filter((l) => l && l.url).map((l) => ({ label: String(l.label || l.url), url: String(l.url) })),
    setup: arr(r?.setup).filter((x) => x && x.name).map((x) => ({ part: String(x.part || ''), name: String(x.name), note: String(x.note || '') })),
  }))
  .filter((r) => r.label && (r.text || r.live))
  .map((r) => ({ ...r, html: r.text ? inlineMarkdown(r.text, 0) : '', moreHtml: r.more ? renderMarkdown(r.more, 0) : '' }));

// Now: a countdown to the move, and what's done and what's left.
site.move = { place: String(site.move?.place || '').trim(), date: asDate(site.move?.date, 10) };
site.checklist = arr(site.checklist)
  .filter((x) => x && x.text)
  .map((x) => ({ text: String(x.text), done: x.done === true || x.done === 'true' }));

// Timeline entries that aren't project milestones.
site.timeline = arr(site.timeline)
  .filter((e) => e && e.date && e.text)
  .map((e) => ({ date: asDate(e.date, 10), kind: String(e.kind || 'life'), text: String(e.text) }));

site.experience = arr(site.experience).map((j) => ({ ...j, projects: arr(j?.projects).map(String).filter(Boolean), points: arr(j?.points).map(String).filter(Boolean) }));

// Books and manga for the Reading row. Anything without an uploaded cover gets one looked
// up when the site is built (Open Library for books, AniList for manga); if that fails,
// the title is drawn as a plain cover instead.
site.reading = (Array.isArray(site.reading) ? site.reading : [])
  .filter((b) => b && b.title)
  .map((b) => ({
    title: String(b.title),
    author: String(b.author || ''),
    kind: String(b.kind || 'Book'),
    isbn: String(b.isbn || '').replace(/[^0-9Xx]/g, ''),
    note: String(b.note || ''),
    progress: String(b.progress || ''),
    thoughts: b.thoughts ? renderMarkdown(String(b.thoughts), 0) : '',
    link: String(b.link || ''),
    cover: String(b.cover || ''),
    slug: slugify(`${b.title}-${b.author || ''}`),
  }));
const fetchedCovers = new Map(); // slug -> { bytes, ext }
async function lookUpCover(b) {
  const get = async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'lawrenceqi.com build', ...(opts.headers || {}) } });
    if (!res.ok) throw new Error(String(res.status));
    return res;
  };
  const image = async (url) => {
    const res = await get(url);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error('not an image');
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length < 1000) throw new Error('too small');
    return { bytes, ext: type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg' };
  };
  const tries = [];
  if (/manga|comic/i.test(b.kind)) {
    tries.push(async () => {
      const res = await get('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: 'query($s:String){Media(search:$s,type:MANGA){coverImage{large}}}', variables: { s: b.title } }),
      });
      const url = (await res.json())?.data?.Media?.coverImage?.large;
      if (!url) throw new Error('no cover');
      return image(url);
    });
  }
  if (b.isbn) tries.push(() => image(`https://covers.openlibrary.org/b/isbn/${b.isbn}-M.jpg?default=false`));
  tries.push(async () => {
    const q = new URLSearchParams({ title: b.title, limit: '1', fields: 'cover_i' });
    if (b.author) q.set('author', b.author);
    const id = (await (await get(`https://openlibrary.org/search.json?${q}`)).json())?.docs?.[0]?.cover_i;
    if (!id) throw new Error('no cover');
    return image(`https://covers.openlibrary.org/b/id/${id}-M.jpg`);
  });
  for (const t of tries) {
    try {
      return await t();
    } catch (e) {}
  }
  return null;
}
if (!process.argv.includes('--offline')) {
  await Promise.all(
    site.reading
      .filter((b) => !b.cover)
      .map(async (b) => {
        const found = await lookUpCover(b).catch(() => null);
        if (found) {
          fetchedCovers.set(b.slug, found);
          b.cover = `/assets/covers/${b.slug}.${found.ext}`;
        }
      })
  );
}

// Projects
const projects = mdFiles('content/projects')
  .map((file) => {
    const { data, body } = frontMatter(read(`content/projects/${file}`));
    const slug = slugify(file.replace(/\.(md|markdown)$/i, ''));
    const summary = String(data.summary || '').trim();
    // Lists show a short lead; the rest of the summary appears when a row is opened.
    const [first, rest] = splitLead(summary);
    const blurb = String(data.blurb || '').trim();
    return {
      lead: blurb || first,
      more: blurb ? summary : rest,
      slug,
      title: String(data.title || slug),
      featured: data.featured === true || data.featured === 'true',
      order: Number(data.order ?? 99),
      demo: data.demo || 'none',
      dates: String(data.dates || ''),
      started: asDate(data.started, 7),
      status: String(data.status || ''),
      team: String(data.team || ''),
      stack: T.list(data.stack),
      summary,
      points: (data.points || []).map(String).filter(Boolean),
      repo: String(data.repo || ''),
      live: String(data.live || ''),
      diagram_title: String(data.diagram_title || ''),
      diagram: Array.isArray(data.diagram) ? data.diagram : [],
      log: (data.log || []).filter((e) => e && e.text).map((e) => ({ date: asDate(e.date, 7), text: String(e.text) })),
      html: renderMarkdown(body, 2),
      draft: data.draft === true,
    };
  })
  .filter((p) => !p.draft)
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

const history = projects
  .flatMap((p) => p.log.map((e) => ({ ...e, slug: p.slug, project: p.title })))
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.project.localeCompare(b.project)));

// Posts
const posts = mdFiles('content/posts')
  .map((file) => {
    const { data, body } = frontMatter(read(`content/posts/${file}`));
    const base = file.replace(/\.(md|markdown)$/i, '');
    const fnDate = base.match(/^(\d{4}-\d{2}-\d{2})-?/);
    let date = asDate(data.date, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = fnDate ? fnDate[1] : new Date().toISOString().slice(0, 10);
    const slug = slugify(fnDate ? base.slice(fnDate[0].length) : base) || date;
    const html = renderMarkdown(body, 2);
    const text = textOf(html);
    const words = text ? text.split(' ').length : 0;
    return {
      slug,
      date,
      title: String(data.title || slug.replace(/-/g, ' ')),
      summary: data.summary ? String(data.summary) : '',
      cover: data.cover ? String(data.cover) : '',
      tags: T.list(data.tags),
      draft: data.draft === true || data.draft === 'true',
      html,
      words,
      minutes: Math.max(1, Math.round(words / 220)),
      excerpt: text.length > 180 ? text.slice(0, 177).replace(/\s+\S*$/, '') + '…' : text,
    };
  })
  .filter((p) => !p.draft)
  .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.title.localeCompare(b.title)));

// Avoid two posts with the same address.
const seen = new Map();
for (const p of posts) {
  const n = (seen.get(p.slug) || 0) + 1;
  seen.set(p.slug, n);
  if (n > 1) p.slug = `${p.slug}-${n}`;
}

// Standalone pages
function page(name, depth) {
  const f = `content/pages/${name}.md`;
  if (!exists(f)) return { title: '', html: '' };
  const { data, body } = frontMatter(read(f));
  return { ...data, updated: data.updated ? asDate(data.updated, 10) : '', html: renderMarkdown(body, depth) };
}
const now = page('now', 1);
const colophon = page('colophon', 1);

// Build information shown in the footer and on the colophon.
let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
if (!sha) {
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    sha = '';
  }
}
const repoUrl = process.env.GITHUB_REPOSITORY
  ? `https://github.com/${process.env.GITHUB_REPOSITORY}`
  : (projects.find((p) => p.slug === 'this-website') || {}).repo || '';
const nowDate = new Date();
const build = {
  sha,
  repoUrl,
  commitUrl: sha && repoUrl ? `${repoUrl}/commit/${sha}` : repoUrl,
  year: nowDate.getFullYear(),
  dateLabel: new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: site.timezone || 'Australia/Melbourne' }).format(nowDate),
  ms: 0,
};

// ---------- output ----------
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(root, 'public'), out, { recursive: true });
for (const [slug, c] of fetchedCovers) write(`assets/covers/${slug}.${c.ext}`, c.bytes);

const pages = []; // [path, render()] so build time can include everything
const ctx = (depth) => ({ site, projects, posts, history, now, colophon, build, L: T.linker(depth, preview) });

pages.push(['index.html', () => T.homePage(ctx(0))]);
pages.push(['projects/index.html', () => T.projectsIndexPage(ctx(1))]);
projects.forEach((project, i) =>
  pages.push([`projects/${project.slug}/index.html`, () => T.projectPage({ ...ctx(2), project, prev: projects[i - 1], next: projects[i + 1] })])
);
pages.push(['blog/index.html', () => T.blogIndexPage(ctx(1))]);
posts.forEach((post, i) =>
  pages.push([`blog/${post.slug}/index.html`, () => T.postPage({ ...ctx(2), post, prev: posts[i + 1], next: posts[i - 1] })])
);
pages.push(['now/index.html', () => T.nowPage(ctx(1))]);
pages.push(['stores/index.html', () => T.storesPage(ctx(1))]);
pages.push(['resume/index.html', () => T.resumePage(ctx(1))]);
pages.push(['colophon/index.html', () => T.colophonPage({ ...ctx(1), stats })]);
pages.push(['404.html', () => T.notFoundPage(ctx(0))]);

const stats = {
  pages: pages.length - 1,
  projects: projects.length,
  posts: posts.length,
  words: posts.reduce((a, p) => a + p.words, 0),
};

// Render the colophon last so its build time covers everything else.
build.ms = Math.round(performance.now() - t0);
const colophonIndex = pages.findIndex(([p]) => p === 'colophon/index.html');
const ordered = [...pages.slice(0, colophonIndex), ...pages.slice(colophonIndex + 1), pages[colophonIndex]];
for (const [p, render] of ordered) {
  if (p === 'colophon/index.html') build.ms = Math.max(1, Math.round(performance.now() - t0));
  write(p, render());
}

// Search index for the command palette.
const index = [
  ...projects.map((p) => ({ type: 'project', title: p.title, url: `projects/${p.slug}/`, text: [p.summary, p.stack.join(' '), p.status].join(' ') })),
  ...posts.map((p) => ({ type: 'post', title: p.title, url: `blog/${p.slug}/`, text: [p.summary, p.tags.join(' '), p.excerpt].join(' '), date: p.date, tags: p.tags })),
];
write('search.json', JSON.stringify(index));

// RSS feed and sitemap need the site's full address.
const siteUrl = (site.url || '').replace(/\/$/, '');
const x = (s) => T.esc(s).replace(/'/g, '&apos;');
const abs = (html) => html.replace(/(src|href)="(?:\.\.\/)+/g, `$1="${siteUrl}/`);
write(
  'feed.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${x(site.name)}'s blog</title>
<link>${siteUrl}/blog/</link>
<atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
<description>${x(site.headline || '')}</description>
<language>en-au</language>
${posts
  .slice(0, 20)
  .map(
    (p) => `<item>
<title>${x(p.title)}</title>
<link>${siteUrl}/blog/${p.slug}/</link>
<guid>${siteUrl}/blog/${p.slug}/</guid>
<pubDate>${new Date(p.date + 'T09:00:00+10:00').toUTCString()}</pubDate>
${p.tags.map((t) => `<category>${x(t)}</category>`).join('')}
<description>${x(p.summary || p.excerpt)}</description>
<content:encoded><![CDATA[${abs(p.html).replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>
</item>`
  )
  .join('\n')}
</channel>
</rss>
`
);
const urls = ['', 'projects/', 'blog/', 'now/', 'resume/', 'colophon/', 'stores/', ...projects.map((p) => `projects/${p.slug}/`), ...posts.map((p) => `blog/${p.slug}/`)];
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${siteUrl}/${u}</loc></url>`).join('\n')}
</urlset>
`
);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);

console.log(
  `Built ${stats.pages} pages (${projects.length} projects, ${posts.length} post${posts.length === 1 ? '' : 's'}) into dist/ in ${Math.round(performance.now() - t0)} ms${preview ? ' (preview links)' : ''}`
);
