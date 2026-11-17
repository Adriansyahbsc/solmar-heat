# SOLMAR HEAT

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/adriansyahbsc/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/adriansyahbsc/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game set in the fictional sunset city of Port Solmar.
Explore the city on foot and by car, steal cars, outrun the police, and run four
story missions for Vera — all in a desktop browser, offline, from static files.
Nothing here comes from any commercial game: the city, the characters, the cars,
the story, the art and the sound are all original.

## The game

- **A city to explore** — a procedural grid of neon-lit streets, a park, and a beach
  along the south edge, all with collision.
- **On foot and by car** — walk and run (WASD, Shift), climb into any car with E,
  drive with W/S gas and brake and A/D steering. Pull a driver out of a moving car
  or take a parked one: both are crimes.
- **Traffic and pedestrians** — drivers follow the road network and turn at
  intersections; walkers stroll the sidewalks and run when things get violent.
- **Wanted, 1–5 stars** — crimes raise the heat. Police cruisers chase you and foot
  officers shoot; stand still next to a cop for too long and you get BUSTED.
- **Combat** — aim with the mouse, click to shoot. Health and armour, cash, health
  and armour pickups on the street.
- **Four story missions** — a timed courier delivery, stealing the coral convertible
  for Vera's Garage, disabling two police cruisers, and ghosting the heat from a
  park hideout — with the objective, timer and target marker on the HUD.
- **HUD with a minimap** — money, health and armour bars, wanted stars, the bust
  meter, the objective line, and a live minimap with roads, police blips and the
  mission marker.
- **Start, pause, save** — title screen with New Game / Continue, pause with P,
  progress saved to localStorage, game over (WASTED) and restart.
- **Sound** — synthesised WebAudio: engine hum, sirens, gunshots, pickups and
  mission jingles. M mutes.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

To build the entry dossier (what the make.fun kit hands in):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot · gas, brake and steer in a car |
| Shift | Run |
| E | Enter / leave a car |
| Mouse + click | Aim and shoot |
| P / Esc | Pause |
| R | Restart the current mission |
| M | Mute |
| C | Continue a saved game (title screen) |

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, staged
deterministically with `?shot=chase|foot|mission|menu&seed=1`: a police chase, the
city on foot, a mission in progress, and the title screen.

## Tech

Top-down 2D canvas, ES modules under `game/src/`, zero dependencies, zero network
requests. One module per job: `world` (the city), `traffic`, `pedestrians`,
`police` (wanted + bust), `missions`, `combat`, `audio`, `hud`, `save`, `render`,
`shots`, and `game` tying the rules together.

## License

MIT — see [LICENSE](LICENSE).

---
Entered on [make.fun](https://make.fun/bounty/gta6-01) · ref `kj9js265`
