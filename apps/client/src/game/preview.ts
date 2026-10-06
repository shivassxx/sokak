import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Look } from '@sokak/shared';
import { Character } from './character';

/** Small turntable renderer for the character on the home screen. */
export class CharacterPreview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private char: Character;
  private raf = 0;
  private last = performance.now();
  private obs: ResizeObserver;
  private t = 0;

  constructor(private canvas: HTMLCanvasElement, look: Look) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    pm.dispose();
    this.scene.add(new THREE.HemisphereLight(0xfff0dd, 0x8a6a5a, 1.1));
    const sun = new THREE.DirectionalLight(0xffd2a0, 2.4);
    sun.position.set(-2, 5, -4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.ShadowMaterial({ opacity: 0.25 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.char = new Character(look);
    this.scene.add(this.char.root);
    this.camera.position.set(0, 1.35, -4.6);
    this.camera.lookAt(0, 1.0, 0);
    this.obs = new ResizeObserver(() => this.resize());
    this.obs.observe(canvas);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  setLook(look: Look): void {
    this.char.setLook(look);
    this.char.playEmote('wave');
  }

  private resize(): void {
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop(now: number): void {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.char.root.rotation.y = Math.sin(this.t * 0.6) * 0.6;
    this.char.animate(dt, 0, false, false);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.obs.disconnect();
    this.renderer.dispose();
  }
}
