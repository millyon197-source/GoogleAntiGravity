// Freeze recorder: paste into the browser DevTools console on the visualizer tab, then reproduce.
// Every second it saves frames drawn, memory, viewer and WebGL state, and whether the GPU has finished
// the work sent a second earlier; it also saves long frames (with the script functions that ran) and
// clicks/keys. Everything goes to localStorage, so it survives a hung or reloaded tab.
// Afterwards (in the same tab, or after reloading it): copy(localStorage.getItem('x4FreezeLog'))
(() => {
  const KEY = 'x4FreezeLog';
  const t0 = Date.now();
  const log = { started: new Date().toISOString(), ua: navigator.userAgent, dpr: devicePixelRatio, beats: [], longFrames: [], events: [] };
  const save = () => { try { for (const k of ['beats', 'longFrames', 'events']) log[k] = log[k].slice(-300); localStorage.setItem(KEY, JSON.stringify(log)); } catch (e) { console.warn('[freeze-recorder] save failed', e); } };
  const sec = () => Math.round((Date.now() - t0) / 100) / 10;
  const v = window.viewer;
  const gl = v && v.renderer && v.renderer.getContext();
  try { const dbg = gl.getExtension('WEBGL_debug_renderer_info'); log.gpu = gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER); } catch { /* no GPU name */ }

  let frames = 0;
  const onFrame = () => { frames++; requestAnimationFrame(onFrame); };
  requestAnimationFrame(onFrame);

  let fence = null, fenceAge = 0;
  setInterval(() => {
    let gpu = 'n/a';
    try {
      if (fence) {
        const done = gl.getSyncParameter(fence, gl.SYNC_STATUS) === gl.SIGNALED;
        if (done) { gl.deleteSync(fence); fence = null; gpu = 'idle'; } else { fenceAge++; gpu = `busy ${fenceAge}s`; }
      }
      if (!fence) { fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); fenceAge = 0; }
    } catch (e) { gpu = 'error ' + e.message; }
    const r = v && v.renderer;
    log.beats.push({
      s: sec(), frames, visible: document.visibilityState, gpu,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
      modules: v && v.modulesGroup ? v.modulesGroup.children.length : null,
      loading: v && v.planLoading, held: v && v.renderHeld,
      canvas: r ? [r.domElement.width, r.domElement.height] : null,
      programs: r ? r.info.programs.length : null, calls: r ? r.info.render.calls : null,
      glError: gl ? gl.getError() : null, contextLost: gl ? gl.isContextLost() : null
    });
    frames = 0;
    save();
  }, 1000);

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration < 150) continue;
        log.longFrames.push({
          s: sec(), ms: Math.round(e.duration), blockingMs: Math.round(e.blockingDuration || 0),
          scripts: [...(e.scripts || [])].sort((a, b) => b.duration - a.duration).slice(0, 5).map(x => ({
            ms: Math.round(x.duration), fn: x.sourceFunctionName, file: (x.sourceURL || '').split('/').pop().split('?')[0], invoker: x.invoker
          }))
        });
      }
      save();
    }).observe({ type: 'long-animation-frame', buffered: false });
  } catch (e) { log.noLongFrames = e.message; }

  for (const type of ['pointerdown', 'keydown', 'wheel', 'change']) {
    window.addEventListener(type, (ev) => { log.events.push({ s: sec(), type, target: String(ev.target && (ev.target.id || ev.target.className || ev.target.tagName) || '').slice(0, 40) }); save(); }, { capture: true, passive: true });
  }
  window.addEventListener('webglcontextlost', () => { log.events.push({ s: sec(), type: 'webglcontextlost' }); save(); }, true);
  window.addEventListener('error', (ev) => { log.events.push({ s: sec(), type: 'error', message: String(ev.message).slice(0, 200) }); save(); });
  window.addEventListener('unhandledrejection', (ev) => { log.events.push({ s: sec(), type: 'rejection', message: String(ev.reason && ev.reason.message || ev.reason).slice(0, 200) }); save(); });

  save();
  console.log('[freeze-recorder] recording; afterwards run: copy(localStorage.getItem("x4FreezeLog"))');
})();
