---
title: Wikipedia live edits
featured: true
order: 1
demo: wikipedia
dates: Oct 2026 – present
started: 2026-10
status: Running
team: Solo
stack: Python, PyTorch, Hugging Face Transformers, DeBERTa-v3, BERT-mini, LightGBM, ONNX Runtime Web, SQLite, Proxmox
summary: >-
  A small model that reads English Wikipedia edits as they happen and flags
  the ones likely to be reverted. It's distilled from a much larger model and
  runs in your browser, so the live feed is scored on your own device.
blurb: Flags live Wikipedia edits that are likely to be reverted, with a small model that runs in your browser.
points:
  - Collected 1.4 million English Wikipedia article edits over 12 days on my homelab, each labelled 48 hours later with whether someone else reverted it.
  - Fine-tuned DeBERTa-v3-base as a teacher. It reached PR-AUC 0.59 on three held-out days, against 0.50 for the best gradient-boosted tree and 0.44 for Wikimedia's recommended revert-risk setup.
  - Distilled it into BERT-mini (11 MB at 8-bit). With its input cut to 128 tokens it reaches 0.55 and scores a typical edit in 21 ms in a browser.
  - Ported the whole input pipeline to JavaScript and checked it against the Python version, so the browser builds the same text the model was trained on.
repo: https://github.com/rockminelaw/wikilogreader
live: ''
diagram_title: How an edit gets a score
diagram:
  - label: Stream
    note: Every change, live
    detail: Your browser reads Wikimedia's public EventStreams feed, which carries every change to every Wikimedia wiki. It keeps English Wikipedia article edits and sets bot edits aside, as the training data did.
  - label: Diff fetch
    note: A few edits every 20 seconds
    detail: Wikipedia's API allows a logged-out browser about 1,000 requests an hour. So every 20 seconds the page picks up to three of the new edits at random and asks for their diffs, plus one request for the editors' account age, edit count and the edits' tags. That's at most 720 requests an hour.
  - label: Features
    note: The edit as text
    detail: The edit becomes a short block of text, the same as in training. It has the editor type, account age and edit count in buckets, the size change, tags, page title, edit summary, how much of the added text is in capitals, and then the removed and added text. Usernames aren't part of it.
  - label: Student model
    note: BERT-mini, 11 MB
    detail: A 4-layer BERT, 11.2 million parameters, trained to copy the scores of a DeBERTa-v3-base teacher as well as the real labels. It's stored as 8-bit integers and runs with ONNX Runtime Web on WebAssembly, reading the first 128 tokens of each edit.
  - label: Flag
    note: Likely to be reverted
    detail: The model's score is calibrated, so it reads as a chance of revert within 48 hours. An edit at 50% or more is flagged as likely to be reverted. On the three test days that flagged 2.4% of edits, and 75% of the flagged edits were reverted within 48 hours. The flags caught 32% of all reverts.
  - label: Digest
    note: A plain summary
    detail: Every few seconds a short summary is filled in from a template, using only the counts on the page. It never names editors.
log:
  - date: 2026-10
    text: Started collecting every English Wikipedia article edit on my homelab, with revert labels 48 hours after each edit.
  - date: 2026-11
    text: Baselines, Wikimedia's revert-risk models and a DeBERTa-v3 teacher, all scored on three whole test days (3 to 5 November).
  - date: 2026-11
    text: Distilled the teacher into three small students, exported them to 8-bit ONNX and timed them in a browser. BERT-mini at 128 tokens won.
  - date: 2026-11
    text: Put the live feed on this site, and then at the top of the homepage.
---
## What it does

Some edits to Wikipedia get undone soon after they're made: vandalism, tests, good-faith mistakes, content disputes. In the 12 days I collected, someone other than the editor reverted 5.5% of article edits within 48 hours. Patrollers and bots like ClueBot NG catch a lot of them, but they have to look at the edit first.

