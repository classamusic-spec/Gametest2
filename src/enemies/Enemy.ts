import * as THREE from "three";
import { Health } from "../player/Health";
import { ARENA } from "../constants";

export interface EnemyStats {
  health: number;
  speed: number; // m/s
  damage: number;
  attackRange: number;
  attackInterval: number; // seconds between hits
  scoreValue: number;
  /** Color used for the death explosion. */
  deathColor: number;
}

/**
 * Base alien: chases the player on the ground plane, attacks in range,
 * and exposes a hitbox mesh for the weapon raycaster.
 */
export class Enemy {
  readonly group: THREE.Group;
  readonly hitbox: THREE.Mesh;
  readonly health: Health;
  readonly stats: EnemyStats;
  state: "spawning" | "chasing" | "dead" = "spawning";
  private attackTimer = 0;
  private spawnTimer = 0.45;
  private bobPhase = Math.random() * Math.PI * 2;
  /** Per-instance animation hook set by the factory. */
  animate?: (enemy: Enemy, dt: number, t: number) => void;

  constructor(group: THREE.Group, hitbox: THREE.Mesh, stats: EnemyStats) {
    this.group = group;
    this.hitbox = hitbox;
    this.stats = stats;
    this.health = new Health(stats.health);
    // Back-reference so the raycaster can resolve hits to this enemy.
    this.hitbox.userData.enemy = this;
    this.group.scale.setScalar(0.01); // pop-in grow
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  /**
   * @returns the contact damage to deal this frame (0 if none).
   */
  update(dt: number, t: number, playerPos: THREE.Vector3): number {
    if (this.state === "dead") return 0;

    // Spawn-in scale animation.
    if (this.state === "spawning") {
      this.spawnTimer -= dt;
      const k = THREE.MathUtils.clamp(1 - this.spawnTimer / 0.45, 0, 1);
      this.group.scale.setScalar(THREE.MathUtils.lerp(0.01, 1, k));
      if (this.spawnTimer <= 0) {
        this.state = "chasing";
        this.group.scale.setScalar(1);
      }
    }

    const toPlayer = new THREE.Vector3(
      playerPos.x - this.position.x,
      0,
      playerPos.z - this.position.z,
    );
    const dist = toPlayer.length();

    // Face the player.
    if (dist > 0.001) {
      const angle = Math.atan2(toPlayer.x, toPlayer.z);
      this.group.rotation.y = angle;
    }

    let contactDamage = 0;
    if (this.state === "chasing") {
      if (dist > this.stats.attackRange) {
        toPlayer.normalize();
        this.position.x += toPlayer.x * this.stats.speed * dt;
        this.position.z += toPlayer.z * this.stats.speed * dt;
        // Keep inside the arena.
        const limit = ARENA.halfSize - 1;
        this.position.x = THREE.MathUtils.clamp(this.position.x, -limit, limit);
        this.position.z = THREE.MathUtils.clamp(this.position.z, -limit, limit);
      } else {
        // In range — attack on cadence.
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
          this.attackTimer = this.stats.attackInterval;
          contactDamage = this.stats.damage;
        }
      }
    }

    if (this.animate) this.animate(this, dt, t + this.bobPhase);
    return contactDamage;
  }

  /** @returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    if (this.state === "dead") return false;
    const fatal = this.health.damage(amount);
    if (fatal) this.state = "dead";
    return fatal;
  }
}
