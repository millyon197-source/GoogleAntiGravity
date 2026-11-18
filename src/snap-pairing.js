import * as THREE from 'three';

/** Min-heap on `d`. */
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].d <= a[i].d) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let s = i;
        if (l < a.length && a[l].d < a[s].d) s = l;
        if (r < a.length && a[r].d < a[s].d) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]];
        i = s;
      }
    }
    return top;
  }
}

/**
 * Snap pairing: joins modules at their snap points. The two modules whose snap points are closest
 * to each other are joined first (the second moves so its snap point lands on the first's), and
 * both become stationary. Then, one by one, the remaining module with a snap point closest to a
 * free snap point of a stationary module moves onto it and becomes stationary too. A snap point
 * joins at most one other, and only one whose hull normal faces it (getNormals). A join that would
 * leave the moving module's box deep inside a stationary module's box, or outside `fits` (e.g. the
 * plot), is skipped for the next closest one.
 * When no remaining module can join the stationary ones, the closest pair of remaining modules
 * starts a new group the same way, until no pair can join; a module that cannot join stays.
 *
 * @param {Array<object>} modules the modules to join (THREE objects)
 * @param {{
 *   getSnaps: (mod: object) => THREE.Vector3[],
 *   getBox: (mod: object) => THREE.Box3 | null,
 *   maxOverlap?: number,
 *   fits?: (box: THREE.Box3) => boolean,
 *   getNormals?: (mod: object) => THREE.Vector3[],
 *   maxFacingDot?: number
 * }} options getSnaps gives a module's snap points in world space, getBox its world box;
 *   maxOverlap is the largest share of the smaller box two joined modules may have in common;
 *   fits says whether a moved module's box is somewhere it may go; getNormals gives each snap
 *   point's outward hull normal in world space (unit), and two snap points join only when their
 *   normals face each other: dot product at most maxFacingDot (-0.99: opposite within about 8 degrees)
 * @returns {{ order: object[], joins: Array<{ mod: object, to: object, delta: THREE.Vector3 }> }}
 *   the modules in the order they became stationary, and each move made (applied to position)
 */
export function pairModulesAtSnaps(modules, { getSnaps, getBox, maxOverlap = 0.1, fits = () => true, getNormals = null, maxFacingDot = -0.99 } = {}) {
  // World snap points and boxes, read once; a move translates them
  const snaps = new Map();
  const normals = new Map();
  const boxes = new Map();
  for (const m of modules || []) {
    if (!m) continue;
    const s = getSnaps(m);
    if (s.length === 0) continue;
    snaps.set(m, s.map(p => p.clone()));
    normals.set(m, getNormals ? getNormals(m) : null);
    const b = getBox(m);
    boxes.set(m, b && !b.isEmpty() ? b.clone() : null);
  }
  const mods = [...snaps.keys()];
  const order = [];
  const joins = [];
  if (mods.length < 2) return { order, joins };

  const used = new Map(mods.map(m => [m, new Set()]));
  const volume = (b) => Math.max(0, b.max.x - b.min.x) * Math.max(0, b.max.y - b.min.y) * Math.max(0, b.max.z - b.min.z);
  const tooDeep = (a, b) => {
    if (!a || !b) return false;
    if (a.max.x <= b.min.x || b.max.x <= a.min.x || a.max.y <= b.min.y || b.max.y <= a.min.y ||
      a.max.z <= b.min.z || b.max.z <= a.min.z) return false;
    const i = a.clone().intersect(b);
    const smaller = Math.min(volume(a), volume(b));
    return smaller > 0 && volume(i) / smaller > maxOverlap;
  };
  const deltaOf = (c) => new THREE.Vector3().subVectors(snaps.get(c.a)[c.ai], snaps.get(c.m)[c.mi]);
  // Would the moving module, moved by `delta`, sit too deep in any of `placed`?
  const clashes = (mod, delta, placed) => {
    const box = boxes.get(mod);
    if (!box) return false;
    const moved = box.clone().translate(delta);
    return placed.some(p => p !== mod && tooDeep(moved, boxes.get(p)));
  };
  const free = (c) => !used.get(c.a).has(c.ai) && !used.get(c.m).has(c.mi);
  const join = (c, delta) => {
    c.m.position.add(delta);
    c.m.updateMatrixWorld(true);
    for (const p of snaps.get(c.m)) p.add(delta);
    if (boxes.get(c.m)) boxes.get(c.m).translate(delta);
    used.get(c.a).add(c.ai);
    used.get(c.m).add(c.mi);
    joins.push({ mod: c.m, to: c.a, delta });
  };
  // Candidates between an anchor's free snaps and a mover's free snaps
  const pairs = (a, m, out) => {
    const an = normals.get(a), mn = normals.get(m);
    snaps.get(a).forEach((ap, ai) => {
      if (used.get(a).has(ai)) return;
      snaps.get(m).forEach((mp, mi) => {
        if (an && mn && an[ai] && mn[mi] && an[ai].dot(mn[mi]) > maxFacingDot) return;
        if (!used.get(m).has(mi)) out.push({ a, ai, m, mi, d: ap.distanceToSquared(mp) });
      });
    });
  };

  // A move is allowed when the moved box still fits (e.g. inside the plot) and is not buried in a
  // stationary module
  const allowed = (c, delta) => {
    const box = boxes.get(c.m);
    if (box && !fits(box.clone().translate(delta))) return false;
    return !clashes(c.m, delta, order);
  };
  const remaining = new Set(mods);
  const heap = new MinHeap();
  const offer = (anchor) => {
    const out = [];
    for (const m of remaining) pairs(anchor, m, out);
    for (const c of out) heap.push(c);
  };
  const settle = (m) => { order.push(m); remaining.delete(m); offer(m); };

  // Every pair of modules, closest first, for starting groups. Remaining modules do not move and
  // the stationary ones only grow in number, so a pair that cannot start a group never can later:
  // one pass down the list (a cursor) finds each next group's start.
  const all = [];
  for (let i = 0; i < mods.length; i++) for (let k = i + 1; k < mods.length; k++) {
    pairs(mods[i], mods[k], all);
    pairs(mods[k], mods[i], all);
  }
  all.sort((x, y) => x.d - y.d);
  let cursor = 0;

  while (remaining.size >= 2) {
    // A new pair: the two remaining modules with the closest snap points (the first one stays,
    // so it must not be buried in a stationary module itself)
    let seed = null;
    for (; cursor < all.length && !seed; cursor++) {
      const c = all[cursor];
      if (!remaining.has(c.a) || !remaining.has(c.m) || !free(c)) continue;
      const anchorBox = boxes.get(c.a);
      if (anchorBox && !fits(anchorBox)) continue;
      if (clashes(c.a, new THREE.Vector3(), order)) continue;
      const delta = deltaOf(c);
      if (!allowed(c, delta)) continue;
      if (anchorBox && boxes.get(c.m) && tooDeep(anchorBox, boxes.get(c.m).clone().translate(delta))) continue;
      seed = c;
    }
    if (!seed) break;
    join(seed, deltaOf(seed));
    settle(seed.a);
    settle(seed.m);

    // Then each remaining module, the closest to a free stationary snap point first. Stationary
    // modules never move again, so a used snap, a clash or a misfit rules a candidate out for good.
    while (remaining.size > 0 && heap.size > 0) {
      const c = heap.pop();
      if (!remaining.has(c.m) || !free(c)) continue;
      const delta = deltaOf(c);
      if (!allowed(c, delta)) continue;
      join(c, delta);
      settle(c.m);
    }
  }
  return { order, joins };
}
