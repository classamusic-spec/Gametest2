import * as THREE from "three";
import { WEAPONS, type WeaponDef, type WeaponId, type WeaponModel } from "./WeaponTypes";

export interface Impact {
  object: THREE.Object3D | null;
  point: THREE.Vector3;
}

export interface FireResult {
  impacts: Impact[];
  damagePerPellet: number;
}

export interface WeaponInput {
  aiming: boolean;
  moving: boolean;
  sprinting: boolean;
}

const TRACER_POOL = 16;

/**
 * The active weapon: holds the current WeaponDef, its magazine/reserve ammo,
 * the first-person viewmodel, recoil, ADS, muzzle flash and tracers.
 * The Arsenal swaps the equipped def and ammo in and out.
 */
export class Weapon {
  def: WeaponDef = WEAPONS.pistol;
  ammo = WEAPONS.pistol.magazine;
  reserve: number = WEAPONS.pistol.reserve;
  reloading = false;
  aiming = false;

  private reloadTimer = 0;
  private cooldown = 0;
  private kick = 0;
  private bobT = 0;
  private adsBlend = 0;

  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private raycaster = new THREE.Raycaster();

  private viewmodel = new THREE.Group();
  private muzzle!: THREE.Mesh;
  private muzzleLight: THREE.PointLight;
  private flashTimer = 0;

  private tracers: THREE.Line[] = [];
  private tracerTimers: number[] = [];
  private tracerIdx = 0;

  private hipPos = new THREE.Vector3(0.32, -0.3, -0.5);
  private adsPos = new THREE.Vector3(0.0, -0.13, -0.4);

  onAmmoChange?: () => void;
  onFired?: () => void;
  onReload?: () => void;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;

    this.camera.add(this.viewmodel);
    this.muzzleLight = new THREE.PointLight(0x36e3ff, 0, 8, 2);
    this.viewmodel.add(this.muzzleLight);

