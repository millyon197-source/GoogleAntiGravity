/**
 * Browser diagnostic: how far each drawn part of a loaded module is from where the game's
 * component XML puts it. Run in the dev page console (vite serves this file):
 *
 *   const { checkModuleParts } = await import('/tools/diagnostics/check-part-placement.browser.js');
 *   await checkModuleParts(window.viewer, window.viewer.modulesGroup.children[0]);
 *
 * For each part, the expected centre is the XML connection's position (composed through its
 * parent chain) plus the part's box centre (<size_raw>, else <size>), which the XML already gives
 * in component axes. The drawn centre is the part's mesh box in the module's local frame. Both are
 * compared relative to a reference part (part_main, else the first part both sides have), so a
 * module-wide shift does not count; `abs` compares against the module origin instead (X mirrored).
 *
 * @param {object} viewer the StationViewer
 * @param {object} mod a loaded module group (viewer.modulesGroup child)
 * @param {{ parts?: string[], ref?: string }} [options] only these parts; the reference part
 * @returns {Promise<{ key: string, ref: string, rows: Array<{ name: string, off: number|null, abs: number|null }> }|{ error: string }>}
 */
export async function checkModuleParts(viewer, mod, { parts = null, ref = 'part_main' } = {}) {
  const e = viewer.resolveModuleAssetEntry(mod.userData.macro);
  if (!e) return { error: `no asset entry for ${mod.userData.macro}` };
  const xml = await (await fetch(e.folderPath.replace(/_data$/, '') + '.xml')).text();
  const attr = (s, n) => s.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];
  const xyz = (tag, keys = ['x', 'y', 'z']) => keys.map(k => +attr(tag, k) || 0);
  const conns = [];
  for (const mm of xml.matchAll(/<connection\b([^>]*?)(\/>|>([\s\S]*?)<\/connection>)/g)) {
    const head = mm[1];
    const body = mm[3] || '';
    const pre = body.split(/<parts\b|<animations\b/)[0];
    const off = pre.match(/<offset>([\s\S]*?)<\/offset>/)?.[1] || '';
    const p = off.match(/<position\b[^>]*>/)?.[0];
    const q = off.match(/<quaternion\b[^>]*>/)?.[0];
    const center = (body.match(/<size_raw>[\s\S]*?<center\b[^>]*>/) || body.match(/<size>[\s\S]*?<center\b[^>]*>/))?.[0].match(/<center\b[^>]*>/)?.[0];
    conns.push({
      parent: attr(head, 'parent'),
      pos: p ? xyz(p) : [0, 0, 0],
      quat: q ? xyz(q, ['qx', 'qy', 'qz', 'qw']) : [0, 0, 0, 1],
      parts: [...body.matchAll(/<part\b[^>]*\bname="([^"]+)"/g)].map(x => x[1].toLowerCase()),
      center: center ? xyz(center) : null
    });
  }
  const byPart = new Map();
  conns.forEach(c => c.parts.forEach(p => { if (!byPart.has(p)) byPart.set(p, c); }));

  const V = viewer.camera.position.constructor;
  const Q = viewer.camera.quaternion.constructor;
  const world = (c, seen = new Set()) => {
    const pc = c.parent && byPart.get(c.parent.toLowerCase());
    if (!pc || seen.has(pc)) return { pos: new V(...c.pos), quat: new Q(...c.quat) };
    seen.add(c);
    const pw = world(pc, seen);
    return { pos: pw.pos.clone().add(new V(...c.pos).applyQuaternion(pw.quat)), quat: pw.quat.clone().multiply(new Q(...c.quat)) };
  };
  const expected = (name) => {
    const c = byPart.get(name);
    return c?.center ? world(c).pos.clone().add(new V(...c.center)) : null;
  };

  mod.updateMatrixWorld(true);
  const inv = mod.matrixWorld.clone().invert();
  const Box = viewer.getModuleWorldBoundingBox(mod).constructor;
  const drawn = (name) => {
    let obj = null;
    mod.traverse(o => { if (!obj && o.userData?.partName?.toLowerCase() === name) obj = o; });
    if (!obj) return null;
    const b = new Box();
    // Only this part's own meshes: child parts attached under it (component-part-parents) are skipped
    const visit = (o) => {
      if (o !== obj && o.userData?.partName) return;
      if (o.isMesh && o.geometry && !o.userData?.isBBox && !o.userData?.isSnapPoint) {
        o.geometry.computeBoundingBox();
        b.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld.clone().premultiply(inv)));
      }
      o.children.forEach(visit);
    };
    visit(obj);
    return b.isEmpty() ? null : b.getCenter(new V());
  };
  const mirror = (p) => new V(-p.x, p.y, p.z);

  let refName = ref;
  if (!drawn(refName) || !expected(refName)) {
    refName = [...byPart.keys()].find(n => !(parts || []).includes(n) && drawn(n) && expected(n));
  }
  if (!refName) return { error: 'no reference part' };
  const refDrawn = drawn(refName);
  const refExpected = expected(refName);
  const rows = [];
  for (const name of (parts || [...byPart.keys()])) {
    const a = drawn(name);
    const x = expected(name);
    rows.push({
      name,
      off: a && x ? +a.clone().sub(refDrawn).distanceTo(mirror(x.clone().sub(refExpected))).toFixed(1) : null,
      abs: a && x ? +a.distanceTo(mirror(x)).toFixed(1) : null
    });
  }
  return { key: e.baseName, ref: refName, rows };
}
