import * as THREE from 'three';

/**
 * Photographic PBR detail for the merged world meshes: nine CC0 texture sets
 * (Poly Haven / ambientCG, see Docs/ThirdPartyAssets.md) packed into two
 * vertical strips (`public/textures/surf_albedo.jpg`, `surf_nrm.jpg`: normal
 * XY + roughness) and uploaded as texture arrays. `materials.ts` samples them
 * triplanar in world space, so the box-built world needs no UVs. The vertex
 * colour keeps the tone; the photo only adds its detail (texture / its mean).
 */
export const SURF_SLICES = ['plaster', 'brick', 'tiles', 'asphalt', 'planks', 'setts', 'oak', 'marble', 'sandstone'] as const;
/** mean linear colour of each slice (from the packing script), to turn the photo into pure detail */
export const SURF_AVG: readonly (readonly [number, number, number])[] = [
  [0.3901, 0.3509, 0.3364],
  [0.2219, 0.1428, 0.0877],
  [0.5526, 0.3712, 0.186],
  [0.0719, 0.0707, 0.0625],
  [0.1962, 0.1036, 0.0459],
  [0.1148, 0.0784, 0.055],
  [0.3602, 0.2106, 0.0953],
  [0.4256, 0.3253, 0.1862],
  [0.1204, 0.0983, 0.0594],
];
/** metres covered by one tile of each slice */
export const SURF_SCALE = [2.4, 1.8, 2.4, 5, 2.4, 2.2, 1.4, 1.8, 3.2];

const placeholder = () => {
  const t = new THREE.DataArrayTexture(new Uint8Array([128, 128, 128, 255]), 1, 1, 1);
  t.needsUpdate = true;
  return t;
};

/** shared uniforms: every patterned material points at these, so a late load lights them all up */
export const surfUniforms = {
  uSurfA: { value: placeholder() as THREE.DataArrayTexture },
  uSurfN: { value: placeholder() as THREE.DataArrayTexture },
  uSurfOn: { value: 0 },
  uSurfAvg: { value: SURF_AVG.map((c) => new THREE.Vector3(...c)) },
  uSurfScale: { value: SURF_SCALE },
};

let started = false;

/** Load the strips once (skipped on the low tier: phones keep the procedural patterns). */
export function loadSurfaces(renderer: THREE.WebGLRenderer, size = 1024): void {
  if (started) return;
  started = true;
  const base = import.meta.env.BASE_URL;
  const n = SURF_SLICES.length;
  const toArray = async (url: string) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size * n;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, size, size * n);
    const data = ctx.getImageData(0, 0, size, size * n).data;
    const tex = new THREE.DataArrayTexture(new Uint8Array(data.buffer), size, size, n);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    tex.needsUpdate = true;
    return tex;
  };
  Promise.all([toArray(`${base}textures/surf_albedo.jpg`), toArray(`${base}textures/surf_nrm.jpg`)])
    .then(([a, nrm]) => {
      surfUniforms.uSurfA.value = a;
      surfUniforms.uSurfN.value = nrm;
      surfUniforms.uSurfOn.value = 1;
    })
    .catch((e) => console.warn('surface textures failed', e));
}

/** GLSL: pattern id → slice (-1: keep the procedural pattern) */
export const SURF_GLSL = /* glsl */ `
uniform highp sampler2DArray uSurfA;
uniform highp sampler2DArray uSurfN;
uniform float uSurfOn;
uniform vec3 uSurfAvg[${SURF_SLICES.length}];
uniform float uSurfScale[${SURF_SLICES.length}];
vec3 gSurfN;
float gSurfR;
bool gSurf;
int surfSlice(int p){
  if (p == 1) return 0;
  if (p == 2) return 1;
  if (p == 3) return 2;
  if (p == 4) return 3;
  if (p == 6) return 4;
  if (p == 8 || p == 14) return 8;
  if (p == 15) return 5;
  if (p == 11 || p == 12) return 6;
  if (p == 13) return 7;
  return -1;
}
vec3 tnorm(vec2 uv, float s){ vec2 xy = texture(uSurfN, vec3(uv, s)).xy * 2.0 - 1.0; return vec3(xy, sqrt(max(0.0, 1.0 - dot(xy, xy)))); }
// triplanar photo detail; fills gSurfN (world normal) and gSurfR (roughness 0..1)
vec3 surfPhoto(vec3 col, int p){
  gSurf = false;
  int sl = surfSlice(p);
  if (uSurfOn < 0.5 || sl < 0) return col;
  gSurf = true;
  float s = float(sl);
  vec3 nW = normalize(vWNormal);
  vec3 w = pow(abs(nW), vec3(6.0));
  w /= w.x + w.y + w.z;
  vec3 ax = sign(nW);
  float k = 1.0 / uSurfScale[sl];
  vec2 uvX = vWPos.zy * k; uvX.x *= ax.x;
  vec2 uvY = vWPos.xz * k; uvY.x *= ax.y;
  vec2 uvZ = vWPos.xy * k; uvZ.x *= -ax.z;
  // solid wood: the grain (the image's v axis) runs along world x or z
  bool swX = p == 12, swYZ = p == 11;
  if (swX) uvX = uvX.yx;
  if (swYZ) { uvY = uvY.yx; uvZ = uvZ.yx; }
  vec3 a = vec3(0.0);
  if (w.x > 0.01) a += texture(uSurfA, vec3(uvX, s)).rgb * w.x;
  if (w.y > 0.01) a += texture(uSurfA, vec3(uvY, s)).rgb * w.y;
  if (w.z > 0.01) a += texture(uSurfA, vec3(uvZ, s)).rgb * w.z;
  a = pow(a, vec3(2.2));
  col *= clamp(a / uSurfAvg[sl], 0.0, 3.0);
  // whiteout-blended normals
  vec3 tX = tnorm(uvX, s), tY = tnorm(uvY, s), tZ = tnorm(uvZ, s);
  if (swX) tX.xy = tX.yx;
  if (swYZ) { tY.xy = tY.yx; tZ.xy = tZ.yx; }
  tX.x *= ax.x; tY.x *= ax.y; tZ.x *= -ax.z;
  tX = vec3(tX.xy + nW.zy, abs(tX.z) * nW.x);
  tY = vec3(tY.xy + nW.xz, abs(tY.z) * nW.y);
  tZ = vec3(tZ.xy + nW.xy, abs(tZ.z) * nW.z);
  gSurfN = normalize(tX.zyx * w.x + tY.xzy * w.y + tZ.xyz * w.z);
  gSurfR = texture(uSurfN, vec3(uvY, s)).b * w.y + texture(uSurfN, vec3(uvX, s)).b * w.x + texture(uSurfN, vec3(uvZ, s)).b * w.z;
  return col;
}
`;
