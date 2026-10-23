---
title: This website
featured: false
order: 8
demo: none
dates: Oct 2026 – present
started: 2026-10
status: Running
team: ''
stack: HTML, CSS, JavaScript, Node.js, GitHub Actions, Pages CMS
summary: >-
  The site you're on. No framework: a small Node build script, a corner store
  where a cart plans routes with A*, a command palette, and a blog I write in a
  web editor.
points: []
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
---
## How it's built

See the [colophon](/colophon/) for the details: the build, the type, the store on the homepage and the keyboard shortcuts.
