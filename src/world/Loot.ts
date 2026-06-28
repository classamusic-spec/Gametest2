import * as THREE from "three";
import type { Particles } from "../fx/Particles";
import type { WeaponId } from "../weapons/WeaponTypes";

export type LootKind = "weapon" | "ammo" | "health";

export interface LootData {
  kind: LootKind;
  weaponId?: WeaponId;
}

interface LootBox {
  group: THREE.Group;
  data: LootData;
  color: number;
  life: number;
  spin: number;
}

const COLORS: Record<LootKind, number> = {
  weapon: 0x36e3ff,
  ammo: 0xffd24d,
  health: 0x4dff9e,
};

const PICKUP_RADIUS = 2.4;
const LIFETIME = 26;

/**
 * Glowing loot crates with a light beam. Walk over one to collect it; the
 * Game applies the effect (weapon unlock / ammo / health) via onCollect.
 */
export class Loot {
  private scene: THREE.Scene;
  private particles: Particles;
  private boxes: LootBox[] = [];

  /** Called when the player picks up a crate. */
  onCollect?: (data: LootData) => void;

  constructor(scene: THREE.Scene, particles: Particles) {
    this.scene = scene;
    this.particles = particles;
  }

  clear() {
    for (const b of this.boxes) this.scene.remove(b.group);
    this.boxes.length = 0;
  }

  spawn(pos: THREE.Vector3, data: LootData) {
    const color = COLORS[data.kind];
    const group = new THREE.Group();
    group.position.set(pos.x, 0, pos.z);

    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x10182a,
      emissive: color,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.7,
    });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), crateMat);
    crate.position.y = 0.9;
    crate.castShadow = true;
    group.add(crate);

    const glowMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 2.2,
    });
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(crate.geometry),
      new THREE.LineBasicMaterial({ color }),
    );
    edges.position.copy(crate.position);
    group.add(edges);

    group.add(this.buildIcon(data.kind, glowMat));

    // Vertical light beam.
    const beamMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 7, 16, 1, true), beamMat);
    beam.position.y = 3.5;
    group.add(beam);

    const light = new THREE.PointLight(color, 1.4, 7, 2);
    light.position.y = 1.0;
    group.add(light);

    this.scene.add(group);
    this.boxes.push({ group, data, color, life: LIFETIME, spin: 0 });
  }

  private buildIcon(kind: LootKind, mat: THREE.Material): THREE.Object3D {
    const icon = new THREE.Group();
    icon.position.y = 0.9;
    if (kind === "health") {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.12), mat);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), mat);
      icon.add(v, h);
    } else if (kind === "ammo") {
      for (let i = -1; i <= 1; i++) {
        const round = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 8), mat);
        round.position.x = i * 0.14;
        icon.add(round);
      }
    } else {
      // Weapon — a little gun glyph.
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.12), mat);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 0.12), mat);
      grip.position.set(-0.12, -0.16, 0);
      icon.add(body, grip);
    }
    return icon;
  }

  update(dt: number, t: number, playerPos: THREE.Vector3) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      b.life -= dt;
      b.spin += dt;
      // Bob + spin the crate/icon (children except beam/light at index >= 0).
      const crate = b.group.children[0];
      const edges = b.group.children[1];
      const icon = b.group.children[2];
      const bob = Math.sin(t * 2 + b.spin) * 0.12;
      crate.position.y = 0.9 + bob;
      edges.position.y = 0.9 + bob;
      crate.rotation.y = edges.rotation.y = t * 0.8;
      icon.position.y = 1.6 + bob;
      icon.rotation.y = t * 1.4;

      const dx = b.group.position.x - playerPos.x;
      const dz = b.group.position.z - playerPos.z;
      if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
        this.particles.burst(
          new THREE.Vector3(b.group.position.x, 1.2, b.group.position.z),
          b.color,
          24,
          5,
          0.16,
          0.4,
        );
        this.onCollect?.(b.data);
        this.scene.remove(b.group);
        this.boxes.splice(i, 1);
        continue;
      }

      if (b.life <= 0) {
        this.scene.remove(b.group);
        this.boxes.splice(i, 1);
      }
    }
  }
}
