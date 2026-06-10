/* ============================================================
   RENDER.JS — Draw only. Read-only access to state.
   No score changes. No phase changes. No game logic.
   Every function in this file draws something and returns.
   ============================================================ */


// ================================================================
//  MAIN RENDER — called every frame by the game loop
// ================================================================

function render() {
  const W = CONFIG.TARGET_WIDTH;
  const H = CONFIG.TARGET_HEIGHT;
  const I = CONFIG.ARENA_INSET;
  const C = CONFIG.ARENA_CORNER;

  // Clear
  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, W, H);

  drawParticles(W, H);
  drawCollisionParticles();
  drawPaddleShards();
  drawArenaBorder(W, H, I, C);
  if (settings.goalPulse) drawGoalPulses(W, H);
  drawPaddle(state.player, playerColor());
  drawPaddle(state.ai, diffColor1());

  if (
    phase === 'PLAYING'   ||
    (phase === 'ROUND_END' && state.ballFade > 0)
  ) {
    drawBall();
  }

  if (phase === 'READY')     drawReadyOverlay(W, H);
  if (phase === 'COUNTDOWN') drawCountdownOverlay(W, H);
  if (phase === 'GAME_OVER') drawGameOverOverlay(W, H);
}


// ================================================================
//  CANVAS OVERLAYS
// ================================================================

function drawReadyOverlay(W, H) {
  ctx.fillStyle = 'rgba(7, 7, 15, 0.45)';
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;

  const pulse = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(Date.now() / 400));

  ctx.save();
  ctx.globalAlpha  = pulse;
  ctx.font         = 'bold 44px Orbitron, monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#e8e8e8';
  ctx.shadowColor  = playerColor();
  ctx.shadowBlur   = 24;
  ctx.fillText('READY?', cx, cy - 20);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha   = pulse;
  ctx.font          = '14px "Share Tech Mono", monospace';
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillStyle     = 'rgba(0, 207, 255, 0.85)';
  ctx.letterSpacing = '0.1em';
  ctx.fillText('SPACE / CLICK  =  INITIALIZE', cx, cy + 30);
  ctx.restore();
}

function drawCountdownOverlay(W, H) {
  ctx.fillStyle = 'rgba(7, 7, 15, 0.45)';
  ctx.fillRect(0, 0, W, H);

  const cx  = W / 2;
  const cy  = H / 2;
  const col = diffColor1();

  ctx.save();
  ctx.font         = 'bold 120px Orbitron, monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = col;
  ctx.shadowColor  = col;
  ctx.shadowBlur   = 40;
  ctx.fillText(String(state.countdownValue), cx, cy);
  ctx.restore();
}

function drawGameOverOverlay(W, H) {
  ctx.fillStyle = 'rgba(7, 7, 15, 0.85)';
  ctx.fillRect(0, 0, W, H);

  const pulse  = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(Date.now() / 400));
  const cx     = W / 2;
  const cy     = H / 2;
  const result = state.gameOverResult || 'TERMINATED';
  const isWin  = result === 'OVERRIDDEN';
  const col    = isWin ? '#00ff88' : '#ff4500';

  ctx.save();
  ctx.font         = 'bold 52px Orbitron, monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = col;
  ctx.shadowColor  = col;
  ctx.shadowBlur   = 32;
  ctx.fillText(result, cx, cy - 48);
  ctx.restore();

  ctx.save();
  ctx.font         = 'bold 36px Orbitron, monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = '#e8e8e8';
  ctx.shadowColor  = col;
  ctx.shadowBlur   = 14;
  ctx.fillText(`${state.player.score}  —  ${state.ai.score}`, cx, cy + 10);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha  = pulse;
  ctx.font         = '14px "Share Tech Mono", monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = 'rgba(0, 207, 255, 0.85)';
  ctx.fillText('SPACE / CLICK  =  REINITIALIZE', cx, cy + 58);
  ctx.restore();
}


// ================================================================
//  ARENA
// ================================================================

