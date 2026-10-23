---
title: How this site works
summary: The build, the fonts, the shop floor at the top of the homepage, and the shortcuts.
---
## The build

There's no framework. A single Node script, `build.mjs`, reads Markdown and YAML from the `content` folder and writes plain HTML. The two libraries it needs, one for Markdown and one for YAML, are copied into the repository, so there's nothing to install. The numbers above come from the most recent build.

Every commit to the main branch triggers a GitHub Actions workflow that runs the build and publishes the result to GitHub Pages.

## Writing

I write posts and update projects in [Pages CMS](https://pagescms.org), a web editor that saves straight to the GitHub repository. Each save is a commit, so the site rebuilds itself about a minute later.

## The shop floor

The header on the homepage is a grid of 22-pixel cells (18 on phones). When the page loads, a script measures every line of text and every button in the header and marks those cells as blocked, then places shelves in the space that's left.

The cart plans with A-star: eight directions of movement, an octile-distance heuristic, and no cutting corners around shelves. Filled squares are cells the search expanded. Outlined squares are cells still waiting in the open set when it found the goal. The shopper wanders on their own route, and if they step onto one of the next few cells of the cart's path, the cart plans again.

If your device asks for reduced motion, nothing animates: the search and route are drawn once, and clicking moves the cart straight to its destination.

## Type and colour

Headings are set in [Anybody](https://fonts.google.com/specimen/Anybody), stretched to its widest. Body text is [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/), designed by the Braille Institute for legibility, and numbers in the demos use its mono companion. All three are self-hosted.

The colours come from a shop floor: pale floor vinyl, navy ink and a blue for routes.

## Privacy

No analytics, no cookies and no trackers. The only thing stored in your browser is your light or dark theme choice, if you change it.
