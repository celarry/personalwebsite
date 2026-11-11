---
title: How this site works
summary: The build, the type, the live Wikipedia demo on the homepage and the little store on the shopping cart page.
---
## The build

There's no framework. A single Node script, `build.mjs`, reads Markdown and YAML from the `content` folder and writes plain HTML. The two libraries it needs, one for Markdown and one for YAML, are copied into the repository, so there's nothing to install. The numbers above come from the most recent build.

Every commit to the main branch triggers a GitHub Actions workflow that runs the build and publishes the result to GitHub Pages.

## Writing

I write posts and update projects in [Pages CMS](https://pagescms.org), a web editor that saves straight to the GitHub repository. Each save is a commit, so the site rebuilds itself about a minute later.

## The live Wikipedia demo

The homepage opens with [Wikipedia live edits](/projects/wikipedia-live-edits/). Nothing loads until you press Start. Then your browser downloads the model (BERT-mini, 11 MB at 8-bit, about 8 MB compressed) and ONNX Runtime Web, which runs it on WebAssembly on one thread. Both are stored with the site, so the only outside connections are to Wikimedia. The page reads Wikimedia's public stream of changes, keeps English Wikipedia article edits by accounts without the bot flag, and every 20 seconds picks up to three of them at random and asks Wikipedia for their diffs. A WordPiece tokeniser and the code that turns an edit into the model's input text are rewritten in JavaScript, and they match the Python versions used in training exactly. It pauses when the tab is in the background and after 15 minutes.

## The store

The store on the [shopping cart's page](/projects/autonomous-shopping-cart/) is a grid of 22-pixel squares (18 on phones), with numbered aisles at the back, a fruit stand, and a checkout where the cart parks. The cart plans each trip with A-star: eight directions of movement, an octile-distance heuristic, and no cutting corners around shelves. Filled squares are the ones the search expanded, revealed in the order it expanded them. Outlined squares were still waiting in the open set when it reached the goal.

The switch under the store changes the search. Dijkstra is A-star without the guess at the distance left, so it spreads out evenly in every direction. Greedy search uses nothing but the guess, so it checks very few squares but can take the long way round. Same floor, same trip, different numbers.

A shopper wanders the aisles on their own route. If they step onto one of the next few squares of the cart's path, the cart plans again. Give the cart something from the list and it fetches it, takes it to the checkout and prints a receipt, including how far it walked.

The store keeps Melbourne hours. Between 10 pm and 7 am the lights go down and the cart sleeps by the checkout until someone wakes it. It also decorates itself for Lunar New Year, Easter, Mid-Autumn and Christmas, and for the week before Halloween.

There are a hundred stores. Your first visit to that page gets the original, and each visit after that gets one you haven't seen: a night market, a hawker centre, a server room, two mazes, a store that spells something, a sleeping cat. [All the stores](/stores/) keeps track of the ones you've found.

If your device asks for reduced motion, nothing animates: each search and route is drawn once, and the cart moves straight to where it's going.

## Type and colour

Headings and long-form writing are set in [Newsreader](https://fonts.google.com/specimen/Newsreader), a serif made for reading on screens. Everything else is [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/), designed by the Braille Institute for legibility, with one change: I redrew its slashed zero as a plain one, so dates don't read like code. The receipt uses its mono companion. All of them are self-hosted.

The colours come from a shop floor: pale floor vinyl, navy ink and one blue for routes.

## Privacy

No analytics, no cookies and no trackers. The only things stored in your browser are your light or dark theme choice, if you change it, and the numbers of the stores you've visited. Neither leaves your browser. The contact form doesn't send anything by itself: it writes the email, and your own email app sends it.

The games and music under Off the clock come from a small Cloudflare Worker of mine that asks Steam and Last.fm what I've been playing and listening to. Your browser only talks to that worker, so Steam and Last.fm never see you, and it keeps nothing about visitors. Book covers are stored with the site.

The live Wikipedia edits demo connects to Wikimedia, but only once you open it. Your browser then reads Wikimedia's public stream of changes and asks Wikipedia's API for a few diffs a minute, so Wikimedia sees those requests the way it sees any visit to Wikipedia. They're sent without cookies. The model, and the code that runs it, are stored with the site.
