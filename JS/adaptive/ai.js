/* ============================================================
   AI.JS — 3-layer adaptive opponent.
   Layer 1: behavioral feel (delay, miss, noise)
   Layer 2: session pattern heuristics
   Layer 3: lightweight Q-learning table
   ============================================================ */


const Q_ACTIONS = ['move_up', 'move_down', 'hold'];
const Q_ACTION_BIAS = { move_up: -18, move_down: 18, hold: 0 };

const BEHAVIOR_START = { reactionDelay: 180, missRate: 0.38, predictionNoise: 48 };
const BEHAVIOR_END   = { reactionDelay: 0,   missRate: 0,    predictionNoise: 10 };
const EVOLUTION_TARGET_ROUNDS = 40;
const PLAYER_HIT_BEHAVIOR_STEP = 0.03;


// ================================================================
//  MAIN AI UPDATE — called every frame during PLAYING
// ================================================================

function aiUpdate() {
  const ball = state.ball;
  const ai   = state.ai;
  const H    = CONFIG.TARGET_HEIGHT;
  const now  = performance.now();
  const prog = aiEvolutionProgress();

  if (ball.vx > 0) {
    if (aiApproachStart === null) {
      aiApproachStart = now;
      aiMissRolled    = false;
    }
    if (!aiMissRolled) {
      aiForcedMiss = Math.random() < aiMemory.behavior.missRate;
      aiMissRolled = true;
    }
  } else {
    aiApproachStart     = null;
    aiMissRolled        = false;
    aiTrajectoryCommitY = null;
    aiRecomputeTimer    = 0;
  }

  const canReact = ball.vx <= 0 ||
    (aiApproachStart !== null &&
     now - aiApproachStart >= aiMemory.behavior.reactionDelay);

  let rawTargetY;

  if (canReact && ball.vx > 0) {
    rawTargetY = incomingTargetForProgress(prog);
  } else if (canReact) {
    rawTargetY = anticipationTarget();
    aiTrajectoryCommitY = null;
    aiRecomputeTimer    = 0;
  } else {
    rawTargetY = aiSmoothedTarget ?? ai.y + ai.h / 2;
  }

  if (aiSmoothedTarget === null) aiSmoothedTarget = rawTargetY;

  const smoothRate = lerp(0.085, 0.028, prog);
  aiSmoothedTarget += (rawTargetY - aiSmoothedTarget) * smoothRate;

  const qState  = encodeQState();
  const qAction = selectQAction(qState);
  aiLastQState  = qState;
  aiLastQAction = qAction;

  const biasTarget = Q_ACTION_BIAS[qAction] * prog * 0.22;
  aiBiasSmoothed += (biasTarget - aiBiasSmoothed) * 0.04;

  ai.targetY = aiSmoothedTarget - ai.h / 2 + aiBiasSmoothed;

  const gap = ai.targetY - ai.y;
  if (Math.abs(gap) > 0.5) {
    const reactionSpeed = lerp(0.28, 0.34, prog);
    const maxSpeed      = lerp(2.6, 7.8, prog);
    let dy = gap * reactionSpeed;
    dy = Math.sign(dy) * Math.min(Math.abs(dy), maxSpeed);
    ai.y += dy;
  }

  const aiMargin = CONFIG.BALL_SIZE * 1.3;
  ai.y = Math.max(aiMargin, Math.min(H - ai.h - aiMargin, ai.y));
}

function incomingTargetForProgress(prog) {
  aiRecomputeTimer++;
  const every = Math.round(lerp(22, 8, prog));

  if (aiRecomputeTimer >= every || aiTrajectoryCommitY === null) {
    aiRecomputeTimer = 0;

    const initChase = state.ball.y;
    let intercept   = predictBallYToX(state.ai.x, Math.round(lerp(3, 8, prog)));
    intercept += (Math.random() * 2 - 1) * aiMemory.behavior.predictionNoise;
    intercept += patternTargetBias();

    const blend = Math.min(1, prog / 0.42);
    let y = initChase + (intercept - initChase) * blend;

    if (aiForcedMiss) {
      y += (Math.random() < 0.5 ? -1 : 1) * lerp(100, 30, prog) * (0.6 + Math.random() * 0.4);
    }

    aiTrajectoryCommitY = clampY(y);
  }

  return aiTrajectoryCommitY;
}


// ================================================================
//  LAYER 1 — BEHAVIORAL ADAPTATION
// ================================================================

