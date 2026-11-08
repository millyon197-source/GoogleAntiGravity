/**
 * X4 texture (UV) animations, read from a module's component XML.
 *
 * A component file (e.g. assets1/structures/connectionmodules/struct_arg_cross_01.xml, beside the
 * struct_arg_cross_01_data folder holding its parts) gives each animated part a loop length in frames
 * and <uv_animations>: per map channel (1 = the first UV set), keyframed u_offset / v_offset tracks.
 * The cross modules' anim_arrows, for example, hold u_offset at 0, slide to 0.25 (one cell of the
 * sign atlas) over 5 frames, hold, and slide back: its icons toggle between a pair of atlas cells.
 */

/** X4 plays component animations at 30 frames per second. */
export const X4_ANIMATION_FPS = 30;

const componentCache = new Map();

/** Component XML URL for a part's .dae: <folder>_data/<part>-lod0.dae -> <folder>.xml */
export function componentUrlForPart(daeUrl) {
  const u = String(daeUrl || '');
  const folder = u.slice(0, u.lastIndexOf('/'));
  if (!folder.endsWith('_data')) return null;
  return folder.slice(0, -'_data'.length) + '.xml';
}

async function readText(url) {
  if (typeof process !== 'undefined' && process.versions?.node && !/^https?:/i.test(url)) {
    const fsName = 'fs'; // variable specifier keeps the bundler out
    const fs = await import(/* @vite-ignore */ fsName);
    const path = url.replace(/^\/+/, '');
    return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : null;
  }
  const res = await fetch(url);
  if (!res.ok) return null;
  const text = await res.text();
  return text.trimStart().startsWith('<') && !/^<!doctype html/i.test(text.trimStart()) ? text : null;
}

/**
 * Parses every part's UV animations in a component XML.
 * @param {string} xml
 * @returns {Map<string, { loopFrames: number, channels: Record<number, { u?: number[][], v?: number[][] }> }>}
 */
export function parseComponentUvAnimations(xml) {
  const parts = new Map();
  // Each <connection> holds an <animations> loop length and the <parts> it animates
  for (const conn of xml.matchAll(/<connection\b[\s\S]*?<\/connection>/g)) {
    const block = conn[0];
    const loopEnd = Number((block.match(/<animation\s+name="loop"[^>]*\bend="(\d+)"/) || [])[1]) || 0;
    for (const part of block.matchAll(/<part\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/part>/g)) {
      const channels = {};
      for (const anim of part[2].matchAll(/<uv_animation\s+mapchannel="(\d+)"\s*>([\s\S]*?)<\/uv_animation>/g)) {
        const tracks = {};
        for (const prop of anim[2].matchAll(/<uv_property\s+name="([uv])_offset"[^>]*>([\s\S]*?)<\/uv_property>/g)) {
          const keys = [...prop[2].matchAll(/<key\s+frame="(-?[\d.]+)"\s+value="(-?[\d.]+)"/g)].map(k => [Number(k[1]), Number(k[2])]);
          if (keys.length > 0) tracks[prop[1]] = keys.sort((a, b) => a[0] - b[0]);
        }
        if (Object.keys(tracks).length > 0) channels[Number(anim[1])] = tracks;
      }
      if (Object.keys(channels).length > 0) parts.set(part[1], { loopFrames: loopEnd, channels });
    }
  }
  return parts;
}

/**
 * The UV animations of one part, or null when its component defines none (or cannot be read).
 * @param {string} daeUrl URL of the part's .dae
 * @param {string} partName e.g. 'anim_arrows'
 */
export async function loadPartUvAnimations(daeUrl, partName) {
  const url = componentUrlForPart(daeUrl);
  if (!url) return null;
  if (!componentCache.has(url)) {
    componentCache.set(url, readText(url).then(t => (t ? parseComponentUvAnimations(t) : new Map())).catch(() => new Map()));
  }
  const parts = await componentCache.get(url);
  return parts.get(partName) || null;
}

/**
 * Value of a keyframed track at `frame` (linear between keys, held before the first and after the last).
 * @param {number[][]} keys [[frame, value], ...] sorted by frame
 * @param {number} frame
 */
export function sampleTrack(keys, frame) {
  if (!keys || keys.length === 0) return 0;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    if (frame <= f1) {
      const [f0, v0] = keys[i - 1];
      return f1 === f0 ? v1 : v0 + ((v1 - v0) * (frame - f0)) / (f1 - f0);
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Applies a keyframed UV animation to a texture's offset at `time` seconds (looping).
 * @param {{ offset: { x: number, y: number } }} texture
 * @param {{ u?: number[][], v?: number[][] }} tracks
 * @param {number} loopFrames
 * @param {number} time
 */
export function applyUvTrack(texture, tracks, loopFrames, time) {
  const loop = loopFrames > 0 ? loopFrames : Math.max(...[tracks.u, tracks.v].filter(Boolean).map(k => k[k.length - 1][0]), 1);
  const frame = (time * X4_ANIMATION_FPS) % loop;
  if (tracks.u) texture.offset.x = sampleTrack(tracks.u, frame);
  if (tracks.v) texture.offset.y = sampleTrack(tracks.v, frame);
}
