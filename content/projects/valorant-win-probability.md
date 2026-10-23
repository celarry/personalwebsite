---
title: Valorant live win probability
featured: true
order: 1
demo: valorant
dates: Apr 2026 – present
started: 2026-04
status: In progress
team: Solo
stack: Python, OpenCV, EasyOCR, XGBoost, LightGBM, River, Docker, Nginx, PostgreSQL
summary: >-
  A real-time model that estimates who wins the current round of a professional
  Valorant match. Valorant has no public game-state feed, so the pipeline reads
  the state straight off the broadcast.
points:
  - Samples VCT broadcast footage, reads the scores, timer, spike and player panels from the HUD, and splits matches into rounds automatically.
  - Builds features for economy, player advantage, ultimate availability, map state and spike status.
  - Trains gradient-boosted trees on professional matches, targeting 75%+ accuracy.
  - Serves predictions from a Docker container through REST endpoints behind Nginx.
repo: https://github.com/rockminelaw/ValorantWinCalculator
live: ''
diagram_title: How a broadcast becomes a prediction
diagram:
  - label: VOD
    note: Full match footage
    detail: Matches come from the official VCT YouTube playlist, downloaded with yt-dlp. A command lists the playlist or downloads a set number of matches.
  - label: Frame sampler
    note: 2 frames per second
    detail: Two frames a second is enough to catch every change to the scores, timer and spike without processing the whole video.
  - label: Gameplay filter
    note: Drops player cams and B-roll
    detail: Broadcasts cut to player cams, the stage and title cards. A detector measures edge density where the HUD should be, then takes a majority vote over the last three frames so a single odd frame doesn't flip it.
  - label: HUD reader
    note: OCR on scores, timer, spike
    detail: Regions of interest are calibrated for the VCT Masters London 1080p broadcast. OCR reads both scores, the round timer and the spike indicator, and template matching reads the player panels.
  - label: Round segmenter
    note: A four-state machine
    detail: Match start, pre-round, active, post-round. A round starts when the timer resets to the buy phase (95 seconds or more) and ends when a score ticks up or the post-round screen appears. Rounds shorter than 15 seconds, or gaps under 20, are treated as OCR noise.
  - label: Snapshots
    note: One row per second
    detail: During each active round the pipeline saves a snapshot every second, with time remaining, players alive, spike state, loadout values and ultimates ready, to a Parquet file. The label (did attackers win?) is added when the round ends.
  - label: Model
    note: Gradient-boosted trees
    detail: An offline model trained with group k-fold by match, so snapshots from one match never appear in both training and test data. An online learner can also predict first and learn from each round only after it ends.
  - label: Prediction
    note: P(attackers win)
    detail: A calibrated probability for every snapshot, served from a Docker container through REST endpoints behind Nginx.
log:
  - date: 2026-04
    text: Started the project.
  - date: 2026-07
    text: Calibrated HUD regions for the VCT Masters London 1080p broadcast and added filtering for player-cam segments.
---
## The problem

Counter-Strike has an official game-state feed that tells you exactly what's happening mid-round. Valorant doesn't, and Riot's API only reports results after a match. So to know the state of a round second by second, the pipeline has to read it off the broadcast, the same way a viewer does.

## How it works

The diagram above walks through each stage. The short version: sample the footage, throw away anything that isn't gameplay, read the HUD, cut the match into rounds, record the game state once a second, and train a model to turn that state into a probability.

## Decisions worth explaining

- **Splitting by match, not by row.** Snapshots from the same match are closely related, so a random split would leak information and make the model look better than it is. Cross-validation folds are grouped by match.
- **Calibrated probabilities.** If the model says 70%, attackers should win about 70% of those rounds. I evaluate with Brier score and calibration plots as well as accuracy.
- **Predict, then learn.** The online learner never sees a round's outcome before predicting it. The pipeline only releases the label when the round is finalised.
- **Broadcast HUD first.** Spectator broadcasts have a consistent layout. Personal streams all look different and are much harder to read.

## Where it's at

Round detection is the current phase: calibrating HUD regions and checking the round count against known scorelines, aiming for more than 95% correct. Next comes richer state: which players are alive from their portraits, health and armour, weapons from the kill feed, and ultimate readiness. Similar Counter-Strike models reach 85–90% accuracy with the full game state. At this level of detail I'm expecting 75–80%.
