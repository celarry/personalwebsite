---
title: Homelab and Kubernetes cluster
featured: true
order: 1
demo: homelab
dates: Sep 2025 – present
started: 2025-09
status: Running
team: Solo
stack: Proxmox, Kubernetes, Docker, Linux, LXC, systemd, Nginx, Cloudflare
summary: >-
  The machines behind most of my side projects: a multi-node Kubernetes cluster
  on Proxmox that hosts apps, media, game servers and machine-learning
  workloads.
points:
  - Combined compute across several machines into one cluster for containerised workloads.
  - Runs Jellyfin, databases, reverse proxies and my own apps, with selected services exposed through Nginx, Cloudflare DNS and HTTPS.
  - Fixed storage and networking issues that took large-file transfers from about 10 MB/s to 70 MB/s.
  - Ran the 12-day Wikipedia edit collector that the live edits model was trained on, in its own container with automatic restarts.
repo: ''
live: ''
diagram_title: ''
diagram: []
log:
  - date: 2025-09
    text: Started the homelab.
  - date: 2026-10
    text: Added a container for the Wikipedia edit collector, which recorded 1.4 million edits over 12 days.
---
## Why I run my own

Most of my projects need something running all the time: a collector that has to stay connected for weeks, a chatbot trained on my own messages, a database, a game server for friends. Renting all of that would cost money every month, and some of it, like my message history, I'd rather not send to someone else's servers at all.

Running my own hardware also turned out to be where I learnt most of what I know about Linux, networking, storage and containers, because when something breaks there's nobody else to fix it.

## What it runs

- **Jellyfin**, my media server.
- **A Kobo book server**, so my e-reader can pull books from the homelab.
- **Databases** for my own apps.
- **Game servers.**
- **Machine-learning workloads**, including the [Discord personality clone](/projects/discord-personality-clone/), a chatbot fine-tuned on my own messages that runs with no hosted AI APIs.
- **The Wikipedia edit collector** behind [Wikipedia live edits](/projects/wikipedia-live-edits/).
- **My own apps and experiments**, which come and go.

## How it's put together

- **Proxmox** on several machines. One of them is an Intel N100 machine with 16 GB of memory, which runs always-on containers like the Wikipedia collector and the book server.
- **A multi-node Kubernetes cluster** made from virtual machines spread across those hosts, so containerised workloads can use compute from any of them.
- **Docker images** for most services, scheduled by Kubernetes.
- **LXC containers** for single long-running jobs that don't need the cluster, like the Wikipedia collector. They're lighter than a VM and start in seconds.
- **The way in.** Services that need to be public go through an **Nginx** reverse proxy, with **Cloudflare** DNS and HTTPS in front. Everything else stays on the home network.
- **Multi-terabyte storage**, shared between the services that need it, with Linux permissions managed across all of them.

## An example: the Wikipedia collector

The collector for [Wikipedia live edits](/projects/wikipedia-live-edits/) is a good picture of how I like to run things:

- **One script creates it.** Run from the Proxmox host's shell, it makes an unprivileged Debian 13 container (2 cores, 1 GB of memory, a 64 GB disk, its network on the host's bridge) that starts with the host, and installs the collector inside it.
- **Its own user, as a systemd service.** It doesn't run as root, and systemd restarts it if it crashes.
- **A health check.** A systemd timer looks every 10 minutes and restarts the service if no new stream events have been stored for 15 minutes, which catches the cases where it's running but stuck.
- **Backups without stopping it.** A backup command makes a consistent copy of the SQLite database while the collector keeps writing, and `pct pull` copies it out to the host.
- **Room to grow.** The database grows by roughly 1.2 GB a day, and the disk can be resized from the host without stopping the container.
- **Nothing lost on a restart.** Each edit and the stream position are saved together, and the stream resumes from the last event it saw, so a crash or a reboot neither loses nor duplicates edits.

Over 12 days it recorded 1.4 million edits.

## The 10 → 70 MB/s fix

Large-file transfers were stuck at about 10 MB/s. The cause wasn't one thing: it took working through the storage setup, the networking and the permissions, one at a time, to get transfers to about 70 MB/s, seven times faster.

## What I've learnt

- **Do the boring things once, in a script.** Anything I set up by hand, I end up setting up by hand again after a reinstall. A script that builds a container from scratch is documentation that can't go out of date.
- **Check that it's working, not just running.** A process can be alive and doing nothing. Health checks should look at the output, like "has it stored anything lately?", not just whether it's up.
- **Expose as little as possible.** Only what has to be public goes through the proxy. Everything else isn't reachable from outside at all.
