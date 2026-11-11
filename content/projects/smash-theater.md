---
title: Smash Theater
featured: false
order: 1
demo: none
dates: Sep 2026 – present
started: 2026-09
status: Running
team: ''
stack: React, TypeScript, Vite, YouTube Data API, start.gg API, GitHub Actions, Vercel
summary: >-
  A searchable archive of more than 41,000 Super Smash Bros. Ultimate tournament
  VODs from nine YouTube channels. Daily GitHub Actions scrape new uploads,
  parse players and characters from the titles, and fill in scores from
  start.gg.
points:
  - Scraped nine tournament channels in the US and Japan into one archive of 41,397 sets and 57,398 games, covering 13,000 player tags from 2018 to now.
  - Wrote a title parser for English and Japanese VOD titles that finds players, characters (with their nicknames), rounds, events and game modes, and skips anything that isn't Ultimate.
  - Matched VODs to their sets on start.gg to fill in scores and stages, with a resumable backfill that runs on GitHub Actions every four hours.
  - Let visitors suggest VODs through a GitHub issue form that only reaches the archive once I approve it with a label.
repo: https://github.com/rockminelaw/smash-theater
live: ''
diagram_title: How a VOD gets into the archive
diagram:
  - label: YouTube channels
    note: Nine of them
    detail: VGBootCamp, Beyond the Summit - Smash, 2GGaming, ClubSmashTV, CLASH Tournaments and its VoDs channel, JMLeague, まえだくん (Maesuma) and Tamisuma.jp. Each channel is tagged with its region.
  - label: Scraper
    note: Resumes after quota runs out
    detail: A command-line scraper uses the YouTube Data API. The first pass covers tens of thousands of uploads and takes hours, so it saves progress and picks up the next day when the daily API quota runs out. The daily run only looks at the last three days.
  - label: Title parser
    note: Players, characters, round, event
    detail: Works out the players, characters, round and tournament from each video title, in English or Japanese, including common character nicknames. Anything outside the official Ultimate roster, and anything from another game, is skipped.
  - label: start.gg
    note: Scores and stages
    detail: Each VOD is matched to its tournament and set on start.gg, using the event's real slug and allowing for tags spelled differently (Sparg0 and Spargo). A match fills in the set score, and the stages and characters of each game when they were reported.
  - label: archive.json
    note: 41,397 VODs
    detail: One static file with every set's players, characters, games, event, date and YouTube link. No videos are downloaded, and visitors don't need an API key.
  - label: Website
    note: Filter and browse
    detail: Filter by player, character, stage or tournament, switch between singles, doubles, squad strike and crews, and open a set for the game-by-game breakdown. A stats page ranks characters, players and matchups.
log:
  - date: 2026-09
    text: Archive passed 46,000 VODs. A GitHub Action now checks for new uploads every day at 06:00 UTC.
  - date: 2026-09
    text: Visitors can suggest VODs into a review queue. Set scores now come from start.gg, through a backfill that runs every four hours.
  - date: 2026-09
    text: Renamed Smash Vault. Added JMLeague, tabs for doubles, squad strike and crews, a stats page, and dropped VODs from before Ultimate, which brought the archive to about 41,000 cleaner sets.
---
## What it is

