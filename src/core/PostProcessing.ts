import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Builds the EffectComposer chain that gives the game its neon glow:
 * RenderPass -> UnrealBloom -> OutputPass (tone mapping / color space).
 */
export function createComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.85, // strength
    0.7, // radius
    0.62, // threshold — only bright/emissive pixels bloom
  );
  composer.addPass(bloom);

  composer.addPass(new OutputPass());
  return composer;
}
