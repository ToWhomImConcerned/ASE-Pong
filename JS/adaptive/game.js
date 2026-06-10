/* ============================================================
   GAME.JS — Boot file only.
   Grabs DOM refs, reads difficulty from URL, runs init + loop.
   All logic lives in the other five files.

   Load order in HTML:
     state.js      → shared data
     ai.js         → aiUpdate, predictBallY
     input.js      → keyboard listeners
     gameplay.js   → update, physics, scoring
     render.js     → draw functions
     game.js       → boot (this file, last)
   ============================================================ */


// ================================================================
//  DOM REFS
// ================================================================

const canvas         = document.getElementById('game-canvas');
const ctx            = canvas.getContext('2d');
const pageContent    = document.querySelector('.page-content');
const hudScorePlayer = document.getElementById('score-player');
const hudScoreAi     = document.getElementById('score-ai');
const hudDiffLabel   = document.getElementById('diff-label');

// ================================================================
//  GAME LOOP
// ================================================================

function loop() {
  update();
  render();
  updateAiStatusHUD();
  requestAnimationFrame(loop);
}

// ================================================================
//  RUNTIME ROUTING — reads ?score= URL param
// ================================================================

function readRuntime() {
  const params = new URLSearchParams(window.location.search);

  // Apply match length — default to 11 if param absent or invalid
  const scoreParam = parseInt(params.get('score'), 10);
  if ([3, 5, 7, 9].includes(scoreParam)) {
    CONFIG.MAX_SCORE = scoreParam;
  }
}

// ================================================================
//  MODE ROUTING
// ================================================================

function applyAdaptiveProfile() {
  hudDiffLabel.className = 'hud-diff-label';
  initThreatLabel();
  updateAiStatusHUD();
}

// ================================================================
//  EXIT ANIMATION
// ================================================================

const exitButton = document.querySelector('.game-exit-button');

exitButton.addEventListener('click', e => {
  e.preventDefault();
  const href = exitButton.getAttribute('href');
  pageContent.style.opacity = '';
  pageContent.classList.add('page-exiting');
  pageContent.addEventListener('animationend', () => {
    window.location.href = href;
  }, { once: true });
});

// ================================================================
//  INIT — runs once on load
// ================================================================

function init() {
  readRuntime();
  applyAdaptiveProfile();

  document.getElementById('hud-match-length').textContent = '// FIRST TO ' + CONFIG.MAX_SCORE + ' \\\\';

  canvas.width  = CONFIG.TARGET_WIDTH;
  canvas.height = CONFIG.TARGET_HEIGHT;

  resetPositions();
  updateHUD();

  // Page enter animation
  requestAnimationFrame(() => {
    pageContent.classList.add('page-entering');
    pageContent.addEventListener('animationend', () => {
      pageContent.classList.remove('page-entering');
      pageContent.style.opacity = '1';
    }, { once: true });
  });

  phase = 'READY';
  requestAnimationFrame(loop);
}

init();