A searchable archive of Super Smash Bros. Ultimate tournament VODs, modelled on [Replay Theater](https://replaytheater.app/). Filter by player, character, stage or tournament, and open a set to see each game's characters and stages. It's since been renamed **Smash Vault**.

Tournament footage for Ultimate is spread across many YouTube channels, each with its own way of writing titles, and YouTube's own search can't tell you "every set where this player used this character". The archive pulls them into one place you can filter.

As of November 2026 it holds **41,397 sets** and **57,398 games** from nine channels, covering about 13,000 player tags, from the first events after Ultimate came out in December 2018 up to this week.

| Channel | Sets |
|---|---|
| VGBootCamp | 12,136 |
| Tamisuma.jp | 7,679 |
| ClubSmashTV | 6,841 |
| まえだくん (Maesuma) | 5,857 |
| 2GGaming | 5,181 |
| JMLeague | 2,258 |
| CLASH Tournaments (both channels) | 968 |
| Beyond the Summit - Smash | 477 |

## Getting the VODs

- **The YouTube Data API.** A command-line scraper lists every upload on each channel. The API has a daily quota, and the first full pass covers tens of thousands of videos, so the scraper saves its progress and carries on the next day when the quota runs out.
- **Staying up to date.** A GitHub Action runs every day at 06:00 UTC. It only looks at the last three days of uploads, stops as soon as it reaches a video that's already archived, and commits anything new to the repository. The site rebuilds from that commit.
- **One file.** Everything ends up in one static `archive.json`: titles, players, characters, games, events, dates and YouTube links. No video is downloaded, nothing runs on a server, and visitors don't need an API key.

## Reading the titles

The hard part is the titles. The same set might be called "Sparg0 (Cloud) vs Shuton (Pyra/Mythra) - Riptide 2024 Grand Final" on one channel and something entirely different, in Japanese, on another. The parser:

- **Finds the two sides** around "vs", "versus" or 対, and peels the round off them, from "Winners Quarters" and "WQF" to 準決勝 and 3位決定戦.
- **Finds the characters**, including nicknames and every common spelling: Pyra/Mythra, Banjo & Kazooie, Olimar (without eating the player Kendrick Olimar's name).
- **Cleans player tags.** It strips team prefixes, Japanese readings in brackets and channel prefixes like Maesuma's, and puts tournament names that leaked into a tag (like "Momocon") back on the event.
- **Works out the mode.** Doubles, squad strike and crew battles each get their own tab instead of cluttering singles. A tag like `+HOPE+` stays one name rather than being split into a team.
- **Keeps the archive clean.** Only the official Ultimate roster is stored. VODs from Melee, Brawl, Smash 4, Rivals of Aether, Street Fighter, Tekken and other games that share these channels are skipped, as are workshop and modded characters and names the parser doesn't recognise. A scrub script removes any that slip through, and a "Random" pick is kept as its own character rather than dropped.

## Scores and stages from start.gg

Most VOD titles don't say the score, but start.gg, where the tournaments are run, usually knows it. So a second step matches each VOD to its set on start.gg:

- **Find the event.** Tournament names on YouTube are fuzzy. The matcher looks events up by their real start.gg slug, allows for different casing, apostrophes and numbered slugs (GOML, LMBM), and doesn't attach a VOD to an event that merely has a similar name.
- **Find the set.** Within an event, it matches the round and the two players, allowing for tags that are spelled differently on YouTube and start.gg, like Sparg0 and Spargo.
- **Fill it in.** A match brings the set score, and the stages and characters for each game when they were reported. When start.gg's characters disagree with the YouTube title, the title wins, because that's what the video shows.
- **Run it in batches.** Thousands of tournaments take far longer than one GitHub Actions job is allowed to run, so the backfill is resumable. It runs every four hours, works for about five hours, commits its progress and state, and the next run carries on from there.

So far 8,823 sets are linked to start.gg, and 7,080 have a set score.

## Suggesting a VOD

Visitors can tip a set that's missing. The Suggest page opens a GitHub issue form with the YouTube link, and optionally the players and the start.gg tournament page (one link can fill in scores for every VOD from that event). The tip stays in a review queue. When I label the issue `approved`, a workflow adds it to the archive and commits it; `rejected` closes it.

## The site

A React and TypeScript app built with Vite and hosted on Vercel. Search narrows by player, character, stage, tournament and date, with suggestions that put exact player names first, and sets stay in date order. Each card shows the date, round, channel and tournament around the matchup, and opens to the game-by-game breakdown.

The stats page counts every VOD and can be drilled into: the most-played characters on a podium with a ranked chart, who mains a character when you open it, and matchups, players and years. Routes are hash-based, so it works on any static host, and anyone can host their own copy.

## What I'd still like to fix

- **Stages are rare.** Only about 3,300 games have a stage, because stages only come from start.gg sets where someone reported them.
- **start.gg coverage is partial.** Plenty of events aren't on start.gg, or can't be matched to it with confidence, so many sets will never get a score from there.
- **Titles keep surprising me.** Every new channel brings new ways of writing names, and most fixes so far have been one more alias or one more pattern.
