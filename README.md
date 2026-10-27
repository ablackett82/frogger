# Hedgehog Crossing

Prickles the hedgehog lives under the log pile at the bottom of the garden.
Supper is in the wood at the top of the screen — and in between are roads,
a railway and a brook. Plain HTML/JS, no build step, built to run fullscreen
on an iPad. It is played in the [Arcade](https://ablackett82.github.io/arcade/).

All original: the rules, pixel art (drawn in `src/render/art.js` and
`sprites.js`) and sounds (made on the fly with WebAudio in `audio.js`).

## How it plays

- Hop one square at a time. Fetch the three treats (apples, mushrooms,
  blackberries) from the wood one at a time and carry each home to the garden.
  All three home clears the level.
- The food bar empties as you go and fills again when you get home. If it
  runs out, Prickles faints from hunger. A beetle on a verge is a snack: 150
  points and a bit more time.
- **Roads**: cars, vans, lorries, tractors and bikes. More of them, faster,
  each level.
- **Railway**: the signal flashes and dings before a very fast train.
- **Brook**: only the stepping stones are safe. Mossy ones sink for a moment
  now and then.
- **The fox** prowls a verge from level 2 and comes after you from level 4.
  Hold CURL and it can't bite — it yelps and backs off (100 points). Curled
  up you can't move, and cars still flatten you.
- Every third level is at night: only headlamps, the glow-worms by the food
  and the lantern at the nest light the way.
- Points: 10 for each new row on the way out and on the way back, 50 to pick
  food up, 200 plus the food bar left (x10) to bring it home, 1000 a level.
  An extra life every 10,000.

## Controls

- Keyboard: arrows / WASD hop, Space (Z, X, Shift) curls up; P pause, M mute,
  F fullscreen, Esc back to the title.
- Touch: left half moves, right half is CURL. Under the cog: swipe to hop (a
  tap hops forward — the default), or a fixed d-pad, or a floating stick; size,
  opacity, and swap sides. The cog also pauses, with Quit and Skip level.
- Gamepad: d-pad / stick hop, any face button curls up.

## Cheats

On the title screen, or under the cog. A game that uses any of them (even for a
moment) doesn't set the high score:

- Game speed (C): Normal, Slow (75%), Very slow (50%)
- Unlimited lives (L)
- Can't be hurt (V) — nothing hurts, and you can walk on water
- Never hungry (H)
- No fox (U)
- Skip level (K during a game, or the cog)

## Develop

```
npm run dev     # http://localhost:8080/
npm test
npm run icons   # redraw icons/
```

Bump `VERSION` in `sw.js` when anything changes so installed copies update.
In the arcade: commit here, then `npm run sync` there, commit, push.
