---
title: Why there's a shopping cart on my homepage
date: 2026-10-23
summary: The little dot at the top of this site comes from a self-driving shopping cart I helped build at UNIHACK 2025.
cover: ''
tags:
  - Projects
  - Tech
draft: false
---
If you clicked around the top of this site, you'll have seen a small cart wandering between shelves, planning a route to wherever you clicked. That's a cut-down version of what I built at UNIHACK 2025.

Our team of five had 48 hours to make a shopping cart that could drive itself to the items on your list. My job was the brain: model the store as a grid, then use **A\*** to find the shortest path between each item.

A\* is simple once it clicks. It explores outward from where you are, but it always tries the most promising cell first: the one with the lowest *distance travelled so far* plus *straight-line guess to the goal*. On the homepage, the faint squares that flash up are the cells it looked at before it settled on a route.

The harder part was people. A real store has shoppers who stand in the middle of the aisle. I borrowed ideas from the Dynamic Window Approach and Velocity Obstacles so the cart could notice something in its way and reroute instead of politely ramming into it. The second dot on the homepage is that shopper, and if it wanders onto the cart's route, the cart plans a new one.

By the end of the weekend we had a working prototype, with motors, sensors, voice and RFID scanning all talking to each other.

This blog is where I'll write about things like that, and about life in general, including the move to Singapore next month.
