import * as THREE from "three";
import { Engine } from "./core/Engine";
import { Input } from "./core/Input";
import { SfxManager } from "./core/Audio";
import { Environment } from "./world/Environment";
import { Obstacles } from "./world/Obstacles";
import { Loot, type LootData } from "./world/Loot";
import { PlayerController } from "./player/PlayerController";
import { Weapon } from "./weapons/Weapon";
import { Arsenal } from "./weapons/Arsenal";
import type { WeaponId } from "./weapons/WeaponTypes";
import { Projectiles } from "./weapons/Projectiles";
import { Particles } from "./fx/Particles";
import { EnemyManager } from "./enemies/EnemyManager";
import type { Enemy } from "./enemies/Enemy";
import { HUD } from "./ui/HUD";
import { Screens } from "./ui/Screens";
import { LEVELS, type AlienType } from "./levels/levels";
import { CAMERA } from "./constants";

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

const HEAL_AMOUNT = 45;
const DROP_CHANCE = 0.17;

const SELECT_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"];

export class Game {
  private engine: Engine;
  private input: Input;
  private sfx = new SfxManager();
  private environment: Environment;
  private obstacles: Obstacles;
  private loot: Loot;
  private player: PlayerController;
  private weapon: Weapon;
  private arsenal: Arsenal;
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
    this.loot = new Loot(this.engine.scene, this.particles);

    this.player = new PlayerController(this.engine.camera, canvas, this.input);
    this.player.setObstacles(this.obstacles);
    this.engine.scene.add(this.player.object);

