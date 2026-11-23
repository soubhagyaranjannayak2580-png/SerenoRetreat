# Sereno Retreat · private farmhouse stay

A one-page site for a farmhouse you rent out by the night. A little farmhouse pops up on its lawn. As you scroll, it spins to the middle of the page while the clock runs from check-in (12:30 PM) to check-out (10 AM). The sky turns to golden hour, then to night, and the windows light up. The house then floats in the page margin past the pricing, and lands in a walled garden where the gate opens and 75 string lights come on one by one. The page ends on a floating estate that turns to show the gate, the house, the lawn and a hammock. Scroll back up and the whole trip plays in reverse.

Every 3D object is built in code with Three.js. There are no image files and no 3D models.

## Run it

It's a static site with no build step. Serve the folder with any static server:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the address it prints. Opening `index.html` straight from disk won't work, because browsers block ES modules on `file://`. Three.js, GSAP and Lenis load from CDNs, so you need an internet connection.

## Where things live

```
index.html          all copy, section markup, links (WhatsApp, phone, Google Maps)
css/style.css       colours (top of file), layout, phone and reduced-motion rules
js/app.js           CONFIG (prices, phone, weekend days) + page chrome: smooth scroll, loader,
                    the stay clock and sky, the booking planner, the WhatsApp message, leaves and fireflies
js/world.js         the single WebGL canvas: stages, lights, the farmhouse's journey, tags, hotspots,
                    rate-card pictures
js/three/
  util.js           shared helpers: seeded random, materials, mesh baking, trees and palms
  house.js          the farmhouse: verandah, door, windows and bulbs that light up, chimney smoke
  garden.js         the night garden: fence, gate, string lights, seating, lanterns, fireflies
  estate.js         the floating estate: gate and drive, farmhouse, lawn seating, hammock, trees, clouds
```

## Change the details

- **Prices, phone number and weekend days** are in `CONFIG` at the top of `js/app.js`. The rate cards, the planner and the WhatsApp message all read from it. `weekendDays` is `[0, 6]` (Sunday and Saturday check-ins). If Friday counts as a weekend for you, make it `[0, 5, 6]`, and the card text updates itself.
- **Phone and map links** are written straight into `index.html`: search for `9989542998` and `maps.app.goo.gl`.
- **Maintenance charge.** The site says "+ maintenance" and "shared when you book" everywhere, because the amount isn't fixed. If you settle on one, add it to `CONFIG` and to `update()` in `js/app.js`.
- **Copy.** Everything visible is in `index.html`: headlines, tags, steps, hotspot cards, the policy and the footer. The loader messages are `MESSAGES` in `js/app.js`, and the house's speech bubbles are `ON_PHRASES` and `OFF_PHRASES` in `js/world.js`.
- **Colours.** Page colours are the custom properties at the top of `css/style.css`. 3D colours sit next to the models (the roof, walls and shutters are at the top of `House` in `house.js`).

## Match the 3D to the real place

The farmhouse, garden and estate are illustrations. Before you go live, check that they don't promise something you don't have. The estate shows a parked car, a hammock and lawn seating with string lights. If any of those aren't at the farmhouse, delete them from `Estate` in `js/three/estate.js` and its hotspot card in `index.html`. The copy only claims what's in your listing: private access, a peaceful setting, and room for parties, family time and weekend chill.

Real photos sell a stay better than any illustration. A gallery section of your own pictures between "What you get" and "Location" would be the next thing to add.

## How it's wired

- There is one fixed, transparent canvas. Each 3D scene (hero, stay, garden, estate) is pinned to an element with `data-stage`. Every frame, its height on screen follows that element, so it scrolls with the page and holds still while the section is pinned. Size and position for desktop and phone are set in the `Act` layouts near the top of `world.js`.
- The house's path is a pure function of scroll position. `updateJourney` in `world.js` blends four poses: hero, stage, margin and garden pad. On phones, the margin pose shrinks the house away, because there's no margin to park it in.
- The stay clock maps scroll to the hour with `HOURS` in `app.js`. The sky colours by hour are in `STAY_SKY`. The 3D lights dim from `window.sereno.nightF`, which comes from the same clock.
- With `prefers-reduced-motion`, smooth scrolling is off, the house skips its pop-in, the garden shows fully lit and CSS animations stop.

## Booking

There is no payment or calendar. The planner works out the estimate (base price, plus ₹250 for each guest over 8) and opens WhatsApp with a message ready to send: the dates, the guest count and the estimate.
