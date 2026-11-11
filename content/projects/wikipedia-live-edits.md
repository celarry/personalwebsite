---
title: Wikipedia live edits
featured: true
order: 2
demo: wikipedia
dates: Oct 2026 – present
started: 2026-10
status: In progress
team: Solo
stack: Python, PyTorch, Hugging Face Transformers, DeBERTa-v3, BERT-mini, LightGBM, ONNX Runtime Web, SQLite, Proxmox
summary: >-
  A small model that reads English Wikipedia edits as they happen and flags
  the ones likely to be reverted. It's distilled from a much larger model and
  runs in your browser, so the live feed below is scored on your own device.
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
    text: Started collecting English Wikipedia edits on my homelab, with revert labels 48 hours after each edit.
  - date: 2026-11
    text: Trained the teacher and the browser student, and put the live feed on this site.
---
## What it does

Some edits to Wikipedia get undone soon after they're made: vandalism, tests, good-faith mistakes. In the 12 days I collected, someone else reverted 5.5% of article edits within 48 hours. I wanted to see how much of that judgement fits into a model small enough to run on a visitor's laptop, using only what's known when the edit is saved.

The feed above is live. It shows real edits from the last minute, each with the model's estimate that someone else will revert it within 48 hours. It doesn't name editors and doesn't show the edits' text. A flag is a prediction about the edit, not a judgement of the person who made it.

## How I built it

- **Data.** A collector on my homelab records every English Wikipedia article edit from the stream, fetches its diff and the editor's details, and checks 48 hours later whether someone else reverted it. Over 12 days that was 1.4 million edits, 963,000 of them not by bots. 5.5% of those were reverted.
- **Fair testing.** The last three days (247,471 edits) are kept for testing, and no page appears in both training and test data.
- **The teacher.** DeBERTa-v3-base, fine-tuned on the edit written out as text. On the test days its PR-AUC is 0.59, and 85% of the edits it ranks in its top 2% were reverted.
- **The student.** BERT-mini, trained on the teacher's scores as well as the labels. Learning from the teacher was worth more than size: it added 0.08 PR-AUC, more than going from a 4.4-million-parameter model to an 11-million one.
- **In the browser.** The student is exported to ONNX with 8-bit weights, which made no measurable difference to its accuracy. A WordPiece tokeniser and the edit-to-text code are rewritten in JavaScript and give identical results to the Python versions on 20,000 test edits.

## How well it works

| Model | Runs on | PR-AUC | Top 2% reverted |
|---|---|---|---|
| Teacher (DeBERTa-v3-base) | A GPU | 0.589 | 85% |
| BERT-mini, 128 tokens (this page) | Your browser | 0.551 | 79% |
| Best gradient-boosted tree | A server | 0.496 | 70% |

PR-AUC measures how well a model ranks reverted edits above the rest. Guessing scores 0.057, the share of test edits that were reverted. "Top 2% reverted" is how many of the edits each model ranks in its top 2% were in fact reverted.

Cutting the input to 128 tokens keeps long edits under 50 ms each: 21 ms for a typical edit and 38 ms for the slowest 1%, measured in Chromium on a 2-core server. The full 256-token input would score 0.562 but takes about 60 ms on long edits.

## Where it falls short

- **Experienced editors.** Edits by registered editors with 100 or more edits are three-quarters of the stream and 18% of reverts, and no model I've tried ranks them well (PR-AUC about 0.08). The student, like the others, does far better on anonymous editors and new accounts.
- **It misses some of the teacher's catches.** Of the edits the teacher correctly puts in its top 2%, the full-length student leaves out a fifth.
- **The live feed is a sample.** Wikipedia's API limits how many diffs a browser can ask for, so the page scores a few edits every 20 seconds, picked at random, not every edit.
- **The data moves.** Reverts depend on who is patrolling and what's in the news. The model learnt from late October 2026, so it may get worse as time goes on. I haven't measured that yet.
