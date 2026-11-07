/**
 * Detects whether the X4: Foundations game assets are available and, if not, tells the user why
 * stations show no real models.
 *
 * The visualizer draws modules with models and textures from X4: Foundations, which belong to
 * Egosoft and are not distributed with this project (assets1/ and dist/ are git-ignored). They
 * have to come from the user's own copy of the game.
 */

/** A small file every complete extraction contains (Argon cross connector, part_main). */
export const GAME_ASSET_PROBE_URL = '/assets1/structures/connectionmodules/struct_arg_cross_01_data/part_main-lod0.json';

const NOTICE_ID = 'missing-assets-modal';

/**
 * Checks for the game assets by fetching the probe file. Only real game data counts: dev and
 * preview servers answer unknown paths with the app's index.html (status 200), so the response
 * must parse as the expected JSON.
 * @param {{ fetchImpl?: typeof fetch, url?: string }} [options]
 * @returns {Promise<{ available: boolean, reason: string }>}
 */
export async function checkGameAssets({ fetchImpl = globalThis.fetch, url = GAME_ASSET_PROBE_URL } = {}) {
  if (typeof fetchImpl !== 'function') return { available: false, reason: 'fetch is not available' };
  let response;
  try {
    response = await fetchImpl(url, { cache: 'no-store' });
  } catch (err) {
    return { available: false, reason: `request failed: ${err?.message || err}` };
  }
  if (!response.ok) return { available: false, reason: `HTTP ${response.status} for ${url}` };
  let data;
  try {
    data = JSON.parse(await response.text());
  } catch (_) {
    return { available: false, reason: `${url} is not game data (the server returned a page instead)` };
  }
  if (!data || typeof data.vertexCount !== 'number') {
    return { available: false, reason: `${url} does not look like a converted game model` };
  }
  return { available: true, reason: 'ok' };
}

/**
 * Shows a pop-up explaining that the game assets are missing. Uses the app's modal styles and
 * does nothing if the pop-up is already open.
 * @param {Document} [doc]
 * @param {string} [reason] technical detail shown in small print
 * @returns {HTMLElement|null} the pop-up element
 */
export function showMissingAssetsNotice(doc = globalThis.document, reason = '') {
  if (!doc?.body) return null;
  const existing = doc.getElementById(NOTICE_ID);
  if (existing) return existing;

  const backdrop = doc.createElement('div');
  backdrop.id = NOTICE_ID;
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', `${NOTICE_ID}-title`);

  const card = doc.createElement('div');
  card.className = 'modal-card';

  const header = doc.createElement('div');
  header.className = 'modal-header';
  const title = doc.createElement('h3');
  title.id = `${NOTICE_ID}-title`;
  title.textContent = 'X4 game assets not found';
  const closeX = doc.createElement('button');
  closeX.className = 'close-modal-btn';
  closeX.setAttribute('aria-label', 'Close');
  closeX.textContent = '✕';
  header.append(title, closeX);

  const body = doc.createElement('div');
  body.className = 'modal-body';
  const paragraphs = [
    'This visualizer draws stations with the 3D models and textures of X4: Foundations. ' +
      'They belong to Egosoft and are not included with this app.',
    'To see real models, use your own purchased copy of X4: Foundations: extract the game\'s ' +
      'asset files into an assets1 folder at the root of this app, then reload the page.',
    'Until then, construction plans still load and stations are drawn with simple placeholder shapes.'
  ];
  for (const text of paragraphs) {
    const p = doc.createElement('p');
    p.className = 'modal-desc';
    p.textContent = text;
    body.append(p);
  }
  if (reason) {
    const detail = doc.createElement('p');
    detail.className = 'modal-desc missing-assets-detail';
    detail.textContent = `Details: ${reason}`;
    body.append(detail);
  }

  const footer = doc.createElement('div');
  footer.className = 'modal-footer';
  const ok = doc.createElement('button');
  ok.className = 'btn btn-primary';
  ok.textContent = 'Continue without models';
  footer.append(ok);

  card.append(header, body, footer);
  backdrop.append(card);
  doc.body.append(backdrop);

  const close = () => backdrop.remove();
  closeX.addEventListener('click', close);
  ok.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  // Fade in with the existing .modal-backdrop.active transition
  const win = doc.defaultView;
  const activate = () => backdrop.classList.add('active');
  if (win?.requestAnimationFrame) win.requestAnimationFrame(activate); else activate();
  ok.focus?.();
  return backdrop;
}

/**
 * Runs the check and shows the pop-up when the assets are missing.
 * @param {{ fetchImpl?: typeof fetch, url?: string, doc?: Document }} [options]
 */
export async function warnIfGameAssetsMissing({ doc = globalThis.document, ...checkOptions } = {}) {
  const result = await checkGameAssets(checkOptions);
  if (!result.available) {
    console.warn(`[!] X4 game assets not found: ${result.reason}`);
    showMissingAssetsNotice(doc, result.reason);
  }
  return result;
}
