import * as THREE from "three";
import { createComposer } from "./PostProcessing";
import { CAMERA } from "../constants";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

/**
 * Owns the renderer, scene, camera and post-processing composer.
 * Handles resize and exposes a render() that runs the bloom pipeline.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      CAMERA.baseFov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );

    this.composer = createComposer(this.renderer, this.scene, this.camera);

    window.addEventListener("resize", this.onResize);
  }

  private onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  /** Smoothly set the field of view (for sprint/ADS/fire punch). */
  setFov(fov: number) {
    if (Math.abs(this.camera.fov - fov) < 0.01) return;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.composer.render();
  }
}
