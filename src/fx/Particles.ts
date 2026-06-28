import * as THREE from "three";

interface Burst {
  points: THREE.Points;
  velocities: THREE.Vector3[];
  life: number;
  maxLife: number;
  material: THREE.PointsMaterial;
}

/**
 * Pooled additive particle bursts for hit sparks and death explosions.
 * Additive blending + bloom makes these read as bright energy.
 */
export class Particles {
  private scene: THREE.Scene;
  private active: Burst[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(
    origin: THREE.Vector3,
    color: number,
    count: number,
    speed: number,
    size = 0.18,
    life = 0.5,
  ) {
    const positions = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      )
        .normalize()
        .multiplyScalar(speed * (0.4 + Math.random() * 0.6));
      velocities.push(dir);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, material);
    this.scene.add(points);
    this.active.push({ points, velocities, life, maxLife: life, material });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const b = this.active[i];
      b.life -= dt;
      const pos = b.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let p = 0; p < b.velocities.length; p++) {
        const v = b.velocities[p];
        arr[p * 3] += v.x * dt;
        arr[p * 3 + 1] += v.y * dt;
        arr[p * 3 + 2] += v.z * dt;
        v.multiplyScalar(0.92); // drag
        v.y -= 2 * dt; // slight gravity
      }
      pos.needsUpdate = true;
      b.material.opacity = Math.max(0, b.life / b.maxLife);

      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.material.dispose();
        this.active.splice(i, 1);
      }
    }
  }
}
