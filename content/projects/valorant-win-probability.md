---
title: Valorant live win probability
featured: true
order: 1
demo: valorant
dates: Apr 2026 – present
started: 2026-04
status: In progress
team: Solo
stack: Python, OpenCV, EasyOCR, yt-dlp, LightGBM, XGBoost, River, scikit-learn, Docker, Nginx, PostgreSQL
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
    detail: Matches come from the official VCT YouTube playlist, downloaded with yt-dlp at up to 1080p. One command lists the playlist without downloading; another downloads a set number of matches and saves a manifest of what it fetched.
  - label: Frame sampler
    note: 2 frames per second
    detail: Two frames a second is enough to catch every change to the scores, timer and spike without decoding every frame. The sampler works out the step from the video's own frame rate, so a 60 fps VOD and a 30 fps one give the same timestamps.
  - label: Gameplay filter
    note: Drops player cams and B-roll
    detail: Broadcasts cut to player cams, the stage and title cards. A detector measures edge density where the HUD should be (the side panels, the bottom player bar and the top score bar), then takes a majority vote over the last three frames so a single odd frame doesn't flip it.
  - label: HUD reader
    note: OCR on scores, timer, spike
    detail: Regions of interest are calibrated for the VCT Masters London 1080p broadcast. Each crop is thresholded and read with EasyOCR. The timer parser copes with OCR dropping the colon, so "125" still reads as 1:25. A planted spike shows up as a bright, saturated indicator.
  - label: Round segmenter
    note: A four-state machine
    detail: Match start, pre-round, active, post-round. A round starts when the timer resets to the buy phase (95 seconds or more) and ends when a score ticks up or the post-round screen appears. Rounds shorter than 15 seconds, or gaps under 20, are treated as OCR noise.
  - label: Snapshots
    note: One row per second
    detail: During each active round the pipeline saves a snapshot every second, with 25 features covering time, players alive, health and armour, credits and loadout value, ultimates ready, spike state and the score, to a Parquet file. The label (did attackers win?) is added when the round ends.
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
    text: Calibrated HUD regions for the VCT Masters London 1080p broadcast, added the player-panel reader and filtering for player-cam segments. First full series processed end to end.
---
## The problem

Counter-Strike has an official game-state feed that tells you exactly what's happening mid-round: who's alive, their health, what they're holding, whether the bomb is down. That's why there are good live win-probability models for it. Valorant doesn't have one. Riot's API reports results after a match, round by round, but nothing about the middle of a round.

So to know the state of a round second by second, the pipeline has to read it off the broadcast, the same way a viewer does. That turns a modelling project into mostly a computer-vision project, at least to begin with.

## Getting the footage

The official VCT YouTube playlist has every match of the season. A small command wraps yt-dlp: it lists the playlist with durations, or downloads the first few matches (or asks how many) at up to 1080p, and writes a manifest so I know which video is which match.

## Reading the HUD

Everything starts with one calibration file for one broadcast: VCT Masters London at 1920×1080. It lists the pixel rectangles where each piece of information sits:

