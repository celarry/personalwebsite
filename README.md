# Lawrence Qi — personal website

My personal website: a homepage with interactive project demos, and a blog I can update from a web editor.

- **Homepage:** a shop floor where a cart plans routes with A*, a Valorant win-probability simulator, a homelab diagram and an email-approval demo.
- **Blog:** posts are Markdown files in `content/posts/`, written and edited with [Pages CMS](https://pagescms.org).
- **Hosting:** GitHub Pages. Every change on `main` rebuilds the site automatically.

There's nothing to install. The build is one Node script with no dependencies.

---

## How it's hosted

- **Code:** GitHub, in the [`rockminelaw/personalwebsite`](https://github.com/rockminelaw/personalwebsite) repository.
- **Hosting:** GitHub Pages. The workflow in `.github/workflows/deploy.yml` rebuilds the site on every change to `main`.
- **Domain:** `lawrenceqi.com`, registered at Cloudflare. DNS points at GitHub Pages:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `185.199.108.153` | DNS only |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| AAAA | `@` | `2606:50c0:8000::153` | DNS only |
| AAAA | `@` | `2606:50c0:8001::153` | DNS only |
| AAAA | `@` | `2606:50c0:8002::153` | DNS only |
| AAAA | `@` | `2606:50c0:8003::153` | DNS only |
| CNAME | `www` | `rockminelaw.github.io` | DNS only |

In the repo, **Settings → Pages** has **Source** set to **GitHub Actions**, **Custom domain** set to `lawrenceqi.com`, and **Enforce HTTPS** on.

### Connect the blog editor (once)

1. Go to **[app.pagescms.org](https://app.pagescms.org)** and sign in with GitHub.
2. Install the Pages CMS GitHub app when it asks, and give it access to the `personalwebsite` repository.
3. Open the repository in Pages CMS. You'll see **Blog posts**, **Projects**, **Now page**, **Profile** and **How this site works** in the sidebar.

---

## Writing a blog post

1. Open [app.pagescms.org](https://app.pagescms.org) and pick your site.
2. Click **Blog posts**, then **Add an entry**.
3. Fill in the title, date, a one-line summary and a tag or two, then write the post. You can add headings, links, lists and images from the toolbar.
4. Click **Save**.

The site updates by itself about a minute later. Tag personal updates **Life**: that's the filter friends and family will use. To keep a post private while you work on it, tick **Draft**.

## Updating everything else

All of these are in the Pages CMS sidebar:

- **Projects:** each project has a summary, highlights, an optional diagram (a list of steps) and a **History** list of dated milestones. Add a milestone whenever something ships; it appears on the project page and in the combined history on the projects page.
- **Now page:** what you're up to. Change **Last updated** when you edit it.
- **Profile:** name, headline, intro, the one-line "Now" on the homepage, contact links, resume PDF, skills and experience. The resume page is built from this too.
- **Moving to Singapore:** in Profile, change **Location** and set **Time zone** to `Asia/Singapore` so the clocks are right.

## Things people can find

- **The shop floor:** it keeps Melbourne hours. From 10 pm to 7 am the lights dim, a Closed sign goes up and the cart sleeps until someone wakes it. Visitors can add items from the list below it (tap, or drag onto the floor) and get a receipt when the cart has fetched them. It decorates itself for Lunar New Year, Mid-Autumn and Christmas. Add `#open`, `#closed`, `#lunar`, `#midautumn` or `#christmas` to the address to preview each.
- **Command palette:** press ⌘K (Ctrl K on Windows) or `/`. On phones it's the **Menu** button. It searches projects and posts, and has a few commands: copy email, local time, say hello in four languages, a random post.
- **Shortcuts:** `g` then `h`, `p`, `b`, `n` or `r` to jump between pages, `t` for the theme, `?` for the list.
- **Project pages:** diagrams you can step through, the Valorant HUD reader, and each project's history.
- **Blog filters:** `/blog/#life` links straight to the Life posts.
- **Colophon:** `/colophon/` explains how the site works, with real build numbers.
- **Developer tools:** open the console for a hello.

## For developers

```
build.mjs              builds the site into dist/
lib/templates.mjs      HTML for every page
lib/vendor/            marked (Markdown) and js-yaml, vendored so the build needs no npm install
content/               everything that changes: site.yml, projects/, posts/, pages/
public/                copied as-is: CSS, JS (floor, demos, palette, site), fonts, images, uploads
.pages.yml             Pages CMS editor configuration
.github/workflows/     GitHub Pages deploy
```

```sh
node build.mjs             # build into dist/
node build.mjs --preview   # links point at index.html, so you can open files directly
cd dist && python3 -m http.server 8000   # view at http://localhost:8000
```

Fonts: Anybody and Atkinson Hyperlegible Next/Mono, self-hosted under the SIL Open Font License.
