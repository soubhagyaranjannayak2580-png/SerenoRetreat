// Sereno · the floating estate. Island-local axes: y up, +z faces the camera at rotation 0.
// Features sit at polar angles ψ (x = r·sinψ, z = r·cosψ) so they face the camera in turn as it rotates.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { V, UP, TAU, smooth, polar, std, lowpoly, add, rod, rbox, rng, bake, shadows, ribbon, sagPoints, makeTree, makePalm } from './util.js';
import { House } from './house.js';

export const ISLAND_R = 3;
const edgeR = (th) => ISLAND_R + 0.16 * Math.sin(3 * th + 0.4) + 0.09 * Math.sin(7 * th + 1.3) + 0.05 * Math.sin(13 * th);

/* --------------------------------------------------------------- layout */

const PSI = { gate: -1.12, house: -0.42, lawn: 0.22, hammock: 0.82 };
const [GX, GZ] = polar(PSI.gate, 2.55);
const [HX, HZ] = polar(PSI.house, 1.25);
const [LX, LZ] = polar(PSI.lawn, 1.6);
const [MX, MZ] = polar(PSI.hammock, 1.8);
const HOUSE_S = 0.8;

export function groundH(x, z) {
  const r = Math.hypot(x, z) / ISLAND_R;
  const h = 0.12 * (1 - r * r) + 0.05 * Math.sin(x * 1.3 + 0.5) * Math.cos(z * 1.1) + 0.035 * Math.sin(x * 2.7 - z * 1.9);
  // flatten a pad under the house
  const w = smooth((1.05 - Math.hypot(x - HX, z - HZ)) / 0.35);
  return h * (1 - w) + 0.1 * w;
}

const KEEP_OUT = [[HX, HZ, 1.05], [LX, LZ, 0.55], [MX, MZ, 0.5], [GX, GZ, 0.4]];
const free = (x, z, pad = 0) => KEEP_OUT.every(([kx, kz, r]) => Math.hypot(x - kx, z - kz) > r + pad);

/* ------------------------------------------------------------- terrain */

function makeTop(drive) {
  const SEG = 128, RINGS = 40;
  const pos = [], col = [], idx = [];
  const greens = ['#7cc35a', '#62ad46', '#97d36b', '#5aa040'].map((c) => new THREE.Color(c));
  const dark = new THREE.Color('#4d8a37');
  const c = new THREE.Color();
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;
    for (let j = 0; j <= SEG; j++) {
      const th = (j / SEG) * TAU;
      const r = edgeR(th) * t;
      const x = r * Math.sin(th), z = r * Math.cos(th);
      pos.push(x, groundH(x, z) - 0.05 * smooth((t - 0.9) / 0.1), z);
      const n = 0.5 + 0.5 * Math.sin(x * 2.1 + z * 1.3) * Math.cos(z * 2.7 - x);
      const k = n * (greens.length - 1);
      c.copy(greens[Math.floor(k)]).lerp(greens[Math.min(greens.length - 1, Math.floor(k) + 1)], k % 1);
      c.lerp(dark, smooth((t - 0.85) / 0.15) * 0.5);
      col.push(c.r, c.g, c.b);
    }
  }
  const row = SEG + 1;
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * row + j, b = a + row;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, std('#ffffff', { vertexColors: true, roughness: 0.95 }));
  m.receiveShadow = true;
  void drive;
  return m;
}

