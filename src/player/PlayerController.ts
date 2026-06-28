import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { ARENA, PLAYER } from "../constants";
import { Health } from "./Health";
import type { Input } from "../core/Input";
import type { Obstacles } from "../world/Obstacles";

/**
 * FPS movement + mouse look via PointerLockControls.
 *
 * The authoritative position is `base`; the rendered camera position is
 * `base + shakeOffset`, so screen shake never accumulates into real movement.
 */
export class PlayerController {
  readonly controls: PointerLockControls;
  readonly health = new Health(PLAYER.maxHealth);
  shakeOffset = new THREE.Vector3();
  sprinting = false;

  private input: Input;
  private hitTimer = 0;
  private sinceDamage = 0;
  private obstacles: Obstacles | null = null;
  private base = new THREE.Vector3();
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

  /** True when moving fast enough to read as sprinting (drives FOV/bob). */
  get isMoving(): boolean {
    return (
      this.input.isDown("KeyW") ||
      this.input.isDown("KeyA") ||
      this.input.isDown("KeyS") ||
      this.input.isDown("KeyD")
    );
  }

  setObstacles(obstacles: Obstacles) {
    this.obstacles = obstacles;
  }

  lock() {
    this.controls.lock();
  }

  reset() {
    this.health.reset();
    this.hitTimer = 0;
    this.sinceDamage = 0;
    this.shakeOffset.set(0, 0, 0);
    this.base.set(0, ARENA.eyeHeight, ARENA.halfSize - 8);
    this.object.position.copy(this.base);
  }

  /** Apply damage if not in the post-hit grace window. Returns true if it landed. */
  takeDamage(amount: number): boolean {
    if (this.hitTimer > 0 || !this.health.alive) return false;
    this.hitTimer = PLAYER.hitCooldown;
    this.sinceDamage = 0;
    this.health.damage(amount);
    return true;
  }

  update(dt: number) {
    if (this.hitTimer > 0) this.hitTimer -= dt;
    this.sinceDamage += dt;

    // CoD-style regen after staying out of fire.
    if (
      this.health.alive &&
      this.sinceDamage > PLAYER.regenDelay &&
      this.health.current < this.health.max
    ) {
      this.health.current = Math.min(this.health.max, this.health.current + PLAYER.regenRate * dt);
    }

    if (this.locked) {
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

      this.sprinting =
        (this.input.isDown("ShiftLeft") || this.input.isDown("ShiftRight")) &&
        this.input.isDown("KeyW");
      const speed = this.sprinting ? PLAYER.sprintSpeed : PLAYER.moveSpeed;

      if (move.lengthSq() > 0) {
        move.normalize().multiplyScalar(speed * dt);
        this.base.add(move);
      }

      // Clamp to arena, resolve against cover, lock eye height.
      const limit = ARENA.halfSize - 2;
      this.base.x = THREE.MathUtils.clamp(this.base.x, -limit, limit);
      this.base.z = THREE.MathUtils.clamp(this.base.z, -limit, limit);
      this.obstacles?.resolve(this.base, PLAYER.radius);
      this.base.y = ARENA.eyeHeight;
    }

    // Render position = authoritative base + transient shake.
    this.object.position.copy(this.base).add(this.shakeOffset);
  }
}
