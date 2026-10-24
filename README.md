# Lawrence Qi — personal website

My personal website: a homepage with interactive project demos, and a blog I can update from a web editor.

- **Homepage:** a small store where a cart plans routes with A* (or Dijkstra, or greedy search), then a list of projects that open into working demos: a Valorant win-probability model, a homelab diagram and an email-approval mock.
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

- **Projects:** each project has a summary, highlights, an optional diagram (a list of steps) and a **History** list of dated milestones. Add a milestone whenever something ships; it appears on the project page and in the combined history on the projects page. Every project is listed on the homepage; the first sentence of the summary is the short description, unless you fill in **Short description**.
- **Now page:** what you're up to. Change **Last updated** when you edit it.
- **Off the clock** (in Profile): the casual section on the homepage, one row per thing (Games, Music, Reading and so on). Links work: `[text](https://example.com)`. A row opens to show more when it has any of: **More to say**, **Related projects**, **Links** or a **Setup** (the numbered parts on the sax drawing). Name the opener with **Label for the part that opens**.
- **Reading notes** (in Profile, under Reading): fill in **My notes on it** and **How far in**; people see them when they tap a cover.
- **Countdown and checklist** (in Profile): **Countdown** is the place and date in the Now section; **Before I go** is the checklist under it. Tick items off as they happen.
- **Skills:** each skill on the homepage opens to the projects and jobs that mention it, worked out when the site builds. Mention a skill in a project's stack, highlights or write-up and it shows up there.
- **Profile:** name, headline, intro, the one-line "Now" on the homepage, contact links, resume PDF, skills and experience. The resume page is built from this too.
- **Moving to Singapore:** in Profile, change **Location** and set **Time zone** to `Asia/Singapore` so the clocks are right.

## Live games, music and book covers

Off the clock can show what I'm playing on Steam and listening to on Spotify (through Last.fm). No server is needed.

**Music (Spotify through Last.fm).** Last.fm's API is made to be read from a browser, so the page asks it directly.

1. Make a Last.fm account. On last.fm, go to **Settings → Applications** and connect **Spotify scrobbling**.
2. Create an API account at [last.fm/api/account/create](https://www.last.fm/api/account/create). Any name and description work; leave the callback empty. Copy the **API key** (not the shared secret).
3. In Pages CMS, open **Profile** and fill in **Last.fm username** and **Last.fm API key**.

**Steam.** The Steam key has to stay secret, so a GitHub Action (`.github/workflows/steam.yml`) asks Steam every ten minutes and publishes the answer to the `live` branch, which the page reads. It's free because the repository is public.

1. Get a Web API key at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) (use `lawrenceqi.com` as the domain). In Steam, go to **Profile → Edit Profile → Privacy Settings** and set **My profile** and **Game details** to **Public**.
2. Find your 17-digit Steam ID: it's in your profile's address, or use any SteamID lookup.
3. On GitHub, open the repository's **Settings → Secrets and variables → Actions**. Under **Secrets**, add `STEAM_KEY` with the key. Under **Variables**, add `STEAM_ID` with the ID.
4. Under **Actions → Steam**, press **Run workflow** once. When it's green, `https://raw.githubusercontent.com/rockminelaw/personalwebsite/live/steam.json` shows your games.
5. In Pages CMS, open **Profile** and turn on **Show Steam games**.

GitHub runs scheduled jobs a few minutes late sometimes, so "playing right now" can lag by up to about a quarter of an hour. GitHub also pauses scheduled jobs if the repository has had no commits for 60 days; saving anything in Pages CMS keeps it going.

To turn either off, clear the Last.fm fields or turn off **Show Steam games**. The text you've written for each row still shows either way. (`worker/now.js` is a Cloudflare Worker that can do both instead, if you'd rather use one: put its address in **Live data address**.)

**Reading** shows covers for the books and manga in Profile → Reading. Upload a cover, or leave it empty: when the site builds it looks one up (AniList for manga, Open Library for books, using the ISBN if you add one). If nothing's found, the title is shown as a plain cover.

## Things people can find

- **The store:** it keeps Melbourne hours. From 10 pm to 7 am the lights dim, a Closed sign goes up and the cart sleeps by the checkout until someone wakes it. Visitors can give it something from the list below it (tap, or drag onto the floor); it fetches it, takes it to the checkout and prints a receipt. The switch under it changes the search between A*, Dijkstra and greedy, and the line next to it reports how many squares each one checked. It decorates itself for Lunar New Year, Easter, Mid-Autumn, Halloween and Christmas. Add `#open`, `#closed`, `#lunar`, `#easter`, `#midautumn`, `#halloween` or `#christmas` to the address to preview each.
- **A hundred stores:** the first visit gets the original store; every visit or refresh after that gets one you haven't seen. They're all in `public/assets/js/stores.js`. `/stores/` shows the ones you've found (the browser remembers), and `#store-37` on the homepage opens a particular one.
- **Projects that open:** each project on the homepage opens in place; the featured ones open into their demo. Each has its own address, like `/#valorant-win-probability`.
- **Experience rows that open:** each job opens to its bullet points and related projects.
- **Contact:** a short text thread that asks for a name and a message, then lets the visitor send it with Gmail, Outlook, their email app, or copy it. Nothing is sent or stored by the site.
- **Email links:** every email link opens a small menu (Gmail, Outlook, email app, copy the address), so people without an email app set up don't hit a system error.
- **Command palette:** press ⌘K (Ctrl K on Windows) or `/`. On phones it's the **Menu** button. It searches projects and posts, and has a few commands: copy email, local time, say hello in four languages, a random post, switch the cart's search, turn the store's lights off, decorate it for a festival.
- **Project pages:** diagrams you can step through, the Valorant HUD reader, the store on the shopping cart's page, and each project's history.
- **Blog filters:** `/blog/#life` links straight to the Life posts.
- **Colophon:** `/colophon/` explains how the site works, with real build numbers.
- **Section links:** hover over a heading in a post or write-up for a link to it.
- **Developer tools:** open the console for a hello. The cart is `window.floorDemo`.

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

Fonts: Newsreader and Atkinson Hyperlegible Next and Mono, self-hosted as WOFF2 under the SIL Open Font License. They're subset to Latin, and Atkinson Hyperlegible Next has a plain zero in place of its slashed one.
