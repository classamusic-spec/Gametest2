import * as THREE from "three";
import { Enemy } from "./Enemy";
import { createEnemy, createBoss } from "./EnemyFactory";
import { ARENA } from "../constants";
import type { LevelConfig } from "../levels/levels";
import type { Particles } from "../fx/Particles";
import type { Projectiles } from "../weapons/Projectiles";
import type { Obstacles } from "../world/Obstacles";

export interface HitResult {
  hit: boolean;
  killed: boolean;
  isBoss: boolean;
}

/**
 * Spawns a level's wave over time, drives all live aliens (including the
 * boss), routes their projectiles, and tracks how many remain.
 */
export class EnemyManager {
  readonly enemies: Enemy[] = [];
  private scene: THREE.Scene;
  private particles: Particles;
  private projectiles: Projectiles;
  private obstacles: Obstacles;
  private level: LevelConfig | null = null;
  private toSpawn = 0;
  private spawnTimer = 0;
  private lastPlayerPos = new THREE.Vector3();
  private bossRef: Enemy | null = null;

  /** Called when an enemy dies; passes its score value and the enemy. */
  onKill?: (scoreValue: number, enemy: Enemy) => void;
  /** Called when any enemy fires a projectile (for SFX). */
  onEnemyFire?: () => void;
  /** Called when the boss spawns (for roar SFX + UI). */
  onBossSpawn?: (boss: Enemy) => void;

  constructor(
    scene: THREE.Scene,
    particles: Particles,
    projectiles: Projectiles,
    obstacles: Obstacles,
  ) {
    this.scene = scene;
    this.particles = particles;
    this.projectiles = projectiles;
    this.obstacles = obstacles;
  }

  /** Live hitboxes for the weapon raycaster. */
  get colliders(): THREE.Object3D[] {
    return this.enemies.filter((e) => e.state !== "dead").map((e) => e.hitbox);
  }

  /** Remaining = still alive + queued to spawn. Level clears when this hits 0. */
  get remaining(): number {
    return this.toSpawn + this.enemies.filter((e) => e.state !== "dead").length;
  }

  get boss(): Enemy | null {
    return this.bossRef && this.bossRef.state !== "dead" ? this.bossRef : null;
  }

  private wire(enemy: Enemy) {
    enemy.resolveCollision = (pos, r) => this.obstacles.resolve(pos, r);
    enemy.onFireProjectile = (origin, dir, spec) => {
      this.projectiles.spawn(origin, dir, spec.projectileSpeed, spec.projectileDamage, spec.color);
      this.onEnemyFire?.();
    };
  }

  startLevel(level: LevelConfig) {
    this.clear();
    this.level = level;
    this.toSpawn = level.count;
    this.spawnTimer = 0.5;

    if (level.boss) {
      const boss = createBoss();
      // Open ground ahead of the player's start, clear of cover.
      boss.position.set(0, 0, 8);
      this.wire(boss);
      this.scene.add(boss.group);
      this.enemies.push(boss);
      this.bossRef = boss;
      this.onBossSpawn?.(boss);
    }
  }

  clear() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies.length = 0;
    this.projectiles.clear();
    this.toSpawn = 0;
    this.level = null;
    this.bossRef = null;
  }

  private aliveCount(): number {
    return this.enemies.filter((e) => e.state !== "dead").length;
  }

  private spawnOne() {
    if (!this.level) return;
    const type =
      this.level.mix && Math.random() < 0.25 ? this.level.mix : this.level.alienType;
    const enemy = createEnemy(type);
    this.wire(enemy);
    // Spawn at a moderate distance around the player so they close in from
    // all sides, clamped to stay inside the arena.
    const limit = ARENA.halfSize - 3;
    const dist = 18 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    enemy.position.set(
      THREE.MathUtils.clamp(this.lastPlayerPos.x + Math.cos(angle) * dist, -limit, limit),
      0,
      THREE.MathUtils.clamp(this.lastPlayerPos.z + Math.sin(angle) * dist, -limit, limit),
    );
    this.scene.add(enemy.group);
    this.enemies.push(enemy);
    this.toSpawn--;
  }

  /** @returns total contact (melee) damage dealt to the player this frame. */
  update(dt: number, t: number, playerPos: THREE.Vector3): number {
    if (!this.level) return 0;
    this.lastPlayerPos.copy(playerPos);

    // Staggered spawning, capped by maxAlive (boss doesn't count toward cap).
    const minions = this.aliveCount() - (this.boss ? 1 : 0);
    if (this.toSpawn > 0 && minions < this.level.maxAlive) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.level.spawnInterval;
        this.spawnOne();
      }
    }

    let damage = 0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.state === "dead") continue;
      damage += e.update(dt, t, playerPos);
    }
    return damage;
  }

  /** Resolve a raycast hit object to its enemy, apply damage, handle death. */
  damageFromHit(hitObject: THREE.Object3D, amount: number): HitResult {
    const enemy = hitObject.userData.enemy as Enemy | undefined;
    if (!enemy || enemy.state === "dead") return { hit: false, killed: false, isBoss: false };

    const killed = enemy.takeDamage(amount);
    if (killed) {
      const center = enemy.position.clone();
      center.y += enemy.isBoss ? 3 : 1;
      const n = enemy.isBoss ? 120 : 40;
      this.particles.burst(center, enemy.stats.deathColor, n, enemy.isBoss ? 14 : 7, 0.26, 0.8);
      if (enemy.isBoss) {
        this.particles.burst(center, 0xffffff, 80, 9, 0.2, 0.6);
      }
      this.scene.remove(enemy.group);
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
      if (this.bossRef === enemy) this.bossRef = null;
      this.onKill?.(enemy.stats.scoreValue, enemy);
      return { hit: true, killed: true, isBoss: enemy.isBoss };
    }

    // Hit spark.
    this.particles.burst(enemy.position.clone().setY(1.4), 0xffffff, 8, 4, 0.12, 0.22);
    return { hit: true, killed: false, isBoss: enemy.isBoss };
  }
}