I wanted to know how much of that judgement fits into a model small enough to run on a visitor's laptop, using only what's known when the edit is saved: who made it (as account age and edit count, never a name), how big it is, its tags and summary, and the text that changed.

The feed is live. It shows real edits from the last minute, each with the model's estimate that someone else will revert it within 48 hours. It doesn't name editors and doesn't show the edits' text. A flag is a prediction about the edit, not a judgement of the person who made it.

The project went in four phases, each with its own report in the repository: collect the data, find the best model regardless of size, shrink it for the browser, and put it on this site.

## Phase 1: collecting the edits

There's no ready-made dataset of edits with diffs and revert labels that's recent enough to match today's Wikipedia, so I built a collector and left it running.

- **Where it runs.** An unprivileged Debian 13 container on my Proxmox host, with 2 cores, 1 GB of memory and a 64 GB disk. It runs as a systemd service under its own user, and a timer checks every 10 minutes and restarts it if no stream events have been stored for 15 minutes. A one-line script creates the whole container from the Proxmox shell.
- **What it records.** For every edit to an English Wikipedia article: the revision ids, page, title, editor, bot flag, whether the editor is anonymous, edit summary, minor flag and sizes, as the edit arrives on the stream. About a minute later it fetches the editor's registration date, edit count and groups and the edit's tags, 50 edits per request. Then it fetches the diff: the added and removed text and the full changed lines.
- **Labelling.** 48 hours after each edit, it reads the revision's tags. MediaWiki adds `mw-reverted` when a later edit undoes it exactly, by undo, rollback or a manual edit that restores an earlier version. For those, it walks the page history to find the reverting revision and how long the revert took. Self-reverts are recorded so they can be left out.
- **Anonymous editors.** Since November 2025, English Wikipedia gives logged-out editors a temporary account named like `~2025-12345-67` instead of showing their IP address, so nearly all anonymous edits now look like that. Older IP usernames are still recognised.
- **Being polite to Wikimedia.** A User-Agent with contact details, as their policy asks. At most three API requests at once and 170 a minute, under the 200 a minute Wikimedia allows a well-identified client. `maxlag=5` on every request, and `Retry-After` is honoured on 429 and 503 responses. Bot edits, a third to a half of the stream and almost never reverted, don't get their diffs fetched.
- **Not losing anything.** Edits and the stream position are saved in one transaction, and after a drop the stream resumes from the last event id. A crash or restart neither loses nor duplicates edits.
- **What went wrong.** I started with one API request at a time, the old etiquette advice. Each diff takes over a second to fetch from Australia, and English Wikipedia gets 1.5 to 1.9 article edits a second, so the collector fell behind by about 52,000 edits. Three at a time, newest first, fixed it. I checked that the edits left waiting weren't a biased sample: 5.7% of them were reverted, against 5.5% of the rest.

Over 25 October to 5 November 2026 that came to 1.40 million article edits. 963,000 were by editors without the bot flag, and those are what the models learn from. For training, an export command writes one compressed file per day, cuts each diff field to 3,000 characters and replaces usernames with a salted hash.

## The labels and their limits

These matter for how any of the numbers below can be read.

- **A revert isn't vandalism.** Good-faith edits get reverted for missing sources, in content disputes or by mistake. The model learns "likely to be reverted", which is why the demo never says "vandalism".
- **Only exact reverts count.** If someone removes a bad edit by hand while also changing something else, MediaWiki doesn't see a revert, so the edit is labelled as fine.
- **The model partly learns one bot.** A large share of fast reverts come from ClueBot NG.
- **Leakage.** Editor details are read about 80 seconds after the edit, so a fast editor's count includes a few later edits. The live demo reads them a few seconds after, which is close. Tags read at labelling time are never used as features. And edits whose diff couldn't be fetched because the revision had been deleted are dropped: 29% of them were reverted, against 5.5% overall, so keeping them would teach a model that "no diff" means "bad edit".

## A fair test

