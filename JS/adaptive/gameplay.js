/* ============================================================
   GAMEPLAY.JS — All rules that change the world.
   Reads: state, keys, CONFIG, phase
   Writes: state (positions, scores, speed), phase
   Calls: aiUpdate() from ai.js
   No rendering. No event listeners.
   ============================================================ */


// ================================================================
//  POSITIONS — reset ball and paddles to center
// ================================================================

function resetPositions() {
  const W = CONFIG.TARGET_WIDTH;
  const H = CONFIG.TARGET_HEIGHT;

  state.ball.x  = W / 2;
  state.ball.y  = H / 2;
  state.ball.vx = 0;
  state.ball.vy = 0;

  state.player.x = CONFIG.PADDLE_MARGIN;
  state.player.y = H / 2 - CONFIG.PADDLE_H / 2;

  state.ai.x       = W - CONFIG.PADDLE_MARGIN - CONFIG.PADDLE_W;
  state.ai.y       = H / 2 - CONFIG.PADDLE_H / 2;
  state.ai.targetY = state.ai.y;

  state.speed      = CONFIG.BALL_SPEED_INIT;
  state.rallyCount = 0;
  state.lastHit    = null;
  state.ballTrail  = [];
  state.playerVY          = 0;
  state.playerMouseTarget = state.player.y + CONFIG.PADDLE_H / 2;
  aiSmoothedTarget = null;
  state.player.visible = true;
  state.ai.visible     = true;
  state.paddleShards   = [];
}

function launchBall() {
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
  const dir   = Math.random() < 0.5 ? 1 : -1;
  state.ball.vx = Math.cos(angle) * state.speed * dir;
  state.ball.vy = Math.sin(angle) * state.speed;
  aiObserveLaunch();
}


// ================================================================
//  COLLISION PARTICLE SPAWNER
//
//  type       'wall' | 'paddle'
//  cx, cy     contact point (ball position at moment of impact)
//  inVx, inVy ball velocity *before* the bounce (incoming direction)
//  paddleCol  hex string — only used for type === 'paddle'
//
//  Design rules:
//  - Particles travel primarily along the incoming vector ±35° spread
//  - Spawn offset is slightly *behind* the ball along incoming direction
//    so fragments appear to shear away from the collision surface
//  - Wall hits: all ball-shape, all ball-color, 6–10 base count
//  - Paddle hits: 50% ball-shape/ball-color, 50% rect/paddle-color, 14–20 base
//  - Count and velocity scale with state.particleIntensity
//  - Hard cap: 80 total collision particles; oldest evicted when exceeded
//
//  Tuned for FRAGMENTATION visibility:
//  - Larger size range so individual shapes are clearly readable
//  - Longer lifetime so color/shape registers before fade
//  - Higher max alpha so particles punch through at a glance
//  - Wider spread for a more dramatic shatter feel
// ================================================================

// Tunable constants — adjust these to dial in feel
const CP_WALL_BASE_COUNT   = 12;    // base burst size for wall hits
const CP_PADDLE_BASE_COUNT = 36;   // base burst size for paddle hits
const CP_MAX_POOL          = 80;   // hard cap on simultaneous collision particles
const CP_LIFETIME_MIN      = 60;   // frames — shortest particle life
const CP_LIFETIME_MAX      = 90;   // frames — longest particle life
const CP_SPREAD_HALF       = 35;   // degrees — half-angle spread
const CP_SPEED_BASE        = 1.1;  // base speed multiplier relative to ball
const CP_SPEED_VARIANCE    = 1.55; // random ± on top of base
const CP_OFFSET_BACK       = 6;    // px — how far behind contact point to spawn
const CP_SIZE_MIN          = 2.0;  // px half-size — min fragment size
const CP_SIZE_MAX          = 5.0;  // px half-size — max fragment size

