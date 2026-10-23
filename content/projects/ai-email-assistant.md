---
title: AI email assistant
featured: true
order: 3
demo: email
dates: Mar 2026 – present
started: 2026-03
status: In progress
team: 5-person team
stack: Chrome Extension API, JavaScript, Node.js, Python, OpenAI API, SQLite
summary: >-
  A Chrome extension that helps people with busy inboxes triage, read and reply
  faster, without ever sending anything they haven't approved.
points:
  - Built an LLM pipeline for classification, priority detection, thread summaries and reply drafts.
  - Designed a human-in-the-loop approval step so AI-written replies can't go out without confirmation.
  - Interviewed people at large organisations and turned their feedback into requirements.
repo: ''
live: ''
diagram_title: What happens when you open an email
diagram:
  - label: Gmail
    note: You open a thread
    detail: The extension's content script notices when an email is opened and adds a panel next to it.
  - label: Extract
    note: Thread text, in the browser
    detail: The thread is read from the page. Raw email content is only held in memory for the request and never written to disk or a database.
  - label: Backend
    note: Classify, summarise, draft
    detail: A small backend sends the thread to an LLM for a priority label, a summary (under 30 words for short threads, under 100 for long ones) and a reply draft. Drafts time out after 10 seconds so the panel never hangs.
  - label: Panel
    note: Results beside the email
    detail: Priority, summary and an editable draft appear in the panel. You can change anything before it goes anywhere.
  - label: You approve
    note: The only way to send
    detail: Sending is always your action, after a confirmation step that reminds you the draft was written by AI. OAuth scopes are read-only, so the extension can't send, delete or change mail on its own.
log:
  - date: 2026-03
    text: Started as a five-person university project. Interviewed people who manage high-volume inboxes at large organisations.
  - date: 2026-09
    text: Gmail extraction, the in-page panel, the confirmation step and LLM drafting, summarising and classifying all working end to end.
---
## The problem

People in large organisations lose a lot of their day to email. We interviewed some of them and turned their feedback into our requirements: priority detection (what's urgent?), concise summaries (what's the short version?) and hands-free interaction.

## The rules we built around

| Area | Rule |
|---|---|
| Permissions | Read-only OAuth scopes. The extension never asks to send, delete or modify mail. |
| Privacy | Raw email content is transient. It's never stored on disk or in a database. |
| Human in the loop | Sending is always an explicit action after a confirmation step. |
| Speed | Draft generation times out after 10 seconds. |
| Summaries | Under 30 words for short threads, under 100 for long ones. |
| Accuracy | Priority classification should reach over 85% F1. |

The approval step matters most. Language models sometimes write things that are confidently wrong or just off in tone, and an email that's already sent can't be taken back.

## Where it's at

The panel, Gmail extraction, the confirmation step and the LLM-backed drafting, summarising and classifying work. Next: real Google and Microsoft sign-in, voice commands with speech recognition, and Outlook support.