function makeUnderside() {
  const SEG = 72;
  const levels = [
    [1.0, null, '#5f3d22', 0], [0.995, -0.14, '#7d5230', 0], [0.985, -0.24, '#6b4428', 0], [0.97, -0.36, '#8a5e38', 0],
    [0.9, -0.62, '#a08a74', 1], [0.78, -0.96, '#857464', 1], [0.63, -1.3, '#b09a84', 1], [0.47, -1.68, '#7a6a5c', 1],
    [0.3, -2.02, '#958270', 1], [0.14, -2.34, '#6f6053', 1], [0.0, -2.56, '#6f6053', 1],
  ];
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  levels.forEach(([s, y, color, rocky], i) => {
    c.set(color);
    for (let j = 0; j <= SEG; j++) {
      const th = (j / SEG) * TAU;
      const n = rocky ? Math.sin(th * 5 + i * 1.7) * 0.5 + Math.sin(th * 11 + i * 0.6) * 0.35 : 0;
      const r = edgeR(th) * s * (1 + n * 0.09);
      const x = r * Math.sin(th), z = r * Math.cos(th);
      pos.push(x, y === null ? groundH(x, z) - 0.05 : y + n * 0.08, z);
      const shade = 0.88 + 0.12 * Math.sin(th * 3 + i);
      col.push(c.r * shade, c.g * shade, c.b * shade);
    }
  });
  const row = SEG + 1;
  for (let i = 0; i < levels.length - 1; i++) {
    for (let j = 0; j < SEG; j++) {
      const a = i * row + j, b = a + row;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g = g.toNonIndexed();
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, std('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.95, side: THREE.DoubleSide }));
  m.castShadow = true;
  return m;
}

function makeRoots(group, R) {
  const mat = std('#5a3820', { roughness: 0.9 });
  for (let i = 0; i < 10; i++) {
    const th = R() * TAU;
    const r = edgeR(th) * 0.96;
    const o = V(Math.sin(th), 0, Math.cos(th));
    const start = o.clone().multiplyScalar(r).setY(-0.3);
    const pts = [start];
    for (let k = 1; k <= 4; k++) pts.push(start.clone().addScaledVector(o, 0.04 * k + (R() - 0.5) * 0.08).add(V((R() - 0.5) * 0.08, -0.16 * k, (R() - 0.5) * 0.08)));
    add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.014 * (0.6 + R() * 0.6), 5), mat);
  }
}

/* ---------------------------------------------------------------- props */

function makeGate() {
  const g = new THREE.Group();
  const pillar = lowpoly('#d8cbb3'), cap = lowpoly('#b8a589'), iron = std('#2f5d57', { roughness: 0.6 });
  [-1, 1].forEach((s) => {
    add(g, new THREE.BoxGeometry(0.16, 0.62, 0.16), pillar, s * 0.36, 0.31, 0);
    add(g, new THREE.BoxGeometry(0.2, 0.05, 0.2), cap, s * 0.36, 0.645, 0);
    add(g, new THREE.SphereGeometry(0.05, 10, 8), cap, s * 0.36, 0.7, 0);
    // open leaves, swung inward
    const leaf = new THREE.Group();
    leaf.position.set(s * 0.28, 0, 0);
    leaf.rotation.y = s * 1.2;
    [0.08, 0.4].forEach((y) => add(leaf, new THREE.BoxGeometry(0.27, 0.03, 0.025), iron, -s * 0.135, y, 0));
    for (let k = 0; k <= 5; k++) add(leaf, new THREE.BoxGeometry(0.02, 0.42, 0.02), iron, -s * (0.02 + k * 0.047), 0.24, 0);
    g.add(leaf);
    // low wall either side
    add(g, new THREE.BoxGeometry(0.7, 0.22, 0.1), pillar, s * 0.8, 0.11, 0.02);
    add(g, new THREE.BoxGeometry(0.72, 0.03, 0.13), cap, s * 0.8, 0.235, 0.02);
  });
  // name board
  add(g, rbox(0.5, 0.11, 0.025, 0.01), std('#3f6b5c'), 0, 0.82, 0);
  add(g, new THREE.BoxGeometry(0.62, 0.03, 0.03), cap, 0, 0.75, 0);
  return g;
}

function makeCar() {
  const g = new THREE.Group();
  const paint = std('#e0794f', { roughness: 0.35, metalness: 0.2 });
  const glass = std('#2e3d45', { roughness: 0.15, metalness: 0.3 });
  add(g, rbox(0.56, 0.13, 0.27, 0.05), paint, 0, 0.12, 0);
  add(g, rbox(0.32, 0.11, 0.24, 0.04), glass, -0.03, 0.22, 0);
  add(g, rbox(0.3, 0.025, 0.25, 0.012), paint, -0.03, 0.28, 0);
  const tyre = std('#222222', { roughness: 0.9 });
  [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.13], [0.17, 0.13]].forEach(([x, z]) => add(g, new THREE.CylinderGeometry(0.055, 0.055, 0.04, 14).rotateX(Math.PI / 2), tyre, x, 0.06, z));
  [-0.07, 0.07].forEach((z) => add(g, new THREE.BoxGeometry(0.01, 0.025, 0.04), std('#fff3c4', { emissive: '#fff3c4', emissiveIntensity: 0.4 }), 0.28, 0.13, z));
  return g;
}

