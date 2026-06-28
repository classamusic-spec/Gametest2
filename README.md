# Galactic Federation — Alien Shooter

A browser-based first-person shooter built with **Three.js** and **TypeScript**.
You are a trooper of the **Galactic Federation**, fighting through four planets,
each overrun by a different alien species:

1. **Greys** — Outpost Zeta (slow, fragile, swarm in numbers)
2. **Insectoids** — Hive Biome (fast and relentless)
3. **Evil Nordics** — Frozen Citadel (tall, armored, resilient)
4. **Evil Reptilians** — The Warrens (slow, immense, brutal)

Clear every alien on a planet to advance. Survive all four to win.

## Visual style

Sleek sci-fi neon: emissive procedurally-built aliens, dynamic lighting,
`UnrealBloom` post-processing, filmic tone mapping, fog, and a per-level neon
palette so each planet feels distinct. No external 3D art assets — every alien
is composed from primitive geometry and glowing materials.

## Controls

| Action | Input |
| ------ | ----- |
| Move   | `W` `A` `S` `D` |
| Look   | Mouse |
| Shoot  | Left click |
| Reload | `R` |
| Pause  | `Esc` |

Click the game to capture the mouse (pointer lock).

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build & preview the production bundle

```bash
npm run build      # type-checks, then outputs static files to dist/
npm run preview    # serves the build at http://localhost:4173
```

The `dist/` bundle is plain static HTML + JS and can be hosted anywhere.

## Tests

```bash
npm run test:e2e   # Playwright smoke test: loads, renders, no errors
```

## Project structure

```
src/
  Game.ts            game state machine + main loop
  constants.ts       tunables (player, weapon, arena)
  core/              Engine, PostProcessing (bloom), Input
  world/             Environment (lights, fog, sky, ground, walls)
  player/            PlayerController (pointer lock + WASD), Health
  weapons/           Weapon (hitscan, viewmodel, muzzle flash, tracer)
  enemies/           Enemy base, EnemyFactory (4 aliens), EnemyManager
  fx/                Particles (sparks, death explosions)
  levels/            LevelManager data (per-level alien, palette, counts)
  ui/                HUD, Screens
```
