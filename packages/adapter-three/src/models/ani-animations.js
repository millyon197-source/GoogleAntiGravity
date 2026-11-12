import * as THREE from 'three';

/**
 * X4 part animations, read from a module's .ANI file (e.g. structures/dock/DOCKAREA_ARG_M_STATION_02_HIGHTECH_DATA.ANI,
 * next to the module's `_data` folder).
 *
 * Layout (little endian):
 *   header (16 bytes)       int32 animCount, int32 keyOffset (= 16 + animCount * 160), int32 version, int32 pad
 *   descriptor (160 bytes)  char[64] part name, char[64] clip name ("loop", "mode_active", "dockingbay_opening", ...),
 *                           int32 position/rotation/scale/prescale/postscale key counts, float duration (s), 8 bytes pad
 *   key (128 bytes)         float value x/y/z, int32 interpolation x/y/z (1 step, 2 linear, 5 bezier), float time (s),
 *                           per axis float[4] bezier handles: out time, out value, in time, in value; rest unused here
 * Keys follow the descriptors in descriptor order, each clip's channels in the order above.
 *
 * Values are relative to the part's connection: position offsets, Euler XYZ rotations in radians, scale factors.
 * X4 is left handed; like the component offsets, X is mirrored for three (position -x, rotation -y/-z).
 */

const HEADER_BYTES = 16;
const DESCRIPTOR_BYTES = 160;
const KEY_BYTES = 128;
const CHANNELS = ['position', 'rotation', 'scale', 'preScale', 'postScale'];

export const INTERP_STEP = 1;
export const INTERP_LINEAR = 2;
export const INTERP_BEZIER = 5;

