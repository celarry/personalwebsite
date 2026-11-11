---
title: Discord personality clone
featured: false
order: 1
demo: none
dates: 2026
started: 2026-07
status: ''
team: ''
stack: Python, PyTorch, Hugging Face Transformers, PEFT, QLoRA, bitsandbytes, TRL, discord.py
summary: >-
  A chatbot that talks like me, fine-tuned with QLoRA on an open-weight model
  using my own Discord data export. It runs entirely on my hardware, with no
  hosted AI APIs.
points:
  - Wrote a parser for Discord's official data export that handles the current JSON format, older CSV exports and zipped or unzipped packages, and filters out messages with nothing to learn from.
  - Built two ways of turning one-sided message history into chat training data, since the export only contains my side of every conversation.
  - Fine-tuned Qwen2.5-1.5B-Instruct with 4-bit QLoRA and LoRA rank 16, small enough to train on an 8 GB GPU.
  - Served it as a terminal chat and a Discord bot with slash commands, per-user sessions that expire, and an allow-list of who can use it.
repo: https://github.com/rockminelaw/ChatbotAI
live: ''
diagram_title: From message history to chatbot
diagram:
  - label: Data package
    note: Discord's official export
    detail: Discord lets you request all of your data. The messages folder in that export only contains messages you sent, across every server, DM and group chat. No self-bots or third-party APIs.
  - label: Scraper
    note: JSON or CSV, zipped or not
    detail: Reads the current JSON export format as well as older CSV exports, and filters out low-signal messages like bare links, emoji-only messages, lone mentions, attachments without text and commands to other bots.
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
## What it is

A chatbot that writes the way I do on Discord: the same slang, the same length of message, the same habits. It's built from my own message history, fine-tuned on a small open-weight model, and runs on my own hardware. There are no calls to OpenAI or any other hosted model, and my messages never leave my machines.

It runs as one command-line tool with four steps, `scrape`, `prepare`, `train` and `chat`, plus `all` to run the first three in a row and `bot` to put it on Discord. Every setting lives in one config file.

## Getting the data, the allowed way

Discord has an official way to get your data: **Settings → Privacy & Safety → Request all of my data**. It can take up to 30 days to arrive as a ZIP, and its `messages` folder has every message you've sent, in every server, DM and group chat, one folder per channel.

That's the only source the project uses. Scraping Discord with your own account's token, or with a "self-bot", breaks Discord's terms of service and can get the account banned, so the project doesn't do it.

## The scraper

- **Every export format.** Discord has changed its export over the years. The parser reads the current JSON format (`ID`, `Timestamp`, `Contents`, `Attachments`), older lowercase and CSV versions, and works on the ZIP directly or on an unzipped folder. It reads each channel's metadata so a message knows which server and channel it came from.
- **Throwing away what teaches nothing.** A bare link, a message that's only custom emoji, only a mention, or only an attachment, and commands meant for other bots (messages that start with `$` or contain `pls`, which is how a lot of Discord bots are called) all get dropped.
- **Optional richer context.** If you also export channels with DiscordChatExporter, the scraper can read those too and use your user ID to tell your messages from everyone else's, which gives real conversations to train on.

## The hard part: only one side of the conversation

The official export only has the messages I sent, not what people said to me. A chat model learns from pairs of "someone says X, you reply Y", so the dataset has to make up the other side. There are two ways to do it:

- **Single mode.** Each of my messages becomes a reply to a short, casual prompt picked at random from about fifty, like "hey", "thoughts?", "wait really?" or "wyd". About one in seven prompts also says which channel it's in. This teaches the model my voice, but not how to respond to anything in particular.
- **Context mode.** Messages are grouped by channel and sorted by time, and each one is paired with my previous message in that channel (up to 200 characters) as the prompt. The first message in a channel gets "someone starts a conversation". It's still not a real conversation, but consecutive messages from one person are often a train of thought, so the model gets more to go on.

Messages outside a minimum and maximum length are skipped, the examples are shuffled with a fixed seed, and a share is kept aside to evaluate on. The system prompt describes the person being imitated, and editing it is one of the easiest ways to change the bot's tone.

## Training with QLoRA

Fine-tuning a whole language model needs far more GPU memory than I have. QLoRA gets around that in two ways at once:

- **The base model is loaded in 4-bit** (NF4 with double quantisation, computing in bfloat16). That takes a 1.5-billion-parameter model down to a few gigabytes.
- **Only small adapters are trained.** LoRA adds low-rank matrices, rank 16 with alpha 32 and 5% dropout, to the attention and MLP projections. The base model's own weights never change, and the trained adapter is a small file saved on its own.

Training uses TRL's `SFTTrainer`, with each example formatted by the base model's own chat template, so the fine-tuned model talks in the format it already knows. The defaults are three epochs, a learning rate of 2e-4 with a cosine schedule and 3% warmup, batches of 2 with 8 steps of gradient accumulation (16 examples per update), sequences up to 1,024 tokens, and 8-bit paged AdamW to save more memory. It evaluates on the held-out examples as it goes and keeps the two latest checkpoints.

The default base is **Qwen2.5-1.5B-Instruct**: open, ungated and small. Any Hugging Face causal language model works, such as Phi-3, Llama 3.2 or Mistral, if the GPU is big enough. A 1.5B model needs about 4 to 6 GB of video memory; a 7B one needs 16 GB or more.

## Talking to it

- **In the terminal.** It loads the base model, in 4-bit when there's a GPU, puts the adapter on top, and keeps the chat history so replies follow on from each other. `reset` clears it.
- **On Discord.** A bot with three slash commands: `/talk` starts a session in a channel, `/stop` ends it and `/reset` clears its memory. Each person gets their own session and history, and a session expires after an hour without messages. Generation runs in a background thread so the bot keeps responding to Discord while it thinks, and shows "typing" while it does. Replies are cut to fit Discord's message limit. An allow-list of user IDs can limit it to just me.
- **Sampling.** Replies are sampled at temperature 0.85 with top-p 0.92, up to 256 new tokens. That's warmer than usual, because a chat clone that always picks the most likely word sounds flat and repeats itself.

## What I learnt

- **Data matters more than anything else.** About 1,000 usable messages is the minimum for anything recognisable, and 10,000 or more is noticeably better.
- **Don't over-train.** When replies start repeating themselves, the fix is fewer epochs (one or two), not more.
- **Made-up prompts limit it.** Because the official export is one-sided, the model learns how I write much better than how I answer. Real conversations from DiscordChatExporter fix that, at the cost of training on other people's messages too.
- **Generic replies** usually mean too little data, too many epochs, or a temperature that's too low.

## Why it runs locally

Everything happens on my own hardware, in the homelab. My message history never goes to a hosted AI service, there are no API costs, and I can see exactly what the model was trained on.
