---
title: Discord personality clone
featured: false
order: 5
demo: none
dates: 2026
started: 2026-07
status: ''
team: ''
stack: Python, PyTorch, Hugging Face Transformers, PEFT, QLoRA, discord.py
summary: >-
  A chatbot that talks like me, fine-tuned with QLoRA on an open-weight model
  using my own Discord data export. It runs entirely on my hardware, with no
  hosted AI APIs.
points: []
repo: https://github.com/rockminelaw/ChatbotAI
live: ''
diagram_title: From message history to chatbot
diagram:
  - label: Data package
    note: Discord's official export
    detail: Discord lets you request all of your data. The messages folder in that export only contains messages you sent, across every server, DM and group chat. No self-bots or third-party APIs.
  - label: Scraper
    note: JSON or CSV, zipped or not
    detail: Reads the current JSON export format as well as older CSV exports, and filters out low-signal messages like bare links, emoji-only messages and empty ones.
  - label: Dataset
    note: Two modes
    detail: Single mode pairs each of my messages with a casual prompt like "hey" or "thoughts?". Context mode uses my previous message in the same channel as the prompt, which gives the model more to go on.
  - label: QLoRA training
    note: 4-bit base, LoRA rank 16
    detail: The base model (Qwen2.5-1.5B-Instruct by default) is loaded in 4-bit, and LoRA adapters are trained on the attention and MLP projections with TRL's SFTTrainer. Three epochs, learning rate 2e-4, batch size 2 with 8 steps of gradient accumulation. Fits on an 8 GB GPU.
  - label: Chat
    note: Terminal or Discord
    detail: Chat locally in the terminal, or run it as a Discord bot. /talk starts a session, /stop ends it and /reset clears the history. Access can be limited to my own user ID.
log:
  - date: 2026-07
    text: Full pipeline working, from data export to fine-tuned model, plus the Discord bot.
---
## How it works

Discord's data export contains every message you've sent. The pipeline scrapes those, turns them into a fine-tuning dataset, trains a small LoRA adapter on top of an open-weight model, and then lets you chat with the result, in the terminal or as a Discord bot.

## Why it runs locally

Everything happens on my own hardware, in the homelab. My message history never goes to a hosted AI service, and there are no API costs.

## How much data it needs

More data matters most. About 1,000 usable messages is the minimum for anything recognisable, and 10,000 or more is noticeably better.