function readName(view, offset) {
  let s = '';
  for (let i = 0; i < 64; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/**
 * Parses an .ANI file.
 * @param {ArrayBuffer|ArrayBufferView} data
 * @returns {Array<{part: string, name: string, duration: number, position: Array, rotation: Array, scale: Array}>|null}
 *   Clips in file order, or null when the bytes are not an ANI file (e.g. an HTML fallback page).
 */
export function parseAni(data) {
  const buffer = ArrayBuffer.isView(data) ? data.buffer : data;
  const base = ArrayBuffer.isView(data) ? data.byteOffset : 0;
  const length = ArrayBuffer.isView(data) ? data.byteLength : data.byteLength;
  if (!buffer || length < HEADER_BYTES) return null;
  const view = new DataView(buffer, base, length);
  const count = view.getInt32(0, true);
  const keyOffset = view.getInt32(4, true);
  if (count < 0 || count > 100000 || keyOffset !== HEADER_BYTES + count * DESCRIPTOR_BYTES || keyOffset > length) return null;

  const clips = [];
  let k = keyOffset;
  for (let i = 0; i < count; i++) {
    const o = HEADER_BYTES + i * DESCRIPTOR_BYTES;
    const clip = {
      part: readName(view, o).toLowerCase(),
      name: readName(view, o + 64).toLowerCase(),
      duration: view.getFloat32(o + 148, true)
    };
    for (let c = 0; c < CHANNELS.length; c++) {
      const n = view.getInt32(o + 128 + c * 4, true);
      if (n < 0 || k + n * KEY_BYTES > length) return null;
      const keys = [];
      for (let j = 0; j < n; j++, k += KEY_BYTES) {
        keys.push({
          time: view.getFloat32(k + 24, true),
          value: [0, 1, 2].map(a => view.getFloat32(k + a * 4, true)),
          interp: [0, 1, 2].map(a => view.getInt32(k + 12 + a * 4, true)),
          // [outTime, outValue, inTime, inValue] per axis
          handles: [0, 1, 2].map(a => [0, 1, 2, 3].map(h => view.getFloat32(k + 28 + a * 16 + h * 4, true)))
        });
      }
      clip[CHANNELS[c]] = keys;
    }
    clips.push(clip);
  }
  return clips;
}

/** Whether a clip moves anything (UV-only clips such as escalator loops have no keys). */
export function clipHasKeys(clip) {
  return !!clip && (clip.position.length > 0 || clip.rotation.length > 0 || clip.scale.length > 0);
}

function cubic(p0, p1, p2, p3, s) {
  const u = 1 - s;
  return u * u * u * p0 + 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s * p3;
}

/** One axis of a bezier segment: solves the time curve for t, then evaluates the value curve. */
function bezierAxis(k0, k1, axis, t) {
  const t0 = k0.time, t1 = k1.time;
  // Handle times clamped into the segment keep the time curve monotonic
  const h1 = Math.min(Math.max(k0.handles[axis][0], t0), t1);
  const h2 = Math.min(Math.max(k1.handles[axis][2], t0), t1);
  let lo = 0, hi = 1, s = (t - t0) / (t1 - t0);
  for (let i = 0; i < 24; i++) {
    const x = cubic(t0, h1, h2, t1, s);
    if (Math.abs(x - t) < 1e-5) break;
    if (x < t) lo = s; else hi = s;
    s = (lo + hi) / 2;
  }
  return cubic(k0.value[axis], k0.handles[axis][1], k1.handles[axis][3], k1.value[axis], s);
}

/**
 * Samples a channel's keys at time t (seconds into the clip).
 * @param {Array} keys
 * @param {number} t
 * @param {number[]} fallback Value when the channel has no keys
 * @returns {number[]}
 */
export function sampleChannel(keys, t, fallback) {
  if (!keys || keys.length === 0) return fallback;
  if (t <= keys[0].time || keys.length === 1) return keys[0].value.slice();
  const last = keys[keys.length - 1];
  if (t >= last.time) return last.value.slice();
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].time) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const span = k1.time - k0.time;
  if (span <= 1e-6) return k1.value.slice();
  const u = (t - k0.time) / span;
  return [0, 1, 2].map(a => {
    const mode = k0.interp[a];
    if (mode === INTERP_STEP) return k0.value[a];
    if (mode === INTERP_BEZIER) return bezierAxis(k0, k1, a, t);
    return k0.value[a] + (k1.value[a] - k0.value[a]) * u;
  });
}

/** Clip names that play continuously, best first. */
const LOOPING_CLIPS = ['loop', 'mode_active', 'active', 'detector_active', 'dockingbay_idle', 'playonce'];
/** Clip names that make a cycle when played in order (doors and hatches open, stay open, close, stay closed). */
const CYCLES = [
  [['dockingbay_opening'], ['dockingbay_open', 3], ['dockingbay_closing'], ['dockingbay_closed', 3]],
  [['activating'], ['active', 3], ['deactivating'], ['deactivated', 3]],
  [['flip'], ['flop']]
];

/**
 * Picks what to play for a part: a looping clip, or a cycle of state clips (open, close, ...).
 * @param {Array} clips All clips of one part
 * @returns {Array<{clip: Object, hold?: number}>|null} Segments played in order and repeated
 */
export function choosePartAnimation(clips) {
  if (!clips || clips.length === 0) return null;
  const byName = new Map(clips.map(c => [c.name, c]));
  for (const name of LOOPING_CLIPS) {
    const clip = byName.get(name);
    if (clipHasKeys(clip) && clip.duration > 0.1) return [{ clip }];
  }
  for (const cycle of CYCLES) {
    const segments = cycle.map(([name, hold]) => ({ clip: byName.get(name), hold }));
    if (segments.every(s => s.clip) && segments.some(s => clipHasKeys(s.clip) && s.clip.duration > 0.1)) return segments;
  }
  const any = clips.find(c => clipHasKeys(c) && c.duration > 0.1);
  return any ? [{ clip: any }] : null;
}

