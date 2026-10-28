# Frogger

A browser remake of the 1981 arcade classic. Guide the frog up the screen,
across five lanes of traffic and a river, into the five home bays at the top.
Plain HTML/JS, no build step, built to run fullscreen on an iPad. It is played
in the [Arcade](https://ablackett82.github.io/arcade/).

The code is original (pixel art drawn in `src/render/art.js` and `sprites.js`,
sounds made on the fly with WebAudio in `audio.js`); the game it recreates is
Konami/Sega's Frogger.

## How it plays

- Hop one square at a time toward the top. Fill all five home bays to clear the
  level. Every new level makes the traffic and the river quicker and sends more
  turtles diving.
- **Road** (lower half): cars, a racing car, a lorry and a bulldozer. Touching
  any of them is the end of that frog.
- **River** (upper half): the water is deadly — you cross by riding the logs
  and the turtles that float past. Ride a log off the edge of the screen and
  you go with it. Some turtles dive: they sink for a moment, and you drown if
  you are standing on them when they go under.
- **Crocodiles**: from level 3 some of the logs are crocodiles — their backs are
  a safe raft, but stay off the snapping jaws at the front. From level 4 one may
  lurk in an open home bay too; hop in there and it eats you.
- **Home bays**: five gaps in the hedge. Line up with one and hop in. Missing a
  bay (landing in the hedge) or jumping into a bay that is already taken is a
  death.
- **The clock**: each frog has a time bar. Let it run out and the frog is lost.
- **Bonuses**: a fly sometimes lands in an empty bay — reach it for 200. A lady
  frog sometimes rides a log — hop on to carry her, and bring her home for 200.
- Points: 10 for each row you advance, 50 plus a time bonus for each frog home,
  200 for a fly or the lady frog, 1000 for filling all five bays. An extra frog
  every 20,000.

## Controls

- Keyboard: arrows or WASD hop; P pause, M mute, F fullscreen, Esc back to the
  title.
- Touch: swipe anywhere to hop (a tap hops forward). Under the cog: a fixed
  d-pad or a floating stick instead; size, opacity, and which corner. The cog
  also pauses, with Quit and Skip level.
- Gamepad: d-pad / stick hop, any button to start.

## Cheats

On the title screen, or under the cog. A game that uses any of them (even for a
moment) doesn't set the high score:

- Game speed (C): Normal, Slow (75%), Very slow (50%)
- Unlimited lives (L)
- Can't be hurt (V) — nothing hurts, and you can walk on water
- Skip level (K during a game, or the cog)

## Develop

```
npm run dev     # http://localhost:8080/
npm test
npm run icons   # redraw icons/
```

Bump `VERSION` in `sw.js` when anything changes so installed copies update.
In the arcade: commit here, then `npm run sync` there, commit, push.