function makeLawnParty(bulbMat) {
  const g = new THREE.Group();
  const teak = std('#9a6a43'), dark = std('#5a3a24');
  // a round table and chairs
  add(g, new THREE.CylinderGeometry(0.22, 0.22, 0.025, 24), teak, 0, 0.22, 0);
  add(g, new THREE.CylinderGeometry(0.025, 0.05, 0.22, 8), dark, 0, 0.11, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const ch = new THREE.Group();
    ch.position.set(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36);
    ch.rotation.y = -a + Math.PI / 2;
    add(ch, rbox(0.12, 0.02, 0.12, 0.008), std('#f2ead8'), 0, 0.13, 0);
    add(ch, rbox(0.12, 0.13, 0.02, 0.008), std('#f2ead8'), 0, 0.2, -0.055);
    [[-0.05, -0.05], [0.05, -0.05], [-0.05, 0.05], [0.05, 0.05]].forEach(([x, z]) => add(ch, new THREE.CylinderGeometry(0.008, 0.008, 0.13, 5), dark, x, 0.065, z));
    g.add(ch);
  }
  // four poles with crossing string lights
  const poleMat = std('#2a2420');
  const P = [[-0.55, -0.55], [0.55, -0.55], [0.55, 0.55], [-0.55, 0.55]].map(([x, z]) => {
    rod(g, V(x, 0, z), V(x, 0.78, z), 0.012, poleMat);
    return V(x, 0.76, z);
  });
  [[0, 2], [1, 3], [0, 1], [1, 2], [2, 3], [3, 0]].forEach(([a, b]) => {
    const pts = sagPoints(P[a], P[b], 0.12, 10);
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.004, 4), poleMat);
    for (let k = 1; k < 10; k += 2) add(g, new THREE.SphereGeometry(0.02, 8, 6), bulbMat, pts[k].x, pts[k].y - 0.02, pts[k].z);
  });
  return g;
}

function makeHammock(R) {
  const g = new THREE.Group();
  const t1 = makeTree(R), t2 = makeTree(R, ['#4f9a3e', '#3f8a34', '#68b04f']);
  t1.position.set(-0.5, 0, 0);
  t2.position.set(0.5, 0, 0);
  t1.scale.setScalar(0.9);
  t2.scale.setScalar(0.85);
  g.add(t1, t2);
  const a = V(-0.46, 0.36, 0), b = V(0.46, 0.36, 0);
  const pts = sagPoints(a, b, 0.2, 16);
  const cloth = new THREE.Mesh(ribbon(pts, 0.2), std('#e0794f', { roughness: 0.95, side: THREE.DoubleSide }));
  g.add(cloth);
  [[a, pts[2]], [b, pts[14]]].forEach(([p, q]) => [-0.08, 0.08].forEach((dz) => rod(g, p, q.clone().add(V(0, 0, dz)), 0.004, std('#efe2c9'), 3)));
  // stripes
  [4, 8, 12].forEach((k) => add(g, new THREE.BoxGeometry(0.03, 0.006, 0.2), std('#f2c14e'), pts[k].x, pts[k].y + 0.004, pts[k].z));
  return g;
}

/* ----------------------------------------------------------- the island */

