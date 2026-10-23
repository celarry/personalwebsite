---
title: Homelab and Kubernetes cluster
featured: true
order: 2
demo: homelab
dates: Sep 2025 – present
started: 2025-09
status: Running
team: Solo
stack: Proxmox, Kubernetes, Docker, Linux, Nginx, Cloudflare
summary: >-
  The machines behind most of my side projects: a multi-node Kubernetes cluster
  on Proxmox that hosts apps, media, game servers and machine-learning
  workloads.
points:
  - Combined compute across several machines into one cluster for containerised workloads.
  - Runs Jellyfin, databases, reverse proxies and my own apps, with selected services exposed through Nginx, Cloudflare DNS and HTTPS.
  - Fixed storage and networking issues that took large-file transfers from about 10 MB/s to 70 MB/s.
repo: ''
live: ''
diagram_title: ''
diagram: []
log:
  - date: 2025-09
    text: Started the homelab.
---
## What it runs

Jellyfin for media, databases, game servers, machine-learning workloads, my own apps, and the chatbot I fine-tuned on my own Discord messages.

## How it's put together

- **Proxmox** on several machines. Virtual machines across them form a multi-node **Kubernetes** cluster, so workloads can use compute from any machine.
- **Docker** images for everything, scheduled by Kubernetes.
- Services that need to be public go through an **Nginx** reverse proxy, with **Cloudflare** DNS and HTTPS in front.
- **Multi-terabyte storage**, with Linux permissions managed across the services that share it.

## The 10 → 70 MB/s fix

Large-file transfers were stuck at about 10 MB/s. Working through the storage, networking and permissions setup got them to about 70 MB/s.