function drawArenaBorder(W, H, I, C) {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth   = 8;
  ctx.strokeRect(I, I, W - I * 2, H - I * 2);

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(I, I, W - I * 2, H - I * 2);

  const col = 'rgba(255,255,255,0.30)';
  drawCornerTick(I,     I,     C,  1,  1, col);
  drawCornerTick(W - I, I,     C, -1,  1, col);
  drawCornerTick(I,     H - I, C,  1, -1, col);
  drawCornerTick(W - I, H - I, C, -1, -1, col);
}

function drawCornerTick(cx, cy, len, dx, dy, col) {
  ctx.beginPath();
  ctx.moveTo(cx + dx * len, cy);
  ctx.lineTo(cx, cy);
  ctx.lineTo(cx, cy + dy * len);
  ctx.strokeStyle = col;
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// ================================================================
//  BACKGROUND PARTICLES
// ================================================================

const PARTICLE_COUNT = 300;

function initParticles(W, H) {
  state.particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    state.particles.push(spawnParticle(W, H, true));
  }
}

function spawnParticle(W, H, randomY = false) {
  const size   = 0.5 + Math.random() * 4;
  const width  = size;
  const height = size * (0.5 + Math.random() * 1.5);
  const speed  = 0.05 + Math.pow(size / 4, 2) * 0.55;
  return {
    x:             Math.random() * W,
    y:             randomY ? Math.random() * H : H + 4,
    size,
    width,
    height,
    speed,
    drift:         (-0.12 + Math.random() * 0.24) * (4 / size),
    opacity:       0.01 + Math.pow(size / 4, 2) * 0.32,
    color:         Math.random() < 0.5 ? 'player' : 'diff',
    rotation:      Math.random() * Math.PI * 2,
    rotationSpeed: (-0.02 + Math.random() * 0.04),
  };
}

function drawParticles(W, H) {
  const ball = state.ball;

  const ballSpeed = ball
    ? Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy)
    : 0;

  const normalized = (ballSpeed - 3.2) / (10 - 3.2);
  const clamped = Math.min(Math.max(normalized, 0), 1);

  let targetIntensity = Math.pow(clamped, 1.8);

  if (clamped > 0.75) {
    targetIntensity += (clamped - 0.75) * 2.5;
  }

  if (phase !== 'PLAYING') {
    targetIntensity = 0.04;
  }

  state.particleIntensity +=
    (targetIntensity - state.particleIntensity) * 0.01;

  const intensity = state.particleIntensity;

  if (state.particles.length === 0) initParticles(W, H);

  if (!settings.backgroundParticles) return;

  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    const moveBoost = 1 + intensity * 4.5;
    p.y -= p.speed * moveBoost;
    p.x += p.drift * (1 + intensity * 3.5);

    if (p.y + p.size < 0) {
      state.particles[i] = spawnParticle(W, H, false);
      continue;
    }

    const col = p.color === 'player' ? playerColor() : diffColor1();

    ctx.save();
    ctx.globalAlpha = p.opacity * (1 + intensity * 0.8);
    ctx.fillStyle   = col;
    p.rotation += p.rotationSpeed * (1 + intensity * 1.5);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillRect(
      -p.width * 0.5,
      -p.height * 0.5,
      p.width,
      p.height
    );
    ctx.restore();
  }
}


// ================================================================
//  COLLISION PARTICLES — impact burst system
//
//  Drawn after background particles, before paddles.
//  Particles are advanced here (position, life) as well as drawn,
//  keeping all visual logic inside render.js.
//  Dead particles (life <= 0) are removed via splice each frame;
//  the pool is capped in gameplay.js so the array stays small.
//
//  Alpha curve: holds near full opacity for the first 40% of life,
//  then fades out — giving the eye time to read shape and color
//  before the fragment disappears.
// ================================================================

