import * as THREE from "three";
import type { LevelConfig } from "../levels/levels";

interface CoverDef {
  x: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind: "crate" | "pillar" | "barrier";
}

/**
 * Fixed cover layout (crates, pillars, barriers) for tactical play.
 * Positions are deterministic so each arena reads the same and is fair.
 * Avoids the player start zone near +Z and the dead center.
 */
const LAYOUT: CoverDef[] = [
  { x: -10, z: 6, w: 3, h: 2.6, d: 3, kind: "crate" },
  { x: 11, z: 4, w: 3, h: 2.6, d: 3, kind: "crate" },
  { x: 0, z: -8, w: 5, h: 1.5, d: 1, kind: "barrier" },
  { x: -16, z: -10, w: 1.4, h: 6, d: 1.4, kind: "pillar" },
  { x: 16, z: -12, w: 1.4, h: 6, d: 1.4, kind: "pillar" },
  { x: -6, z: -18, w: 3, h: 2.6, d: 3, kind: "crate" },
  { x: 8, z: -20, w: 4, h: 1.5, d: 1, kind: "barrier" },
  { x: -20, z: 12, w: 1.4, h: 6, d: 1.4, kind: "pillar" },
  { x: 20, z: 14, w: 1.4, h: 6, d: 1.4, kind: "pillar" },
  { x: 0, z: -28, w: 3.2, h: 3.2, d: 3.2, kind: "crate" },
  { x: -13, z: 18, w: 4, h: 1.5, d: 1, kind: "barrier" },
  { x: 13, z: 20, w: 3, h: 2.6, d: 3, kind: "crate" },
];

/**
 * Cover field: builds meshes and AABBs, blocks shots/projectiles via the
 * meshes, and resolves circle-vs-box collision for the player and enemies.
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

    for (const c of LAYOUT) {
      const geo = new THREE.BoxGeometry(c.w, c.h, c.d);
      const mesh = new THREE.Mesh(geo, this.mat);
      mesh.position.set(c.x, c.h / 2, c.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.meshes.push(mesh);

      // Neon edge outline for the sci-fi look.
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), this.edgeMat);
      edges.position.copy(mesh.position);
      this.group.add(edges);

      // Collision box, slightly inflated, treated as full-height in XZ.
      const box = new THREE.Box3().setFromCenterAndSize(
        new THREE.Vector3(c.x, c.h / 2, c.z),
        new THREE.Vector3(c.w, c.h, c.d),
      );
      this.boxes.push(box);
    }
  }

  /** Recolor cover edges to match the level palette. */
  applyPalette(level: LevelConfig) {
    this.edgeMat.color.setHex(level.palette.grid);
    this.mat.emissive.setHex(level.palette.fog);
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
        // Outside the box but overlapping the circle — push out radially.
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else {
        // Center is inside the box — eject along the smallest penetration axis.
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
