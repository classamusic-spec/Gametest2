import * as THREE from "three";
import { WEAPON } from "../constants";
import type { Particles } from "../fx/Particles";

export interface FireResult {
  hitObject: THREE.Object3D | null;
  point: THREE.Vector3;
}

/**
 * Hitscan plasma rifle: handles fire rate, ammo, reload, the first-person
 * viewmodel, muzzle flash, and glowing tracer.
 */
export class Weapon {
  ammo = WEAPON.magazine;
  reloading = false;
  private reloadTimer = 0;
  private cooldown = 0;

  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private particles: Particles;
  private raycaster = new THREE.Raycaster();

  private viewmodel: THREE.Group;
  private muzzle: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private flashTimer = 0;
  private tracer: THREE.Line;
  private tracerTimer = 0;

  /** Notifies the HUD when ammo/reload state changes. */
  onAmmoChange?: () => void;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene, particles: Particles) {
    this.camera = camera;
    this.scene = scene;
    this.particles = particles;
    this.raycaster.far = WEAPON.range;

    this.viewmodel = this.buildViewmodel();
    this.camera.add(this.viewmodel);

    this.muzzle = this.viewmodel.getObjectByName("muzzle") as THREE.Mesh;
    this.muzzleLight = new THREE.PointLight(0x36e3ff, 0, 8, 2);
    this.muzzleLight.position.copy(this.muzzle.position);
    this.viewmodel.add(this.muzzleLight);

    // Tracer line lives in world space.
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

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.5, 12),
      bodyMat,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.5);
    g.add(barrel);

    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 8, 16), glowMat);
    coil.position.set(0, 0.02, -0.35);
    g.add(coil);

    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glowMat);
    muzzle.material = glowMat.clone();
    (muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    muzzle.name = "muzzle";
    muzzle.position.set(0, 0.02, -0.75);
    g.add(muzzle);

    // Position viewmodel in the lower-right of the view.
    g.position.set(0.34, -0.32, -0.55);
    g.scale.setScalar(0.85);
    return g;
  }

  reset() {
    this.ammo = WEAPON.magazine;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0;
    this.onAmmoChange?.();
  }

  startReload() {
    if (this.reloading || this.ammo === WEAPON.magazine) return;
    this.reloading = true;
    this.reloadTimer = WEAPON.reloadTime;
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
    this.onAmmoChange?.();

    // Raycast from screen center.
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.raycaster.intersectObjects(targets, false);

    const muzzleWorld = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzleWorld);

    let endPoint: THREE.Vector3;
    let hitObject: THREE.Object3D | null = null;
    if (hits.length > 0) {
      endPoint = hits[0].point.clone();
      hitObject = hits[0].object;
      this.particles.burst(endPoint.clone(), 0xffffff, 8, 3, 0.1, 0.2);
    } else {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      endPoint = muzzleWorld.clone().add(dir.multiplyScalar(WEAPON.range));
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

  update(dt: number) {
    if (this.cooldown > 0) this.cooldown -= dt;

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