function drawCollisionParticles() {
  if (!settings.hitParticles) {
    // Still drain the array so stale particles don't survive a toggle-off
    for (let i = state.collisionParticles.length - 1; i >= 0; i--) {
      state.collisionParticles[i].life--;
      if (state.collisionParticles[i].life <= 0) {
        state.collisionParticles.splice(i, 1);
      }
    }
    return;
  }

  for (let i = state.collisionParticles.length - 1; i >= 0; i--) {
    const p = state.collisionParticles[i];

    // Advance
    p.x        += p.vx;
    p.y        += p.vy;
    p.rotation += p.rotSpeed;
    p.life--;

    if (p.life <= 0) {
      state.collisionParticles.splice(i, 1);
      continue;
    }

    // Alpha curve: hold near full for first 40% of life, then linear fade.
    // This ensures shape and color read clearly before the fragment disappears.
    const lifeFrac = p.life / p.maxLife;   // 1 → 0
    const alpha = lifeFrac > 0.6
      ? 0.92                               // full opacity hold phase
      : (lifeFrac / 0.6) * 0.92;          // linear fade to 0

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 6;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);

    if (p.shape === 'rect') {
      // Paddle fragment — rectangle debris matching background debris style
      ctx.fillRect(-p.rectW * 0.5, -p.rectH * 0.5, p.rectW, p.rectH);
    } else {
      // Ball fragment — uses the same drawShape helper as the ball itself
      drawShape(p.shape, 0, 0, p.size * 0.5);
    }

    ctx.restore();
  }
}

// ================================================================
//  PADDLE SHATTER
//
//  Each shard has a `delay` field — it sits frozen until delay
//  reaches 0, then begins drifting. This creates a subtle ripple
//  pulse radiating outward from the impact point.
//
//  Zero-gravity: no vy accumulation. Drag (SHARD_DRAG) bleeds
//  velocity each frame so shards slow and hang in space.
//
//  Fade curve: holds near full opacity for first 40% of life
//  then linear fade — matching the collision particle aesthetic.
// ================================================================

function drawPaddleShards() {
  for (let i = state.paddleShards.length - 1; i >= 0; i--) {
    const s = state.paddleShards[i];

    // Delay: tick down before the shard starts moving
    if (s.delay > 0) {
      s.delay--;
      s.life--;
      if (s.life <= 0) { state.paddleShards.splice(i, 1); }
      continue;
    }

    // Zero-g drift with drag
    s.x  += s.vx;
    s.y  += s.vy;
    s.vx *= SHARD_DRAG;
    s.vy *= SHARD_DRAG;

    s.rotation += s.rotSpeed;
    s.life--;

    if (s.life <= 0) {
      state.paddleShards.splice(i, 1);
      continue;
    }

    // Alpha: hold near full for first 40% of life, linear fade after
    const lifeFrac = s.life / s.maxLife;  // 1 → 0
    const alpha = lifeFrac > 0.6
      ? 0.92
      : (lifeFrac / 0.6) * 0.92;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(s.x + s.w * 0.5, s.y + s.h * 0.5);
    ctx.rotate(s.rotation);
    ctx.fillStyle   = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur  = 14;
    ctx.fillRect(-s.w * 0.5, -s.h * 0.5, s.w, s.h);
    ctx.restore();
  }
}

// ================================================================
//  GOAL PULSES
// ================================================================