function updateBehaviorLearning() {
  applyBehaviorStep(1);
  aiMemory.totalRounds++;
  aiMemory.epsilon = Math.max(0.04, aiMemory.epsilon * 0.93);
}

function applyBehaviorStep(scale) {
  const b = aiMemory.behavior;
  b.reactionDelay   = Math.max(BEHAVIOR_END.reactionDelay,
    b.reactionDelay   - ((BEHAVIOR_START.reactionDelay - BEHAVIOR_END.reactionDelay) / EVOLUTION_TARGET_ROUNDS) * scale);
  b.missRate        = Math.max(BEHAVIOR_END.missRate,
    b.missRate        - ((BEHAVIOR_START.missRate - BEHAVIOR_END.missRate) / EVOLUTION_TARGET_ROUNDS) * scale);
  b.predictionNoise = Math.max(BEHAVIOR_END.predictionNoise,
    b.predictionNoise - ((BEHAVIOR_START.predictionNoise - BEHAVIOR_END.predictionNoise) / EVOLUTION_TARGET_ROUNDS) * scale);
}


// ================================================================
//  LAYER 2 — SESSION PATTERN TRACKING
// ================================================================

function aiObserveLaunch() {
  const H = CONFIG.TARGET_HEIGHT;
  if (state.ball.vx >= 0) return;

  const zone = zoneFromY(state.ball.y, H);
  aiMemory.sessionStats.playerServeZones[zone]++;
}

function aiObservePaddleHit(who, hitPos, incomingAngle) {
  const H = CONFIG.TARGET_HEIGHT;

  if (who === 'player') {
    const zone = zoneFromY(state.ball.y, H);
    aiMemory.sessionStats.returnZones[zone]++;

    const outgoingAngle = Math.atan2(state.ball.vy, state.ball.vx);
    const angleDelta    = Math.abs(outgoingAngle - incomingAngle);
    if (angleDelta > 0.45) aiMemory.sessionStats.crossCourtCount++;
    else aiMemory.sessionStats.straightCount++;

    applyBehaviorStep(PLAYER_HIT_BEHAVIOR_STEP);
  }
}

function patternTargetBias() {
  const stats = aiMemory.sessionStats;
  const total = stats.returnZones[0] + stats.returnZones[1] + stats.returnZones[2];
  if (total < 2) return 0;

  let best = 0;
  let max  = stats.returnZones[0];
  for (let i = 1; i < 3; i++) {
    if (stats.returnZones[i] > max) {
      max  = stats.returnZones[i];
      best = i;
    }
  }

  const weight = Math.min(0.22, total * 0.018);
  return (best - 1) * (CONFIG.TARGET_HEIGHT / 3) * weight;
}


// ================================================================
//  LAYER 3 — Q-LEARNING TABLE
// ================================================================

function encodeQState() {
  const W = CONFIG.TARGET_WIDTH;
  const H = CONFIG.TARGET_HEIGHT;
  const ball = state.ball;

  const ballXBucket = Math.min(4, Math.floor((ball.x / W) * 5));
  const ballYDir    = ball.vy < -0.25 ? 'up' : ball.vy > 0.25 ? 'down' : 'flat';
  const playerZone  = zoneFromY(state.player.y + state.player.h / 2, H);

  return ballXBucket + '|' + ballYDir + '|' + playerZone;
}

function ensureQEntry(stateKey) {
  if (!aiMemory.qTable[stateKey]) {
    aiMemory.qTable[stateKey] = { up: 0, down: 0, stay: 0 };
  }
  return aiMemory.qTable[stateKey];
}

function qActionToKey(action) {
  if (action === 'move_up') return 'up';
  if (action === 'move_down') return 'down';
  return 'stay';
}

function selectQAction(stateKey) {
  if (Math.random() < aiMemory.epsilon) {
    return Q_ACTIONS[Math.floor(Math.random() * Q_ACTIONS.length)];
  }

  const entry = ensureQEntry(stateKey);
  let bestAction = 'hold';
  let bestVal    = entry.stay;

  if (entry.up > bestVal) {
    bestVal    = entry.up;
    bestAction = 'move_up';
  }
  if (entry.down > bestVal) {
    bestVal    = entry.down;
    bestAction = 'move_down';
  }

  return bestAction;
}

