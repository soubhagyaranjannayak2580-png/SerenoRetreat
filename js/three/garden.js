// Sereno · the night garden. A walled lawn with a gate, string lights on the fence and a pad the house lands on.
// Local axes: y up, the gate faces +z.
import * as THREE from 'three';
import { V, TAU, std, lowpoly, add, rod, rbox, rng, bake, shadows, sagPoints, glowTexture, makeTree, makePalm, clamp01 } from './util.js';

const HALF = 1.72; // half the lawn width
const FENCE = HALF - 0.08;
export const SLOT = V(0, 0.012, -0.32); // where the house lands
export const SLOT_S = 0.6; // its scale there

const MOODS = {
  family: ['#ffcf8a', '#ffd9a0', '#ffc773'],
  party: ['#ff5d73', '#ffd166', '#3ee6b0', '#4cc9f0', '#c77dff', '#ff9f43'],
};

export class Garden {
  constructor(seed = 21) {
    const R = rng(seed);
    this.group = new THREE.Group();
    const G = this.group;

    /* ---------------------------------------------------------- ground */
    add(G, rbox(HALF * 2 + 0.04, 0.36, HALF * 2 + 0.04, 0.12), lowpoly('#5b3d26'), 0, -0.22, 0);
    add(G, rbox(HALF * 2, 0.08, HALF * 2, 0.05), std('#5f9a47', { roughness: 0.95 }), 0, -0.028, 0);

    // a paved ring for the house to land in
    const ring = add(G, new THREE.RingGeometry(1.3 * SLOT_S + 0.01, 1.3 * SLOT_S + 0.12, 48).rotateX(-Math.PI / 2), std('#d9ccb5', { roughness: 0.9 }), SLOT.x, 0.014, SLOT.z);
    void ring;
    add(G, new THREE.CircleGeometry(1.3 * SLOT_S + 0.01, 48).rotateX(-Math.PI / 2), std('#4f8a3b', { roughness: 1 }), SLOT.x, 0.013, SLOT.z);

    // path from the gate to the house
    for (let i = 0; i < 6; i++) {
      const s = add(G, new THREE.CylinderGeometry(0.1, 0.11, 0.025, 9), lowpoly('#e3d7c3'), (R() - 0.5) * 0.08, 0.02, HALF - 0.2 - i * 0.17);
      s.scale.set(1.25, 1, 0.8);
    }

    /* ----------------------------------------------------------- fence */
    const wood = std('#efe2c9', { roughness: 0.8 });
    const fenceH = 0.36, postH = 0.62;
    const posts = []; // walking round from the gate: front-right, right, back, left, front-left
    const step = 0.5;
    const line = (x0, z0, x1, z1) => {
      const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / step);
      for (let i = 0; i <= n; i++) posts.push(V(x0 + ((x1 - x0) * i) / n, 0, z0 + ((z1 - z0) * i) / n));
    };
    const GATE = 0.4;
    line(GATE, FENCE, FENCE, FENCE);
    posts.pop();
    line(FENCE, FENCE, FENCE, -FENCE);
    posts.pop();
    line(FENCE, -FENCE, -FENCE, -FENCE);
    posts.pop();
    line(-FENCE, -FENCE, -FENCE, FENCE);
    posts.pop();
    line(-FENCE, FENCE, -GATE, FENCE);
    // (each line's last post is the next line's first, hence the pops)

