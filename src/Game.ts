import * as THREE from "three";
import { Engine } from "./core/Engine";
import { Input } from "./core/Input";
import { SfxManager } from "./core/Audio";
import { Environment } from "./world/Environment";
import { Obstacles } from "./world/Obstacles";
import { PlayerController } from "./player/PlayerController";
import { Weapon } from "./weapons/Weapon";
import { Projectiles } from "./weapons/Projectiles";
import { Particles } from "./fx/Particles";
import { EnemyManager } from "./enemies/EnemyManager";
import type { Enemy } from "./enemies/Enemy";
import { HUD } from "./ui/HUD";
import { Screens } from "./ui/Screens";
import { LEVELS, type AlienType } from "./levels/levels";
import { WEAPON, CAMERA } from "./constants";

type State =
  | "menu"
  | "intro"
  | "playing"
  | "paused"
  | "complete"
  | "gameover"
  | "victory";

const ALIEN_LABEL: Record<AlienType, string> = {
  grey: "GREY",
  insectoid: "INSECTOID",
  nordic: "NORDIC",
  reptilian: "REPTILIAN",
};

export class Game {
  private engine: Engine;
  private input: Input;
  private sfx = new SfxManager();
  private environment: Environment;
  private obstacles: Obstacles;
  private player: PlayerController;
  private weapon: Weapon;
  private particles: Particles;
  private projectiles: Projectiles;
  private enemies: EnemyManager;
  private hud = new HUD();
  private screens = new Screens();

  private clock = new THREE.Clock();
  private state: State = "menu";
  private levelIndex = 0;
  private score = 0;
  private elapsed = 0;

  // Game-feel state.
  private shakeTrauma = 0;
  private fov = CAMERA.baseFov;
  private fovPunch = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
    this.input = new Input();
    this.environment = new Environment(this.engine.scene);
    this.engine.scene.add(this.environment.group);

    this.obstacles = new Obstacles();
    this.engine.scene.add(this.obstacles.group);

    this.particles = new Particles(this.engine.scene);
    this.projectiles = new Projectiles(this.engine.scene, this.particles);

    this.player = new PlayerController(this.engine.camera, canvas, this.input);
    this.player.setObstacles(this.obstacles);
    // Camera must be in the scene so its child weapon viewmodel renders.
    this.engine.scene.add(this.player.object);

    this.weapon = new Weapon(this.engine.camera, this.engine.scene);
    this.enemies = new EnemyManager(
      this.engine.scene,
      this.particles,
      this.projectiles,
      this.obstacles,
    );

