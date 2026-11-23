// Sereno · shared 3D helpers: maths, seeded random, shared materials, mesh baking, a soft glow sprite.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const UP = V(0, 1, 0);
export const TAU = Math.PI * 2;
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const smooth = (t) => (t = clamp01(t), t * t * (3 - 2 * t));
export const seg = (p, a, b) => clamp01((p - a) / (b - a));
export const polar = (psi, r) => [r * Math.sin(psi), r * Math.cos(psi)];

/** Small seeded RNG (mulberry32) so every model is identical on every load. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// materials are shared by colour + options, so static models can be baked into one mesh per material
const MATS = new Map();
export const std = (color, extra = {}) => {
  const k = color + JSON.stringify(extra);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }));
  return MATS.get(k);
};
export const lowpoly = (color, extra = {}) => std(color, { flatShading: true, ...extra });

export const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};

export function rod(parent, a, b, r, mat, seg = 6) {
  const d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  parent.add(m);
  return m;
}

export const rbox = (w, h, d, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99);

/** Points along a hanging string from a to b (a gentle catenary-ish sag). */
export function sagPoints(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(a.clone().lerp(b, t).add(V(0, -sag * 4 * t * (1 - t), 0)));
  }
  return pts;
}

/** A flat ribbon following `pts`, `width` wide, lying horizontally. `yOf` can drape it on terrain. */
export function ribbon(pts, width, yOf = null) {
  const pos = [], idx = [];
  const side = V();
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    side.set(-(b.z - a.z), 0, b.x - a.x).normalize().multiplyScalar(width / 2);
    [-1, 1].forEach((s) => {
      const x = p.x + side.x * s, z = p.z + side.z * s;
      pos.push(x, yOf ? yOf(x, z) : p.y, z);
    });
    if (i) {
      const o = (i - 1) * 2;
      idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * Merges every static, opaque mesh under `root` (except those under `keep`) into one mesh per material.
 * Turns hundreds of draw calls into a few dozen. Materials stay shared, so animating one still works.
 */
export function bake(root, keep = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const dead = [];
  const kept = (o) => {
    for (let p = o; p; p = p.parent) {
      if (keep.includes(p)) return true;
      if (p === root) return false;
    }
    return false;
  };
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.material.transparent || kept(o)) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    Object.keys(g.attributes).forEach((name) => {
      if (name !== 'position' && name !== 'normal' && !(name === 'color' && o.material.vertexColors)) g.deleteAttribute(name);
    });
    if (!buckets.has(o.material)) buckets.set(o.material, { list: [], cast: false, receive: false });
    const b = buckets.get(o.material);
    b.list.push(g);
    b.cast ||= o.castShadow;
    b.receive ||= o.receiveShadow;
    dead.push(o);
  });
  dead.forEach((o) => o.parent.remove(o));
  buckets.forEach((b, mat) => {
    const merged = mergeGeometries(b.list);
    if (!merged) return;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    root.add(mesh);
  });
}

/** Turns shadows on for every opaque mesh under root. */
export function shadows(root) {
  root.traverse((o) => {
    if (o.isMesh && !o.material.transparent && o.material.visible !== false) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

let glow = null;
export function glowTexture() {
  if (glow) return glow;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.6)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  glow = new THREE.CanvasTexture(c);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}

/* ------------------------------------------------------------ shared props */

/** A round, low-poly shade tree. About 1.2 tall. */
export function makeTree(R, palette = ['#5fae4a', '#4f9a3e', '#78c05a']) {
  const g = new THREE.Group();
  const bark = lowpoly('#7a4e2c');
  add(g, new THREE.CylinderGeometry(0.04, 0.07, 0.62, 7), bark, 0, 0.31, 0);
  rod(g, V(0, 0.4, 0), V(0.17, 0.62, 0.05), 0.024, bark, 5);
  rod(g, V(0, 0.46, 0), V(-0.15, 0.66, -0.06), 0.022, bark, 5);
  const leaves = palette.map((c) => lowpoly(c));
  for (let i = 0; i < 8; i++) {
    const r = 0.2 + R() * 0.14;
    const a = R() * TAU;
    add(g, new THREE.IcosahedronGeometry(r, 1), leaves[i % leaves.length], Math.cos(a) * 0.22 * R(), 0.8 + R() * 0.3, Math.sin(a) * 0.22 * R());
  }
  return g;
}

/** A coconut palm with a gently curved trunk. About 1.5 tall. */
export function makePalm(R) {
  const g = new THREE.Group();
  const bark = lowpoly('#9b7652');
  const frond = lowpoly('#4f9b45', { side: THREE.DoubleSide });
  const lean = (R() - 0.5) * 0.5;
  let p = V(0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const q = V(Math.sin(lean) * 0.03 * i * i * 0.5, 0.2 * (i + 1), 0);
    rod(g, p, q, 0.05 - i * 0.004, bark, 6);
    p = q;
  }
  const top = p.clone();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + R() * 0.3;
    const leaf = new THREE.Group();
    leaf.position.copy(top);
    leaf.rotation.set(0, a, 0);
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.62, 4, 1, true).rotateZ(-Math.PI / 2).translate(0.31, 0, 0).scale(1, 0.18, 1), frond);
    blade.rotation.z = -0.35 - R() * 0.3;
    leaf.add(blade);
    g.add(leaf);
  }
  [0, 2.1, 4.2].forEach((a) => add(g, new THREE.IcosahedronGeometry(0.05, 0), lowpoly('#7a5a2a'), top.x + Math.cos(a) * 0.06, top.y - 0.06, Math.sin(a) * 0.06));
  return g;
}
