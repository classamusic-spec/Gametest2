import * as THREE from "three";
import { Enemy, type EnemyStats } from "./Enemy";
import type { AlienType } from "../levels/levels";

/**
 * Builds each alien procedurally from primitives + emissive materials.
 * Differentiation comes from silhouette, palette, glow and motion style —
 * no external 3D assets required.
 */

function invisibleHitbox(w: number, h: number, d: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  mesh.position.y = h / 2;
  return mesh;
}

function emissiveMat(color: number, emissive: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.9,
    roughness: 0.5,
    metalness: 0.3,
    ...opts,
  });
}

function addShadow(group: THREE.Group) {
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
    }
  });
}

// ---------- Grey ----------
function buildGrey(): Enemy {
  const g = new THREE.Group();
  const skin = emissiveMat(0xc9d6dc, 0x223040, { roughness: 0.4, metalness: 0.1 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 6, 12), skin);
  body.position.y = 0.95;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 20), skin);
  head.scale.set(1, 1.2, 0.95);
  head.position.y = 1.75;
  g.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: 0x0a0a14,
    roughness: 0.1,
    metalness: 0.6,
  });
  const eyeGeo = new THREE.SphereGeometry(0.13, 12, 10);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.scale.set(0.7, 1.5, 0.6);
    eye.position.set(sx * 0.16, 1.78, 0.34);
    eye.rotation.z = sx * 0.5;
    g.add(eye);
  }
  // limbs
  const limb = emissiveMat(0xc9d6dc, 0x223040, { roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), limb);
    arm.position.set(sx * 0.34, 0.95, 0);
    arm.rotation.z = sx * 0.3;
    g.add(arm);
  }

  addShadow(g);
  const hitbox = invisibleHitbox(0.9, 2.2, 0.9);
  g.add(hitbox);

  const stats: EnemyStats = {
    health: 50,
    speed: 3.0,
    damage: 8,
    attackRange: 2.0,
    attackInterval: 1.0,
    scoreValue: 100,
    deathColor: 0x9fd8ff,
  };
  const enemy = new Enemy(g, hitbox, stats);
  enemy.animate = (e, _dt, t) => {
    head.position.y = 1.75 + Math.sin(t * 2) * 0.04;
    e.group.position.y = Math.abs(Math.sin(t * 3)) * 0.05;
  };
  return enemy;
}

// ---------- Insectoid ----------
function buildInsectoid(): Enemy {
  const g = new THREE.Group();
  const chitin = emissiveMat(0x1a3a14, 0x2f7a1f, { roughness: 0.25, metalness: 0.7 });

  const thorax = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), chitin);
  thorax.position.y = 0.7;
  g.add(thorax);
  const abdomen = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), chitin);
  abdomen.position.set(0, 0.7, -0.55);
  abdomen.scale.set(1, 0.8, 1.3);
  g.add(abdomen);
  const headSeg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), chitin);
  headSeg.position.set(0, 0.78, 0.45);
  g.add(headSeg);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xff2a2a,
    emissive: 0xff2020,
    emissiveIntensity: 2.2,
    roughness: 0.3,
  });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), eyeMat);
    eye.position.set(sx * 0.14, 0.82, 0.62);
    g.add(eye);
  }

  // legs
  const legMat = emissiveMat(0x0f2a0c, 0x1f5a14, { roughness: 0.4, metalness: 0.6 });
  const legs: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.9, 6), legMat);
      leg.position.set(sx * 0.42, 0.45, 0.25 - i * 0.32);
      leg.rotation.z = sx * 0.9;
      g.add(leg);
      legs.push(leg);
    }
  }

  addShadow(g);
  const hitbox = invisibleHitbox(1.1, 1.4, 1.6);
  g.add(hitbox);

  const stats: EnemyStats = {
    health: 35,
    speed: 5.6,
    damage: 6,
    attackRange: 1.8,
    attackInterval: 0.7,
    scoreValue: 120,
    deathColor: 0x57ff2f,
  };
  const enemy = new Enemy(g, hitbox, stats);
  enemy.animate = (e, _dt, t) => {
    legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(t * 16 + i) * 0.4;
    });
    e.group.position.y = Math.abs(Math.sin(t * 10)) * 0.08;
  };
  return enemy;
}

