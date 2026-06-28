import * as THREE from "three";
import { ARENA, PROJECTILE, PLAYER } from "../constants";
import type { Particles } from "../fx/Particles";
import type { Obstacles } from "../world/Obstacles";

interface Bolt {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
  color: number;
}

/**
 * Glowing enemy plasma bolts. They travel in a straight line, are blocked
 * by cover and arena walls, and damage the player on contact.
 */
export class Projectiles {
  private scene: THREE.Scene;
  private particles: Particles;
  private bolts: Bolt[] = [];
  private geo = new THREE.SphereGeometry(PROJECTILE.radius, 12, 10);

  constructor(scene: THREE.Scene, particles: Particles) {
    this.scene = scene;
    this.particles = particles;
  }

  get count(): number {
    return this.bolts.length;
  }

  spawn(origin: THREE.Vector3, dir: THREE.Vector3, speed: number, damage: number, color: number) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 3,
    });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.copy(origin);
    const light = new THREE.PointLight(color, 1.6, 6, 2);
    mesh.add(light);
    this.scene.add(mesh);
    this.bolts.push({
      mesh,
      light,
      velocity: dir.clone().normalize().multiplyScalar(speed),
      damage,
      life: PROJECTILE.life,
      color,
    });
  }

  clear() {
    for (const b of this.bolts) {
      this.scene.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
    this.bolts.length = 0;
  }

  /** @returns total damage dealt to the player this frame. */
  update(dt: number, playerPos: THREE.Vector3, obstacles: Obstacles): number {
    let damage = 0;
    const limit = ARENA.halfSize - 0.5;

    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.mesh.position.addScaledVector(b.velocity, dt);
      b.life -= dt;

      const p = b.mesh.position;
      let dead = false;
      let impact = false;

      // Player hit (sphere vs player capsule, ignore height).
      const dx = p.x - playerPos.x;
      const dz = p.z - playerPos.z;
      const dy = p.y - playerPos.y;
      if (Math.abs(dy) < 1.4 && dx * dx + dz * dz < (PLAYER.radius + PROJECTILE.radius) ** 2) {
        damage += b.damage;
        dead = true;
        impact = true;
      } else if (Math.abs(p.x) > limit || Math.abs(p.z) > limit || p.y < 0.1 || p.y > ARENA.wallHeight) {
        dead = true;
        impact = true;
      } else if (obstacles.contains(p)) {
        dead = true;
        impact = true;
      } else if (b.life <= 0) {
        dead = true;
      }

      if (dead) {
        if (impact) this.particles.burst(p.clone(), b.color, 12, 4, 0.14, 0.3);
        this.scene.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.bolts.splice(i, 1);
      }
    }
    return damage;
  }
}
