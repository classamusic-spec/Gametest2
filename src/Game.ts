import * as THREE from "three";
import { Engine } from "./core/Engine";
import { Input } from "./core/Input";
import { Environment } from "./world/Environment";
import { PlayerController } from "./player/PlayerController";
import { Weapon } from "./weapons/Weapon";
import { Particles } from "./fx/Particles";
import { EnemyManager } from "./enemies/EnemyManager";
import { HUD } from "./ui/HUD";
import { Screens } from "./ui/Screens";
import { LEVELS } from "./levels/levels";
import { WEAPON } from "./constants";

type State =
  | "menu"
  | "intro"
  | "playing"
  | "paused"
  | "complete"
  | "gameover"
  | "victory";

export class Game {
  private engine: Engine;
  private input: Input;
  private environment: Environment;
  private player: PlayerController;
  private weapon: Weapon;
  private particles: Particles;
  private enemies: EnemyManager;
  private hud = new HUD();
  private screens = new Screens();

  private clock = new THREE.Clock();
  private state: State = "menu";
  private levelIndex = 0;
  private score = 0;
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
    this.input = new Input();
    this.environment = new Environment(this.engine.scene);
    this.engine.scene.add(this.environment.group);

    this.particles = new Particles(this.engine.scene);
    this.player = new PlayerController(this.engine.camera, canvas, this.input);
    // Camera must be in the scene so its child weapon viewmodel renders.
    this.engine.scene.add(this.player.object);

    this.weapon = new Weapon(this.engine.camera, this.engine.scene, this.particles);
    this.enemies = new EnemyManager(this.engine.scene, this.particles);

    this.weapon.onAmmoChange = () => {
      this.hud.setAmmo(this.weapon.ammoText);
      this.hud.setReloading(this.weapon.reloading);
    };
    this.enemies.onKill = (value) => {
      this.score += value;
      this.hud.setScore(this.score);
    };

    // Pointer-lock loss during play pauses the game.
    this.player.controls.addEventListener("unlock", () => {
      if (this.state === "playing") this.pause();
    });

    canvas.addEventListener("click", () => {
      if (this.state === "playing" && !this.player.locked) this.player.lock();
    });

    this.screens.showStart(() => this.startGame());
    this.exposeDebugHooks();

    this.animate();
  }

  // ---------- State transitions ----------
  private startGame() {
    this.score = 0;
    this.levelIndex = 0;
    this.hud.setScore(0);
    this.beginLevel();
  }

  private beginLevel() {
    const level = LEVELS[this.levelIndex];
    this.state = "intro";
    this.environment.applyPalette(level, this.engine.scene);
    this.player.reset();
    this.weapon.reset();
    this.enemies.clear();
    this.hud.hide();
    this.screens.showLevelIntro(level.id, level.name, level.briefing, () => {
      this.screens.hide();
      this.hud.show();
      this.hud.setLevel(level.name);
      this.hud.setHealth(this.player.health.fraction);
      this.hud.setEnemiesRemaining(level.count);
      this.enemies.startLevel(level);
      this.state = "playing";
      this.player.lock();
    });
  }

  private pause() {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.screens.showLevelIntro(
      LEVELS[this.levelIndex].id,
      "PAUSED",
      "Mission paused. Click ENGAGE to resume the assault.",
      () => {
        this.screens.hide();
        this.state = "playing";
        this.player.lock();
      },
    );
  }

  private completeLevel() {
    this.state = "complete";
    this.hud.hide();
    const isLast = this.levelIndex >= LEVELS.length - 1;
    if (isLast) {
      this.state = "victory";
      this.screens.showVictory(this.score, () => this.startGame());
      return;
    }
    this.screens.showLevelComplete(LEVELS[this.levelIndex].id, this.score, () => {
      this.levelIndex++;
      this.beginLevel();
    });
  }

  private gameOver() {
    this.state = "gameover";
    this.hud.hide();
    this.screens.showGameOver(this.score, () => this.startGame());
  }

  // ---------- Loop ----------
  private animate = () => {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    this.particles.update(dt);

    if (this.state === "playing") {
      this.player.update(dt);
      this.weapon.update(dt);

      // Shooting.
      if (this.input.mouseDown && this.player.locked) {
        const result = this.weapon.tryFire(this.enemies.colliders);
        if (result?.hitObject) {
          this.enemies.damageFromHit(result.hitObject, WEAPON.damage);
        }
      }
      if (this.input.wasPressed("KeyR")) this.weapon.startReload();

      // Enemies + contact damage.
      const damage = this.enemies.update(dt, this.elapsed, this.player.object.position);
      if (damage > 0 && this.player.takeDamage(damage)) {
        this.hud.flashDamage();
      }
      this.hud.setHealth(this.player.health.fraction);
      this.hud.setEnemiesRemaining(this.enemies.remaining);

      // Win / lose checks.
      if (!this.player.health.alive) {
        this.gameOver();
      } else if (this.enemies.remaining === 0) {
        this.completeLevel();
      }
    }

    this.input.endFrame();
    this.engine.render();
    if (!this.ready) this.markReady();
  };

  // ---------- Test / debug hooks ----------
  private ready = false;
  private markReady() {
    this.ready = true;
    (window as unknown as Record<string, unknown>).__gameReady = true;
  }
  private exposeDebugHooks() {
    (window as unknown as Record<string, unknown>).__game = {
      getState: () => this.state,
      getScore: () => this.score,
      enemiesRemaining: () => this.enemies.remaining,
      startGame: () => this.startGame(),
      // Test hook: start the current level's wave without the intro/pointer-lock flow.
      spawnCurrentWave: () => this.enemies.startLevel(LEVELS[this.levelIndex]),
      // Test hook: drop straight into the playing state (no pointer lock / intro).
      forcePlay: (idx = 0) => {
        this.levelIndex = Math.max(0, Math.min(idx, LEVELS.length - 1));
        const level = LEVELS[this.levelIndex];
        this.environment.applyPalette(level, this.engine.scene);
        this.player.reset();
        this.weapon.reset();
        this.screens.hide();
        this.hud.show();
        this.hud.setLevel(level.name);
        this.enemies.startLevel(level);
        this.state = "playing";
      },
    };
  }
}