- **Train:** 25 October to 1 November, 408,921 edits, 5.0% reverted.
- **Validation:** 2 November, 60,021 edits.
- **Test:** 3 to 5 November, three whole days, 247,471 edits, 5.7% reverted.

No page appears in more than one set. Busy pages get edited day after day, and an edit war spreads related edits across days, so whenever a page shows up in a later set its edits are removed from the earlier one. That took out 29% of the training edits, but it keeps the test days an untouched slice of live traffic. Editors do appear on both sides, which is what the live demo faces too; the models never see usernames, so they can't memorise individuals.

## Phase 2: the best model, at any size

Everything was scored on the same three test days. The main measure is PR-AUC, which rewards ranking reverted edits above the rest. Guessing scores 0.057, the share of test edits that were reverted.

- **Rules.** An anonymous editor removing 500 bytes or more, profanity being added, and a points score that also counts blanking, shouting in capitals and missing edit summaries from new accounts.
- **Gradient-boosted trees** (LightGBM) on the metadata, then on the metadata plus cheap statistics of the diff text: characters added and removed, capitals, links, references, templates, URLs, repeated characters and profanity.
- **Wikimedia's own revert-risk models**, through their public Lift Wing API. Scoring all 247,471 test edits that way would have taken about a day, so I scored a random 25,000.
- **The teacher:** `microsoft/deberta-v3-base` reading each edit written out as text, like this:

```
anonymous editor (temporary account), account under a week, 5 edits
edit: size 72835 to 72855 (+20), 0 lines added, 0 removed, 1 changed
tags: mobile edit, mobile web edit
page: Student List
summary: /* */ link [[Plenary session|plenums]]
removed: (nothing)
added: [[Plenary session| ]]
```

The teacher trained for one epoch over the 408,921 training edits, with inputs cut at 256 tokens, in 73 minutes on an RTX 3080. A second epoch made validation slightly worse. I trained on the natural 5% revert rate rather than reweighting, so its probabilities stay close to real, and then calibrated them with Platt scaling on the validation day.

| Model | PR-AUC | Reverted, of its top 2% |
|---|---|---|
| Teacher (DeBERTa-v3-base) | 0.589 | 85% |
| Trees, metadata and diff statistics | 0.496 | 70% |
| Trees, metadata only | 0.454 | 64% |
| Wikimedia, recommended setup (25,000-edit sample) | 0.445 | 68% |
| Wikimedia, language-agnostic model alone | 0.306 | 41% |
| Rules, points score | 0.240 | 40% |

The teacher's lead over the best tree held on each test day separately, at 0.09 to 0.10, even though PR-AUC itself moved by about 0.05 from one day to the next. It isn't a level comparison with Wikimedia's models: theirs were trained on 2022 edits, with a looser label, for every language at once. I also trained a second teacher that reads 384 tokens instead of 256. It scored 0.587, so a longer input wasn't what was holding it back.

## Phase 3: making it small

The teacher is 738 MB and takes 69 ms per edit on a desktop CPU. The budget for the browser was under 15 MB to download and under 50 ms per edit. So I distilled it: trained small models to copy the teacher's scores as well as the real labels.

- **Three students:** BERT-tiny (2 layers, 4.4 million parameters), BERT-mini (4 layers, 11.2 million) and ELECTRA-small (12 layers, 13.5 million). Each trained for three epochs, in 5, 8 and 18 minutes.
- **The loss:** 0.3 times the usual loss on the label, plus 0.7 times a loss that pulls the student towards the teacher's score, softened with a temperature of 2 so the student also learns how sure the teacher was.
- **One extra line of input.** These students lowercase everything, so they can't see shouting in capitals. A line like `capitals: many` tells them, and it sits before the diff so cutting a long input never drops it.
- **For the browser:** each student exported to ONNX with its weights quantised to 8-bit integers, run with ONNX Runtime Web on one WebAssembly thread, and timed in headless Chromium on 500 random test edits.

