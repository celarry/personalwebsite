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

const textOf = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();

// Render Markdown for a page `depth` folders deep. Site-absolute links (/blog/...,
// /uploads/...) become relative so the site works at any address.
function renderMarkdown(md, depth) {
  const L = T.linker(depth, preview);
  let html = marked.parse(md || '', { gfm: true, breaks: false });
  html = html.replace(/(src|href)="\/(?!\/)([^"]*)"/g, (_, a, rest) => `${a}="${L(rest)}"`);
  html = html.replace(/<img /g, '<img loading="lazy" ');
  // Tables can be wider than a phone screen; let them scroll on their own.
  html = html.replace(/<table>/g, '<div class="table-scroll"><table>').replace(/<\/table>/g, '</table></div>');
  return html;
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const mdFiles = (dir) =>
  exists(dir) ? fs.readdirSync(path.join(root, dir)).filter((f) => /\.(md|markdown)$/i.test(f)) : [];

// ---------- content ----------
const site = loadYaml(read('content/site.yml')) || {};

// Projects
const projects = mdFiles('content/projects')
  .map((file) => {
    const { data, body } = frontMatter(read(`content/projects/${file}`));
    const slug = slugify(file.replace(/\.(md|markdown)$/i, ''));
    return {
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
      summary: String(data.summary || ''),
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
const urls = ['', 'projects/', 'blog/', 'now/', 'resume/', 'colophon/', ...projects.map((p) => `projects/${p.slug}/`), ...posts.map((p) => `blog/${p.slug}/`)];
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