function updateQTable(result) {
  if (!aiLastQState || !aiLastQAction) return;

  const reward = result.winner === 'ai' ? 1 : -1;
  const entry  = ensureQEntry(aiLastQState);
  const key    = qActionToKey(aiLastQAction);
  const lr     = 0.1;

  entry[key] += lr * (reward - entry[key]);
}


// ================================================================
//  RALLY END — called by gameplay.js after each point
// ================================================================

function aiObserveRallyEnd(scorer) {
  const result = { winner: scorer };
  updateBehaviorLearning();
  updateQTable(result);
  aiApproachStart       = null;
  aiForcedMiss          = false;
  aiMissRolled          = false;
  aiTrajectoryCommitY   = null;
  aiRecomputeTimer      = 0;
}


// ================================================================
//  TARGETING
// ================================================================

function anticipationTarget() {
  const H      = CONFIG.TARGET_HEIGHT;
  const center = H / 2;
  const bias   = patternTargetBias();
  const learn  = Math.min(0.65, rallyExperience());

  const favoredZone = dominantReturnZone();
  const favoredY    = (favoredZone + 0.5) * (H / 3);

  return clampY(center * (1 - learn) + favoredY * learn + bias);
}

function dominantReturnZone() {
  const zones = aiMemory.sessionStats.returnZones;
  let best = 1;
  let max  = zones[0];
  for (let i = 1; i < 3; i++) {
    if (zones[i] > max) {
      max  = zones[i];
      best = i;
    }
  }
  return best;
}

function rallyExperience() {
  const total = aiMemory.sessionStats.returnZones.reduce((a, b) => a + b, 0);
  return Math.min(1, total / 10);
}

function aiEvolutionProgress() {
  const b = aiMemory.behavior;
  const delayT = 1 - (b.reactionDelay - BEHAVIOR_END.reactionDelay) /
    (BEHAVIOR_START.reactionDelay - BEHAVIOR_END.reactionDelay);
  const missT  = 1 - (b.missRate - BEHAVIOR_END.missRate) /
    (BEHAVIOR_START.missRate - BEHAVIOR_END.missRate);
  const noiseT = 1 - (b.predictionNoise - BEHAVIOR_END.predictionNoise) /
    (BEHAVIOR_START.predictionNoise - BEHAVIOR_END.predictionNoise);
  const roundT = Math.min(1, aiMemory.totalRounds / EVOLUTION_TARGET_ROUNDS);
  return Math.max(0, Math.min(1,
    Math.max(delayT, missT, noiseT, roundT)
  ));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}


// ================================================================
//  PREDICTION HELPERS
// ================================================================

function predictBallYToX(targetX, maxBounces) {
  const H    = CONFIG.TARGET_HEIGHT;
  const ball = state.ball;
  let bx = ball.x;
  let by = ball.y;
  let vx = ball.vx;
  let vy = ball.vy;
  let bounces = 0;

  if (vx <= 0) return by;

  while (bx < targetX && bounces < maxBounces) {
    const tToTarget = (targetX - bx) / vx;
    const tToWall = vy !== 0
      ? (vy > 0 ? (H - by) / vy : -by / vy)
      : Infinity;

    if (tToWall < tToTarget) {
      bx += vx * tToWall;
      by = vy > 0 ? H : 0;
      vy = -vy;
      bounces++;
    } else {
      by += vy * tToTarget;
      break;
    }
  }

  return clampY(by);
}

function zoneFromY(y, H) {
  return Math.min(2, Math.max(0, Math.floor((y / H) * 3)));
}

function clampY(y) {
  const margin = CONFIG.BALL_SIZE * 1.3;
  return Math.max(margin, Math.min(CONFIG.TARGET_HEIGHT - margin, y));
}


// ================================================================
//  UI FEEDBACK — threat label + paddle color
// ================================================================

const THREAT_MSGS = {
  early: [
    'OBSERVING...',
    'CALIBRATING...',
    'CONVERGENCE: 2%',
    'PATTRN ARCHIVD...',
    'SAMPL LOGGED...',
    'ANALYZING...',
    'WATCHING...',
  ],
  mid: [
    'ANTICIPATING...',
    'ABSORBNG...',
    'CATALOGING...',
    'RECALC\u2591\u2591\u2591ULATING...',
    'CONVRGENCE: 61%',
    'CONVERGNCE: -CRPTD',
    'VECTR::RECAL',
    'REFINING...',
    'ADJUSTING...',
    'PREDICTING...',
    'PATTRN ARCHIVD...',
  ],
  late: [
    'CONVERGENCE: COMPLETE',
    'MODL//:REFIND',
    'LOSS MINIMIZED',
    'BEHAVIORAL DELTA-- OVRCLO-',
    'ANOMALY DETEC-',
    'EXPOSURE THRSHLD:/ CAPD',
    'FNCT://EVOLVD...',
    '[REDACTED] INITIALIZD',
    'SYN_ADAPT::LOCK',
    'MODL_V[?] ONLINE',
    '//MUTATION APPLIED//',
    'CNTRL ASSERTED',
    'SHFT::OVRWRITE',
  ],
};