// ---------- Evil Nordic ----------
function buildNordic(): Enemy {
  const g = new THREE.Group();
  const skin = emissiveMat(0xdfe8f5, 0x2a4a7a, { roughness: 0.45, metalness: 0.15 });
  const armor = emissiveMat(0x6f8db5, 0x223a66, { roughness: 0.2, metalness: 0.85 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.9, 6, 12), armor);
  torso.position.y = 1.25;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), skin);
  head.position.y = 2.05;
  g.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x6fd0ff,
    emissive: 0x4fb0ff,
    emissiveIntensity: 2.4,
  });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.04), eyeMat);
    eye.position.set(sx * 0.12, 2.08, 0.27);
    g.add(eye);
  }

  // arms + legs
  const arms: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 4, 8), skin);
    arm.position.set(sx * 0.46, 1.25, 0);
    g.add(arm);
    arms.push(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.85, 4, 8), armor);
    leg.position.set(sx * 0.18, 0.5, 0);
    g.add(leg);
  }
  // shoulder glow accents
  for (const sx of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), eyeMat);
    pad.position.set(sx * 0.42, 1.7, 0);
    pad.scale.set(1, 0.6, 1);
    g.add(pad);
  }

  addShadow(g);
  const hitbox = invisibleHitbox(1.0, 2.4, 0.8);
  g.add(hitbox);

  const stats: EnemyStats = {
    health: 90,
    speed: 3.8,
    damage: 12,
    attackRange: 2.1,
    attackInterval: 1.1,
    scoreValue: 180,
    deathColor: 0x6fd0ff,
    ranged: {
      fireInterval: 1.9,
      projectileSpeed: 26,
      projectileDamage: 11,
      preferredRange: 15,
      color: 0x6fd0ff,
    },
  };
  const enemy = new Enemy(g, hitbox, stats);
  enemy.animate = (_e, _dt, t) => {
    arms.forEach((arm, i) => {
      arm.rotation.x = Math.sin(t * 5 + i * Math.PI) * 0.5;
    });
  };
  return enemy;
}

// ---------- Evil Reptilian ----------
function buildReptilian(): Enemy {
  const g = new THREE.Group();
  const scale = emissiveMat(0x1f4d24, 0x2f7a2a, { roughness: 0.55, metalness: 0.5 });
  const belly = emissiveMat(0x3a6b2f, 0x4a8a32, { roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), scale);
  torso.position.y = 1.3;
  torso.scale.set(1.1, 1.2, 1);
  g.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), belly);
  chest.position.set(0, 1.15, 0.35);
  chest.scale.set(0.9, 1.1, 0.7);
  g.add(chest);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 8), scale);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 1.95, 0.35);
  g.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffe14a,
    emissive: 0xffd000,
    emissiveIntensity: 2.6,
  });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeMat);
    eye.scale.set(0.5, 1.4, 0.5);
    eye.position.set(sx * 0.14, 2.0, 0.55);
    g.add(eye);
  }

  // ridged back spines
  for (let i = 0; i < 5; i++) {
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 6), scale);
    spine.position.set(0, 1.7 - i * 0.18, -0.4 - i * 0.05);
    g.add(spine);
  }

  // heavy legs + arms
  const legs: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.7, 4, 8), scale);
    leg.position.set(sx * 0.28, 0.5, 0);
    g.add(leg);
    legs.push(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.7, 4, 8), scale);
    arm.position.set(sx * 0.6, 1.25, 0.1);
    arm.rotation.z = sx * 0.4;
    g.add(arm);
  }

  addShadow(g);
  const hitbox = invisibleHitbox(1.6, 2.5, 1.4);
  g.add(hitbox);

  const stats: EnemyStats = {
    health: 150,
    speed: 2.4,
    damage: 20,
    attackRange: 2.6,
    attackInterval: 1.3,
    scoreValue: 260,
    deathColor: 0xffd000,
  };
  const enemy = new Enemy(g, hitbox, stats);
  enemy.animate = (e, _dt, t) => {
    // heavy lumber
    e.group.position.y = Math.abs(Math.sin(t * 3)) * 0.07;
    legs.forEach((leg, i) => {
      leg.rotation.x = Math.sin(t * 3 + i * Math.PI) * 0.3;
    });
  };
  return enemy;
}