    this.weapon = new Weapon(this.engine.camera, this.engine.scene);
    this.arsenal = new Arsenal(this.weapon);
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
      this.addShake(0.28 + this.weapon.def.recoil * 0.06);
      this.fovPunch += CAMERA.firePunch;
      this.hud.pulseCrosshair();
    };
    this.weapon.onReload = () => this.sfx.reload();

    this.arsenal.onInventoryChange = () => {
      this.hud.setWeapons(this.arsenal.view());
      this.hud.setWeaponName(this.weapon.def.name);
      this.hud.setAmmo(this.weapon.ammoText);
    };

    this.loot.onCollect = (data) => this.applyLoot(data);

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
        this.maybeDropLoot(enemy);
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

  // ---------- Loot ----------
  private maybeDropLoot(enemy: Enemy) {
    if (Math.random() > DROP_CHANCE) return;
    const roll = Math.random();
    let data: LootData;
    const unowned = this.arsenal.randomUnowned();
    if (roll < 0.25 && unowned) data = { kind: "weapon", weaponId: unowned };
    else if (roll < 0.6) data = { kind: "health" };
    else data = { kind: "ammo" };
    this.loot.spawn(enemy.position.clone(), data);
  }

  private seedLevelLoot() {
    // Offer a new weapon and an ammo cache near the player's start each level.
    const unowned = this.arsenal.randomUnowned();
    if (unowned) {
      this.loot.spawn(new THREE.Vector3(7, 0, 34), { kind: "weapon", weaponId: unowned });
    }
    this.loot.spawn(new THREE.Vector3(-7, 0, 34), { kind: "ammo" });
  }

  private applyLoot(data: LootData) {
    let label = "";
    if (data.kind === "weapon" && data.weaponId) {
      label = this.arsenal.giveWeapon(data.weaponId);
      this.sfx.uiClick();
    } else if (data.kind === "ammo") {
      label = this.arsenal.giveAmmo();
      this.sfx.reload();
    } else {
      this.player.heal(HEAL_AMOUNT);
      this.hud.setHealth(this.player.health.fraction);
      label = "HEALTH +" + HEAL_AMOUNT;
      this.sfx.uiClick();
    }
    this.hud.showPickup(label);
  }

  // ---------- State transitions ----------
  private startGame() {
    this.sfx.resume();
    this.sfx.uiClick();
    this.score = 0;
    this.levelIndex = 0;
    this.hud.setScore(0);
    this.arsenal.reset();
    this.beginLevel();
  }

  private beginLevel() {
    const level = LEVELS[this.levelIndex];
    this.state = "intro";
    this.environment.applyPalette(level, this.engine.scene);
    this.obstacles.build(level);
    this.loot.clear();
    this.player.reset();
    this.arsenal.giveAmmo();
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
      this.hud.setWeapons(this.arsenal.view());
      this.hud.setWeaponName(this.weapon.def.name);
      this.enemies.startLevel(level);
      this.seedLevelLoot();
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
    this.shakeTrauma = Math.max(0, this.shakeTrauma - dt * 1.6);
    const s = this.shakeTrauma * this.shakeTrauma * 0.35;
    this.player.shakeOffset.set(
      (Math.random() * 2 - 1) * s,
      (Math.random() * 2 - 1) * s,
      0,
    );

    this.fovPunch = THREE.MathUtils.damp(this.fovPunch, 0, 12, dt);
    const aiming = this.weapon.aiming;
    const target =
      (aiming ? this.weapon.adsFov : this.player.sprinting ? CAMERA.sprintFov : CAMERA.baseFov) +
      this.fovPunch;
    this.fov = THREE.MathUtils.damp(this.fov, target, 14, dt);
    this.engine.setFov(this.fov);
  }

  private handleWeaponSwitch() {
    for (let i = 0; i < SELECT_KEYS.length; i++) {
      if (this.input.wasPressed(SELECT_KEYS[i])) this.arsenal.selectIndex(i);
    }
    if (this.input.wasPressed("KeyQ")) this.arsenal.next();
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
      this.handleWeaponSwitch();
      this.weapon.update(dt, {
        aiming,
        moving: this.player.isMoving,
        sprinting: this.player.sprinting,
      });

      // Shooting — auto weapons fire while held, others one shot per click.
      const wantFire = this.weapon.def.auto
        ? this.input.mouseDown
        : this.input.wasMousePressed();
      if (wantFire && this.player.locked) {
        const targets = [...this.enemies.colliders, ...this.obstacles.raycastMeshes];
        const result = this.weapon.tryFire(targets);
        if (result) {
          let hit = false;
          let killed = false;
          for (const impact of result.impacts) {
            if (!impact.object) continue;
            const r = this.enemies.damageFromHit(impact.object, result.damagePerPellet);
            hit = hit || r.hit;
            killed = killed || r.killed;
          }
          if (hit) {
            this.hud.showHitmarker(killed);
            this.sfx.hit();
          }
        }
      }
      if (this.input.wasPressed("KeyR")) this.weapon.startReload();
      this.arsenal.checkDry();

      // Enemies + loot + damage.
      const playerPos = this.player.object.position;
      this.loot.update(dt, this.elapsed, playerPos);
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
      weaponName: () => this.weapon.def.name,
      startGame: () => this.startGame(),
      spawnCurrentWave: () => this.enemies.startLevel(LEVELS[this.levelIndex]),
      forcePlay: (idx = 0) => {
        this.levelIndex = Math.max(0, Math.min(idx, LEVELS.length - 1));
        const level = LEVELS[this.levelIndex];
        this.environment.applyPalette(level, this.engine.scene);
        this.obstacles.build(level);
        this.loot.clear();
        this.player.reset();
        this.arsenal.reset();
        this.arsenal.giveAmmo();
        this.screens.hide();
        this.hud.show();
        this.hud.setLevel(level.name);
        this.hud.setWeapons(this.arsenal.view());
        this.hud.setWeaponName(this.weapon.def.name);
        this.enemies.startLevel(level);
        this.seedLevelLoot();
        this.state = "playing";
      },
      // Screenshot helpers.
      equipWeapon: (id: WeaponId) => {
        this.arsenal.giveWeapon(id);
      },
      spawnLootAhead: (kind: LootData["kind"], weaponId?: WeaponId) => {
        const p = this.player.object.position;
        this.loot.spawn(new THREE.Vector3(p.x, 0, p.z - 6), { kind, weaponId });
      },
    };
  }
}
