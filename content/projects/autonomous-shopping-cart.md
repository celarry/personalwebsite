---
title: Autonomous shopping cart
featured: true
order: 4
demo: cart
dates: Mar 2025
started: 2025-03
status: Finished
team: UNIHACK 2025, 5-person team
stack: C++, Arduino, RFID
summary: >-
  A self-driving shopping cart prototype built in 48 hours, with navigation,
  voice interaction and RFID item scanning.
points:
  - Wrote the A* pathfinding that modelled the store layout and found the shortest route between items.
  - Added real-time obstacle avoidance based on the Dynamic Window Approach and Velocity Obstacles, so the cart reroutes around people.
  - Integrated motors, sensors and the Arduino with the rest of the team's software into a working prototype.
repo: ''
live: ''
diagram_title: From shopping list to wheels
diagram:
  - label: Shopping list
    note: Items to collect
    detail: Each item maps to a location in the store.
  - label: Store grid
    note: Aisles become cells
    detail: The store layout is modelled as a grid, with shelves as blocked cells.
  - label: A* search
    note: Shortest route
    detail: A* finds the shortest route between items, always expanding the cell with the lowest cost so far plus estimated distance to go.
  - label: Obstacle avoidance
    note: People in the aisle
    detail: Ideas from the Dynamic Window Approach and Velocity Obstacles let the cart notice something in its way and reroute in real time.
  - label: Motors
    note: Arduino drives the wheels
    detail: The route becomes motor commands on the Arduino, with sensors feeding back what's around the cart.
log:
  - date: 2025-03
    text: Built in 48 hours at UNIHACK 2025 with a team of five.
---
## UNIHACK 2025

Forty-eight hours, five people, and one shopping cart that drives itself to the items on your list. It combined embedded hardware, navigation, voice interaction and RFID scanning to identify items as they went in.

## My part: getting around the store

I built the navigation. The store layout became a grid, and A-star worked out the shortest route between grocery locations. Then came the harder problem: people. Using ideas from the Dynamic Window Approach and Velocity Obstacles, the cart could spot something in its path and reroute around it in real time.

## Try it

The cart at the top of the homepage runs a simplified version in your browser: eight-directional A-star with an octile-distance heuristic, no cutting corners around shelves, and a wandering shopper that makes the cart replan when they step onto its route. I wrote more about it in [Why there's a shopping cart on my homepage](/blog/why-theres-a-shopping-cart-on-my-homepage/).
