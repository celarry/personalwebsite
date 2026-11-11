---
title: MEGA stream overlays
featured: false
order: 2
demo: none
dates: Sep 2026
started: 2026-09
status: ''
team: ''
stack: HTML, CSS, JavaScript, Go, Tcl/Tk, OBS, start.gg API
summary: >-
  Twelve OBS overlay scenes and a scoreboard app for MEGA's fighting-game
  weeklies, built on GORTS so the next production manager can run a stream
  without touching code.
points:
  - Built twelve 1920×1080 overlay scenes, from gameplay nametags to a top 8 graphic, that all redraw live from one scoreboard app.
  - Added Event and Layout tabs to the scoreboard, with presets, so a weekly's game, colours, casters, text and positions change without opening any HTML.
  - Wrote a handover guide covering every scene, every field and how to run a night from start to finish.
repo: https://github.com/rockminelaw/mega-gorts
live: ''
diagram_title: From scoreboard to stream
diagram:
  - label: Scoreboard
    note: Tcl/Tk app
    detail: Where the production manager types player names, scores, casters, hold-screen text, colours and layout during the night, across five tabs (Main, Timer, Event, Layout and start.gg).
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
gallery_note: Player names here are placeholders.
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

The graphics pack for MEGA's fighting-game weekly streams, whichever game is on that week: Tekken, Guilty Gear Strive, 2XKO and so on. You run one app, keep it open during the night, and point OBS at the pages it serves. Everything on stream, from the nametags over gameplay to the "starting soon" screen, updates from that one window.

It's built on [GORTS](https://github.com/nhanb/gorts), an open-source scoreboard for fighting-game streams, licensed under the GPL-3. GORTS gave me the small Go web server and the Tcl/Tk scoreboard window. MEGA's twelve scenes, the theme, and the Event and Layout tools are mine.

## Built for the next person

Whoever runs the stream after me shouldn't have to edit HTML before a weekly. So the rule was that a normal week should need no code at all. The game of the week, the colours, the casters, the hold-screen wording, the queue and the positions of everything on screen are all fields in the scoreboard. Presets save a whole night's setup, or a layout per game, to load next week.

The README is written as a handover guide: first run, every OBS scene and its address, every tab and field, a checklist for running a night, and how to add a new scene.

## How it fits together

There are three pieces:

| Piece | What it does |
|---|---|
| `gorts.exe` | A tiny local web server, plus the scoreboard app |
| The scoreboard window | What you type into during the night |
| The pages in `web/` | The graphics OBS shows |

When you change something, the scoreboard writes it to one of four JSON files, and every overlay page polls those files and redraws:

| File | Written by | Holds | Pages check it every |
|---|---|---|---|
| `state.json` | Main tab, when you press Apply | Player names, scores, countries, teams, title | 1.5 s |
| `event.json` | Event tab, live | Game, phase, first-to, casters, queue, hold text, colours, top 8, lower third | 0.4 s |
| `layout.json` | Layout tab, live | Positions, scale, what's shown or hidden | 0.25 s |
| `timer.json` | Timer tab | The break countdown | |

Polling plain files sounds crude, but it means there's no build step, no framework and nothing to install: each scene is a single HTML page that OBS can show with nothing else installed.

## The twelve scenes

| Scene | Background | When it's used |
|---|---|---|
| Gameplay nametags | Transparent | Over the game during a match |
| Casters | MEGA background | The commentary desk, with boxes for webcams |
| Timer | MEGA background | A standalone countdown |
| Hold | MEGA background | Starting soon, BRB, tech pause, thanks for watching |
| Match intro | MEGA background | "Now on stream", before a set |
| Versus | MEGA background | Names, characters and the current score |
| Up next | MEGA background | The next set |
| Queue | MEGA background | The next three matches |
| Winner | MEGA background | After a set |
| Instant replay | Transparent bars | Over replay footage in OBS |
| Top 8 | MEGA background | Who's left |
| Lower third | Transparent | A thin bar over gameplay or a cam |

Every scene is laid out on a fixed 1920×1080 stage and scaled to fit the browser, so a position in the Layout tab is the same position in OBS. The casters scene draws empty 16:9 boxes (a 1344×756 main cam and two 480×270 player cams by default), and the webcams go on top of them in OBS. Instant replay only draws a bar at the top and the bottom, so the replay shows through the middle.

## The scoreboard's tabs

- **Main.** The current match: title, subtitle, both players' names, countries (as flags from a two-letter code), teams and scores. **Win** adds a point, and there are buttons to reset scores and swap sides.
- **Timer.** Set a duration, start, pause, reset. The hold screen can show it too.
- **Event.** This week's event name, game, phase and first-to (with quick buttons for Pools, Top 8, Grands and FT2, FT3, FT5), the venue and hashtag, the casters, characters for the current match, the queue, the hold-screen headline, socials and Discord, the top 8, the lower third, the replay bar, three theme colours, and switches to hide flags, scores, phase or characters. **Push event → title / subtitle** fills in the main tab from these.
- **Layout.** Positions and scale for the nametags, title, logo and the three caster cams, with presets per game, because Tekken's health bars sit somewhere different from Strive's.
- **start.gg.** Paste a token and a tournament's slug, press Fetch, and the players come back as a CSV, so their names autocomplete on Main.

## Small decisions

- **Apply before it goes live.** Names and scores turn green when they've changed but haven't been applied, and **Discard** undoes them, so mistakes stay off stream. Changes on the Event and Layout tabs go live straight away, since they're mostly set up before the night starts.
- **The queue moves itself.** **Next → current match** puts the next set's players on Main and zeroes the scores. **Shift whole queue** does that and moves everything else up one.
- **Winner from scores** fills in the winner graphic from the score, so there's one less thing to type.
- **Port 7331.** GORTS normally uses 1337, which clashes with Razer's Chroma SDK on many Windows PCs. One copy only, or the second can't get the port.
- **Cache-busting.** OBS's browser sources hold on to old files. Every page loads its styles and scripts with a version number in the address, so a new logo or style turns up after one refresh.

## Adding a scene

A new scene is a copied HTML page. Keep the `#stage` element and the scaling script, give elements the ids the JSON files already use (`p1name`, `caster1`, `holdHeadline` and so on), include the matching script, and it updates live like the others. The README has a full worked example.
