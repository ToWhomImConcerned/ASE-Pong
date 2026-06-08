/* ============================================================
   INPUT.JS — Event listeners only.
   Writes to keys[] and state.pointerLocked in state.js.
   Pointer lock engaged on canvas click, released on round end.
   Keyboard paddle controls disabled while pointer lock active.
   ============================================================ */

const MOUSE_SENSITIVITY = 0.6;


// ================================================================
//  KEYBOARD
// ================================================================

document.addEventListener('keydown', e => {

  // Paddle keys — only active when pointer lock is NOT engaged
  if (!state.pointerLocked && e.key in keys) {
    keys[e.key] = true;
    e.preventDefault();
  }

  if (e.key === ' ') {
    e.preventDefault();
    if (phase === 'READY')     beginCountdown();
    if (phase === 'GAME_OVER') restartGame();
  }

  // Escape is always active — browser releases pointer lock automatically,
  // pointerlockchange handler below syncs state.pointerLocked
});

document.addEventListener('keyup', e => {
  if (e.key in keys) {
    keys[e.key] = false;
  }
});


// ================================================================
//  POINTER LOCK — engage / release
// ================================================================

const gameCanvas = document.getElementById('game-canvas');

function engagePointerLock() {
  gameCanvas.requestPointerLock();
}

function releasePointerLock() {
  if (document.pointerLockElement === gameCanvas) {
    document.exitPointerLock();
  }
}

// Sync state whenever lock changes for any reason (click, Escape, tab-out)
document.addEventListener('pointerlockchange', () => {
  state.pointerLocked = document.pointerLockElement === gameCanvas;
});


// ================================================================
//  CANVAS CLICK
// ================================================================

gameCanvas.addEventListener('click', () => {
  if (phase === 'READY') {
    engagePointerLock();
    beginCountdown();
  }
  if (phase === 'PLAYING') {
    engagePointerLock();
  }
  if (phase === 'GAME_OVER') {
    restartGame();
  }
});


// ================================================================
//  MOUSE MOVEMENT — only active while pointer lock engaged
// ================================================================

document.addEventListener('mousemove', e => {
  if (!state.pointerLocked || phase !== 'PLAYING') return;

  state.playerMouseTarget += e.movementY * MOUSE_SENSITIVITY;

  // Clamp to full canvas height — paddle clamp is applied separately in gameplay.js
  state.playerMouseTarget = Math.max(0, Math.min(CONFIG.TARGET_HEIGHT, state.playerMouseTarget));
});