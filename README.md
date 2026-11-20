# Vice Point

![Vice Point](https://make.fun/badge/gta6-01.svg)
![Rank](https://make.fun/badge/gta6-01/muherilobak-web/gta6-01/rank.svg)
![Reward](https://make.fun/badge/gta6-01/muherilobak-web/gta6-01/reward.svg)

An open-world action game set in a single dense coastal district at golden hour. Drive, steal cars, dodge the police, and run six story missions for Mara Reyes — from a first delivery job at the marina to the big bank score.

Play it here: [https://make.fun/r/bt57jd3y](https://make.fun/r/bt57jd3y)

## The district

One 6×6-block beach district, built entirely from procedural art: a beachfront avenue lined with palms, a downtown of neon-signed towers, a marina with moored boats, and a harbour basin in the south-east corner. The sun hangs low over the ocean and the whole city glows orange at the horizon. No assets are downloaded — every texture is painted on canvas at load, every sound is synthesized in the browser.

## How to play

- **WASD** move / drive, **mouse** look, **Shift** run, **Space** jump (on foot) or handbrake (in a car)
- **E** steal a car / exit a car
- **Click** shoot, **1 / 2 / 3** switch between fists, pistol and SMG
- **P** or **Esc** pause (save from the pause menu)
- Progress saves automatically after every mission and every 30 seconds

On foot you can walk the sidewalks with the pedestrians; in a car you can take anything parked or moving — but stealing a marked car calls the police. Wanted stars rise with crimes and decay when you break line of sight. At three stars and up, the police set roadblocks. Get busted on foot or wasted in a fight and you wake up at the hospital, lighter in the wallet.

## The six missions

1. **First Gear** — $250. Drive to the docks, pick up the heat, lose the tail.
2. **Repo Run** — $400. Steal the marked coupe and deliver it to the garage.
3. **The Courier** — $500. Tail the courier for 45 seconds. Close, but never spotted.
4. **Stash House** — $700. Defend the stash house through three waves.
5. **Getaway Fleet** — $900. Steal three getaway cars and bring them home.
6. **The Big One** — $2,500. Hit the bank, then escape a four-star chase to the marina.

Twenty packages are hidden around the district, worth $50 each. Your cash, position, weapons and completed missions persist across sessions.

## Tech

- Three.js (vendored, no build step, no network at runtime)
- WebAudio synthesis only — engine hum, sirens, gunfire, mission stingers
- Save/load in `localStorage`, exact round-trip of cash, position and mission state
- Screenshots staged in-game with `?shot=chase|street|combat|marina`

## Development

Serve the folder and open `game/index.html`:

```sh
python3 -m http.server 8080
```

Then visit `http://localhost:8080/game/index.html`. The dossier is generated with `node main.ts` (output goes to `MAKEFUN_OUTPUT_DIR`, default `/output`).

## Disclaimer

Vice Point is a fan-made open-world action game. It is not affiliated with, sponsored by, or endorsed by any existing game franchise, and it uses no assets, names, characters or music from any other game. All art is procedural and all audio is synthesized.
