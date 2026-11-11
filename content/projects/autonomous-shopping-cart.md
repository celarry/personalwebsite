---
title: Autonomous shopping cart
featured: true
order: 1
demo: cart
dates: Mar 2025
started: 2025-03
status: Finished
team: UNIHACK 2025, 5-person team
stack: C++, Arduino, RFID, JavaScript
summary: >-
  A self-driving shopping cart prototype built in 48 hours, with navigation,
  voice interaction and RFID item scanning.
points:
  - Wrote the A* pathfinding that modelled the store layout and found the shortest route between items.
  - Added real-time obstacle avoidance based on the Dynamic Window Approach and Velocity Obstacles, so the cart reroutes around people.
  - Integrated motors, sensors and the Arduino with the rest of the team's software into a working prototype.
  - Rebuilt the planner for the browser later, as the store on this page, with a hundred layouts and a switch between A*, Dijkstra and greedy search.
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
  - date: 2026-10
    text: Rebuilt the planner in the browser as a little store, first on the homepage of this site, then with a hundred layouts, opening hours, seasonal stock and receipts.
  - date: 2026-11
    text: The store moved from the homepage to this page, to make room for the live Wikipedia edits demo.
---
## UNIHACK 2025

Forty-eight hours, five people, and one shopping cart that drives itself to the items on your list. It combined embedded hardware, navigation, voice interaction and RFID scanning to identify items as they went in.

## My part: getting around the store

I built the navigation: the part of the software that decides where the cart goes next.

- **The store as a grid.** The layout became a grid of cells, with shelves as blocked cells, and each item on the list maps to a location in the store.
- **The route.** A-star search works out the shortest route between grocery locations. It explores outward from the cart, but always tries the most promising cell first: the one with the lowest distance travelled so far plus a guess at the distance left. With a good guess, it checks far fewer cells than searching blindly, and still finds the shortest route.
- **People.** The harder problem. A real store has shoppers who stop in the middle of the aisle. Using ideas from the Dynamic Window Approach (only consider the speeds and turns the cart can actually reach in the next moment, and pick the best one that doesn't hit anything) and Velocity Obstacles (work out which directions would collide with something that's moving, and avoid them), the cart could spot something in its path and reroute around it in real time, instead of politely ramming into it.
- **Wheels.** The route became motor commands on the Arduino, with sensors feeding back what was around the cart.

By the end of the weekend we had a working prototype, with motors, sensors, voice and RFID scanning all working together.

## The store on this page

Long after the hackathon I rebuilt the planner in the browser, as a little store you can play with. It was the first thing on the homepage of this site until the [live Wikipedia edits](/projects/wikipedia-live-edits/) demo took its place.

- **The floor.** A grid of 22-pixel squares (18 on phones), with numbered aisles, a fruit stand and a checkout where the cart parks. Each square is about half a metre, which is also how the receipt measures the walk.
- **The search.** Eight directions of movement, an octile-distance heuristic (the true distance on a grid where diagonal steps cost about 1.41), and no cutting corners around shelves, so the cart never squeezes diagonally between two blocked squares. Filled squares are the ones the search expanded, revealed in the order it expanded them; outlined squares were still waiting their turn when it reached the goal.
- **Three searches to compare.** The switch under the store changes the algorithm. Dijkstra is A-star without the guess, so it spreads out evenly in every direction and checks far more squares for the same route. Greedy search uses nothing but the guess, so it checks very few squares but can take the long way round. The line next to the switch reports how many squares each one checked. One of the stores, the greedy trap, is built to catch greedy search out on an ordinary trip from the checkout.
- **A shopper in the way.** A second dot wanders the aisles on routes of its own. If it steps onto one of the next few squares of the cart's route, the cart plans again around it. If the shopper is the only thing blocking the way, the cart waits a moment and tries again.
- **Shopping.** Give the cart something from the list under the store, by tapping it or dragging it onto the floor. It fetches each item, takes it to the checkout and prints a receipt with prices, how far it walked and how many times the shopper made it reroute.
- **Opening hours.** It keeps Melbourne time. Between 10 pm and 7 am the lights go down, a Closed sign goes up and the cart sleeps by the checkout until someone wakes it. It stocks mandarins for Lunar New Year, hot cross buns at Easter, mooncakes for Mid-Autumn, lollies for Halloween and cherries at Christmas.
- **A hundred stores.** The first visit gets the original store; every visit after that gets one you haven't seen yet: a night market, a hawker centre, a server room, two mazes, an exam hall, the UNIHACK room itself. [All the stores](/stores/) keeps track of the ones you've found, in your browser only.
- **Reduced motion.** If your device asks for it, nothing animates: each search and route is drawn once, and the cart moves straight to where it's going.

I wrote more about it in [Why there's a shopping cart on my homepage](/blog/why-theres-a-shopping-cart-on-my-homepage/).

## What the browser version leaves out

The real cart had to deal with things a grid doesn't: wheels that slip, sensors that see a person a moment late, and people who move in ways no planner expects. The browser version keeps the planning and the replanning, and leaves out the physics. In the real cart, the grid route was the plan and the obstacle avoidance did the moment-to-moment steering; in the browser, a whole-route replan stands in for both.
