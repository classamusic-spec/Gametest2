import * as THREE from "three";
import { ARENA } from "../constants";
import type { LevelConfig } from "../levels/levels";

interface CoverDef {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/** Small deterministic RNG so each level's layout is fixed and fair. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a richer, deterministic cover layout for a level: a central fort,
 * a ring of pillars, and scattered crates/barriers — kept clear of the
 * player's start and the boss spawn.
 */
function generateLayout(level: LevelConfig): CoverDef[] {
  const rng = mulberry32(level.id * 1013 + 7);
  const defs: CoverDef[] = [];
  const limit = ARENA.halfSize - 6;
  const playerStartZ = ARENA.halfSize - 8;

  const tooClose = (x: number, z: number, pad: number) => {
    // Keep clear of player start and boss spawn (0, 8) and dead center.
    if (Math.hypot(x - 0, z - playerStartZ) < 10 + pad) return true;
    if (Math.hypot(x - 0, z - 8) < 8 + pad) return true;
    for (const d of defs) {
      if (Math.hypot(x - d.x, z - d.z) < Math.max(d.w, d.d) + pad + 2) return true;
    }
    return false;
  };

  // Central fort: a small cluster of crates.
  const fort: [number, number][] = [
    [-4, -6],
    [4, -6],
    [-4, -14],
    [4, -14],
    [0, -10],
  ];
  for (const [x, z] of fort) {
    defs.push({ x, z, w: 3.2, h: 2.8, d: 3.2 });
  }

  // Ring of tall pillars.
  const pillars = 8;
  const ringR = ARENA.halfSize * 0.62;
  for (let i = 0; i < pillars; i++) {
    const a = (i / pillars) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * ringR;
    const z = Math.sin(a) * ringR;
    if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
    defs.push({ x, z, w: 1.6, h: 7, d: 1.6 });
  }

  // Scattered crates and barriers.
  let placed = 0;
  let attempts = 0;
  while (placed < 14 && attempts < 200) {
    attempts++;
    const x = (rng() * 2 - 1) * limit;
    const z = (rng() * 2 - 1) * limit;
    if (tooClose(x, z, 1)) continue;
    const barrier = rng() < 0.4;
    if (barrier) {
      const horiz = rng() < 0.5;
      defs.push({
        x,
        z,
        w: horiz ? 4.5 : 1,
        h: 1.6,
        d: horiz ? 1 : 4.5,
      });
    } else {
      const s = 2.4 + rng() * 1.6;
      defs.push({ x, z, w: s, h: 2.2 + rng() * 1.4, d: s });
    }
    placed++;
  }

  return defs;
}

/**
 * Cover field: builds meshes and AABBs, blocks shots/projectiles via the
 * meshes, and resolves circle-vs-box collision for the player and enemies.
 * Rebuilt per level via build().
 */
export class Obstacles {
  readonly group = new THREE.Group();
  readonly boxes: THREE.Box3[] = [];
  private meshes: THREE.Mesh[] = [];
  private mat: THREE.MeshStandardMaterial;
  private edgeMat: THREE.LineBasicMaterial;

  constructor() {
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x141c2c,
      emissive: 0x0c2440,
      emissiveIntensity: 0.5,
      roughness: 0.55,
      metalness: 0.65,
    });
    this.edgeMat = new THREE.LineBasicMaterial({ color: 0x36e3ff });
  }

  /** Regenerate cover for a level and recolor to its palette. */
  build(level: LevelConfig) {
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose?.();
    }
    this.meshes = [];
    this.boxes.length = 0;
    this.edgeMat.color.setHex(level.palette.grid);
    this.mat.emissive.setHex(level.palette.fog);

    for (const c of generateLayout(level)) {
      const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.position.set(c.x, c.h / 2, c.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.meshes.push(mesh);

      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.edgeMat);
      edges.position.copy(mesh.position);
      this.group.add(edges);

      this.boxes.push(
        new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(c.x, c.h / 2, c.z),
          new THREE.Vector3(c.w, c.h, c.d),
        ),
      );
    }
  }

  /** Meshes to include in the weapon raycast so shots are blocked by cover. */
  get raycastMeshes(): THREE.Object3D[] {
    return this.meshes;
  }

  /** True if the point (any height) is inside a cover box — used by projectiles. */
  contains(p: THREE.Vector3): boolean {
    for (const b of this.boxes) {
      if (
        p.x >= b.min.x &&
        p.x <= b.max.x &&
        p.z >= b.min.z &&
        p.z <= b.max.z &&
        p.y >= b.min.y &&
        p.y <= b.max.y
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Push a circle of `radius` centered at `pos` (XZ) out of any cover box.
   * Mutates and returns pos.
   */
  resolve(pos: THREE.Vector3, radius: number): THREE.Vector3 {
    for (const b of this.boxes) {
      const closestX = THREE.MathUtils.clamp(pos.x, b.min.x, b.max.x);
      const closestZ = THREE.MathUtils.clamp(pos.z, b.min.z, b.max.z);
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq > radius * radius) continue;

      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else {
        const toLeft = pos.x - b.min.x;
        const toRight = b.max.x - pos.x;
        const toNear = pos.z - b.min.z;
        const toFar = b.max.z - pos.z;
        const minPen = Math.min(toLeft, toRight, toNear, toFar);
        if (minPen === toLeft) pos.x = b.min.x - radius;
        else if (minPen === toRight) pos.x = b.max.x + radius;
        else if (minPen === toNear) pos.z = b.min.z - radius;
        else pos.z = b.max.z + radius;
      }
    }
    return pos;
  }
}
