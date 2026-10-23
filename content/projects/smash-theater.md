---
title: Smash Theater
featured: false
order: 6
demo: none
dates: 2026
started: 2026-09
status: ''
team: ''
stack: React, TypeScript, Vite, YouTube Data API, GitHub Actions
summary: >-
  A searchable archive of 46,000+ Super Smash Bros. Ultimate tournament VODs. A
  daily GitHub Action scrapes seven YouTube channels and parses players and
  characters from video titles.
points: []
repo: https://github.com/rockminelaw/smash-theater
live: ''
diagram_title: How a VOD gets into the archive
diagram:
  - label: YouTube channels
    note: Seven of them
    detail: VGBootCamp, Beyond the Summit - Smash, 2GGaming, ClubSmashTV, CLASH, まえだくん (Maesuma) and Tamisuma.jp.
  - label: Scraper
    note: Resumes after quota runs out
    detail: A command-line scraper uses the YouTube Data API. The first pass covers tens of thousands of uploads and takes hours, so it saves progress and picks up the next day when the daily API quota runs out.
  - label: Title parser
    note: Players and characters
    detail: Works out the players, characters and tournament from each video title, including common character nicknames. Anything outside the official Ultimate roster is skipped.
  - label: archive.json
    note: 46,433 VODs
    detail: One static file with titles and YouTube links. No videos are downloaded, and visitors don't need an API key.
  - label: Website
    note: Filter and browse
    detail: Filter by player, character, stage or tournament, and expand a set for the game-by-game breakdown. Hash-based routes mean it works on any static host.
log:
  - date: 2026-09
    text: Archive passed 46,000 VODs. A GitHub Action now checks for new uploads every day at 06:00 UTC.
---
## What it is

A searchable archive of Super Smash Bros. Ultimate tournament VODs, modelled on Replay Theater. Filter by player, character, stage or tournament, and open a set to see each game's characters and stages.

## Keeping it up to date

A GitHub Action runs every day at 06:00 UTC. It only looks at the last three days of uploads, stops as soon as it reaches a video that's already archived, and commits anything new.

## Keeping it clean

Only the official Ultimate roster is stored. VODs for other games, custom workshop characters or names the parser doesn't recognise are skipped, and a scrub script removes any that slip through.
