# Vice Point

[![Vice Point](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/muherilobak-web/gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/muherilobak-web/gta6-01/reward.svg)](https://make.fun/c/gta6-01)

**Vice Point** is a complete open-world crime game in the spirit of the open-world crime genre, built for the [make.fun](https://make.fun) gta6-01 bounty. One dense sun-soaked coastal district, six story missions, and every system of the genre wired together — all running offline from static files in a desktop browser.

## The game

Mara Reyes, ex-getaway driver, is back in Vice Point for one last job. The district is a 6×6-block coastal city at golden hour: a beachfront avenue with palms, a downtown of neon towers, a canal crossed by one bridge, a market street and a marina.

- **On foot and by car** — third-person walking, running and jumping, plus arcade driving in five car models (sedan, coupe, SUV, pickup, taxi), each with its own handling.
- **Steal any car** — walk up to a parked or traffic car and press E. Steal in view of the police and the heat is on.
- **Wanted 1–5 stars** — police interceptors chase and ram; roadblocks appear from 3 stars; the heat cools off when you stay out of sight. Get busted or wasted and you wake up at Vice Point General with a fine.
- **Six story missions** — First Gear, Repo Run, The Courier, Stash House, Getaway Fleet and The Big One, with waypoint beacons, objective banners, pass/fail and cash rewards, chained automatically.
- **Side work** — taxi fares, vigilante targets, 20 collectible packages and stunt jumps.
- **Combat** — fists, pistol and SMG, with gang enemies and officers who shoot back, plus health, armor and weapon pickups.
- **HUD** — health, armor, cash, wanted stars, weapon and ammo, speedometer, clock, objective banner and a live canvas minimap with blips for the player, the objective, police, traffic, enemies and packages.
- **Menus and save** — title screen, pause menu, and a localStorage save (position, cash, mission progress, collectibles) with autosave after every mission.
- **Sound** — everything synthesized with WebAudio: engine, sirens, gunshots, UI clicks and one original synthwave radio loop. No audio files.
- **Polish** — particles, muzzle flashes, skid marks, damage smoke, explosions, screen shake and a golden-hour sky.

Nothing from Rockstar Games or any other commercial game.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Drive / walk |
| Mouse | Look and aim |
| Click | Shoot / punch |
| E | Enter / steal a car |
| Space | Jump on foot, handbrake in a car |
| Q | Next weapon |
| H | Horn |
| M | Minimap zoom |
| Esc | Pause |

## Play it

Serve `game/` with any static server and open `game/index.html`:

```sh
node serve.ts
# then open http://localhost:8080
```

No network is needed — every script, module and asset is a file under `game/`, with three.js vendored as `game/vendor/three.module.min.js`.

## Structure

- `game/index.html` — the page, HUD and menus
- `game/src/main.js` — boot and the one game loop
- `game/src/city.js` — the district, buildings, props, collision
- `game/src/player.js` — Mara on foot and the third-person camera
- `game/src/vehicles.js` — car models and arcade driving physics
- `game/src/traffic.js` — traffic AI, lights, honking
- `game/src/pedestrians.js` — pedestrians who stroll and flee
- `game/src/police.js` — wanted level, pursuit cars, roadblocks
- `game/src/combat.js` — enemies, pickups, shooting
- `game/src/missions.js` — the six-mission story and side work
- `game/src/hud.js` — HUD and live minimap
- `game/src/audio.js` — synthesized WebAudio sound and radio
- `game/src/effects.js` — particles, smoke, skid marks, screen shake
- `game/src/save.js` — localStorage save and load
- `game/src/input.js` — keyboard and mouse input
- `game/src/config.js` — tuning numbers, car models, the story
- `game/src/rng.js` — seeded random and math helpers
- `game/src/shots.js` — screenshot staging behind `?shot=`

## Screenshots

Four real renders of the game, taken in a headless browser from the game's own code:

1. `1-chase.jpg` — golden-hour police chase, 3 stars, on the beachfront avenue
2. `2-street.jpg` — on foot downtown, with traffic, pedestrians and neon
3. `3-combat.jpg` — the stash-house shootout
4. `4-marina.jpg` — the marina, player beside a stolen coupe

## Build

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

## License

MIT. Built for make.fun — [join with referral bt57jd3y](https://make.fun/r/bt57jd3y).
