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
float gHgt;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ return vnoise(p)*0.55 + vnoise(p*2.13)*0.3 + vnoise(p*4.7)*0.15; }
// distance to the nearest edge of a unit cell, in cell units
float edgeDist(vec2 g){ vec2 e = min(g, 1.0 - g); return min(e.x, e.y); }
vec3 surfaceDetail(vec3 col){
  vec3 n = abs(vWNormal);
  vec2 uv = n.y > 0.6 ? vWPos.xz : (n.x > n.z ? vWPos.zy : vWPos.xy);
  int p = int(vPat + 0.5);
  float f = 1.0;
  gHgt = 0.0;
  if (p == 1) { // plaster: soft mottling + faint floor bands
    float m = fbm(uv * 0.9);
    f = 0.93 + 0.12 * m;
    f *= 1.0 - 0.05 * smoothstep(0.9, 1.0, fract(vWPos.y / 3.0));
    gHgt = 0.004 * vnoise(uv * 7.0) + 0.003 * m;
  } else if (p == 2) { // brick
    vec2 b = uv / vec2(0.42, 0.19);
    b.x += step(1.0, mod(floor(b.y), 2.0)) * 0.5;
    vec2 g = fract(b);
    float e = min(min(g.x, 1.0 - g.x) * 0.42, min(g.y, 1.0 - g.y) * 0.19);
    float brick = smoothstep(0.006, 0.016, e);
    float var = h21(floor(b));
    f = mix(1.22, 0.82 + 0.3 * var, brick) * (0.95 + 0.1 * vnoise(uv * 14.0));
    gHgt = 0.014 * brick + 0.002 * vnoise(uv * 20.0);
  } else if (p == 3) { // paving tiles
    vec2 t = uv / 0.6;
    float e = edgeDist(fract(t)) * 0.6;
    float tile = smoothstep(0.004, 0.014, e);
    f = (0.93 + 0.12 * h21(floor(t))) * mix(0.8, 1.0, tile) * (0.96 + 0.08 * vnoise(uv * 6.0));
    gHgt = 0.008 * tile + 0.002 * vnoise(uv * 11.0);
  } else if (p == 4) { // asphalt: grain, repaired patches, cracks, speckles
    float big = fbm(uv * 0.12);
    float grain = vnoise(uv * 9.0);
    f = 0.88 + 0.12 * grain + 0.14 * (big - 0.5);
    float patchM = smoothstep(0.62, 0.66, fbm(uv * 0.07 + 3.1));
    f *= mix(1.0, 0.82, patchM);
    float crackN = abs(vnoise(uv * 0.9 + 7.0) - 0.5);
    float crack = (1.0 - smoothstep(0.0, 0.018, crackN)) * smoothstep(0.55, 0.7, fbm(uv * 0.2));
    f *= 1.0 - 0.35 * crack;
    if (h21(floor(uv * 35.0)) > 0.985) f *= 1.25;
    gHgt = 0.004 * vnoise(uv * 24.0) - 0.006 * crack + 0.002 * patchM;
  } else if (p == 5) { // grass
    f = 0.82 + 0.3 * fbm(uv * 0.6) + 0.08 * vnoise(uv * 12.0);
    gHgt = 0.01 * vnoise(uv * 9.0);
  } else if (p == 6) { // wood planks
    float pl = fract(uv.x / 0.18 + h21(vec2(floor(uv.y / 1.2), 0.0)));
    float gap = smoothstep(0.0, 0.05, pl) * smoothstep(1.0, 0.97, pl);
    float grain = vnoise(vec2(uv.x * 40.0, uv.y * 1.5));
    f = (0.86 + 0.12 * vnoise(vec2(uv.x * 6.0, uv.y * 0.6)) + 0.06 * grain) * mix(0.72, 1.0, gap);
    gHgt = 0.006 * gap + 0.0015 * grain;
  } else if (p == 7) { // roof gravel
    f = 0.85 + 0.2 * vnoise(uv * 4.0);
    gHgt = 0.006 * vnoise(uv * 30.0);
  } else if (p == 8) { // cobble stone
    vec2 t = uv / vec2(0.7, 0.35);
    t.x += step(1.0, mod(floor(t.y), 2.0)) * 0.5;
    vec2 g = fract(t);
    float e = min(min(g.x, 1.0 - g.x) * 0.7, min(g.y, 1.0 - g.y) * 0.35);
    float stone = smoothstep(0.0, 0.05, e);
    f = (0.88 + 0.18 * h21(floor(t))) * mix(0.7, 1.0, smoothstep(0.0, 0.02, e));
    gHgt = 0.022 * sqrt(stone);
  } else if (p == 9) { // fabric weave
    float w = sin(uv.x * 60.0) * sin(uv.y * 60.0);
    f = 0.92 + 0.08 * w;
    gHgt = 0.0015 * w;
  } else if (p == 10) { // leaves
    float l = vnoise(uv * 3.5 + vWPos.y);
    f = 0.78 + 0.35 * l;
    gHgt = 0.03 * l;
  }
  col *= f;
  // contact shadow at the foot of vertical surfaces
  if (n.y < 0.5 && uAO > 0.0) col *= mix(1.0 - uAO, 1.0, smoothstep(0.0, 0.9, vWPos.y));
  return col;
}
// derivative bump mapping from the analytic height (view space)
vec3 bumpNormal(vec3 nrm, float h){
  vec3 pos = -vViewPosition;
  vec3 dpx = dFdx(pos);
  vec3 dpy = dFdy(pos);
  vec3 r1 = cross(dpy, nrm);
  vec3 r2 = cross(nrm, dpx);
  float det = dot(dpx, r1);
  vec2 dh = vec2(dFdx(h), dFdy(h));
  vec3 grad = sign(det) * (dh.x * r1 + dh.y * r2);
  return normalize(abs(det) * nrm - grad);
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
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  if (gHgt != 0.0) normal = bumpNormal(normal, gHgt * 1.6);');
  };
  m.customProgramCacheKey = () => `pat2-${ao}-${fadeNear}`;
  return m;
}
