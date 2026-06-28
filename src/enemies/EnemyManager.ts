import * as THREE from "three";
import { Enemy } from "./Enemy";
import { createEnemy } from "./EnemyFactory";
import { ARENA } from "../constants";
import type { LevelConfig } from "../levels/levels";
import type { Particles } from "../fx/Particles";

/**
 * Spawns a level's wave over time, updates all live aliens, and tracks
 * how many remain (alive + still-to-spawn) for the win condition.
 */
export class EnemyManager {
  readonly enemies: Enemy[] = [];
  private scene: THREE.Scene;
  private particles: Particles;
  private level: LevelConfig | null = null;
  private toSpawn = 0;
  private spawnTimer = 0;
  private lastPlayerPos = new THREE.Vector3();

  /** Called when an enemy dies; passes its score value. */
  onKill?: (scoreValue: number) => void;

  constructor(scene: THREE.Scene, particles: Particles) {
    this.scene = scene;
    this.particles = particles;
  }

  /** Live hitboxes for the weapon raycaster. */
  get colliders(): THREE.Object3D[] {
    return this.enemies.filter((e) => e.state !== "dead").map((e) => e.hitbox);
  }

  /** Remaining = still alive + queued to spawn. Level clears when this hits 0. */
  get remaining(): number {
    return this.toSpawn + this.enemies.filter((e) => e.state !== "dead").length;
  }

  startLevel(level: LevelConfig) {
    this.clear();
    this.level = level;
    this.toSpawn = level.count;
    this.spawnTimer = 0.5;
  }

  clear() {
    for (const e of this.enemies) this.scene.remove(e.group);
    this.enemies.length = 0;
    this.toSpawn = 0;
    this.level = null;
  }

  private aliveCount(): number {
    return this.enemies.filter((e) => e.state !== "dead").length;
  }

  private spawnOne() {
    if (!this.level) return;
    const enemy = createEnemy(this.level.alienType);
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

  /** @returns total contact damage dealt to the player this frame. */
  update(dt: number, t: number, playerPos: THREE.Vector3): number {
    if (!this.level) return 0;
    this.lastPlayerPos.copy(playerPos);

    // Staggered spawning, capped by maxAlive.
    if (this.toSpawn > 0 && this.aliveCount() < this.level.maxAlive) {
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
  damageFromHit(hitObject: THREE.Object3D, amount: number) {
    const enemy = hitObject.userData.enemy as Enemy | undefined;
    if (!enemy || enemy.state === "dead") return;
    const killed = enemy.takeDamage(amount);
    if (killed) {
      const center = enemy.position.clone();
      center.y += 1;
      this.particles.burst(center, enemy.stats.deathColor, 40, 7, 0.22, 0.6);
      this.scene.remove(enemy.group);
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
      this.onKill?.(enemy.stats.scoreValue);
    } else {
      // Hit spark.
      this.particles.burst(enemy.position.clone().setY(1.4), 0xffffff, 10, 4, 0.12, 0.25);
    }
  }
}
