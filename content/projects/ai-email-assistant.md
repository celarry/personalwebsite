---
title: AI email assistant
featured: true
order: 1
demo: email
dates: Mar – Nov 2026
started: 2026-03
status: Finished
team: 5-person team, Monash FIT3164
stack: Chrome Extension API, JavaScript, Node.js, Python, OpenAI API, Whisper, SQLite
summary: >-
  A Chrome extension that helps people with busy inboxes triage, read and reply
  faster, without ever sending anything they haven't approved.
points:
  - Built an LLM pipeline for classification, priority detection, thread summaries and reply drafts.
  - Designed a human-in-the-loop approval step so AI-written replies can't go out without confirmation.
  - Interviewed people at large organisations and turned their feedback into requirements.
  - Tested the classifier on 240 labelled emails (85% accuracy, macro F1 0.84) and ran a 27-person survey on the outputs.
repo: ''
live: ''
diagram_title: What happens when you open an email
diagram:
  - label: Gmail
    note: Your inbox
    detail: The extension's content scripts run on Gmail. In the inbox they add a category and urgency label to each email, with filter chips in the panel. When you open a thread, they add the assistant panel beside it.
  - label: Extract
    note: Thread text, in the browser
    detail: The thread is read from the page. Raw email content is only held in memory for the request and never written to disk or a database.
  - label: Backend
    note: Classify, summarise, draft
    detail: A small Node.js server sends the thread to GPT-4o-mini for a category and urgency label, a summary (under 30 words for the short one, under 100 for the long one) and a reply draft in the tone and length you've chosen. Drafts time out after 10 seconds so the panel never hangs. Voice goes to Whisper.
  - label: Panel
    note: Results beside the email
    detail: Labels, summary and an editable draft appear in the panel. You can change anything before it goes anywhere, and there's autocomplete as you type your own reply.
  - label: You approve
    note: The only way to send
    detail: Moving a draft into Gmail's reply box takes a confirmation step that reminds you it was written by AI, and sending is always you pressing Gmail's own Send button. OAuth scopes are read-only, so the extension can't send, delete or change mail on its own.
log:
  - date: 2026-03
    text: Started as a five-person university project. Interviewed people who manage high-volume inboxes at large organisations.
  - date: 2026-09
    text: Gmail extraction, the in-page panel, the confirmation step and LLM drafting, summarising and classifying all working end to end.
  - date: 2026-11
    text: Handed in the final code and report, with voice dictation through Whisper, read-aloud, autocomplete and editable labels, a 240-email classification test and a 27-person survey.
---
## The problem

People in large organisations lose a lot of their day to email. We interviewed some of them, people who manage high-volume inboxes, and turned what they told us into our requirements. Three things came up again and again:

- **What's urgent?** Priority detection, so the important email doesn't sink under newsletters.
- **What's the short version?** Concise summaries of long threads.
- **Can I do this without typing?** Hands-free interaction, by voice.

This was our final-year team project at Monash (FIT3164), built by five of us between March and November 2026.

## What we built

A Manifest V3 Chrome extension that adds an assistant panel to Gmail, backed by a small Node.js server that calls GPT-4o-mini for the language work and Whisper for speech.

- **Inbox labels.** Every email in the inbox gets a category and an urgency label, and filter chips in the panel narrow the inbox down to, say, only the urgent ones. The labels can be edited in settings to match how you actually sort mail.
- **Summaries.** For an open email, a short summary (under 30 words) or a long one (under 100) that covers the whole thread.
- **Reply drafts.** A draft in the tone and length you pick, which you can edit in the panel before using it.
- **Autocomplete.** As you write your own reply in Gmail, a suggested continuation appears in grey, and Tab accepts it.
- **Voice.** Dictate instead of typing, and have summaries or drafts read aloud.
- **It never sends anything.** The extension has no way to send mail. Moving a draft into the reply box asks for explicit confirmation, and the email only goes when you press Gmail's own Send button.

## The rules we built around

| Area | Rule |
|---|---|
| Permissions | Read-only OAuth scopes. The extension never asks to send, delete or modify mail. |
| Privacy | Raw email content is transient. It's never stored on disk or in a database. |
| Human in the loop | Sending is always an explicit action after a confirmation step. |
| Speed | Draft generation times out after 10 seconds. |
| Summaries | Under 30 words for the short summary, under 100 for the long one. |
| Accuracy | Priority classification should reach a macro F1 of 0.85. |

The approval step matters most. Language models sometimes write things that are confidently wrong or just off in tone, and an email that's already sent can't be taken back. So the design puts the person at the last step every time, and makes it obvious when they're looking at text a model wrote.

## How well it works

**Classification.** We tested it on 240 emails, each labelled by hand with one of four priority classes and whether it needs action.

| Measure | Result |
|---|---|
| Correct priority | 204 of 240 (85% accuracy) |
| Macro F1 across the four classes | 0.84 |
| F1: urgent / routine / informational / important | 0.87 / 0.85 / 0.82 / 0.80 |
| Needs action or not | 228 of 240 correct (F1 0.95) |

**What people thought.** 27 people rated the outputs out of 5.

| Statement | Average | Gave 4 or 5 |
|---|---|---|
| The category matched how I'd sort it | 4.19 | 89% |
| The urgency matched how soon I'd act | 4.19 | 85% |
| The label helped me choose what to open | 4.11 | 85% |
| The summary stayed with what was in the email | 4.48 | 96% |
| The long summary covered the thread | 4.37 | 89% |

Summaries scored best: almost everyone agreed they stuck to what the email actually said, which matters more than anything for a summary you act on without reading the original.

## What the testing doesn't show

I wrote the testing and evaluation section of our report, and I'd rather be straight about the limits here too.

- **The test set is balanced, and real inboxes aren't.** It has exactly 60 emails in each priority class. A real inbox is mostly routine mail, so 85% accuracy may not hold in everyday use.
- **Just short of the target.** Macro F1 came out at 0.84 against our 0.85 target, and "important" was the weakest class (0.80).
- **The survey measured opinions, not time.** It shows people thought the outputs were good. It doesn't show how much time the assistant saves, because we didn't time anyone on real tasks.
- **Some things weren't tested at all:** the quality of drafts, how accurate transcription is, and response times.

Stronger evidence would come from three things: a larger test on real inbox data used with consent, timed tasks, and logged response times.

## Where it ended up

The extension works end to end on Gmail. Outlook was planned and partly started, but the inbox labels and autocomplete only run on Gmail. While preparing screenshots for the report I also found a race where the panel could appear twice if Gmail finished loading while it was still being built, which a few lines of code fix.
