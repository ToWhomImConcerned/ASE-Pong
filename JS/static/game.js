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
  requestAnimationFrame(loop);
}

// ================================================================
//  DIFFICULTY ROUTING — reads ?diff= and ?score= URL params
// ================================================================

function readDifficulty() {
  const params = new URLSearchParams(window.location.search);
  const key    = (params.get('diff') || 'INIT').toUpperCase();
  diff         = DIFFICULTY[key] || DIFFICULTY.INIT;

  // Apply match length — default to 7 if param absent or invalid
  const scoreParam = parseInt(params.get('score'), 10);
  if ([3, 5, 7, 9].includes(scoreParam)) {
    CONFIG.MAX_SCORE = scoreParam;
  }

  hudDiffLabel.textContent      = diff.label;
  hudDiffLabel.className        = 'hud-diff-label';
  hudDiffLabel.style.color      = diffColor1();
  hudDiffLabel.style.textShadow = `0 0 18px ${diffColor1()}`;

  document.querySelector('.hud-label-system').style.color = diffColor1();
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
  readDifficulty();

  document.getElementById('hud-match-length').textContent = `// FIRST TO ${CONFIG.MAX_SCORE} \\\\`;

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