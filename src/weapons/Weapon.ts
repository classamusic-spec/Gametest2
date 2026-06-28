import * as THREE from "three";
import { WEAPON } from "../constants";

export interface FireResult {
  hitObject: THREE.Object3D | null;
  point: THREE.Vector3;
}

export interface WeaponInput {
  aiming: boolean;
  moving: boolean;
  sprinting: boolean;
}

/**
 * Hitscan plasma rifle with CoD-style feel: recoil kick, weapon bob,
 * aim-down-sights, bullet spread, muzzle flash and a glowing tracer.
 */
export class Weapon {
  ammo = WEAPON.magazine;
  reloading = false;
  aiming = false;
  private reloadTimer = 0;
  private cooldown = 0;
  private kick = 0; // recoil amount, springs back to 0
  private bobT = 0;
  private adsBlend = 0; // 0 = hip, 1 = aiming

  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private raycaster = new THREE.Raycaster();

  private viewmodel: THREE.Group;
  private muzzle: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private flashTimer = 0;
  private tracer: THREE.Line;
  private tracerTimer = 0;

  private hipPos = new THREE.Vector3(0.34, -0.32, -0.55);
  private adsPos = new THREE.Vector3(0.0, -0.14, -0.42);

  /** Notifies the HUD when ammo/reload state changes. */
  onAmmoChange?: () => void;
  /** Fired on a successful shot (for SFX, FOV punch, shake, crosshair). */
  onFired?: () => void;
  /** Fired when a reload begins (for SFX). */
  onReload?: () => void;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
    this.raycaster.far = WEAPON.range;

    this.viewmodel = this.buildViewmodel();
    this.camera.add(this.viewmodel);

    this.muzzle = this.viewmodel.getObjectByName("muzzle") as THREE.Mesh;
    this.muzzleLight = new THREE.PointLight(0x36e3ff, 0, 8, 2);
    this.muzzleLight.position.copy(this.muzzle.position);
    this.viewmodel.add(this.muzzleLight);

    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: 0x9ff4ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.tracer = new THREE.Line(geo, mat);
    this.tracer.frustumCulled = false;
    this.scene.add(this.tracer);
  }

  private buildViewmodel(): THREE.Group {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a2230,
      emissive: 0x0c2a44,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.8,
    });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x36e3ff,
      emissive: 0x36e3ff,
      emissiveIntensity: 0.9,
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.7), bodyMat);
    body.position.set(0, 0, -0.2);
    g.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.5, 12), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.5);
    g.add(barrel);

    // Iron-sight rail so ADS reads clearly.
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.16), bodyMat);
    sight.position.set(0, 0.12, -0.1);
    g.add(sight);

    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 8, 16), glowMat);
    coil.position.set(0, 0.02, -0.35);
    g.add(coil);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glowMat.clone());
    (muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    muzzle.name = "muzzle";
    muzzle.position.set(0, 0.02, -0.75);
    g.add(muzzle);

    g.position.copy(this.hipPos);
    g.scale.setScalar(0.85);
    return g;
  }

  reset() {
    this.ammo = WEAPON.magazine;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0;
    this.kick = 0;
    this.onAmmoChange?.();
  }

  startReload() {
    if (this.reloading || this.ammo === WEAPON.magazine) return;
    this.reloading = true;
    this.reloadTimer = WEAPON.reloadTime;
    this.onReload?.();
    this.onAmmoChange?.();
  }

  /** Attempt to fire. @returns the hit info, or null if it couldn't fire. */
  tryFire(targets: THREE.Object3D[]): FireResult | null {
    if (this.cooldown > 0 || this.reloading) return null;
    if (this.ammo <= 0) {
      this.startReload();
      return null;
    }

    this.cooldown = 1 / WEAPON.fireRate;
    this.ammo--;
    this.kick = Math.min(this.kick + 1, 2.2);
    this.onAmmoChange?.();
    this.onFired?.();

    // Raycast from screen center with spread (tighter while aiming).
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const spread = this.aiming ? WEAPON.adsSpread : WEAPON.hipSpread;
    const dir = this.raycaster.ray.direction;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.normalize();

    const hits = this.raycaster.intersectObjects(targets, false);
    const muzzleWorld = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzleWorld);

    let endPoint: THREE.Vector3;
    let hitObject: THREE.Object3D | null = null;
    if (hits.length > 0) {
      endPoint = hits[0].point.clone();
      hitObject = hits[0].object;
    } else {
      endPoint = muzzleWorld.clone().add(dir.clone().multiplyScalar(WEAPON.range));
    }

    this.showMuzzleFlash();
    this.showTracer(muzzleWorld, endPoint);

    if (this.ammo <= 0) this.startReload();
    return { hitObject, point: endPoint };
  }

  private showMuzzleFlash() {
    this.flashTimer = 0.06;
    (this.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 4;
    this.muzzleLight.intensity = 4;
  }

  private showTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const pos = this.tracer.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    (this.tracer.material as THREE.LineBasicMaterial).opacity = 0.9;
    this.tracerTimer = 0.05;
  }

  update(dt: number, input: WeaponInput) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.aiming = input.aiming && !this.reloading;

    // Recoil spring.
    this.kick = THREE.MathUtils.damp(this.kick, 0, 10, dt);

    // ADS blend.
    const adsTarget = this.aiming ? 1 : 0;
    this.adsBlend = THREE.MathUtils.damp(this.adsBlend, adsTarget, 12, dt);

    // Weapon bob while moving (suppressed while aiming).
    if (input.moving) this.bobT += dt * (input.sprinting ? 14 : 9);
    const bobAmt = (input.moving ? (input.sprinting ? 0.03 : 0.018) : 0) * (1 - this.adsBlend);
    const bobX = Math.cos(this.bobT) * bobAmt;
    const bobY = Math.abs(Math.sin(this.bobT)) * bobAmt;

    // Compose viewmodel transform: hip<->ADS, plus bob, plus recoil kick.
    const p = this.hipPos.clone().lerp(this.adsPos, this.adsBlend);
    p.x += bobX;
    p.y += bobY;
    p.z += this.kick * 0.06; // pull back on recoil
    this.viewmodel.position.copy(p);
    this.viewmodel.rotation.x = this.kick * 0.18; // muzzle climb
    this.viewmodel.scale.setScalar(THREE.MathUtils.lerp(0.85, 0.7, this.adsBlend));

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        (this.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        this.muzzleLight.intensity = 0;
      }
    }

    if (this.tracerTimer > 0) {
      this.tracerTimer -= dt;
      const mat = this.tracer.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, (this.tracerTimer / 0.05) * 0.9);
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = WEAPON.magazine;
        this.onAmmoChange?.();
      }
    }
  }

  get ammoText(): string {
    return `${this.ammo} / ${WEAPON.magazine}`;
  }
}