    this.wireEvents(canvas);
    this.screens.showStart(() => this.startGame());
    this.exposeDebugHooks();
    this.animate();
  }

  private wireEvents(canvas: HTMLCanvasElement) {
    this.weapon.onAmmoChange = () => {
      this.hud.setAmmo(this.weapon.ammoText);
      this.hud.setReloading(this.weapon.reloading);
    };
    this.weapon.onFired = () => {
      this.sfx.shoot();
      this.addShake(0.32);
      this.fovPunch += CAMERA.firePunch;
      this.hud.pulseCrosshair();
    };
    this.weapon.onReload = () => this.sfx.reload();

    this.enemies.onKill = (value, enemy) => {
      this.score += value;
      this.hud.setScore(this.score);
      this.hud.addKill(`${this.killLabel(enemy)} DOWN`, value, enemy.isBoss);
      if (enemy.isBoss) {
        this.sfx.explosion();
        this.addShake(1);
        this.hud.hideBoss();
      } else {
        this.sfx.kill();
      }
    };
    this.enemies.onEnemyFire = () => this.sfx.enemyShoot();
    this.enemies.onBossSpawn = (boss) => {
      this.hud.showBoss("REPTILIAN WARLORD");
      this.hud.setBossHealth(boss.health.fraction);
      this.sfx.bossRoar();
      this.addShake(0.7);
    };

    this.player.controls.addEventListener("unlock", () => {
      if (this.state === "playing") this.pause();
    });
    canvas.addEventListener("click", () => {
      this.sfx.resume();
      if (this.state === "playing" && !this.player.locked) this.player.lock();
    });
  }

  private killLabel(enemy: Enemy): string {
    if (enemy.isBoss) return "WARLORD";
    return ALIEN_LABEL[LEVELS[this.levelIndex].alienType];
  }

  // ---------- State transitions ----------
  private startGame() {
    this.sfx.resume();
    this.sfx.uiClick();
    this.score = 0;
    this.levelIndex = 0;
    this.hud.setScore(0);
    this.beginLevel();
  }

  private beginLevel() {
    const level = LEVELS[this.levelIndex];
    this.state = "intro";
    this.environment.applyPalette(level, this.engine.scene);
    this.obstacles.applyPalette(level);
    this.player.reset();
    this.weapon.reset();
    this.enemies.clear();
    this.hud.hide();
    this.screens.showLevelIntro(level.id, level.name, level.briefing, () => {
      this.sfx.resume();
      this.sfx.levelStart();
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
      this.sfx.victory();
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
    this.sfx.hurt();
    this.screens.showGameOver(this.score, () => this.startGame());
  }

  // ---------- Game feel ----------
  private addShake(amount: number) {
    this.shakeTrauma = Math.min(1, this.shakeTrauma + amount);
  }

  private updateCameraFeel(dt: number) {
    // Positional screen shake (trauma squared for a punchy falloff).
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.6);
    const s = this.shakeTrauma * this.shakeTrauma * 0.35;
    this.player.shakeOffset.set(
      (Math.random() * 2 - 1) * s,
      (Math.random() * 2 - 1) * s,
      0,
    );

    // FOV: base / sprint / ADS + decaying fire punch.
    this.fovPunch = THREE.MathUtils.damp(this.fovPunch, 0, 12, dt);
    const aiming = this.weapon.aiming;
    const target =
      (aiming ? CAMERA.adsFov : this.player.sprinting ? CAMERA.sprintFov : CAMERA.baseFov) +
      this.fovPunch;
    this.fov = THREE.MathUtils.damp(this.fov, target, 14, dt);
    this.engine.setFov(this.fov);
  }

  // ---------- Loop ----------
  private animate = () => {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    this.particles.update(dt);
    this.hud.update(dt);

    if (this.state === "playing") {
      const aiming = this.input.rightMouseDown && this.player.locked && !this.weapon.reloading;
      this.hud.setAds(aiming);

      this.updateCameraFeel(dt);
      this.player.update(dt);
      this.weapon.update(dt, {
        aiming,
        moving: this.player.isMoving,
        sprinting: this.player.sprinting,
      });

      // Shooting.
      if (this.input.mouseDown && this.player.locked) {
        const targets = [...this.enemies.colliders, ...this.obstacles.raycastMeshes];
        const result = this.weapon.tryFire(targets);
        if (result?.hitObject) {
          const r = this.enemies.damageFromHit(result.hitObject, WEAPON.damage);
          if (r.hit) {
            this.hud.showHitmarker(r.killed);
            this.sfx.hit();
          }
        }
      }
      if (this.input.wasPressed("KeyR")) this.weapon.startReload();

      // Enemy melee + projectile damage.
      const playerPos = this.player.object.position;
      let damage = this.enemies.update(dt, this.elapsed, playerPos);
      damage += this.projectiles.update(dt, playerPos, this.obstacles);
      if (damage > 0 && this.player.takeDamage(damage)) {
        this.hud.flashDamage();
        this.sfx.hurt();
        this.addShake(0.4);
      }

      this.hud.setHealth(this.player.health.fraction);
      this.hud.setEnemiesRemaining(this.enemies.remaining);
      const boss = this.enemies.boss;
      if (boss) this.hud.setBossHealth(boss.health.fraction);

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
      hasBoss: () => !!this.enemies.boss,
      projectileCount: () => this.projectiles.count,
      startGame: () => this.startGame(),
      // Test hook: start the current level's wave without the intro/pointer-lock flow.
      spawnCurrentWave: () => this.enemies.startLevel(LEVELS[this.levelIndex]),
      // Test hook: drop straight into the playing state (no pointer lock / intro).
      forcePlay: (idx = 0) => {
        this.levelIndex = Math.max(0, Math.min(idx, LEVELS.length - 1));
        const level = LEVELS[this.levelIndex];
        this.environment.applyPalette(level, this.engine.scene);
        this.obstacles.applyPalette(level);
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
