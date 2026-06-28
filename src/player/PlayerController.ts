import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { ARENA, PLAYER } from "../constants";
import { Health } from "./Health";
import type { Input } from "../core/Input";

/**
 * FPS movement + mouse look via PointerLockControls.
 * Keeps the camera at a fixed eye height, clamped to the arena.
 */
export class PlayerController {
  readonly controls: PointerLockControls;
  readonly health = new Health(PLAYER.maxHealth);
  private input: Input;
  private hitTimer = 0;
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement, input: Input) {
    this.controls = new PointerLockControls(camera, domElement);
    this.input = input;
    this.reset();
  }

  get object(): THREE.Object3D {
    return this.controls.object;
  }

  get locked(): boolean {
    return this.controls.isLocked;
  }

  lock() {
    this.controls.lock();
  }

  reset() {
    this.health.reset();
    this.hitTimer = 0;
    this.object.position.set(0, ARENA.eyeHeight, ARENA.halfSize - 8);
  }

  /** Apply damage if not in the post-hit grace window. Returns true if it landed. */
  takeDamage(amount: number): boolean {
    if (this.hitTimer > 0 || !this.health.alive) return false;
    this.hitTimer = PLAYER.hitCooldown;
    this.health.damage(amount);
    return true;
  }

  update(dt: number) {
    if (this.hitTimer > 0) this.hitTimer -= dt;
    if (!this.locked) return;

    const cam = this.object;
    cam.getWorldDirection(this.forward);
    this.forward.y = 0;
    this.forward.normalize();
    this.right.crossVectors(this.forward, cam.up).normalize();

    const move = new THREE.Vector3();
    if (this.input.isDown("KeyW")) move.add(this.forward);
    if (this.input.isDown("KeyS")) move.sub(this.forward);
    if (this.input.isDown("KeyD")) move.add(this.right);
    if (this.input.isDown("KeyA")) move.sub(this.right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(PLAYER.moveSpeed * dt);
      cam.position.add(move);
    }

    // Clamp to arena and lock eye height.
    const limit = ARENA.halfSize - 2;
    cam.position.x = THREE.MathUtils.clamp(cam.position.x, -limit, limit);
    cam.position.z = THREE.MathUtils.clamp(cam.position.z, -limit, limit);
    cam.position.y = ARENA.eyeHeight;
  }
}