export class Estate {
  constructor(seed = 12) {
    const R = rng(seed);
    this.group = new THREE.Group();
    const G = this.group;
    G.add(makeTop(), makeUnderside());
    makeRoots(G, R);

    const place = (obj, x, z, rotY = 0, lift = 0) => {
      obj.position.set(x, groundH(x, z) + lift, z);
      obj.rotation.y = rotY;
      G.add(obj);
      return obj;
    };

    // the farmhouse
    this.house = new House({ tile: false, seed: 5 });
    this.house.setLights(0);
    this.house.setDoor(0.35);
    place(this.house.group, HX, HZ, PSI.house, 0);
    this.house.group.scale.setScalar(HOUSE_S);

    // gate on the rim, a gravel drive up to the house, and a car parked beside it
    const gate = place(makeGate(), GX, GZ, PSI.gate);
    void gate;
    const [fx, fz] = [HX + Math.sin(PSI.house) * 0.62, HZ + Math.cos(PSI.house) * 0.62];
    const drive = new THREE.CatmullRomCurve3([V(GX, 0, GZ), V((GX + fx) / 2 - 0.25, 0, (GZ + fz) / 2 + 0.25), V(fx, 0, fz)]).getPoints(24);
    const driveMesh = new THREE.Mesh(ribbon(drive, 0.34, (x, z) => groundH(x, z) + 0.008), std('#e3d3b4', { roughness: 1 }));
    driveMesh.receiveShadow = true;
    G.add(driveMesh);
    drive.forEach((p, i) => {
      if (i % 2) return;
      KEEP_OUT.push([p.x, p.z, 0.24]);
    });
    const [cx, cz] = polar(PSI.gate + 0.28, 2.0);
    place(makeCar(), cx, cz, PSI.gate + 1.9, 0);
    KEEP_OUT.push([cx, cz, 0.35]);

    // the lawn party spot
    this.bulbMat = new THREE.MeshStandardMaterial({ color: '#f4e6c8', emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 0.6, roughness: 0.4 });
    place(makeLawnParty(this.bulbMat), LX, LZ, PSI.lawn);

    // the hammock between two trees
    place(makeHammock(R), MX, MZ, PSI.hammock + Math.PI / 2);

    // trees round the back and sides
    [
      ['palm', -2.05, -1.0], ['tree', -1.2, -2.0], ['palm', 0.2, -2.3], ['tree', 1.35, -1.75], ['palm', 2.3, -0.6],
      ['tree', -2.35, 0.55], ['palm', 2.45, 0.9], ['tree', 0.35, -1.2], ['palm', -0.7, -1.45],
    ].forEach(([k, x, z]) => {
      const t = place(k === 'palm' ? makePalm(R) : makeTree(R), x, z, R() * TAU);
      t.scale.setScalar(k === 'palm' ? 0.85 + R() * 0.25 : 0.7 + R() * 0.25);
      KEEP_OUT.push([x, z, 0.3]);
    });

    // hedge along the rim, gap at the gate
    const hedge = lowpoly('#4e9640');
    for (let a = 0; a < TAU; a += 0.16) {
      const d = Math.atan2(Math.sin(a - PSI.gate), Math.cos(a - PSI.gate));
      if (Math.abs(d) < 0.3) continue;
      const r = edgeR(a) - 0.14;
      const [x, z] = [Math.sin(a) * r, Math.cos(a) * r];
      add(G, new THREE.IcosahedronGeometry(0.1 + R() * 0.05, 0), hedge, x, groundH(x, z) + 0.06, z);
    }

    // flowers and grass
    const scatter = (n, pad, fn) => {
      let made = 0, guard = 0;
      while (made < n && guard++ < n * 20) {
        const th = R() * TAU, r = Math.sqrt(R()) * (edgeR(th) - 0.3);
        const x = r * Math.sin(th), z = r * Math.cos(th);
        if (!free(x, z, pad)) continue;
        fn(x, z, made++);
      }
    };
    const FLOWERS = 180;
    const heads = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.026, 0), lowpoly('#ffffff'), FLOWERS);
    const flowerCols = ['#ff8a65', '#ffd166', '#fffaf0', '#f7a8c6', '#c9a7ff', '#ffa20f'].map((c) => new THREE.Color(c));
    const m4 = new THREE.Matrix4();
    scatter(FLOWERS, 0.05, (x, z, i) => {
      m4.makeTranslation(x, groundH(x, z) + 0.06, z);
      heads.setMatrixAt(i, m4);
      heads.setColorAt(i, flowerCols[i % flowerCols.length]);
    });
    const blades = [];
    for (let k = 0; k < 3; k++) {
      const c = new THREE.ConeGeometry(0.016, 0.13, 3);
      c.translate(0, 0.065, 0);
      c.rotateZ((k - 1) * 0.35);
      c.rotateY(k * 2.1);
      blades.push(c);
    }
    const TUFTS = 360;
    const tufts = new THREE.InstancedMesh(mergeGeometries(blades), lowpoly('#ffffff'), TUFTS);
    const tuftCols = ['#5aa040', '#73b950', '#4b9136', '#8cc860'].map((c) => new THREE.Color(c));
    const q = new THREE.Quaternion(), s = V(), p = V();
    scatter(TUFTS, 0.0, (x, z, i) => {
      q.setFromAxisAngle(UP, R() * TAU);
      s.setScalar(0.7 + R() * 0.7);
      m4.compose(p.set(x, groundH(x, z) - 0.01, z), q, s);
      tufts.setMatrixAt(i, m4);
      tufts.setColorAt(i, tuftCols[i % tuftCols.length]);
    });
    [heads, tufts].forEach((m) => {
      m.castShadow = true;
      m.receiveShadow = true;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
      G.add(m);
    });

    // butterflies
    const wingGeo = new THREE.CircleGeometry(0.05, 10);
    wingGeo.translate(0.045, 0, 0);
    this.butterflies = ['#ff8a65', '#ffd166', '#9fd8ff', '#f7a8c6', '#ffffff'].map((c, i) => {
      const b = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, side: THREE.DoubleSide });
      const l = new THREE.Mesh(wingGeo, mat), r = new THREE.Mesh(wingGeo, mat);
      const wl = new THREE.Group(), wr = new THREE.Group();
      wl.add(l); wr.add(r);
      wr.rotation.y = Math.PI;
      l.rotation.x = r.rotation.x = -Math.PI / 2;
      b.add(wl, wr);
      b.userData = { wl, wr, cx: (R() - 0.5) * 3, cz: (R() - 0.5) * 3, a: 0.4 + R() * 0.5, b: 0.5 + R() * 0.6, ph: R() * TAU, i };
      G.add(b);
      return b;
    });

    // clouds orbiting above
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: new THREE.Color('#fff4e0'), emissiveIntensity: 0.25 });
    this.clouds = Array.from({ length: 5 }, (_, i) => {
      const c = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + R() * 0.18, 1), cloudMat);
        m.position.set((k - 2) * 0.24, R() * 0.12, (R() - 0.5) * 0.2);
        c.add(m);
      }
      c.userData = { r: 3.4 + R() * 0.6, y: 1.7 + R() * 0.6, a: (i / 5) * TAU, speed: 0.04 + R() * 0.03 };
      G.add(c);
      return c;
    });

    shadows(G);
    this.clouds.forEach((c) => c.traverse((o) => (o.castShadow = false)));
    bake(G, [this.house.group, ...this.butterflies, ...this.clouds]);

    // hotspots, in island-local space, with their facing angle ψ
    this.hotspots = {
      gate: V(GX, groundH(GX, GZ) + 0.95, GZ),
      house: V(HX, groundH(HX, HZ) + 0.95, HZ),
      lawn: V(LX, groundH(LX, LZ) + 0.85, LZ),
      hammock: V(MX, groundH(MX, MZ) + 0.6, MZ),
    };
    this.psi = Object.fromEntries(Object.entries(this.hotspots).map(([k, v]) => [k, Math.atan2(v.x, v.z)]));
  }

  update(dt, time) {
    this.house.update(dt, time);
    this.bulbMat.emissiveIntensity = 0.5 + 0.2 * Math.sin(time * 2);
    this.butterflies.forEach((b) => {
      const u = b.userData, t = time * 0.5 + u.ph;
      const x = u.cx + Math.sin(t * u.a) * 0.7, z = u.cz + Math.cos(t * u.b) * 0.6;
      const y = groundH(x, z) + 0.35 + Math.sin(t * 2.3) * 0.12;
      const nx = u.cx + Math.sin((t + 0.05) * u.a) * 0.7, nz = u.cz + Math.cos((t + 0.05) * u.b) * 0.6;
      b.position.set(x, y, z);
      b.rotation.y = Math.atan2(nx - x, nz - z);
      const flap = Math.sin(time * 22 + u.i) * 1.1;
      u.wl.rotation.z = flap;
      u.wr.rotation.z = -flap;
    });
    this.clouds.forEach((c) => {
      const u = c.userData;
      const a = u.a + time * u.speed;
      c.position.set(Math.sin(a) * u.r, u.y + Math.sin(time * 0.4 + u.a) * 0.08, Math.cos(a) * u.r);
      c.rotation.y = a;
    });
  }
}