| Model | Download (int8) | PR-AUC | Typical edit | Slowest 1% |
|---|---|---|---|---|
| BERT-tiny | 4.5 MB | 0.520 | 4.8 ms | 25 ms |
| BERT-mini, 256 tokens | 11.4 MB | 0.562 | 24 ms | 86 ms |
| BERT-mini, 128 tokens (this site) | 11.4 MB | 0.551 | 21 ms | 38 ms |
| ELECTRA-small | 14.1 MB | 0.561 | 66 ms | 221 ms |

- **Learning from the teacher mattered more than size.** The same BERT-mini trained on the labels alone scores 0.483. The teacher adds 0.08, twice what going from BERT-tiny to BERT-mini adds.
- **8-bit costs nothing measurable.** Each int8 model ranks exactly as well as its PyTorch original, and the browser's scores match Python's to within 0.04 on the logit scale.
- **Why 128 tokens.** At its trained length BERT-mini is over 50 ms on most long edits, about one in seven. Cutting the input to 128 tokens brings even its slowest 1% under 40 ms, for a loss of 0.011 PR-AUC. ELECTRA-small was no better than BERT-mini and almost three times slower, so it was out.

## Phase 4: in the browser

The model is only right if the browser gives it exactly the text it was trained on. So the code that turns an edit into that text is rewritten in JavaScript function by function, and so is the WordPiece tokeniser, in about 130 lines, so the page doesn't need a machine-learning library. On the last checks they matched the Python versions on 20,476 exported edits, 1,987 stream events and API responses, 114 real diffs fetched in Chromium, and 20,017 tokeniser cases, including Chinese, Arabic, emoji and odd Unicode.

The first visit downloads about 12 MB: the model (8.2 MB compressed) and ONNX Runtime's WebAssembly file (3.7 MB compressed). GitHub Pages compresses both, and the browser caches them after that.

An edit is flagged when its calibrated score is 50% or more. On the test days that flagged 2.4% of edits; 75% of the flagged edits were reverted, and the flags caught 32% of all reverts.

## How well it works

| Editors | Share of edits | Reverted | Teacher | This site's model | Best tree |
|---|---|---|---|---|---|
| Anonymous | 14% | 24.2% | 0.700 | 0.665 | 0.577 |
| Registered, under 100 edits | 10% | 13.1% | 0.617 | 0.593 | 0.533 |
| Registered, 100 or more edits | 76% | 1.3% | 0.087 | 0.083 | 0.082 |

Anonymous editors make 14% of edits but 60% of reverts, so most flags land on them. The flags aren't harsher on them than their revert rate supports, though: 86% of the teacher's flags on anonymous edits were reverted, and 84 to 87% of its flags on registered editors.

## Where it falls short

- **Experienced editors.** Edits by registered editors with 100 or more edits are three-quarters of the stream and 18% of reverts, and no model I've tried ranks them well (PR-AUC about 0.08 against a base rate of 1.3%). Those reverts are mostly disputes and style changes that the diff alone doesn't give away.
- **It misses some of the teacher's catches.** Of the edits the teacher correctly puts in its top 2%, BERT-mini leaves out a fifth. I looked for a pattern in the misses, like a script it can't read or very long edits, and didn't find one. It reads like a smaller model reading the same text less well.
- **Scores near the top run a little high.** Around the 98th percentile, BERT-mini says 77% and 69% of those edits were reverted. The wording "likely to be reverted" doesn't depend on that, but a percentage shown on the page can be a few points off.
- **Speed is measured on one machine,** a 2-core cloud server. I haven't timed a laptop or a phone yet.
- **The live feed is a sample.** Wikipedia's API limits how many diffs a browser can ask for, so the page scores a few edits every 20 seconds, picked at random, not every edit.
- **The data moves.** Reverts depend on who's patrolling and what's in the news. The model learnt from late October and early November 2026, so it may get worse over time. I haven't measured that yet.

## What's next

Timing both small students on a real mid-range laptop and a phone, measuring how quickly the model goes stale on newer edits, and trying a student trained at 128 tokens from the start, which might win back some of what the cut costs.
