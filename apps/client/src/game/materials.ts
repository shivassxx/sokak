import * as THREE from 'three';

/**
 * World-space procedural surface detail for the merged world meshes.
 * Each vertex carries a `pat` attribute selecting a pattern; the fragment
 * shader modulates the vertex color with it, plus contact darkening at the
 * foot of walls (cheap fake ambient occlusion). No textures, no UVs.
 */
export const PAT = {
  none: 0,
  plaster: 1,
  brick: 2,
  tiles: 3,
  asphalt: 4,
  grass: 5,
  wood: 6,
  roof: 7,
  stone: 8,
  fabric: 9,
  leaves: 10,
} as const;
export type Pattern = (typeof PAT)[keyof typeof PAT];

const VERT_DECL = /* glsl */ `
attribute float pat;
varying float vPat;
varying vec3 vWPos;
varying vec3 vWNormal;
`;

const VERT_MAIN = /* glsl */ `
vPat = pat;
vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

const FRAG_DECL = /* glsl */ `
varying float vPat;
varying vec3 vWPos;
varying vec3 vWNormal;
uniform float uAO;
uniform float uFade;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ return vnoise(p)*0.55 + vnoise(p*2.13)*0.3 + vnoise(p*4.7)*0.15; }
vec3 surfaceDetail(vec3 col){
  vec3 n = abs(vWNormal);
  vec2 uv = n.y > 0.6 ? vWPos.xz : (n.x > n.z ? vWPos.zy : vWPos.xy);
  int p = int(vPat + 0.5);
  float f = 1.0;
  if (p == 1) { // plaster: soft mottling + faint floor bands
    f = 0.93 + 0.12 * fbm(uv * 0.9);
    f *= 1.0 - 0.05 * smoothstep(0.9, 1.0, fract(vWPos.y / 3.0));
  } else if (p == 2) { // brick
    vec2 b = uv / vec2(0.42, 0.19);
    b.x += step(1.0, mod(floor(b.y), 2.0)) * 0.5;
    vec2 g = fract(b);
    float mortar = step(g.x, 0.06) + step(g.y, 0.1);
    f = mix(0.85 + 0.25 * h21(floor(b)), 1.25, clamp(mortar, 0.0, 1.0));
  } else if (p == 3) { // paving tiles
    vec2 t = uv / 0.6;
    vec2 g = fract(t);
    float line = step(g.x, 0.04) + step(g.y, 0.04);
    f = (0.94 + 0.1 * h21(floor(t))) * (1.0 - 0.18 * clamp(line, 0.0, 1.0));
  } else if (p == 4) { // asphalt grain + patches
    f = 0.9 + 0.12 * vnoise(uv * 9.0) + 0.1 * (fbm(uv * 0.15) - 0.5);
  } else if (p == 5) { // grass
    f = 0.82 + 0.3 * fbm(uv * 0.6) + 0.08 * vnoise(uv * 12.0);
  } else if (p == 6) { // wood planks
    float pl = fract(uv.x / 0.18 + h21(vec2(floor(uv.y / 1.2), 0.0)));
    f = 0.88 + 0.1 * vnoise(vec2(uv.x * 6.0, uv.y * 0.6)) - 0.15 * step(pl, 0.06);
  } else if (p == 7) { // roof gravel
    f = 0.85 + 0.2 * vnoise(uv * 4.0);
  } else if (p == 8) { // stone
    vec2 t = uv / vec2(0.7, 0.35);
    t.x += step(1.0, mod(floor(t.y), 2.0)) * 0.5;
    vec2 g = fract(t);
    float line = step(g.x, 0.05) + step(g.y, 0.08);
    f = (0.9 + 0.15 * h21(floor(t))) * (1.0 - 0.2 * clamp(line, 0.0, 1.0));
  } else if (p == 9) { // fabric weave
    f = 0.92 + 0.08 * sin(uv.x * 60.0) * sin(uv.y * 60.0);
  } else if (p == 10) { // leaves
    f = 0.78 + 0.35 * vnoise(uv * 3.5 + vWPos.y);
  }
  col *= f;
  // contact shadow at the foot of vertical surfaces
  if (n.y < 0.5 && uAO > 0.0) col *= mix(1.0 - uAO, 1.0, smoothstep(0.0, 0.9, vWPos.y));
  return col;
}
`;

/** Patch a standard/lambert material so it applies the patterns. */
export function patternize<T extends THREE.Material>(m: T, ao = 0.32, fadeNear = 0): T {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uAO = { value: ao };
    shader.uniforms.uFade = { value: fadeNear };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_DECL}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         diffuseColor.rgb = surfaceDetail(diffuseColor.rgb);
         // screen-door fade when the camera is inside / very close (bushes, trees)
         if (uFade > 0.0) {
           float camD = length(vViewPosition);
           float keep = smoothstep(uFade * 0.45, uFade, camD);
           if (keep < 1.0 && h21(floor(gl_FragCoord.xy)) > keep) discard;
         }`,
      );
  };
  m.customProgramCacheKey = () => `pat-${ao}-${fadeNear}`;
  return m;
}