// ---------- Reptilian Warlord (boss) ----------
function buildBoss(): Enemy {
  const g = new THREE.Group();
  const scale = emissiveMat(0x244d24, 0x2f7a2a, { roughness: 0.5, metalness: 0.55 });
  const armor = emissiveMat(0x3a2010, 0x6a3010, { roughness: 0.4, metalness: 0.7 });
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xff7a1f,
    emissive: 0xff5a00,
    emissiveIntensity: 3,
  });

  const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), scale);
  torso.position.y = 3.0;
  torso.scale.set(1.2, 1.3, 1.05);
  g.add(torso);

  // Glowing chest core (weak point look).
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), coreMat);
  core.position.set(0, 2.9, 0.95);
  g.add(core);

  const head = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.6, 8), scale);
  head.rotation.x = Math.PI / 2;
  head.position.set(0, 4.4, 0.7);
  g.add(head);

  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xffe14a,
    emissive: 0xffd000,
    emissiveIntensity: 3.2,
  });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), eyeMat);
    eye.scale.set(0.5, 1.5, 0.5);
    eye.position.set(sx * 0.3, 4.5, 1.2);
    g.add(eye);
  }

  // Horn crown.
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - 0.5) * 2.2;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.9, 6), armor);
    horn.position.set(Math.sin(a) * 0.7, 5.0, 0.2 + Math.cos(a) * 0.2);
    horn.rotation.z = -a * 0.6;
    g.add(horn);
  }

  // Back spines.
  for (let i = 0; i < 6; i++) {
    const spine = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 6), scale);
    spine.position.set(0, 3.8 - i * 0.4, -1.0 - i * 0.08);
    g.add(spine);
  }

  // Heavy limbs.
  const arms: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.4, 5, 9), scale);
    leg.position.set(sx * 0.7, 1.2, 0);
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.5, 5, 9), scale);
    arm.position.set(sx * 1.5, 2.9, 0.2);
    arm.rotation.z = sx * 0.5;
    g.add(arm);
    arms.push(arm);
  }

  addShadow(g);
  const hitbox = invisibleHitbox(3.4, 5.4, 3.0);
  g.add(hitbox);

  const stats: EnemyStats = {
    health: 2600,
    speed: 2.2,
    damage: 34,
    attackRange: 4.2,
    attackInterval: 1.2,
    scoreValue: 2500,
    deathColor: 0xff7a1f,
    ranged: {
      fireInterval: 2.6,
      projectileSpeed: 20,
      projectileDamage: 13,
      preferredRange: 10,
      burst: 5,
      spread: 0.6,
      color: 0xff7a1f,
    },
  };
  const enemy = new Enemy(g, hitbox, stats);
  enemy.isBoss = true;
  enemy.animate = (e, _dt, t) => {
    e.group.position.y = Math.abs(Math.sin(t * 2)) * 0.12;
    core.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
    arms.forEach((arm, i) => {
      arm.rotation.x = Math.sin(t * 2.2 + i * Math.PI) * 0.35;
    });
  };
  return enemy;
}

export function createEnemy(type: AlienType): Enemy {
  switch (type) {
    case "grey":
      return buildGrey();
    case "insectoid":
      return buildInsectoid();
    case "nordic":
      return buildNordic();
    case "reptilian":
      return buildReptilian();
  }
}

export function createBoss(): Enemy {
  return buildBoss();
}