function spawnCollisionParticles(type, cx, cy, inVx, inVy, paddleCol) {
  if (!settings.hitParticles) return;

  const intensity  = state.particleIntensity;
  const ballSpeed  = Math.sqrt(inVx * inVx + inVy * inVy);
  if (ballSpeed < 0.001) return;

  // Direction of incoming travel (unit vector)
  const dirX = inVx / ballSpeed;
  const dirY = inVy / ballSpeed;

  // Spawn point: step backward along incoming direction
  const spawnX = cx - dirX * CP_OFFSET_BACK;
  const spawnY = cy - dirY * CP_OFFSET_BACK;

  // Scale burst size with intensity (1× at rest, up to ~2.2× at max speed)
  const intensityScale = 1 + intensity * 1.2;
  const base = type === 'paddle' ? CP_PADDLE_BASE_COUNT : CP_WALL_BASE_COUNT;
  const count = Math.round(base * intensityScale);

  const ballCol   = settings.ballColor;
  const ballShape = settings.ballShape;

  for (let i = 0; i < count; i++) {
    // Spread: random angle within ±CP_SPREAD_HALF degrees of incoming direction
    const spreadRad = (Math.random() * 2 - 1) * (CP_SPREAD_HALF * Math.PI / 180);
    const cos = Math.cos(spreadRad);
    const sin = Math.sin(spreadRad);
    // Rotate incoming direction by spread angle
    const pVx = dirX * cos - dirY * sin;
    const pVy = dirX * sin + dirY * cos;

    // Speed: ball's speed × base fraction ± variance, boosted by intensity
    const speedMag = ballSpeed * (CP_SPEED_BASE + (Math.random() * 2 - 1) * CP_SPEED_VARIANCE)
                   * (1 + intensity * 0.6);

    // For paddle hits, alternate between ball-fragment and paddle-fragment
    const isPaddleFragment = (type === 'paddle') && (i % 2 === 1);

    const size = CP_SIZE_MIN + Math.random() * (CP_SIZE_MAX - CP_SIZE_MIN);

    const particle = {
      x:        spawnX + (Math.random() * 4 - 2), // tiny positional jitter
      y:        spawnY + (Math.random() * 4 - 2),
      vx:       pVx * speedMag,
      vy:       pVy * speedMag,
      life:     Math.round(CP_LIFETIME_MIN + Math.random() * (CP_LIFETIME_MAX - CP_LIFETIME_MIN)),
      maxLife:  0,   // set below
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (-0.05 + Math.random() * 0.10) * (1 + intensity),
      size,
      // Rect fragments get randomized paddle-debris proportions
      rectW:    size * (0.7 + Math.random() * 1.1),
      rectH:    size * (0.35 + Math.random() * 0.7),
      // Shape: paddle fragments are always rect; ball fragments match ball shape
      shape:    isPaddleFragment ? 'rect' : ballShape,
      color:    isPaddleFragment ? paddleCol : ballCol,
    };
    particle.maxLife = particle.life;

    state.collisionParticles.push(particle);
  }

  // Evict oldest particles if pool is over the cap
  if (state.collisionParticles.length > CP_MAX_POOL) {
    state.collisionParticles.splice(0, state.collisionParticles.length - CP_MAX_POOL);
  }
}

// ================================================================
//  GOAL SHATTER
// ================================================================

const SHARD_COLS        = 3;
const SHARD_ROWS        = 9;
const SHARD_LIFE        = 120;
const SHARD_DRAG        = 0.996;
const SHARD_DELAY_MAX   = 8;
const SHARD_SPEED_H     = 1.5;
const SHARD_SPEED_H_VAR = 5;
const SHARD_SPEED_V     = 3;
const SHARD_SPIN_MAX    = 0.2;

function spawnPaddleShatter(side, ballY) {
  const paddle    = side === 'player' ? state.player : state.ai;
  const color     = side === 'player' ? playerColor() : aiPaddleColor();
  const shockDirX = side === 'player' ? 1 : -1;

  const impactBias = Math.max(-1, Math.min(1,
    (ballY - (paddle.y + paddle.h * 0.5)) / (paddle.h * 0.5)
  ));

  const baseW = paddle.w / SHARD_COLS;
  const baseH = paddle.h / SHARD_ROWS;

  for (let col = 0; col < SHARD_COLS; col++) {
    for (let row = 0; row < SHARD_ROWS; row++) {
      const w = baseW * (0.65 + Math.random() * 0.6);
      const h = baseH * (0.65 + Math.random() * 0.6);
      const x = paddle.x + col * baseW + (baseW - w) * Math.random();
      const y = paddle.y + row * baseH + (baseH - h) * Math.random();
      const shardCY = y + h * 0.5;

      const distFromImpact = Math.abs(shardCY - ballY);
      const delay = Math.round((distFromImpact / paddle.h) * SHARD_DELAY_MAX);

      const vx = shockDirX * (SHARD_SPEED_H + Math.random() * SHARD_SPEED_H_VAR);

      const shardBias = (shardCY - (paddle.y + paddle.h * 0.5)) / (paddle.h * 0.5);
      const vy = (shardBias * 0.65 - impactBias * 0.55)
               * SHARD_SPEED_V
               * (0.55 + Math.random() * 0.65);

      state.paddleShards.push({
        x, y, w, h,
        vx, vy, delay,
        rotation: 0,
        rotSpeed: (-SHARD_SPIN_MAX + Math.random() * SHARD_SPIN_MAX * 2),
        color,
        life:    SHARD_LIFE,
        maxLife: SHARD_LIFE,
      });
    }
  }
}

