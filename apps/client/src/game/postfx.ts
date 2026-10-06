import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Quality tiers:
 *  - high: MSAA, ground-truth ambient occlusion, bloom, colour grade + vignette
 *  - medium: MSAA, bloom, grade (no AO)
 *  - low: plain forward render (phones); a CSS vignette keeps the mood
 * Starts from a guess (touch device → low) and steps down if frames are slow.
 */
export type Quality = 'high' | 'medium' | 'low';

export function initialQuality(): Quality {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'high' || q === 'medium' || q === 'low') return q;
  if (matchMedia('(pointer: coarse)').matches) return 'low';
  return 'high';
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: 0.32 },
    uSat: { value: 1.08 },
    uContrast: { value: 1.05 },
    uLift: { value: new THREE.Vector3(0.012, 0.006, 0.0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSat;
    uniform float uContrast;
    uniform vec3 uLift;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      col += uLift * (1.0 - l);
      vec2 d = vUv - 0.5;
      float v = 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.15, 1.0)));
      gl_FragColor = vec4(clamp(col * v, 0.0, 1.0), c.a);
    }`,
};

export class PostFX {
  private composer: EffectComposer | null = null;
  private gtao: GTAOPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private grade: ShaderPass | null = null;
  private w = 1;
  private h = 1;
  private slowFrames = 0;
  private sampled = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    public quality: Quality = initialQuality(),
    private opts: { bloomStrength?: number; aoRadius?: number; vignette?: number } = {},
  ) {
    this.build();
  }

  private build(): void {
    this.dispose();
    if (this.quality === 'low') return;
    const target = new THREE.WebGLRenderTarget(this.w, this.h, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(this.renderer, target);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (this.quality === 'high') {
      const ao = new GTAOPass(this.scene, this.camera, this.w, this.h);
      ao.blendIntensity = 0.9;
      ao.updateGtaoMaterial({ radius: this.opts.aoRadius ?? 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
      ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      composer.addPass(ao);
      this.gtao = ao;
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w / 2, this.h / 2), this.opts.bloomStrength ?? 0.35, 0.5, 0.92);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.grade.uniforms.uVignette!.value = this.opts.vignette ?? 0.32;
    composer.addPass(this.grade);
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(this.w, this.h);
    this.composer = composer;
  }

  setSize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
  }

  /** Bloom strength follows the time of day (lamps glow more at night). */
  setBloom(strength: number): void {
    if (this.bloom) this.bloom.strength = strength;
  }

  render(dt: number): void {
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  }

  /** Step down a tier when the frame rate stays low (after a warm-up). */
  private adapt(dt: number): void {
    this.sampled++;
    if (this.sampled < 90 || this.quality === 'low') return;
    if (dt > 1 / 40) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 120) {
      this.quality = this.quality === 'high' ? 'medium' : 'low';
      this.slowFrames = 0;
      this.sampled = 0;
      this.build();
    }
  }

  dispose(): void {
    this.gtao?.dispose();
    this.bloom?.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.gtao = null;
    this.bloom = null;
    this.grade = null;
  }
}
