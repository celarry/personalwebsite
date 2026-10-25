---
title: MEGA stream overlays
featured: false
order: 7
demo: none
dates: 2026
started: 2026-09
status: ''
team: ''
stack: HTML, CSS, JavaScript, Go, Tcl/Tk, OBS
summary: >-
  Twelve OBS overlay scenes and a scoreboard app for MEGA's fighting-game
  weeklies, built on GORTS so the next production manager can run a stream
  without touching code.
points: []
repo: https://github.com/rockminelaw/mega-gorts
live: ''
diagram_title: From scoreboard to stream
diagram:
  - label: Scoreboard
    note: Tcl/Tk app
    detail: Where the production manager types player names, scores, casters, hold-screen text, colours and layout during the night.
  - label: JSON files
    note: state, event, layout, timer
    detail: The scoreboard writes four JSON files. Player names and scores only change when you press Apply, so a typo doesn't hit the stream. Event, layout and timer changes are live straight away.
  - label: gorts.exe
    note: Local server on port 7331
    detail: A small local web server. It uses port 7331 instead of GORTS's usual 1337, because Razer's Chroma SDK already takes 1337 on a lot of Windows machines.
  - label: Overlay pages
    note: Twelve scenes
    detail: Nametags, casters, timer, hold, match intro, versus, up next, queue, winner, instant replay, top 8 and a lower third. Each polls the JSON files and redraws on a fixed 1920×1080 stage.
  - label: OBS
    note: Browser sources
    detail: Each scene is an OBS browser source at 1920×1080. Transparent overlays sit above the game capture or the replay footage.
gallery_title: The scenes
gallery:
  - image: /uploads/projects/mega/hold.webp
    thumb: /uploads/projects/mega/hold-small.webp
    caption: Starting soon, with the break timer. The same scene does BRB, tech pause and thanks for watching.
  - image: /uploads/projects/mega/casters.webp
    thumb: /uploads/projects/mega/casters-small.webp
    caption: Casters. Boxes for the main cam and two player cams, with the casters' names.
  - image: /uploads/projects/mega/versus.webp
    thumb: /uploads/projects/mega/versus-small.webp
    caption: Versus. Both players, their characters and the score.
  - image: /uploads/projects/mega/replay.webp
    thumb: /uploads/projects/mega/replay-small.webp
    caption: Instant replay. Bars above and below the replay footage in OBS.
log:
  - date: 2026-09
    text: Twelve overlay scenes, plus Event and Layout tabs with presets so weekly changes need no code.
---
## What it is

The graphics pack for MEGA's fighting-game weekly streams. You run one app, keep it open during the night, and point OBS at the pages it serves.

## Built for the next person

I wanted whoever runs the stream after me to be able to change the game of the week, colours, casters and on-screen text without opening any HTML. The Event tab covers all of that, and presets save a whole night's setup or a per-game layout to load next week. A start.gg integration can fetch a tournament's players so names autocomplete.

## Small decisions

- **Apply before it goes live.** Names and scores turn green when they've changed but haven't been applied, so mistakes stay off stream.
- **Port 7331.** GORTS normally uses 1337, which clashes with Razer's Chroma SDK on many Windows PCs.
- **Fixed 16:9 stage.** Every page is laid out at 1920×1080 and scaled to fit, so positions are the same in OBS as they are in the editor.

Built on [GORTS](https://github.com/nhanb/gorts), which is open source under the GPL-3.