// ================================================================
//  MAIN UPDATE — called every frame by the game loop
// ================================================================

function update() {

  // ============================================================
  // Goal pulse updates
  // ============================================================

  const PULSE_DURATION = 55;

  for (const side of ['player', 'ai']) {
    if (state.pulses[side].active) {
      state.pulses[side].t++;

      if (state.pulses[side].t >= PULSE_DURATION) {
        state.pulses[side].active = false;
      }
    }
  }

  // ============================================================
  // Stop gameplay updates unless actively playing
  // ============================================================

  if (phase !== 'PLAYING') return;

  const ball   = state.ball;
  const player = state.player;
  const ai     = state.ai;
  const W      = CONFIG.TARGET_WIDTH;
  const H      = CONFIG.TARGET_HEIGHT;
  const r      = CONFIG.BALL_SIZE / 2;

  // Player movement — same momentum system for both mouse and keyboard
  const ACCEL    = 0.15;
  const FRICTION = 0.94;

  if (state.pointerLocked) {
    // Mouse: drive velocity toward the target position
    const gap = state.playerMouseTarget - (player.y + player.h / 2);
    const step = gap * 0.04;
    state.playerVY = step;
  } else {
    // Keyboard: accelerate/decelerate
    const movingUp   = keys.ArrowUp   || keys.w;
    const movingDown = keys.ArrowDown || keys.s;

    if (movingUp)        state.playerVY -= ACCEL;
    else if (movingDown) state.playerVY += ACCEL;
    else                 state.playerVY *= FRICTION;
  }

  // Clamp velocity to max player speed
  state.playerVY = Math.max(-CONFIG.PLAYER_SPEED, Math.min(CONFIG.PLAYER_SPEED, state.playerVY));

  player.y += state.playerVY;

  // Clamp player inside arena with gap
  const margin = CONFIG.BALL_SIZE * 1.3;
  player.y = Math.max(margin, Math.min(H - player.h - margin, player.y));

  // Kill velocity if clamped against a wall
  if (player.y <= margin || player.y >= H - player.h - margin) state.playerVY = 0;

  // AI movement
  aiUpdate();

  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce (top / bottom)
  // Capture incoming velocity before flip so spawn gets the arrival direction
  if (ball.y - r <= 0) {
    ball.y = r;
    const preVy = ball.vy;          // negative (ball was moving up)
    ball.vy = Math.abs(ball.vy);
    spawnCollisionParticles('wall', ball.x, ball.y, ball.vx, preVy);
  }
  if (ball.y + r >= H) {
    ball.y = H - r;
    const preVy = ball.vy;          // positive (ball was moving down)
    ball.vy = -Math.abs(ball.vy);
    spawnCollisionParticles('wall', ball.x, ball.y, ball.vx, preVy);
  }

  // Player paddle collision
  if (
    ball.vx < 0 &&
    ball.x - r <= player.x + player.w &&
    ball.x - r >= player.x &&
    ball.y + r >= player.y &&
    ball.y - r <= player.y + player.h
  ) {
    onPaddleHit('player');
  }

  // AI paddle collision
  if (
    ball.vx > 0 &&
    ball.x + r >= ai.x &&
    ball.x + r <= ai.x + ai.w &&
    ball.y + r >= ai.y &&
    ball.y - r <= ai.y + ai.h
  ) {
    onPaddleHit('ai');
  }

  // Scoring — ball exits left or right
  if (ball.x + r < 0) onPoint('ai');
  if (ball.x - r > W) onPoint('player');
}


// ================================================================
//  PADDLE HIT — deflects ball, increases speed
// ================================================================

