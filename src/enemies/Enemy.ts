import * as THREE from "three";
import { Health } from "../player/Health";
import { ARENA } from "../constants";

export interface RangedSpec {
  fireInterval: number; // seconds between volleys
  projectileSpeed: number;
  projectileDamage: number;
  preferredRange: number; // hold this distance and shoot
  burst?: number; // bolts per volley (1 if omitted)
  spread?: number; // total spread angle (radians) for a burst
  color: number;
}

export interface EnemyStats {
  health: number;
  speed: number; // m/s
  damage: number;
  attackRange: number;
  attackInterval: number; // seconds between melee hits
  scoreValue: number;
  /** Color used for the death explosion. */
  deathColor: number;
  /** Optional ranged attack (Nordics, boss). */
  ranged?: RangedSpec;
}

/**
 * Base alien: chases the player, attacks in melee and/or at range, resolves
 * against cover, and exposes a hitbox mesh for the weapon raycaster.
 */
export class Enemy {
  readonly group: THREE.Group;
  readonly hitbox: THREE.Mesh;
  readonly health: Health;
  readonly stats: EnemyStats;
  state: "spawning" | "chasing" | "dead" = "spawning";
  isBoss = false;
  private attackTimer = 0;
  private fireTimer: number;
  private spawnTimer = 0.45;
  private bobPhase = Math.random() * Math.PI * 2;
  private muzzleHeight = 1.4;
  private slideSign = Math.random() < 0.5 ? 1 : -1;

  /** Per-instance animation hook set by the factory. */
  animate?: (enemy: Enemy, dt: number, t: number) => void;
  /** Set by EnemyManager: spawn a projectile from origin in a direction. */
  onFireProjectile?: (origin: THREE.Vector3, dir: THREE.Vector3, spec: RangedSpec) => void;
  /** Set by EnemyManager: push this enemy out of cover. */
  resolveCollision?: (pos: THREE.Vector3, radius: number) => void;

  constructor(group: THREE.Group, hitbox: THREE.Mesh, stats: EnemyStats) {
    this.group = group;
    this.hitbox = hitbox;
    this.stats = stats;
    this.health = new Health(stats.health);
    this.fireTimer = stats.ranged ? 1.2 + Math.random() : 0;
    // Back-reference so the raycaster can resolve hits to this enemy.
    this.hitbox.userData.enemy = this;
    this.group.scale.setScalar(0.01); // pop-in grow
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get collisionRadius(): number {
    return this.isBoss ? 2.2 : 0.7;
  }

  /**
   * @returns the melee contact damage to deal this frame (0 if none).
   */
  update(dt: number, t: number, playerPos: THREE.Vector3): number {
    if (this.state === "dead") return 0;

    // Spawn-in scale animation (bosses keep their authored scale).
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
      this.group.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    }

    let contactDamage = 0;
    if (this.state === "chasing") {
      const ranged = this.stats.ranged;
      const dir = toPlayer.clone().normalize();

      if (ranged) {
        // Kite: hold preferred range, back off if too close, advance if too far.
        const near = ranged.preferredRange * 0.7;
        const far = ranged.preferredRange * 1.25;
        if (dist > far) this.step(dir, this.stats.speed * dt);
        else if (dist < near) this.step(dir, -this.stats.speed * 0.7 * dt);

        // Fire on cadence whenever roughly in range.
        this.fireTimer -= dt;
        if (this.fireTimer <= 0 && dist < far * 1.4) {
          this.fireTimer = ranged.fireInterval;
          this.fireVolley(playerPos, ranged);
        }
      } else if (dist > this.stats.attackRange) {
        this.step(dir, this.stats.speed * dt);
      }

      // Melee when close enough (ranged units can still bite).
      if (dist <= this.stats.attackRange) {
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

  private step(dir: THREE.Vector3, amount: number) {
    const limit = ARENA.halfSize - 1;
    const prevX = this.position.x;
    const prevZ = this.position.z;

    this.position.x = THREE.MathUtils.clamp(this.position.x + dir.x * amount, -limit, limit);
    this.position.z = THREE.MathUtils.clamp(this.position.z + dir.z * amount, -limit, limit);
    this.resolveCollision?.(this.position, this.collisionRadius);

    // If cover blocked us (we barely advanced) while moving forward, slide
    // sideways so we round the obstacle instead of sticking to it.
    if (amount > 0) {
      const dxm = this.position.x - prevX;
      const dzm = this.position.z - prevZ;
      if (dxm * dxm + dzm * dzm < amount * amount * 0.25) {
        const sx = -dir.z * this.slideSign;
        const sz = dir.x * this.slideSign;
        this.position.x = THREE.MathUtils.clamp(this.position.x + sx * amount, -limit, limit);
        this.position.z = THREE.MathUtils.clamp(this.position.z + sz * amount, -limit, limit);
        this.resolveCollision?.(this.position, this.collisionRadius);
      }
    }
  }

  private fireVolley(playerPos: THREE.Vector3, ranged: RangedSpec) {
    if (!this.onFireProjectile) return;
    const origin = this.position.clone();
    origin.y = this.muzzleHeight * this.group.scale.y;
    const base = new THREE.Vector3(
      playerPos.x - origin.x,
      playerPos.y - origin.y,
      playerPos.z - origin.z,
    ).normalize();

    const burst = ranged.burst ?? 1;
    const spread = ranged.spread ?? 0;
    for (let i = 0; i < burst; i++) {
      const a = burst > 1 ? (i / (burst - 1) - 0.5) * spread : 0;
      const dir = base.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
      this.onFireProjectile(origin.clone(), dir, ranged);
    }
  }

  /** @returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    if (this.state === "dead") return false;
    const fatal = this.health.damage(amount);
    if (fatal) this.state = "dead";
    return fatal;
  }
}
