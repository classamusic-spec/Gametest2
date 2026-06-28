# Galactic Federation — Alien Shooter

A browser-based first-person shooter built with **Three.js** and **TypeScript**.
You are a trooper of the **Galactic Federation**, fighting through four planets,
each overrun by a different alien species:

1. **Greys** — Outpost Zeta (slow, fragile, swarm in numbers)
2. **Insectoids** — Hive Biome (fast and relentless)
3. **Evil Nordics** — Frozen Citadel (tall, armored, resilient)
4. **Evil Reptilians** — The Warrens (slow, immense, brutal)

Clear every alien on a planet to advance. The final planet is guarded by the
towering **Reptilian Warlord** boss. Survive all four to win.

## Visual style

Sleek sci-fi neon: emissive procedurally-built aliens, dynamic lighting,
`UnrealBloom` post-processing, filmic tone mapping, fog, and a per-level neon
palette so each planet feels distinct. No external 3D art assets — every alien
is composed from primitive geometry and glowing materials.

## "Call of Duty meets space" feel

- **Sprint** (Shift), **aim down sights** (right click) with FOV zoom + tighter spread
- Recoil kick, weapon bob, FOV punch and **camera shake** on fire / hits / explosions
- **Regenerating health** after staying out of fire, with a low-health pulse
- **Hitmarkers** (white on hit, red on kill) and a **kill feed**
- **Cover** crates, pillars and barriers block movement, shots and plasma bolts
- **Ranged Evil Nordics** that kite and fire plasma at you
- **Reptilian Warlord boss** with a 5-bolt plasma volley, heavy melee and a boss health bar
- Fully procedural **WebAudio sound effects** — shots, hits, explosions, boss roar (no audio files)

## Controls

| Action | Input |
| ------ | ----- |
| Move   | `W` `A` `S` `D` |
| Sprint | `Shift` (+ forward) |
| Look   | Mouse |
| Shoot  | Left click |
| Aim    | Right click (hold) |
| Reload | `R` |
| Pause  | `Esc` |

Click the game to capture the mouse (pointer lock).

## Play it instantly (no install)

Open **`game.html`** directly in a browser — it's a fully self-contained,
single-file build (all JavaScript and CSS inlined) that runs from the
filesystem with no server. Regenerate it with `npm run build:single`.

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
  Game.ts            game state machine, main loop, game-feel (shake/FOV)
  constants.ts       tunables (player, camera, weapon, projectiles, arena)
  core/              Engine, PostProcessing (bloom), Input, Audio (WebAudio SFX)
  world/             Environment (lights, fog, sky, ground, walls), Obstacles (cover)
  player/            PlayerController (pointer lock, WASD, sprint, regen), Health
  weapons/           Weapon (hitscan, ADS, recoil), Projectiles (enemy plasma bolts)
  enemies/           Enemy base (chase/ranged/boss), EnemyFactory (4 aliens + boss), EnemyManager
  fx/                Particles (sparks, death explosions)
  levels/            per-level data (alien, palette, counts, boss flag)
  ui/                HUD (health, ammo, score, boss bar, hitmarker, kill feed), Screens
```

The standalone `game.html` and the inliner at `scripts/inline.mjs` produce the
single-file build.
