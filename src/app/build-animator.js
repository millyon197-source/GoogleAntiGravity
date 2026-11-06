/**
 * Build Sequence Animator: plays the station build order by stepping viewer.setBuildProgress,
 * plus its play/step/reset/speed/slider/minimize controls. Extracted from main.js.
 */
import { excludedMacros } from './ui-preferences.js';

/**
 * Controller state supplied by main.js via initBuildAnimator().
 * - getViewer(): main.js `viewer`
 * - getCurrentPlan(): main.js `currentPlan`
 */
let deps = null;

/** Connects this module to the app controller (called once by main.js). */
export function initBuildAnimator(controller) {
  deps = controller;
}

// Build Sequence Animator state
let animInterval = null;
let isAnimating = false;
let animProgress = 100; // Percentage 0 - 100
let animSpeed = 1000;  // ms per step

/**
 * Animator timeline functions
 */
export function resetAnimator() {
  stopAnimation();
  animProgress = 100;
  updateAnimatorUI();
  deps.getViewer().setBuildProgress(animProgress);
}

function updateAnimatorUI() {
  const slider = document.getElementById('anim-progress-slider');
  const badge = document.getElementById('anim-progress-badge');
  const countSpan = document.getElementById('anim-visible-count');
  
  if (slider) slider.value = animProgress;
  if (badge) badge.textContent = `${animProgress}%`;
  
  if (deps.getCurrentPlan() && countSpan) {
    const visibleModules = deps.getCurrentPlan().modules.filter(mod => !excludedMacros.has(mod.macro));
    const total = visibleModules.length;
    const current = Math.ceil((animProgress / 100) * total);
    countSpan.textContent = `${current} / ${total}`;
  }
}

function toggleAnimation() {
  if (isAnimating) {
    stopAnimation();
  } else {
    startAnimation();
  }
}

function startAnimation() {
  if (!deps.getCurrentPlan() || deps.getCurrentPlan().modules.length === 0) return;
  
  isAnimating = true;
  const playBtn = document.getElementById('btn-anim-play');
  if (playBtn) playBtn.innerHTML = '<span class="pause-icon">⏸</span> Pause';

  // If progress is at 100%, reset to 0 to start over
  if (animProgress >= 100) {
    animProgress = 0;
    updateAnimatorUI();
    deps.getViewer().setBuildProgress(animProgress);
  }

  const stepSize = Math.max(1, Math.floor(100 / deps.getCurrentPlan().modules.length));

  animInterval = setInterval(() => {
    animProgress += stepSize;
    if (animProgress >= 100) {
      animProgress = 100;
      stopAnimation();
    }
    updateAnimatorUI();
    deps.getViewer().setBuildProgress(animProgress);
  }, animSpeed);
}

export function stopAnimation() {
  isAnimating = false;
  const playBtn = document.getElementById('btn-anim-play');
  if (playBtn) playBtn.innerHTML = '<span class="play-icon">▶</span> Play Sequence';
  
  if (animInterval) {
    clearInterval(animInterval);
    animInterval = null;
  }
}

function stepAnimation(direction) {
  stopAnimation();
  if (!deps.getCurrentPlan()) return;
  
  const step = Math.max(1, Math.floor(100 / deps.getCurrentPlan().modules.length));
  
  if (direction === 'forward') {
    animProgress = Math.min(100, animProgress + step);
  } else {
    animProgress = Math.max(0, animProgress - step);
  }

  updateAnimatorUI();
  deps.getViewer().setBuildProgress(animProgress);
}

/** Wires the animator controls (part of main.js setupEventListeners). */
export function setupBuildAnimatorControls() {
  const playBtn = document.getElementById('btn-anim-play');
  if (playBtn) playBtn.addEventListener('click', toggleAnimation);

  const prevBtn = document.getElementById('btn-anim-prev');
  if (prevBtn) prevBtn.addEventListener('click', () => stepAnimation('backward'));

  const nextBtn = document.getElementById('btn-anim-next');
  if (nextBtn) nextBtn.addEventListener('click', () => stepAnimation('forward'));

  const resetBtn = document.getElementById('btn-anim-reset');
  if (resetBtn) resetBtn.addEventListener('click', resetAnimator);

  const speedSelect = document.getElementById('anim-speed-select');
  if (speedSelect) {
    speedSelect.addEventListener('change', (e) => {
      animSpeed = parseInt(e.target.value, 10);
      if (isAnimating) {
        // Restart interval with new speed
        stopAnimation();
        startAnimation();
      }
    });
  }

  const slider = document.getElementById('anim-progress-slider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      stopAnimation();
      animProgress = parseInt(e.target.value, 10);
      updateAnimatorUI();
      deps.getViewer().setBuildProgress(animProgress);
    });
  }

  // Minimize / Maximize toggle for Build Sequence Animator
  const animatorHub = document.getElementById('animator-hub');
  const animToggleBtn = document.getElementById('btn-anim-toggle');
  if (animatorHub && animToggleBtn) {
    const toggleMinimize = (e) => {
      e.stopPropagation();
      const isMinimized = animatorHub.classList.toggle('minimized');
      animToggleBtn.textContent = isMinimized ? '➕' : '➖';
      animToggleBtn.title = isMinimized ? 'Maximize Simulation' : 'Minimize Simulation';
    };
    animToggleBtn.addEventListener('click', toggleMinimize);

    const animHeader = animatorHub.querySelector('.animator-header');
    if (animHeader) {
      animHeader.addEventListener('click', () => {
        if (animatorHub.classList.contains('minimized')) {
          animatorHub.classList.remove('minimized');
          animToggleBtn.textContent = '➖';
          animToggleBtn.title = 'Minimize Simulation';
        }
      });
    }
  }
}

/** Stops playback and shows the empty-plan state (100%, 0 / 0); used when all panels are cleared. */
export function clearBuildAnimator() {
  stopAnimation();
  animProgress = 100;
  
  const slider = document.getElementById('anim-progress-slider');
  const badge = document.getElementById('anim-progress-badge');
  const countSpan = document.getElementById('anim-visible-count');
  
  if (slider) slider.value = 100;
  if (badge) badge.textContent = '100%';
  if (countSpan) countSpan.textContent = '0 / 0';
}