function drawGoalPulses(W, H) {
  const PULSE_DURATION = 55;

  for (const side of ['player', 'ai']) {
    const pulse = state.pulses[side];
    if (!pulse.active) continue;

    const progress = pulse.t / PULSE_DURATION;
    const ease = progress < 0.4
      ? progress / 0.4
      : 1 - (progress - 0.4) / 0.6;

    const maxAlpha = 0.38;
    const alpha    = ease * maxAlpha;
    const col      = side === 'player' ? diffColor1() : playerColor();
    const gradW    = W * 0.52;

    const grad = side === 'player'
      ? ctx.createLinearGradient(0, 0, gradW, 0)
      : ctx.createLinearGradient(W, 0, W - gradW, 0);

    grad.addColorStop(0,   hexToRgba(col, alpha));
    grad.addColorStop(0.5, hexToRgba(col, alpha * 0.4));
    grad.addColorStop(1,   hexToRgba(col, 0));

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}


// ================================================================
//  PADDLES
// ================================================================

function drawPaddle(paddle, col) {

  if (!paddle.visible) return;

  const { x, y, w, h } = paddle;

  if (settings.paddlePulse) {
    if (paddle.hitPulse > 0) {
      paddle.hitPulse = Math.max(0, paddle.hitPulse - 0.01);
    }
  } else {
    paddle.hitPulse = 0;
  }

  const blur = settings.paddlePulse
    ? 18 + paddle.hitPulse * 32
    : 18;

  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur  = blur;
  ctx.fillStyle   = col;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}


// ================================================================
//  BALL
// ================================================================

function drawBall() {

  let fadeAlpha = 1;

  if (phase === 'ROUND_END') {
    state.ballFade -= 0.03;
    state.ballFade = Math.max(0, state.ballFade);
    alpha = state.ballFade;
  }

  const { x, y, vx, vy } = state.ball;
  const r     = CONFIG.BALL_SIZE / 2;
  const speed = Math.sqrt(vx * vx + vy * vy);

  if (settings.ballSpin) {
    // Clockwise when moving right (vx > 0), counter-clockwise when moving left (vx < 0)
    const direction = vx > 0 ? 1 : -1;
    ballRotation += speed * 0.01 * direction;
  }

  const trailCol = state.lastHit === null ? '#ffffff' : (state.lastHit === 'player' ? playerColor() : diffColor1());
  const ballCol  = settings.ballColor;
  const shape    = settings.ballShape;

  // Push current position to trail
  state.ballTrail.push({ x, y, rotation: ballRotation });
  if (state.ballTrail.length > 20) state.ballTrail.shift();

  // Trail — uses same shape as ball, scaled down
  if (settings.ballTrail) {
    for (let i = 0; i < state.ballTrail.length; i++) {
      const t        = state.ballTrail[i];
      const progress = i / state.ballTrail.length;
      const alpha    = progress * 0.3 * fadeAlpha;
      const size     = CONFIG.BALL_SIZE * (0.4 + progress * 0.6);
      const half     = size / 2;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);
      ctx.shadowColor = trailCol;
      ctx.shadowBlur  = 12 * progress;
      ctx.fillStyle   = trailCol;
      drawShape(shape, 0, 0, half);
      ctx.restore();
    }
  }

  // Glow halo
  ctx.save();
  ctx.globalAlpha = fadeAlpha;

  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
  grad.addColorStop(0, trailCol + '28');
  grad.addColorStop(1, 'transparent');

  ctx.beginPath();
  ctx.arc(x, y, r * 4.5, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();

  // Ball core
  ctx.save();
  ctx.globalAlpha = fadeAlpha;

  ctx.translate(x, y);
  ctx.rotate(ballRotation);

  ctx.shadowColor = trailCol;
  ctx.shadowBlur  = 22;
  ctx.fillStyle   = ballCol;

  drawShape(shape, 0, 0, r);

  ctx.restore();
}

// ================================================================
//  SHAPE HELPER — draws a shape centered at (cx,cy) with half-size r
//  Must be called with ctx already translated to the center point.
// ================================================================

function drawShape(shape, cx, cy, r) {
  const size = r * 2;
  switch (shape) {
    case 'circle':
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'triangle':
      ctx.beginPath();
      ctx.moveTo(cx,     cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
      ctx.fill();
      break;
    case 'square':
    default:
      ctx.fillRect(cx - r, cy - r, size, size);
      break;
  }
}


// ================================================================
//  DIFFICULTY COLOR HELPERS
// ================================================================

function playerColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-player').trim() || '#001aff';
}

function diffColor1() {
  if (!diff) return '#e8e8e8';
  return {
    'diff-init':      '#00ff0d',
    'diff-stable':    '#ffdd00',
    'diff-prime':     '#ff8800',
    'diff-overclock': '#ff2200',
  }[diff.cssClass] || '#e8e8e8';
}

function diffColor2() {
  if (!diff) return '#e8e8e8';
  return {
    'diff-init':      '#00ff88',
    'diff-stable':    '#00cfff',
    'diff-prime':     '#ff4500',
    'diff-overclock': '#ffaa00',
  }[diff.cssClass] || '#e8e8e8';
}


// ================================================================
//  HEX TO RGBA HELPER
// ================================================================

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}