const THREAT_CYCLE_MS = 5200;

let threatHudReady = false;
let threatActive   = 'a';
let threatCurrent  = 'OBSERVING...';
let threatNextAt   = 0;
let threatWrapEl   = null;
let threatSizerEl  = null;
let threatMsgAEl   = null;
let threatMsgBEl   = null;

function threatTier() {
  const p = aiEvolutionProgress();
  if (p < 0.34) return 'early';
  if (p < 0.68) return 'mid';
  return 'late';
}

function pickThreatMessage(exclude) {
  const pool = THREAT_MSGS[threatTier()];
  if (pool.length === 1) return pool[0];

  let msg;
  do {
    msg = pool[Math.floor(Math.random() * pool.length)];
  } while (msg === exclude);

  return msg;
}

function initThreatLabel() {
  threatWrapEl  = document.getElementById('diff-msg-wrap');
  threatSizerEl = document.getElementById('diff-msg-sizer');
  threatMsgAEl  = document.getElementById('diff-msg-a');
  threatMsgBEl  = document.getElementById('diff-msg-b');

  if (!threatWrapEl || !threatSizerEl || !threatMsgAEl || !threatMsgBEl) return;

  if (threatHudReady) {
    syncThreatWrapWidth(threatCurrent);
    return;
  }

  threatCurrent  = pickThreatMessage('');
  threatActive   = 'a';
  threatNextAt   = performance.now() + THREAT_CYCLE_MS;
  threatHudReady = true;

  threatMsgAEl.textContent = threatCurrent;
  threatMsgBEl.textContent = '';
  threatMsgAEl.classList.add('visible');
  threatMsgBEl.classList.remove('visible');
  syncThreatWrapWidth(threatCurrent);
  requestAnimationFrame(() => syncThreatWrapWidth(threatCurrent));
}

function syncThreatWrapWidth(text) {
  if (!threatWrapEl || !threatSizerEl) return;
  threatSizerEl.textContent = text;
  const pad = parseFloat(getComputedStyle(threatWrapEl).paddingLeft) +
              parseFloat(getComputedStyle(threatWrapEl).paddingRight);
  threatWrapEl.style.width = (threatSizerEl.offsetWidth + pad) + 'px';
}

function advanceThreatMessage(now) {
  if (!threatHudReady) return;

  const incoming = pickThreatMessage(threatCurrent);
  const outEl    = threatActive === 'a' ? threatMsgAEl : threatMsgBEl;
  const inEl     = threatActive === 'a' ? threatMsgBEl : threatMsgAEl;

  inEl.textContent = incoming;
  syncThreatWrapWidth(incoming);

  outEl.classList.remove('visible');
  inEl.classList.add('visible');

  threatActive  = threatActive === 'a' ? 'b' : 'a';
  threatCurrent = incoming;
  threatNextAt  = now + THREAT_CYCLE_MS;
}

function updateThreatLabel(now) {
  if (!threatHudReady) return;
  if (now >= threatNextAt) advanceThreatMessage(now);
}

function adaptivePrimaryColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-adaptive-primary').trim() || '#ff2a14';
}

function adaptiveSecondaryColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--color-adaptive-secondary').trim() || '#ffb000';
}

function aiPaddleColor() {
  const t = aiEvolutionProgress();
  return lerpHex(adaptiveSecondaryColor(), adaptivePrimaryColor(), t);
}

function updateAiStatusHUD() {
  const col = aiPaddleColor();
  const now = performance.now();

  updateThreatLabel(now);

  const diffEl = document.getElementById('diff-label');
  if (diffEl) {
    diffEl.style.color      = col;
    diffEl.style.textShadow = `0 0 18px ${col}`;
  }

  const systemLabel = document.querySelector('.hud-label-system');
  if (systemLabel) systemLabel.style.color = col;
}

function lerpHex(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return '#' + [r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}
