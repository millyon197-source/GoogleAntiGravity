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

/**
 * Browser diagnostic: for each part the XML hangs off another drawn part (a connection's
 * parent="..."), how far the drawn child's origin is from its attachment point on the drawn
 * parent (the child connection's position in the parent's frame, X mirrored). Run it at rest and
 * after stepping animations (viewer.updateAnimatedParts(t)): a chain that comes apart shows here.
 *
 * @param {object} viewer the StationViewer
 * @param {object} mod a loaded module group
 * @returns {Promise<{ key: string, rows: Array<{ child: string, parent: string, gap: number }> }|{ error: string }>}
 */
export async function checkChainLinks(viewer, mod) {
  const e = viewer.resolveModuleAssetEntry(mod.userData.macro);
  if (!e) return { error: `no asset entry for ${mod.userData.macro}` };
  const xml = await (await fetch(e.folderPath.replace(/_data$/, '') + '.xml')).text();
  const attr = (s, n) => s.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1];
  const byConn = new Map();
  const links = [];
  for (const mm of xml.matchAll(/<connection\b([^>]*?)(\/>|>([\s\S]*?)<\/connection>)/g)) {
    const head = mm[1];
    const body = mm[3] || '';
    const parts = [...body.matchAll(/<part\b[^>]*\bname="([^"]+)"/g)].map(x => x[1].toLowerCase());
    byConn.set(attr(head, 'name'), parts);
    const parent = attr(head, 'parent');
    const p = (body.split(/<parts\b|<animations\b/)[0].match(/<offset>([\s\S]*?)<\/offset>/)?.[1] || '').match(/<position\b[^>]*>/)?.[0];
    if (parent && parts[0]) links.push({ child: parts[0], parent, pos: p ? ['x', 'y', 'z'].map(k => +attr(p, k) || 0) : [0, 0, 0] });
  }
  const drawn = new Map();
  mod.traverse(o => { const n = o.userData?.partName?.toLowerCase(); if (n && !drawn.has(n)) drawn.set(n, o); });
  const V = viewer.camera.position.constructor;
  mod.updateMatrixWorld(true);
  const rows = [];
  for (const l of links) {
    const parentName = drawn.has(l.parent.toLowerCase()) ? l.parent.toLowerCase() : byConn.get(l.parent)?.find(p => drawn.has(p));
    const c = drawn.get(l.child);
    const p = parentName && drawn.get(parentName);
    if (!c || !p || parentName === 'part_main') continue;
    const want = new V(-l.pos[0], l.pos[1], l.pos[2]).applyMatrix4(p.matrixWorld);
    rows.push({ child: l.child, parent: parentName, gap: +c.getWorldPosition(new V()).distanceTo(want).toFixed(2) });
  }
  return { key: e.baseName, rows };
}

/**
 * Loads the given module macros side by side (20 km apart) and reports, per module, how many
 * parts are off their XML placement and how many chain links are open, at rest or after stepping
 * the animations to each of `times` (seconds).
 * @param {object} viewer the StationViewer
 * @param {string[]} macros module macros
 * @param {{ animate?: boolean, times?: number[], wait?: number }} [options]
 * @returns {Promise<Record<string, string[]>>} one line per time, per module
 */
export async function measureModules(viewer, macros, { animate = false, times = [7, 23, 41], wait = 18000 } = {}) {
  viewer.allowAllAnimations = animate;
  const entries = macros.map((mc, i) => `<entry index="${i + 1}" macro="${mc}"><offset><position x="${i * 20000}" y="0" z="0"/></offset></entry>`).join('');
  window.loadPlanFromXml(`<?xml version="1.0" encoding="UTF-8"?><plans><plan id="player_${Date.now()}" name="Measure" description="">${entries}</plan></plans>`);
  await new Promise(r => setTimeout(r, wait));
  const res = {};
  for (const m of viewer.modulesGroup.children) {
    const key = viewer.resolveModuleAssetEntry(m.userData.macro)?.baseName || m.userData.macro;
    const lines = [];
    for (const t of animate ? times : [null]) {
      if (t !== null) viewer.updateAnimatedParts(t, 0.016);
      const p = await checkModuleParts(viewer, m);
      const c = await checkChainLinks(viewer, m);
      const off = (p.rows || []).filter(x => x.off > 2);
      const gaps = (c.rows || []).filter(x => x.gap > 1);
      const offText = p.error || `${p.rows.length} parts, ${off.length} >2 m${off.length ? ` (${off.slice(0, 4).map(x => `${x.name}=${x.off}`).join(', ')})` : ''}`;
      const gapText = `links ${(c.rows || []).length}, ${gaps.length} open >1 m${gaps.length ? ` (max ${Math.max(...gaps.map(x => x.gap))}: ${gaps.slice(0, 3).map(x => `${x.child}=${x.gap}`).join(', ')})` : ''}`;
      lines.push(`${t === null ? 'rest' : `t=${t}`}: ${offText}; ${gapText}`);
    }
    res[key] = lines;
  }
  viewer.allowAllAnimations = false;
  return res;
}