    const lineMat = () =>
      new THREE.LineBasicMaterial({
        color: 0x9ff4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
    for (let i = 0; i < TRACER_POOL; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const line = new THREE.Line(geo, lineMat());
      line.frustumCulled = false;
      this.scene.add(line);
      this.tracers.push(line);
      this.tracerTimers.push(0);
    }

    this.equip(WEAPONS.pistol, WEAPONS.pistol.magazine, WEAPONS.pistol.reserve);
  }

  get adsFov(): number {
    return this.def.adsFov;
  }

  /** True when the weapon has no ammo left at all. */
  get dry(): boolean {
    return this.ammo <= 0 && this.reserve <= 0;
  }

  /** Equip a weapon definition with the given magazine/reserve ammo. */
  equip(def: WeaponDef, ammo: number, reserve: number) {
    this.def = def;
    this.ammo = ammo;
    this.reserve = reserve;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0.12; // brief raise delay
    this.kick = 0.6;
    this.raycaster.far = def.range;
    this.buildViewmodel(def.model, def.color);
    this.onAmmoChange?.();
  }

  private buildViewmodel(model: WeaponModel, color: number) {
    // Clear the old model (keep the muzzle light, re-added below).
    for (const child of [...this.viewmodel.children]) {
      if (child !== this.muzzleLight) {
        this.viewmodel.remove(child);
        (child as THREE.Mesh).geometry?.dispose?.();
      }
    }

    const body = new THREE.MeshStandardMaterial({
      color: 0x1a2230,
      emissive: 0x0c2030,
      emissiveIntensity: 0.5,
      roughness: 0.4,
      metalness: 0.85,
    });
    const glow = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.0,
    });
    const g = new THREE.Group();

    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      rx = 0,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      g.add(m);
      return m;
    };

    let muzzleZ = -0.6;
    switch (model) {
      case "pistol": {
        add(new THREE.BoxGeometry(0.09, 0.14, 0.34), body, 0, 0, -0.1);
        add(new THREE.BoxGeometry(0.07, 0.16, 0.08), body, 0, -0.13, 0.02);
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 10), body, 0, 0.03, -0.28, Math.PI / 2);
        add(new THREE.TorusGeometry(0.035, 0.01, 8, 14), glow, 0, 0.03, -0.18);
        muzzleZ = -0.42;
        break;
      }
      case "machinegun": {
        add(new THREE.BoxGeometry(0.11, 0.15, 0.8), body, 0, 0, -0.2);
        add(new THREE.CylinderGeometry(0.035, 0.04, 0.55, 12), body, 0, 0.02, -0.6, Math.PI / 2);
        add(new THREE.BoxGeometry(0.07, 0.18, 0.1), body, 0, -0.14, 0.05);
        add(new THREE.BoxGeometry(0.05, 0.06, 0.3), body, 0, -0.1, -0.2); // magazine
        add(new THREE.TorusGeometry(0.05, 0.012, 8, 16), glow, 0, 0.02, -0.4);
        muzzleZ = -0.85;
        break;
      }
      case "shotgun": {
        add(new THREE.BoxGeometry(0.13, 0.13, 0.85), body, 0, 0, -0.2);
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 12), body, -0.04, 0.03, -0.62, Math.PI / 2);
        add(new THREE.CylinderGeometry(0.045, 0.045, 0.6, 12), body, 0.04, 0.03, -0.62, Math.PI / 2);
        add(new THREE.BoxGeometry(0.08, 0.16, 0.12), body, 0, -0.13, 0.06);
        add(new THREE.TorusGeometry(0.07, 0.012, 8, 16), glow, 0, 0.02, -0.45);
        muzzleZ = -0.9;
        break;
      }
      case "sniper": {
        add(new THREE.BoxGeometry(0.1, 0.13, 1.0), body, 0, 0, -0.25);
        add(new THREE.CylinderGeometry(0.03, 0.035, 0.8, 12), body, 0, 0.02, -0.75, Math.PI / 2);
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 12), body, 0, 0.12, -0.2, Math.PI / 2); // scope
        add(new THREE.BoxGeometry(0.07, 0.18, 0.12), body, 0, -0.14, 0.1);
        add(new THREE.TorusGeometry(0.045, 0.01, 8, 16), glow, 0, 0.02, -0.5);
        muzzleZ = -1.05;
        break;
      }
      case "laser": {
        add(new THREE.BoxGeometry(0.12, 0.16, 0.7), body, 0, 0, -0.18);
        add(new THREE.CylinderGeometry(0.05, 0.06, 0.4, 12), glow, 0, 0.02, -0.55, Math.PI / 2);
        add(new THREE.TorusGeometry(0.08, 0.02, 10, 18), glow, 0, 0.02, -0.42);
        add(new THREE.TorusGeometry(0.07, 0.018, 10, 18), glow, 0, 0.02, -0.3);
        add(new THREE.BoxGeometry(0.07, 0.17, 0.1), body, 0, -0.14, 0.04);
        muzzleZ = -0.78;
        break;
      }
    }

    const muzzleMat = glow.clone();
    muzzleMat.emissiveIntensity = 0;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), muzzleMat);
    muzzle.position.set(0, 0.02, muzzleZ);
    muzzle.name = "muzzle";
    g.add(muzzle);

    g.position.copy(this.hipPos);
    g.scale.setScalar(0.85);
    this.viewmodel.add(g);

    this.muzzle = muzzle;
    this.muzzleLight.color.setHex(color);
    this.muzzleLight.position.copy(muzzle.position);
  }

  startReload() {
    if (this.reloading || this.ammo >= this.def.magazine || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = this.def.reloadTime;
    this.onReload?.();
    this.onAmmoChange?.();
  }

  /** Attempt to fire. @returns hit impacts, or null if it couldn't fire. */
  tryFire(targets: THREE.Object3D[]): FireResult | null {
    if (this.cooldown > 0 || this.reloading) return null;
    if (this.ammo <= 0) {
      this.startReload();
      return null;
    }

    this.cooldown = 1 / this.def.fireRate;
    this.ammo--;
    this.kick = Math.min(this.kick + this.def.recoil, 3);
    this.onAmmoChange?.();
    this.onFired?.();

    const muzzleWorld = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzleWorld);
    const spread = this.aiming ? this.def.adsSpread : this.def.hipSpread;
    const impacts: Impact[] = [];

    for (let p = 0; p < this.def.pellets; p++) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
      const dir = this.raycaster.ray.direction.clone();
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.normalize();
      this.raycaster.ray.direction.copy(dir);

      const hits = this.raycaster.intersectObjects(targets, false);
      let end: THREE.Vector3;
      if (hits.length > 0) {
        end = hits[0].point.clone();
        impacts.push({ object: hits[0].object, point: end });
      } else {
        end = muzzleWorld.clone().add(dir.multiplyScalar(this.def.range));
        impacts.push({ object: null, point: end });
      }
      this.showTracer(muzzleWorld, end);
    }

    this.showMuzzleFlash();
    if (this.ammo <= 0) this.startReload();
    return { impacts, damagePerPellet: this.def.damage };
  }

  private showMuzzleFlash() {
    this.flashTimer = 0.06;
    (this.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 4;
    this.muzzleLight.intensity = this.def.beam ? 6 : 4;
  }

  private showTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const i = this.tracerIdx;
    this.tracerIdx = (this.tracerIdx + 1) % TRACER_POOL;
    const line = this.tracers[i];
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    const mat = line.material as THREE.LineBasicMaterial;
    mat.color.setHex(this.def.color);
    mat.opacity = 0.95;
    this.tracerTimers[i] = this.def.beam ? 0.09 : 0.05;
  }

  update(dt: number, input: WeaponInput) {
    if (this.cooldown > 0) this.cooldown -= dt;
    this.aiming = input.aiming && !this.reloading;

    this.kick = THREE.MathUtils.damp(this.kick, 0, 10, dt);
    const adsTarget = this.aiming ? 1 : 0;
    this.adsBlend = THREE.MathUtils.damp(this.adsBlend, adsTarget, 12, dt);

    if (input.moving) this.bobT += dt * (input.sprinting ? 14 : 9);
    const bobAmt = (input.moving ? (input.sprinting ? 0.03 : 0.018) : 0) * (1 - this.adsBlend);
    const bobX = Math.cos(this.bobT) * bobAmt;
    const bobY = Math.abs(Math.sin(this.bobT)) * bobAmt;

    const model = this.viewmodel.children.find((c) => c !== this.muzzleLight) as THREE.Group;
    if (model) {
      const pos = this.hipPos.clone().lerp(this.adsPos, this.adsBlend);
      pos.x += bobX;
      pos.y += bobY;
      pos.z += this.kick * 0.06;
      model.position.copy(pos);
      model.rotation.x = this.kick * 0.16;
      model.scale.setScalar(THREE.MathUtils.lerp(0.85, 0.72, this.adsBlend));
    }

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        (this.muzzle.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        this.muzzleLight.intensity = 0;
      }
    }

    for (let i = 0; i < TRACER_POOL; i++) {
      if (this.tracerTimers[i] > 0) {
        this.tracerTimers[i] -= dt;
        const mat = this.tracers[i].material as THREE.LineBasicMaterial;
        mat.opacity = Math.max(0, this.tracerTimers[i] / 0.05) * 0.95;
      }
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        if (this.reserve === Infinity) {
          this.ammo = this.def.magazine;
        } else {
          const need = this.def.magazine - this.ammo;
          const take = Math.min(need, this.reserve);
          this.ammo += take;
          this.reserve -= take;
        }
        this.onAmmoChange?.();
      }
    }
  }

  get ammoText(): string {
    const res = this.reserve === Infinity ? "∞" : String(this.reserve);
    return `${this.ammo} / ${res}`;
  }
}

export type { WeaponId };
