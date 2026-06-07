/* ============================================================
   AI.JS — All AI logic.
   Reads: state, diff, CONFIG
   Writes: state.ai.y, state.ai.targetY, driftOffset, driftTimer
   No rendering. No scoring. No input handling.
   ============================================================ */


// ================================================================
//  INTERNAL AI STATE — persists across frames
// ================================================================

// Smoothed paddle target — tracking + OVERCLOCK
let aiSmoothedTarget = null;
let aiRecomputeTimer = 0;
// Committed ball-Y prediction held between OVERCLOCK recomputes
let aiTrajectoryCommitY = null;

// ================================================================
//  MAIN AI UPDATE — called once per frame by gameplay.js
// ================================================================

function aiUpdate() {
  const ball = state.ball;
  const ai   = state.ai;
  const H    = CONFIG.TARGET_HEIGHT;
  const cfg  = diff;

  switch (cfg.strategy) {

    // ----------------------------------------------------------
    // INIT — always chases the ball, never drifts to center.
    //   Speed is low enough it falls behind once the ball gets
    //   moving. No misses, no tricks. Just slow.
    // ----------------------------------------------------------
    case 'simple': {
      const rawTarget = ball.y - ai.h / 2;
      const gap = rawTarget - ai.y;
      if (Math.abs(gap) < 1.5) break;
      let dy = gap * cfg.reactionSpeed;
      dy = Math.sign(dy) * Math.min(Math.abs(dy), cfg.maxPaddleSpeed);
      ai.y += dy;
      break;
    }

    // ----------------------------------------------------------
    // STABLE + PRIME — tracks ball when incoming, drifts to
    //   center when ball moves away. Creates real shot openings.
    //   Differentiated purely by reactionSpeed and maxPaddleSpeed.
    // ----------------------------------------------------------
    case 'tracking': {
      const rawTarget = ball.vx > 0
        ? ball.y - ai.h / 2
        : H / 2 - ai.h / 2;

      if (aiSmoothedTarget === null) aiSmoothedTarget = rawTarget;
      aiSmoothedTarget += (rawTarget - aiSmoothedTarget) * 0.12;

      const gap = aiSmoothedTarget - ai.y;
      if (Math.abs(gap) < 1.5) break;

      let dy = gap * cfg.reactionSpeed;
      dy = Math.sign(dy) * Math.min(Math.abs(dy), cfg.maxPaddleSpeed);
      ai.y += dy;
      break;
    }

    // ----------------------------------------------------------
    // OVERCLOCK — full trajectory prediction, near-perfect.
    //   Commits a new intercept every N frames; smooths toward
    //   each commit so the paddle doesn't snap on recompute.
    // ----------------------------------------------------------
    case 'trajectory': {
      aiRecomputeTimer++;

      if (ball.vx > 0) {
        if (aiRecomputeTimer >= cfg.recomputeEvery) {
          aiRecomputeTimer = 0;
          const predicted = predictBallY(8);
          const error     = (Math.random() * 2 - 1) * cfg.predictionError;
          aiTrajectoryCommitY = predicted + error;
        }
      } else {
        aiTrajectoryCommitY = H / 2;
        aiRecomputeTimer = 0;
      }

      if (aiTrajectoryCommitY === null) {
        aiTrajectoryCommitY = H / 2;
      }

      const rawTarget = aiTrajectoryCommitY - ai.h / 2;
      if (aiSmoothedTarget === null) aiSmoothedTarget = rawTarget;
      aiSmoothedTarget += (rawTarget - aiSmoothedTarget) * 0.14;
      ai.targetY = aiSmoothedTarget;

      const gap = aiSmoothedTarget - ai.y;
      if (Math.abs(gap) < 0.5) break;

      let dy = gap * cfg.reactionSpeed;
      dy = Math.sign(dy) * Math.min(Math.abs(dy), cfg.maxPaddleSpeed);
      ai.y += dy;
      break;
    }
  }

  const aiMargin = CONFIG.BALL_SIZE * 1.5;
  ai.y = Math.max(aiMargin, Math.min(H - ai.h - aiMargin, ai.y));
}

// ================================================================
//  BALL PREDICTION — used by OVERCLOCK only
// ================================================================

function predictBallY(maxBounces) {
  const H       = CONFIG.TARGET_HEIGHT;
  const ball    = state.ball;
  const targetX = state.ai.x;
  let bx = ball.x, by = ball.y, vx = ball.vx, vy = ball.vy, bounces = 0;

  while (bx < targetX && bounces < maxBounces) {
    const tToTarget = (targetX - bx) / vx;
    const tToWall   = vy !== 0 ? (vy > 0 ? (H - by) / vy : -by / vy) : Infinity;
    if (tToWall < tToTarget) {
      bx += vx * tToWall;
      by  = vy > 0 ? H : 0;
      vy  = -vy;
      bounces++;
    } else {
      by += vy * tToTarget;
      break;
    }
  }
  return Math.max(0, Math.min(H, by));
}