- **The score bar** at the top: the left score (the defenders' side of the panels), the right score, the round timer, and the spike indicator and spike timer underneath.
- **Ten player panels**, five down each side, each 270 by 87 pixels. Within each panel: the health bar, the health and armour numbers, the agent portrait, the ultimate, the ability charges, the weapon and the credits.
- **The bottom player bar**, which some parts of the broadcast use instead of the side panels.

Each crop is converted to greyscale, thresholded so the white text stands out from whatever is behind it, and read with EasyOCR. OCR is messy in predictable ways. It often drops the colon from the timer, so "125" is taken to mean 1:25 and "1005" to mean 10:05. A score that can't be read comes back as zero, and the segmenter never counts a 0–0 reading as a change of score.

You can click the boxes on the HUD crop above to see what the reader pulls out of each one.

## Throwing away what isn't gameplay

A broadcast isn't all gameplay. It cuts to player cams, the casters' desk, replays, the crowd and title cards, and OCR on those produces nonsense scores that break round detection.

The filter measures how many edges there are where the HUD should be. Gameplay has a dense, busy HUD in the side panels, or in the bottom bar plus the top bar; a face cam doesn't. Masters London uses both HUD layouts, so either one counts. Then it takes a vote over the last three sampled frames, and needs two of them to agree, so a single flash of the stage doesn't flip it. On a five-minute test clip it skipped 95 non-gameplay frames and kept the three rounds in it intact.

## Cutting a match into rounds

The round segmenter is a small state machine with four states: match start, pre-round, active and post-round.

1. **A round starts** when the timer reads 95 seconds or more, the buy phase, at least 20 seconds after the last round ended.
2. **It goes active** when the timer drops below 95.
3. **It ends** when either score ticks up, or the post-round screen appears. Whichever score went up is the winner.
4. **Noise is ignored.** A "round" under 15 seconds is almost always an OCR misread, so it's thrown away.

The first full series I ran through it, EDG against Leviathan at Masters London, came out as 104 round segments across just under two hours of video. Checking that against the real scoreline, map by map, is the job in front of me now. The target is more than 95% of rounds detected correctly before anything gets trained on them.

## What gets recorded

During each active round, the pipeline writes one snapshot per second to a Parquet file. Each row has 25 features:

| Group | Features |
|---|---|
| Time | seconds remaining, seconds elapsed, round number, overtime |
| Players | attackers alive, defenders alive, the difference |
| Health | total health and total armour for each side |
| Economy | credits and loadout value for each side, and the differences |
| Ultimates | ultimates ready on each side |
| Spike | planted or not, spike timer, post-plant |
| Score | each side's score and the difference |

The label, whether attackers won, is only filled in once the round has ended.

## The models

- **Offline: LightGBM.** 300 trees, a learning rate of 0.05, depth 6, with isotonic calibration on top so the output reads as a probability. It reports Brier score, log loss and accuracy from out-of-fold predictions.
- **Group k-fold by match.** Snapshots from the same match, and especially the same round, are almost copies of each other. A random split would put near-identical rows in training and testing and make the model look much better than it is. So the five folds are split by match.
- **Online: predict, then learn.** A River pipeline, a standard scaler into logistic regression trained by stochastic gradient descent, that can keep learning while it processes new VODs. It buffers every snapshot during a round and predicts each one, and only when the round is finalised does it learn from them with the real outcome. It never sees a round's result before predicting it. The point is to compare a frozen model against one that adapts, on matches held out by date.
- **Calibration over accuracy.** If the model says 70%, attackers should win about 70% of those rounds. That's what a viewer cares about, so I evaluate with Brier score and calibration plots as well as accuracy.

## The demo on this page

The predictor you can play with above runs a small logistic model with weights I set by hand, so it works instantly with no data download. Each factor adds to the log-odds that attackers win: players alive, the round clock, the spike and its timer, and the economy, with a small edge for defence. It handles the cases that are decided outright too, like the spike going off or every defender being down, and a full defuse taking seven seconds. The real model learns those weights from footage instead.

## Decisions worth explaining

- **Broadcast HUD first.** Spectator broadcasts have a consistent layout. Personal streams all look different and are much harder to read.
- **Sample, don't decode.** Two frames a second keeps processing a two-hour series practical on a normal machine, and it still catches every change to the scores, timer and spike.
- **Let the segmenter absorb OCR noise.** Misreads are inevitable, so instead of trusting every frame, the state machine only moves on clear signals (a buy-phase timer, a score going up) and its minimum durations throw out rounds that are too short to be real.

## Where it's at

Round detection is the current phase: checking round counts against known scorelines across five to ten full maps. Next comes richer state. The player-panel reader is written (health from the bar and the numbers, alive or dead, ultimates, ability charges, weapon class and credits) and needs the same checking. After that: weapons from the kill feed, a bigger training set from many matches, and cross-checking round winners against VLR.gg's results.

Similar Counter-Strike models reach 85 to 90% accuracy with the full game state. At this level of detail I'm expecting 75 to 80%.