    posts.forEach((p) => {
      add(G, new THREE.BoxGeometry(0.045, postH, 0.045), wood, p.x, postH / 2, p.z);
      add(G, new THREE.ConeGeometry(0.04, 0.05, 4).rotateY(Math.PI / 4), wood, p.x, postH + 0.025, p.z);
    });
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i], b = posts[i + 1];
      [0.12, fenceH - 0.04].forEach((y) => rod(G, a.clone().setY(y), b.clone().setY(y), 0.01, wood, 4));
      const n = 4;
      for (let k = 1; k < n; k++) {
        const p = a.clone().lerp(b, k / n);
        add(G, new THREE.BoxGeometry(0.03, fenceH - 0.02, 0.03), wood, p.x, (fenceH - 0.02) / 2, p.z);
      }
    }

    // the gate: two leaves that swing inward
    const gateMat = std('#2f5d57', { roughness: 0.6 });
    this.leaves = [-1, 1].map((s) => {
      const pivot = new THREE.Group();
      pivot.position.set(s * GATE, 0, FENCE);
      const w = GATE - 0.02;
      const dir = -s; // leaf extends toward the middle
      [0.08, 0.38].forEach((y) => add(pivot, new THREE.BoxGeometry(w, 0.035, 0.03), gateMat, (dir * w) / 2, y, 0));
      for (let k = 0; k <= 5; k++) add(pivot, new THREE.BoxGeometry(0.025, 0.42, 0.025), gateMat, dir * (0.02 + (k * (w - 0.04)) / 5), 0.23, 0);
      G.add(pivot);
      pivot.userData.s = s;
      return pivot;
    });
    [-1, 1].forEach((s) => {
      add(G, new THREE.BoxGeometry(0.09, 0.7, 0.09), lowpoly('#d8cbb3'), s * (GATE + 0.04), 0.35, FENCE);
      add(G, new THREE.BoxGeometry(0.12, 0.04, 0.12), lowpoly('#b8a589'), s * (GATE + 0.04), 0.72, FENCE);
    });

    /* ----------------------------------------------------- string lights */
    const wire = std('#2a2420');
    const bulbPts = [];
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i].clone().setY(postH - 0.02), b = posts[i + 1].clone().setY(postH - 0.02);
      const pts = sagPoints(a, b, 0.07, 8);
      add(G, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.0045, 4), wire);
      [2, 4, 6].forEach((k) => bulbPts.push(pts[k].clone().add(V(0, -0.03, 0))));
    }
    this.bulbCount = bulbPts.length;
    this.bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), bulbPts.length);
    const m4 = new THREE.Matrix4();
    bulbPts.forEach((p, i) => {
      m4.makeTranslation(p.x, p.y, p.z);
      this.bulbs.setMatrixAt(i, m4);
      this.bulbs.setColorAt(i, new THREE.Color('#3a3128'));
    });
    G.add(this.bulbs);

    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(bulbPts.flatMap((p) => [p.x, p.y, p.z]), 3));
    glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(bulbPts.length * 3), 3));
    this.glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({
      map: glowTexture(), size: 0.3, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    G.add(this.glow);

    /* ---------------------------------------------------------- seating */
    const teak = std('#9a6a43', { roughness: 0.8 });
    const table = new THREE.Group();
    table.position.set(-1.0, 0, 0.78);
    table.rotation.y = 0.25;
    add(table, rbox(0.62, 0.035, 0.26, 0.01), teak, 0, 0.24, 0);
    [[-0.27, -0.1], [0.27, -0.1], [-0.27, 0.1], [0.27, 0.1]].forEach(([x, z]) => add(table, new THREE.BoxGeometry(0.03, 0.24, 0.03), std('#5a3a24'), x, 0.12, z));
    [-0.22, 0.22].forEach((z) => {
      add(table, rbox(0.58, 0.03, 0.09, 0.01), teak, 0, 0.14, z);
      [-0.24, 0.24].forEach((x) => add(table, new THREE.BoxGeometry(0.025, 0.14, 0.07), std('#5a3a24'), x, 0.07, z));
    });
    G.add(table);

    // floor cushions round a low table
    const lounge = new THREE.Group();
    lounge.position.set(1.0, 0, 0.82);
    add(lounge, new THREE.CylinderGeometry(0.18, 0.18, 0.025, 20), teak, 0, 0.1, 0);
    add(lounge, new THREE.CylinderGeometry(0.03, 0.04, 0.1, 8), std('#5a3a24'), 0, 0.05, 0);
    ['#e0794f', '#f2c14e', '#3f6b5c', '#e7d6c2'].forEach((c, i) => {
      const a = (i / 4) * TAU + 0.4;
      const cu = add(lounge, rbox(0.17, 0.06, 0.17, 0.03), std(c, { roughness: 0.95 }), Math.cos(a) * 0.34, 0.03, Math.sin(a) * 0.34);
      cu.rotation.y = -a;
    });
    G.add(lounge);

    // lanterns: on the table and the low table
    this.lanternMat = new THREE.MeshStandardMaterial({ color: '#f4e6c8', emissive: new THREE.Color('#ffb85c'), emissiveIntensity: 0, roughness: 0.4 });
    const lanternAt = (x, y, z) => {
      add(G, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), this.lanternMat, x, y + 0.03, z);
      add(G, new THREE.ConeGeometry(0.04, 0.03, 8), std('#2a2420'), x, y + 0.075, z);
    };
    lanternAt(-1.08, 0.26, 0.76);
    lanternAt(-0.86, 0.26, 0.82);
    lanternAt(1.0, 0.115, 0.82);

    /* ------------------------------------------------------------ trees */
    const t1 = makeTree(R);
    t1.position.set(-1.25, 0, -1.25);
    const t2 = makePalm(R);
    t2.position.set(1.3, 0, -1.2);
    const t3 = makeTree(R, ['#4f9a3e', '#3f8a34', '#68b04f']);
    t3.position.set(1.32, 0, -0.1);
    t3.scale.setScalar(0.75);
    G.add(t1, t2, t3);
    const hedge = lowpoly('#4e9640');
    [[-1.4, -0.2], [-1.45, 0.25], [1.42, 1.3], [-1.45, 1.35], [0.62, -1.42], [-0.6, -1.45]].forEach(([x, z]) => add(G, new THREE.IcosahedronGeometry(0.11 + R() * 0.05, 0), hedge, x, 0.07, z));

    /* -------------------------------------------------------- fireflies */
    const FF = 26;
    this.ff = Array.from({ length: FF }, () => ({ x: (R() - 0.5) * 2.8, z: (R() - 0.5) * 2.8, y: 0.25 + R() * 0.6, ph: R() * TAU, sp: 0.4 + R() * 0.6 }));
    const ffGeo = new THREE.BufferGeometry();
    ffGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(FF * 3), 3));
    this.fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({
      map: glowTexture(), color: '#e6ff8a', size: 0.12, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    G.add(this.fireflies);

    // warm light from the string lights
    this.light = new THREE.PointLight('#ffb35c', 0, 0, 2);
    this.light.position.set(0, 0.9, 0.5);
    G.add(this.light);

    shadows(G);
    this.bulbs.castShadow = false;
    bake(G, [...this.leaves]);

    this.lit = 0;
    this.settle = 0;
    this.mood = 'family';
    this._c = new THREE.Color();
    this._s = V();
    this._off = new THREE.Color('#3a3128');
  }

  setGate(v) {
    this.leaves.forEach((p) => (p.rotation.y = p.userData.s * -v * 1.5));
  }
  /** 0..1: the bulbs come on one by one, walking round from the gate. */
  setLit(v) { this.lit = v; }
  /** 0..1: lanterns warm up and the fireflies come out. */
  setSettle(v) { this.settle = v; }
  setMood(m) { if (MOODS[m]) this.mood = m; }

  /** World pose of the landing pad, for the travelling house. */
  slotPose(out) {
    out.p.copy(SLOT).applyMatrix4(this.group.matrixWorld);
    this.group.getWorldQuaternion(out.q);
    this.group.getWorldScale(this._s);
    out.s = this._s.x * SLOT_S;
    out.sy = out.sxz = 1;
    return out;
  }

  update(dt, time, pxScale) {
    const n = this.bulbCount;
    const pal = MOODS[this.mood];
    const party = this.mood === 'party';
    const col = this.glow.geometry.attributes.color;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const on = clamp01(this.lit * n - i);
      let b = party ? 0.55 + 0.45 * Math.sin(time * 5 + i * 0.9) : 0.85 + 0.15 * Math.sin(time * 2.2 + i * 2.3);
      b *= on;
      this._c.set(pal[i % pal.length]);
      if (party) this._c.offsetHSL(Math.sin(time * 0.5) * 0.04, 0, 0);
      col.setXYZ(i, this._c.r * b, this._c.g * b, this._c.b * b);
      this._c.lerp(this._off, 1 - Math.max(on * 0.35, b));
      this.bulbs.setColorAt(i, on > 0 ? this._c.multiplyScalar(1.6) : this._off);
      total += b;
    }
    col.needsUpdate = true;
    this.bulbs.instanceColor.needsUpdate = true;
    this.glow.material.size = 0.36 * pxScale;
    this.fireflies.material.size = 0.1 * pxScale;

    this.group.getWorldScale(this._s);
    const s = this._s.x;
    this.light.intensity = (total / n) * 3.2 * s * s + this.settle * 0.6 * s * s;
    this.light.color.set(party ? pal[Math.floor(time * 1.5) % pal.length] : '#ffb35c');
    this.lanternMat.emissiveIntensity = this.settle * (2.4 + 0.3 * Math.sin(time * 9));

    const pos = this.fireflies.geometry.attributes.position;
    this.ff.forEach((f, i) => {
      const t = time * f.sp + f.ph;
      pos.setXYZ(i, f.x + Math.sin(t * 0.7) * 0.25, f.y + Math.sin(t * 1.3) * 0.12, f.z + Math.cos(t * 0.6) * 0.25);
    });
    pos.needsUpdate = true;
    this.fireflies.material.opacity = this.settle * (0.7 + 0.3 * Math.sin(time * 4));
  }
}
