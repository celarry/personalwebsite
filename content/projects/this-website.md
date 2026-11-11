---
title: This website
featured: false
order: 2
demo: none
dates: Oct 2026 – present
started: 2026-10
status: Running
team: Solo
stack: HTML, CSS, JavaScript, Node.js, GitHub Actions, GitHub Pages, Pages CMS, ONNX Runtime Web
summary: >-
  The site you're on. No framework: a small Node build script, a live
  Wikipedia demo that runs a model in your browser, a store where a cart plans
  routes with A*, a command palette, and a blog I write in a web editor.
blurb: No framework, a live model running in your browser, a command palette and a blog I write in a web editor.
points:
  - Wrote the whole build as one Node script with no dependencies to install. It turns Markdown and YAML into every page, the RSS feed, the sitemap and the search index.
  - Set up Pages CMS so posts, projects and profile details can be edited in a browser, with each save becoming a commit that rebuilds the site.
  - Built live games and music without a server, using Last.fm from the browser and a scheduled GitHub Action for Steam.
  - Runs an 11 MB machine-learning model on the homepage, in the visitor's browser.
repo: https://github.com/rockminelaw/personalwebsite
live: ''
diagram_title: From a saved post to a live page
diagram:
  - label: Pages CMS
    note: Write in the browser
    detail: Posts, projects and profile details are edited in Pages CMS, which saves them as Markdown and YAML files in the GitHub repo.
  - label: GitHub
    note: Every save is a commit
    detail: The whole site, content included, lives in one repository, so every change has a history.
  - label: Build
    note: One Node script
    detail: build.mjs turns the content into HTML with no dependencies to install. Markdown parsing and YAML are vendored in the repo.
  - label: GitHub Pages
    note: Live in about a minute
    detail: A GitHub Actions workflow builds and publishes the site on every commit to main.
log:
  - date: 2026-10
    text: Launched, with project pages, the command palette and the blog.
  - date: 2026-10
    text: Redesign with projects that open in place, a hundred stores for the cart, live Steam and Last.fm, skills that show where they were used, and charts of what I play and listen to.
  - date: 2026-11
    text: Added the live Wikipedia edits demo, then made it the first thing on the homepage.
---
## Why no framework

A personal site is mostly text, and I wanted to understand every line of what's sent to a visitor. So there's no framework and no bundler. The whole build is `build.mjs`, about 400 lines of Node, plus about a thousand lines of templates that write the HTML. The two libraries it needs, one for Markdown and one for YAML, are copied into the repository, so building the site is `node build.mjs` with nothing to install first.

The output is plain HTML, one stylesheet and a handful of small scripts. Every link is relative, so the site works at any address, from a folder on my laptop to the real domain.

## Writing without code

I write posts and update projects in [Pages CMS](https://pagescms.org), a web editor that saves straight to the GitHub repository. Its configuration lists every field: a post's title, date, tags and body; a project's dates, stack, highlights, diagram steps, history and pictures; and everything on the homepage, from the headline to the checklist under the countdown.

Each save is a commit. A GitHub Actions workflow builds the site and publishes it to GitHub Pages, and the change is live about a minute later.

## What the build does

- **Pages.** The homepage, a page per project and per post, the projects and blog indexes, the Now page, the resume, the colophon, the stores and the stats charts.
- **Writing helpers.** Headings in posts get their own links, wide tables scroll on their own on a phone, and images load lazily.
- **Skills with receipts.** Each skill on the homepage opens to the projects and jobs that mention it, with the sentence that does. The build works that out by searching every project's stack, highlights, diagram and write-up.
- **Book covers.** For each book or manga under Reading without an uploaded cover, the build looks one up (AniList for manga, Open Library for books, by ISBN when there is one) and stores it with the site.
- **Feeds and search.** An RSS feed with full posts, a sitemap, and a small JSON index that the command palette searches.
- **Its own numbers.** The colophon shows how many pages the last build made and how long it took, and every page's footer links to the commit it was built from.

## Things to find

- **The live Wikipedia demo** at the top of the homepage. Press Start and your browser downloads an 11 MB model and ONNX Runtime Web, reads Wikimedia's public stream of edits, and scores a few every 20 seconds on your device. More on the [project page](/projects/wikipedia-live-edits/).
- **The store** on the [shopping cart's page](/projects/autonomous-shopping-cart/): a cart that plans its routes with A-star, Dijkstra or greedy search, a hundred store layouts to find, opening hours and seasonal stock.
- **The command palette.** Press ⌘K, Ctrl K or `/`. It searches projects and posts and has a few commands: copy my email, my local time, say hello in four languages, a random post, and some for the cart.
- **Projects that open in place**, each with its own address like `/#valorant-win-probability`, and interactive diagrams on the project pages you can step through with the arrow keys.
- **Off the clock**, with what I've been playing on Steam and listening to on Spotify, the parts of my saxophone setup, and my notes on what I'm reading.
- **A contact form that doesn't send anything.** It's a short text thread that asks for your name and message, then lets you send it with Gmail, Outlook or your own email app, or copy it. Every email link on the site opens the same small menu, so nobody without an email app set up hits an error.

## Live data without a server

Off the clock shows what I'm playing and listening to, but the site is static files with no server of its own.

- **Music** comes from Last.fm, which has an API made to be called from a browser, so each visitor's browser asks it directly.
- **Steam** needs a secret key, which can't be in the page. So a GitHub Action runs every ten minutes, asks Steam and Last.fm, and publishes the result to a separate `live` branch that the page reads. It's free because the repository is public. It also keeps a running record that the [charts of my playing and listening](/stats/) are drawn from: hours per game per day, when I play, songs per day, top artists, and what I listen to while a game is open.

## Type, colour and care

- **Fonts.** Newsreader for headings and Atkinson Hyperlegible Next for everything else, self-hosted and cut down to Latin characters, so the six font files come to about 180 KB together.
- **Colour.** The palette comes from a shop floor: pale vinyl, navy ink and one blue for routes. There's a dark theme that follows your device, and a switch to override it.
- **Motion.** Sections fade in as they scroll into view, and if your device asks for reduced motion, nothing animates.
- **Privacy.** No analytics, no cookies and no trackers. The only things kept in your browser are your theme, if you change it, and which stores you've found.

The [colophon](/colophon/) has the rest: the build numbers, the store's rules and what the live demo connects to.
