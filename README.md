# Vice Point — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/muherilobak-web/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/muherilobak-web/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**[Play it on make.fun](https://make.fun/bounty/gta6-01)** — or run it yourself below. Built for the [gta6-01 bounty](https://make.fun/bounty/gta6-01) on make.fun. My referral link: https://make.fun/r/bt57jd3y (code `bt57jd3y`).

## What it is

**Vice Point** is a complete open-world crime game in the spirit of the open-world crime genre, played in a desktop browser from static files — no build step, no network request, no downloaded assets. One dense coastal district at golden hour, and every system of the genre wired together:

- **A city to explore** — a 6×6-block district with a beachfront avenue, a downtown of neon towers, a canal with one bridge, a market street and a marina. ~70 procedural buildings with canvas-drawn facades, palms, lamps, traffic lights, a park and a parking lot.
- **On foot and by car** — Mara Reyes, ex-getaway driver, walks, runs, jumps and punches; five car models (sedan, coupe, SUV, pickup, taxi) with distinct handling, arcade physics, handbrake drifts and damage smoke.
- **Traffic and pedestrians** — cars follow the block loops, stop at red lights and honk; pedestrians stroll the sidewalks and flee gunfire and crashes.
- **Steal any car** — walk up to traffic or a parked car and press E. The driver may flee, an alarm may sound, and the police may notice.
- **Wanted 1–5 stars** — stealing in view of police, hitting pedestrians and shooting raise the heat. Police cars chase and ram, roadblocks appear from 3 stars, and the heat cools off out of sight. Busted or wasted means a fine and a wake-up at the hospital.
- **Six story missions** — one arc: an intro drive and tail, a repo job, tailing a courier, a stash-house shootout, stealing a getaway fleet, and a four-star finale chase to the marina boat. Each has an intro card, a waypoint beacon, a minimap blip and a cash reward.
- **Side work** — taxi fares, vigilante targets, 20 collectible packages and stunt ramps.
- **Combat** — fists, pistol and SMG (pickups), mouse aim, muzzle flash, enemies who shoot back.
- **HUD and minimap** — health, armor, cash, wanted stars, weapon and ammo, speedometer, objective banner, clock, and a live canvas minimap with blips.
- **Start and save** — title menu, pause menu, localStorage saves (position, cash, mission progress, packages) with autosave after each mission.
- **Sound** — WebAudio synthesized only: engine hum, sirens, gunshots, and one looping original synthwave radio track. No audio files.

Everything is original: the city, the characters, the story and the art are ours. Nothing from Rockstar Games or any other commercial game.

## Play it

```bash
node serve.ts
# open http://localhost:8080
```

Controls: **WASD** drive / walk · **E** enter or steal a car · **Space** jump / handbrake · **Mouse** look & aim · **Click** shoot / punch · **Q** weapon · **H** horn · **M** minimap zoom · **Esc** pause.

## Structure

```
game/
  index.html            page, import map, HUD and menus
  vendor/three.module.min.js   three.js r160 (vendored, minified)
  src/
    main.js             boot, game loop, screens, wiring
    config.js           tuning, car models, mission script
    rng.js              seeded random and angle helpers
    city.js             the district, buildings, canal, marina
    player.js           Mara on foot, third-person camera
    vehicles.js         car models and arcade driving
    traffic.js          traffic AI, lights, honking
    pedestrians.js      walkers who flee trouble
    police.js           wanted level, pursuit, roadblocks
    missions.js         six story missions + side work
    combat.js           weapons, enemies, pickups
    hud.js              HUD bars, minimap, menus
    audio.js            synthesized WebAudio sounds + radio
    save.js             localStorage save / load
    effects.js          particles, shake, skid marks
    input.js            keyboard + mouse
    shots.js            screenshot scenes (?shot=chase|street|combat|marina)
main.ts                 the entry program (copies game/ + screenshots/, writes dossier.json)
```

## Screenshots

Four real renders of the game running: a golden-hour police chase (cover), on foot downtown, the stash-house shootout, and the marina at sunset. Taken with Playwright + Chromium at 1280×720.

## License

MIT — see [LICENSE](LICENSE).
