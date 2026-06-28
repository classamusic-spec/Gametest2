import * as THREE from "three";
import { ARENA } from "../constants";
import type { LevelConfig } from "../levels/levels";

/**
 * Lights, fog, skybox and ground. Reskinned per level via applyPalette()
 * so each alien "planet" has its own neon mood.
 */
export class Environment {
  readonly group = new THREE.Group();
  private hemi: THREE.HemisphereLight;
  private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private ground: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private grid: THREE.GridHelper;
  private skylineMat: THREE.MeshStandardMaterial;
  private ringMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    scene.fog = new THREE.FogExp2(0x0a1430, 0.012);

    this.hemi = new THREE.HemisphereLight(0x6fb7ff, 0x10203a, 0.9);
    this.group.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0x9fd8ff, 1.6);
    this.sun.position.set(40, 70, 20);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const d = ARENA.halfSize + 10;
    const cam = this.sun.shadow.camera;
    cam.left = -d;
    cam.right = d;
    cam.top = d;
    cam.bottom = -d;
    cam.near = 1;
    cam.far = 200;
    this.group.add(this.sun);
    this.group.add(this.sun.target);

    // Gradient sky dome (shader sphere, rendered from the inside).
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x0a1838) },
        bottom: { value: new THREE.Color(0x050a1a) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        uniform vec3 top;
        uniform vec3 bottom;
        void main() {
          float h = normalize(vPos).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), this.skyMat);
    this.group.add(this.sky);

    // Ground plane.
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1426,
      roughness: 0.85,
      metalness: 0.2,
    });
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA.halfSize * 2, ARENA.halfSize * 2),
      this.groundMat,
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = ARENA.groundY;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    // Glowing grid overlay for the neon look.
    this.grid = new THREE.GridHelper(
      ARENA.halfSize * 2,
      50,
      0x2f6fff,
      0x2f6fff,
    );
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.32;
    this.grid.position.y = 0.02;
    this.group.add(this.grid);

    this.skylineMat = new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      emissive: 0x2f6fff,
      emissiveIntensity: 0.5,
      roughness: 0.5,
      metalness: 0.6,
    });
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x2f6fff,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.buildWalls();
    this.buildStars();
    this.buildSkyline();
    this.buildGroundRings();
  }

  /** Static starfield on the sky dome. */
  private buildStars() {
    const count = 700;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Upper hemisphere of a large sphere.
      const u = Math.random();
      const v = Math.random() * 0.5; // upper half
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - 2 * v);
      const r = 460;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 20;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xcfe8ff,
        size: 1.6,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.group.add(stars);
  }

  /** Distant non-colliding spires beyond the arena walls for a skyline. */
  private buildSkyline() {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.2;
      const r = ARENA.halfSize + 18 + Math.random() * 55;
      const h = 14 + Math.random() * 46;
      const w = 2 + Math.random() * 5;
      const spire = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), this.skylineMat);
      spire.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      this.group.add(spire);
    }
  }

  /** Flat glowing rings on the ground for depth and motion cues. */
  private buildGroundRings() {
    for (const radius of [14, 26, 40]) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius - 0.18, radius + 0.18, 96),
        this.ringMat,
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      this.group.add(ring);
    }
  }

  /** Low neon boundary walls so the arena reads as enclosed. */
  private buildWalls() {
    const h = ARENA.wallHeight;
    const s = ARENA.halfSize;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      emissive: 0x123a6a,
      emissiveIntensity: 0.6,
      roughness: 0.6,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85,
    });
    const defs: [number, number, number, number, number][] = [
      [0, h / 2, -s, s * 2, h], // far
      [0, h / 2, s, s * 2, h], // near
      [-s, h / 2, 0, s * 2, h], // left
      [s, h / 2, 0, s * 2, h], // right
    ];
    defs.forEach(([x, y, z, len, height], i) => {
      const isSide = i >= 2;
      const geo = new THREE.BoxGeometry(isSide ? 0.4 : len, height, isSide ? len : 0.4);
      const wall = new THREE.Mesh(geo, mat);
      wall.position.set(x, y, z);
      this.group.add(wall);
    });
  }

  applyPalette(level: LevelConfig, scene: THREE.Scene) {
    const p = level.palette;
    (scene.fog as THREE.FogExp2).color.setHex(p.fog);
    this.hemi.color.setHex(p.hemiSky);
    this.hemi.groundColor.setHex(p.hemiGround);
    this.sun.color.setHex(p.sun);
    this.skyMat.uniforms.top.value.setHex(p.skyTop);
    this.skyMat.uniforms.bottom.value.setHex(p.skyBottom);
    this.groundMat.color.setHex(p.ground);
    const gridMat = this.grid.material as THREE.LineBasicMaterial;
    gridMat.color.setHex(p.grid);
    this.skylineMat.emissive.setHex(p.grid);
    this.ringMat.color.setHex(p.grid);
  }
}