/**
 * Where a part is in its animation at a given time.
 * @param {Array<{clip: Object, hold?: number}>} segments
 * @param {number} time Seconds
 * @returns {{clip: Object, t: number}}
 */
export function sampleSegments(segments, time) {
  const lengths = segments.map(s => (s.hold !== undefined ? s.hold : Math.max(s.clip.duration, 1e-3)));
  const total = lengths.reduce((a, b) => a + b, 0);
  let t = ((time % total) + total) % total;
  for (let i = 0; i < segments.length; i++) {
    if (t < lengths[i] || i === segments.length - 1) {
      const clip = segments[i].clip;
      // A held state clip shows its own pose (its keys are at the start)
      return { clip, t: segments[i].hold !== undefined ? Math.min(t, clip.duration) : t };
    }
    t -= lengths[i];
  }
  return { clip: segments[0].clip, t: 0 };
}

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _vec = new THREE.Vector3();

/**
 * Builds the per-frame update for a part: the animation applied on top of the part's rest transform
 * (its connection offset), which is read on the first update so later re-parenting is taken into account.
 * @param {THREE.Object3D} object
 * @param {Array<{clip: Object, hold?: number}>} segments
 * @returns {(time: number) => void}
 */
export function createPartAnimator(object, segments) {
  let rest = null;
  return (time) => {
    if (!rest) {
      rest = { position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() };
    }
    const { clip, t } = sampleSegments(segments, time);
    const p = sampleChannel(clip.position, t, null);
    const r = sampleChannel(clip.rotation, t, null);
    const s = sampleChannel(clip.scale, t, null);

    object.quaternion.copy(rest.quaternion);
    if (r) {
      _quat.setFromEuler(_euler.set(r[0], -r[1], -r[2], 'XYZ'));
      object.quaternion.multiply(_quat);
    }
    object.position.copy(rest.position);
    if (p) {
      object.position.add(_vec.set(-p[0], p[1], p[2]).applyQuaternion(rest.quaternion));
    }
    object.scale.copy(rest.scale);
    if (s) object.scale.multiply(_vec.set(s[0], s[1], s[2]));
  };
}

/**
 * URLs the .ANI file of a module folder may have (game files are upper or lower case).
 * @param {string} folderPath e.g. /assets1/structures/dock/dockarea_arg_m_station_02_hightech_data
 * @returns {string[]}
 */
export function aniUrlsForFolder(folderPath) {
  const clean = String(folderPath || '').replace(/[\\/]+$/, '');
  const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  if (slash < 0) return [];
  const dir = clean.slice(0, slash);
  const folder = clean.slice(slash + 1);
  return [`${dir}/${folder.toUpperCase()}.ANI`, `${dir}/${folder.toLowerCase()}.ani`];
}

const aniCache = new Map();

/**
 * Loads a module folder's part animations, grouped by part name (lower case). Cached per folder.
 * @param {string} folderPath
 * @param {(url: string) => Promise<Response>} [fetchImpl]
 * @returns {Promise<Map<string, Array>>} Empty when the module has no .ANI file
 */
export function loadModuleAniClips(folderPath, fetchImpl = (typeof fetch === 'function' ? fetch : null)) {
  if (!folderPath || !fetchImpl) return Promise.resolve(new Map());
  if (aniCache.has(folderPath)) return aniCache.get(folderPath);
  const pending = (async () => {
    for (const url of aniUrlsForFolder(folderPath)) {
      try {
        const resp = await fetchImpl(url);
        if (!resp || !resp.ok) continue;
        const clips = parseAni(await resp.arrayBuffer());
        if (!clips) continue;
        const byPart = new Map();
        for (const clip of clips) {
          if (!byPart.has(clip.part)) byPart.set(clip.part, []);
          byPart.get(clip.part).push(clip);
        }
        return byPart;
      } catch (_) { /* try the next spelling */ }
    }
    return new Map();
  })();
  aniCache.set(folderPath, pending);
  return pending;
}