function onPaddleHit(who) {
  const ball   = state.ball;
  const paddle = who === 'player' ? state.player : state.ai;

  // Capture incoming velocity before any modification — needed for particle spawn
  const preVx = ball.vx;
  const preVy = ball.vy;

  // Capture incoming angle before flipping — negate vy so we think in terms
  // of "outgoing" frame (positive angle = upward away from paddle)
  const incomingAngle = Math.atan2(-ball.vy, Math.abs(ball.vx));

  ball.vx = -ball.vx;
  const dir = ball.vx > 0 ? 1 : -1;

  // Where on the paddle the ball hit (-1 = top edge, 0 = center, 1 = bottom edge)
  const hitPos   = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2);

  const MAX_ANGLE   = 60 * (Math.PI / 180);
  const paddleAngle = hitPos * MAX_ANGLE;

  const steepness = Math.min(Math.abs(incomingAngle) / MAX_ANGLE, 1);

  const BLEND_FLAT  = 0.9;
  const BLEND_STEEP = 0.6;
  const blend = BLEND_FLAT + (BLEND_STEEP - BLEND_FLAT) * steepness;

  let finalAngle = incomingAngle * (1 - blend) + paddleAngle * blend;
  finalAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, finalAngle));

  state.speed = Math.min(CONFIG.BALL_SPEED_MAX, state.speed + CONFIG.BALL_SPEED_INC);
  state.rallyCount++;
  state.lastHit = who;
  paddle.hitPulse = 1.0;

  ball.vx = dir * Math.cos(finalAngle) * state.speed;
  ball.vy =       Math.sin(finalAngle) * state.speed;

  aiObservePaddleHit(who, hitPos, incomingAngle);

  // Push ball clear of paddle to prevent double-hits
  if (who === 'player') {
    ball.x = paddle.x + paddle.w + CONFIG.BALL_SIZE / 2 + 1;
  } else {
    ball.x = paddle.x - CONFIG.BALL_SIZE / 2 - 1;
  }

  // Spawn collision particles using the paddle's color as secondary
  const paddleCol = who === 'player' ? playerColor() : aiPaddleColor();
  spawnCollisionParticles('paddle', ball.x, ball.y, preVx, preVy, paddleCol);
}


// ================================================================
//  SCORING
// ================================================================

function onPoint(scorer) {
  state.ballFade = 1;
  phase = 'ROUND_END';
  releasePointerLock();
  aiObserveRallyEnd(scorer);

  if (settings.paddleShatter) {
    if (scorer === 'player') {
      state.ai.visible = false;
      spawnPaddleShatter('ai', state.ball.y);
    } else {
      state.player.visible = false;
      spawnPaddleShatter('player', state.ball.y);
    }
  }

  if (scorer === 'player') {
    state.player.score++;
    flashScore('player');
  } else {
    state.ai.score++;
    flashScore('ai');
  }

  if (scorer === 'player') {
    state.pulses.ai.active = true;
    state.pulses.ai.t      = 0;
  } else {
    state.pulses.player.active = true;
    state.pulses.player.t      = 0;
  }

  updateHUD();

  const playerWon = state.player.score >= CONFIG.MAX_SCORE;
  const aiWon     = state.ai.score    >= CONFIG.MAX_SCORE;

  if (playerWon || aiWon) {
    setTimeout(() => showGameOver(playerWon ? 'WIN' : 'LOSS'), 1000);
  } else {
    setTimeout(() => {
      resetPositions();
      phase = 'READY';
    }, 800);
  }
}


// ================================================================
//  PAUSE
// ================================================================

function pauseGame() {
  phase = 'PAUSED';
}

function resumeGame() {
  phase = 'PLAYING';
}


// ================================================================
//  GAME OVER
// ================================================================

function showGameOver(result) {
  phase = 'GAME_OVER';
  state.gameOverResult = result === 'WIN' ? 'OVERRIDDEN' : 'TERMINATED';
}

function restartGame() {
  state.player.score = 0;
  state.ai.score     = 0;
  state.gameOverResult = null;
  updateHUD();
  resetPositions();
  phase = 'READY';
}


// ================================================================
//  COUNTDOWN
// ================================================================

function beginCountdown() {
  let count = CONFIG.COUNTDOWN_FROM;
  phase = 'COUNTDOWN';
  state.countdownValue = count;

  function tick() {
    state.countdownValue = count;

    if (count === 1) {
      setTimeout(() => {
        phase = 'PLAYING';
        launchBall();
      }, 500);
      return;
    }

    count--;
    setTimeout(tick, 600);
  }

  tick();
}


// ================================================================
//  HUD
// ================================================================

function updateHUD() {
  hudScorePlayer.textContent = state.player.score;
  hudScoreAi.textContent     = state.ai.score;
}

function flashScore(who) {
  const el       = who === 'player' ? hudScorePlayer : hudScoreAi;
  const realVal  = who === 'player' ? state.player.score : state.ai.score;
  const duration = 400;  // total scramble time ms
  const interval = 40;   // how fast digits flip ms
  let elapsed    = 0;

  const scramble = setInterval(() => {
    el.textContent = Math.floor(Math.random() * 10);
    elapsed += interval;
    if (elapsed >= duration) {
      clearInterval(scramble);
      el.textContent = realVal;
    }
  }, interval);

  if (who === 'player') {
    hudScorePlayer.classList.add('flash-player');
    setTimeout(() => hudScorePlayer.classList.remove('flash-player'), 400);
  } else {
    const col = aiPaddleColor();
    hudScoreAi.style.color      = col;
    hudScoreAi.style.textShadow = `0 0 24px ${col}`;
    setTimeout(() => {
      hudScoreAi.style.color      = '';
      hudScoreAi.style.textShadow = '';
    }, 400);
  }
}