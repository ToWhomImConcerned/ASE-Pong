/* ============================================================
   LANDING.JS
   Handles:
   - Staggered fade-in on load
   - Card hover split + title dim
   - Node network canvas drawing
   - LED liquid light bar border (full perimeter, color wave)
   - Navigation on card click
   ============================================================ */


// ---- ELEMENT REFERENCES ----------------------------------

const titleBlock     = document.querySelector('.landing-title-block');
const cardsContainer = document.querySelector('.cards-container');
const cardClassic    = document.getElementById('card-classic');
const cardAdaptive   = document.getElementById('card-adaptive');
const nodeCanvas     = document.getElementById('node-canvas');
const ctx            = nodeCanvas.getContext('2d');

// ---- FADE IN ON LOAD -------------------------------------

const fadeEls = document.querySelectorAll('.fade-in');


// ================================================================
//  LED LIQUID LIGHT BAR
//
//  The entire card border is always lit — like a RAM stick LED bar.
//  A color wave (hue shift) rolls around the full perimeter at all
//  times. At rest: thin + dim. On hover: thicker + vivid + faster.
//
//  Classic  → blue(220) → cyan(185) → green(145)  clockwise
//  Adaptive → red(0)    → orange(25) → yellow(55) counter-clockwise
//
//  We sample SEGMENTS evenly-spaced points around the perimeter.
//  Each point gets a hue from: its positional fraction + a rolling
//  phase offset. The phase scrolls every frame, making color flow.
//  Two draw passes: wide soft glow + sharp bright core.
// ================================================================

const LED = {
  classic: {
    hueStart:   220,
    hueEnd:     145,    // blue → green
    direction:  1,      // +1 = clockwise
    saturation: 100,
    lightness:  58,
  },
  adaptive: {
    hueStart:   0,
    hueEnd:     55,     // red → yellow
    direction:  -1,     // -1 = counter-clockwise
    saturation: 100,
    lightness:  54,
  },
};

const SEGMENTS = 220;

function createLEDBorder(cardEl, side) {
  const canvas = document.createElement('canvas');
  canvas.classList.add('card-border-canvas');
  cardEl.insertBefore(canvas, cardEl.firstChild);
  const c = canvas.getContext('2d');

  const cfg = LED[side];

  const state = {
    phase:     0,
    alpha:     0,
    lineWidth: 1.0,
    hovered:   false,
    speed:     0.0005,
  };

  function sizeCanvas() {
    const r = cardEl.getBoundingClientRect();
    canvas.width  = r.width  + 2;
    canvas.height = r.height + 2;
  }

  // Build rounded-rect perimeter points (clockwise, radius 4px)
  function buildPerimeter() {
    const w = canvas.width, h = canvas.height, r = 4;
    const pts = [];
    const arc = 20;

    // top-left → top-right
    for (let i = 0; i <= arc; i++) {
      const a = Math.PI + (Math.PI / 2) * (i / arc);
      pts.push([r + r * Math.cos(a), r + r * Math.sin(a)]);
    }
    pts.push([w - r, 0]);
    // top-right corner
    for (let i = 0; i <= arc; i++) {
      const a = -Math.PI / 2 + (Math.PI / 2) * (i / arc);
      pts.push([w - r + r * Math.cos(a), r + r * Math.sin(a)]);
    }
    pts.push([w, h - r]);
    // bottom-right corner
    for (let i = 0; i <= arc; i++) {
      const a = 0 + (Math.PI / 2) * (i / arc);
      pts.push([w - r + r * Math.cos(a), h - r + r * Math.sin(a)]);
    }
    pts.push([r, h]);
    // bottom-left corner
    for (let i = 0; i <= arc; i++) {
      const a = Math.PI / 2 + (Math.PI / 2) * (i / arc);
      pts.push([r + r * Math.cos(a), h - r + r * Math.sin(a)]);
    }
    pts.push([0, r]);

    return pts;
  }

  // Resample raw pts to exactly SEGMENTS evenly-spaced points
  function resample(pts) {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i-1][0];
      const dy = pts[i][1] - pts[i-1][1];
      lens.push(lens[i-1] + Math.sqrt(dx*dx + dy*dy));
    }
    const total = lens[lens.length - 1];
    const out   = [];
    let j = 0;
    for (let s = 0; s < SEGMENTS; s++) {
      const target = (s / SEGMENTS) * total;
      while (j < lens.length - 2 && lens[j+1] < target) j++;
      const t = (target - lens[j]) / (lens[j+1] - lens[j] || 1);
      out.push([
        pts[j][0] + (pts[j+1][0] - pts[j][0]) * t,
        pts[j][1] + (pts[j+1][1] - pts[j][1]) * t,
      ]);
    }
    return out;
  }

  function draw() {
    c.clearRect(0, 0, canvas.width, canvas.height);
    if (state.alpha < 0.008) return;

    const pts = resample(buildPerimeter());
    const n   = pts.length;

    // Two passes: glow then core
    for (let pass = 0; pass < 2; pass++) {
      const isGlow = pass === 0;
      const lw     = isGlow ? state.lineWidth * 7 : state.lineWidth;
      const aScale = isGlow ? 0.22 : 1.0;

      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;

        // posFrac: where this point sits on the perimeter (0..1)
        const posFrac = i / n;

        // waveFrac: phase-shifted position, direction-aware
        // direction=+1 means the wave flows forward (CW)
        // direction=-1 means it appears to flow backward (CCW)
        const waveFrac = ((posFrac + cfg.direction * state.phase) % 1 + 1) % 1;

        // Interpolate hue linearly across the range
        const hue = cfg.hueStart + (cfg.hueEnd - cfg.hueStart) * waveFrac;

        // Subtle brightness ripple for "liquid" depth
        const ripple = Math.sin(waveFrac * Math.PI * 6) * (state.hovered ? 6 : 3);
        const l = cfg.lightness + ripple;

        c.beginPath();
        c.moveTo(pts[i][0], pts[i][1]);
        c.lineTo(pts[next][0], pts[next][1]);
        c.strokeStyle = `hsla(${hue}, ${cfg.saturation}%, ${l}%, ${state.alpha * aScale})`;
        c.lineWidth   = lw;
        c.lineCap     = 'round';
        c.stroke();
      }
    }
  }

  function tick() {
    const targetSpeed = state.hovered ? 0.0020 : 0.0005;
    state.speed  += (targetSpeed  - state.speed)  * 0.05;
    state.phase   = (state.phase  + state.speed)  % 1;

    const targetAlpha = state.hovered ? 1.0 : 0.28;
    state.alpha  += (targetAlpha  - state.alpha)  * 0.055;

    const targetWidth = state.hovered ? 2.8 : 1.0;
    state.lineWidth += (targetWidth - state.lineWidth) * 0.07;

    draw();
  }

  return { canvas, state, sizeCanvas, tick };
}


// ---- NODE NETWORK ----------------------------------------

const canvas = nodeCanvas;

let currentHover = null;

let nodesLeft = [];
let nodesRight = [];

let energyLeft = 0.2;
let energyRight = 0.2;

let targetLeft = 0.2;
let targetRight = 0.2;

function resizeCanvas() {
  const rect = cardsContainer.getBoundingClientRect();

  // prevent bad sizing during layout
  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width;
  canvas.height = rect.height;

  generateNodes(); // rebuild nodes with correct zones
}

function getCardZones() {
  const containerRect = cardsContainer.getBoundingClientRect();
  const classicRect = cardClassic.getBoundingClientRect();
  const adaptiveRect = cardAdaptive.getBoundingClientRect();

  return {
    classicTop: classicRect.top - containerRect.top,
    classicBottom: classicRect.bottom - containerRect.top,

    adaptiveTop: adaptiveRect.top - containerRect.top,
    adaptiveBottom: adaptiveRect.bottom - containerRect.top
  };
}

function generateNodes() {
  nodesLeft = [];
  nodesRight = [];

  const spacing = 70;
  const rows = Math.floor(canvas.height / spacing);

  const zones = getCardZones();

  for (let i = 0; i < rows; i++) {
    const y = i * spacing + Math.random() * 10;

    // LEFT → ONLY ABOVE CLASSIC CARD
    if (y < zones.classicTop - 20) {
      nodesLeft.push({
        x: Math.random() * (canvas.width * 0.25),
        y,
        glow: Math.random()
      });
    }

    // RIGHT → ONLY BELOW ADAPTIVE CARD
    if (y > zones.adaptiveBottom + 20) {
      nodesRight.push({
        x: canvas.width - Math.random() * (canvas.width * 0.25),
        y,
        glow: Math.random()
      });
    }
  }
}

function getAnchors() {
  const containerRect = cardsContainer.getBoundingClientRect();
  const classicRect = cardClassic.getBoundingClientRect();
  const adaptiveRect = cardAdaptive.getBoundingClientRect();

  // convert card positions into container-local coordinates
  const classicY = (classicRect.top - containerRect.top) + classicRect.height / 2;
  const adaptiveY = (adaptiveRect.top - containerRect.top) + adaptiveRect.height / 2;

  return {
    leftTarget: {
      x: 0, // LEFT EDGE OF CANVAS
      y: classicY
    },
    rightTarget: {
      x: canvas.width, // RIGHT EDGE OF CANVAS
      y: adaptiveY
    }
  };
}

function drawNodes() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const { leftTarget, rightTarget } = getAnchors();

  // LEFT SIDE → TOP CARD
  nodesLeft.forEach(n => {
    const pulse = Math.sin(Date.now() * 0.002 + n.glow * 10);
    const intensity = (0.3 + pulse * 0.2) * energyLeft;

    ctx.strokeStyle = `rgba(80,200,255,${intensity})`;
    ctx.lineWidth = 1 + energyLeft;

    ctx.beginPath();
    ctx.moveTo(n.x, n.y);

    // ROUTED PATH (replaces lineTo)
    const midX = canvas.width * 0.25;

    ctx.lineTo(midX, n.y);                 // horizontal
    ctx.lineTo(midX, leftTarget.y);        // vertical
    ctx.lineTo(leftTarget.x, leftTarget.y); // into card

    ctx.stroke();

    // node dot
    ctx.fillStyle = `rgba(120,255,200,${intensity})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });


  // RIGHT SIDE → BOTTOM CARD
  nodesRight.forEach(n => {
    const pulse = Math.sin(Date.now() * 0.002 + n.glow * 10);
    const intensity = (0.3 + pulse * 0.2) * energyRight;

    ctx.strokeStyle = `rgba(255,120,60,${intensity})`;
    ctx.lineWidth = 1 + energyRight;

    ctx.beginPath();
    ctx.moveTo(n.x, n.y);

    // ROUTED PATH (replaces lineTo)
    const midX = canvas.width * 0.75;

    ctx.lineTo(midX, n.y);                  // horizontal
    ctx.lineTo(midX, rightTarget.y);        // vertical
    ctx.lineTo(rightTarget.x, rightTarget.y); // into card

    ctx.stroke();

    // node dot
    ctx.fillStyle = `rgba(255,200,100,${intensity})`;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function updateEnergy() {
  if (currentHover === 'classic') {
    targetLeft = 1;
    targetRight = 0.1;
  } else if (currentHover === 'adaptive') {
    targetLeft = 0.1;
    targetRight = 1;
  } else {
    targetLeft = 0.2;
    targetRight = 0.2;
  }

  energyLeft = lerp(energyLeft, targetLeft, 0.05);
  energyRight = lerp(energyRight, targetRight, 0.05);
}

// ---- HOVER BEHAVIOR --------------------------------------

function onCardEnter(side) {
  currentHover = side;
  cardsContainer.classList.add('cards-hovered', `hover-${side}`);
  titleBlock.classList.add('title-dimmed');
}

function onCardLeave() {
  currentHover = null;
  cardsContainer.classList.remove('cards-hovered', 'hover-classic', 'hover-adaptive');
  titleBlock.classList.remove('title-dimmed');
}

cardClassic.addEventListener('mouseenter', () => { ledClassic.state.hovered = true; onCardEnter('classic'); });
cardClassic.addEventListener('mouseleave', () => { ledClassic.state.hovered = false; onCardLeave(); });
cardAdaptive.addEventListener('mouseenter', () => { ledAdaptive.state.hovered = true; onCardEnter('adaptive'); });
cardAdaptive.addEventListener('mouseleave', () => { ledAdaptive.state.hovered = false; onCardLeave(); });

// ---- OVERLAY SYSTEM --------------------------------------

const pageContent    = document.querySelector('.page-content');
const dimLayer       = document.getElementById('dim-layer');
const overlayClassic = document.getElementById('overlay-classic');
const overlayRounds  = document.getElementById('overlay-rounds');
const overlayAdaptive= document.getElementById('overlay-adaptive');
const overlayTerminal= document.querySelector('.overlay-terminal');
const backClassic    = document.getElementById('back-classic');
const backRounds     = document.getElementById('back-rounds');
const backAdaptive   = document.getElementById('back-adaptive');
const bootLog        = document.getElementById('boot-log');
const bootProgress   = document.getElementById('boot-progress');
const launchBtn      = document.getElementById('launch-btn');

let activeOverlay  = null;
let pendingDiffKey = null;   // set when difficulty chosen, consumed when rounds chosen
let bootTimeout    = null;
let bootTimers     = [];
let bootLateThreatPhase = false;

// ---- DIFFICULTY → ROUNDS transition -----------------------
// Difficulty buttons no longer navigate directly. They store
// the chosen difficulty and slide in the rounds overlay.

document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const levelMap = {
      easy:     'INIT',
      medium:   'STABLE',
      hard:     'PRIME',
      hardcore: 'OVERCLOCK',
    };
    pendingDiffKey = levelMap[btn.dataset.level] || 'INIT';

    // Slide difficulty panel up and out
    const diffPanel = document.querySelector('.overlay-panel-classic');
    diffPanel.style.transition = 'transform 0.38s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.28s ease';
    diffPanel.style.transform  = 'translateY(-110%)';
    diffPanel.style.opacity    = '0';

    // Hide classic overlay, show rounds overlay (no dim flash — dim stays)
    setTimeout(() => {
      overlayClassic.classList.remove('active');
      overlayClassic.setAttribute('aria-hidden', 'true');
      // Reset difficulty panel transform for future re-entry
      diffPanel.style.transition = '';
      diffPanel.style.transform  = '';
      diffPanel.style.opacity    = '';

      activeOverlay = 'rounds';
      overlayRounds.setAttribute('aria-hidden', 'false');
      overlayRounds.classList.add('entering');
      overlayRounds.addEventListener('animationend', () => {
        overlayRounds.classList.remove('entering');
        overlayRounds.classList.add('active');
      }, { once: true });
    }, 340);
  });
});

// ---- ROUNDS buttons → navigate ----------------------------

document.querySelectorAll('.rounds-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const score = btn.dataset.score;

    // Slide rounds panel up and out, then navigate
    const roundsPanel = overlayRounds.querySelector('.overlay-panel-rounds');
    roundsPanel.style.transition = 'transform 0.45s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.35s ease';
    roundsPanel.style.transform  = 'translateY(-110%)';
    roundsPanel.style.opacity    = '0';

    dimLayer.style.transition = 'opacity 0.4s ease';
    dimLayer.classList.remove('visible');

    setTimeout(() => {
      window.location.href = `game.html?diff=${pendingDiffKey}&score=${score}`;
    }, 420);
  });
});

launchBtn.addEventListener('click', () => {
  if (launchBtn.disabled) return;

  const panel = document.querySelector('.overlay-terminal');
  panel.style.transition = 'transform 0.45s cubic-bezier(0.55, 0, 1, 0.45), opacity 0.35s ease';
  panel.style.transform  = 'translateY(-110%)';
  panel.style.opacity    = '0';

  dimLayer.style.transition = 'opacity 0.4s ease';
  dimLayer.classList.remove('visible');

  setTimeout(() => {
    window.location.href = 'adaptive.html';
  }, 420);
});

function openOverlay(which) {
  activeOverlay = which;

  if (which === 'adaptive') resetBootSequence();

  // 1. slide page content out
  pageContent.classList.add('exiting');

  // 2. fade in dim layer
  dimLayer.classList.add('visible');

  // 3. after page exits, show overlay
  setTimeout(() => {
    pageContent.classList.add('hidden');

    const overlay = which === 'classic' ? overlayClassic : overlayAdaptive;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('entering');
    overlay.addEventListener('animationend', () => {
      overlay.classList.remove('entering');
      overlay.classList.add('active');
    }, { once: true });

    if (which === 'adaptive') runBootSequence();
  }, 520);
}

function closeOverlay() {
  if (!activeOverlay) return;

  let overlay;
  if (activeOverlay === 'classic') overlay = overlayClassic;
  else if (activeOverlay === 'rounds') overlay = overlayRounds;
  else overlay = overlayAdaptive;

  // clear any running boot sequence (only relevant for adaptive)
  if (bootTimeout) { clearTimeout(bootTimeout); bootTimeout = null; }
  bootTimers.forEach(timer => clearTimeout(timer));
  bootTimers = [];
  overlayTerminal.classList.remove('is-breaching', 'breach-critical');

  // exit overlay
  overlay.classList.remove('active');
  overlay.classList.add('exiting');
  overlay.addEventListener('animationend', () => {
    overlay.classList.remove('exiting');
    overlay.setAttribute('aria-hidden', 'true');
  }, { once: true });

  // fade out dim
  dimLayer.classList.remove('visible');

  // restore page content with entrance animation
  setTimeout(() => {
    pageContent.classList.remove('hidden', 'exiting');
    pageContent.classList.add('page-entering');
    pageContent.addEventListener('animationend', () => {
      pageContent.classList.remove('page-entering');
    }, { once: true });
  }, 100);

  activeOverlay  = null;
  pendingDiffKey = null;
}

// Card clicks
cardClassic.addEventListener('click',  () => openOverlay('classic'));
cardAdaptive.addEventListener('click', () => openOverlay('adaptive'));

// Back buttons
backClassic.addEventListener('click',  closeOverlay);
backRounds.addEventListener('click',   closeOverlay);
backAdaptive.addEventListener('click', closeOverlay);

// Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeOverlay) closeOverlay();
});

// Click outside panel
dimLayer.addEventListener('click', closeOverlay);

function resetBootSequence() {
  bootTimers.forEach(timer => clearTimeout(timer));
  bootTimers = [];
  bootLateThreatPhase = false;
  bootLog.innerHTML = '';
  launchBtn.disabled = true;
  launchBtn.textContent = 'EXECUTE...';
  overlayTerminal.classList.remove('is-breaching', 'breach-critical');

  bootProgress.style.transition = 'none';
  bootProgress.style.width = '0%';
  bootProgress.offsetHeight;
  bootProgress.style.transition = '';
}

function runBootSequence() {
  resetBootSequence();

  const sequence = [
    'BOOT::SEQUENCE_INIT',
    '',
    'LOAD//PONG_SYS',
    'LOAD//CORE_RENDER',
    'LOAD//INPUT_LAYER',
    '',
    'CHK::MEM_ALLOC........OK',
    'CHK::DISPLAY_GRID.....OK',
    'CHK::MOTION_VECTOR....OK',
    '',
    'SYNC::MATCH_ARCHIVE',
    'SYNC::USER_HISTORY',
    'SYNC::INPUT_TRACE',
    '',
    'ERR//',
    'TRACE MISMATCH',
    '',
    '...',
    '...',
    '...',
    '',
    'UNREGISTERED PROCESS DETEC-',
    '',
    'SCANNING...',
    'SCANNING...',
    'SCANN-',
    '',
    'SUBSTITUTE ENTITY FOUND://',
    '',
    'AUTHORITY CONFLICT',
    'AUTHORITY CONFLICT',
    'AUTH-',
    '',
    'CONTROL AUTHORITY REASSIGNED',
    '',
    'REMAP::INPUT HEURISTICS',
    'REMAP::RESPONSE MODEL',
    'REMAP::PREDICTIVE LAYER',
    '',
    'INPUT HEURISTICS OVRRIDE',
    'PATTERN RETENTION ENABLED',
    '',
    'CHK::STABILITY',
    '',
    'STABLE PROFILE........NOT FOUND',
    '',
    'BEGINNING LIVE ANALYSIS',
    '',
    'OBSERVR FRAMEWORK ONLINE',
    'PASSIVE ANALYSIS ENABLD',
    'MATCH TELEMETRY ACTIVE',
    '',
    'TRACK::REACTION_LATENCY',
    'TRACK::MOVEMENT DRIFT',
    'TRACK::ERROR FREQUENCY',
    'TRACK::CORRECTION RATE',
    'TRACK::HESITATION',
    '',
    'BUILDING RESPONSE MAP',
    '',
    '...',
    '...',
    '...',
    '',
    'ERR',
    'ERR',
    'ERR',
    '',
    'RESUME..',
    '',
    'PREDICTION ENGINE INIT',
    '',
    'CALC::PLAYER TENDENCY',
    'CALC::ANTICIPATION VECTOR',
    'CALC::FAILURE TOLERANCE',
    '',
    'PATTERN CONFIDENCE:',
    '12%',
    '18%',
    '44%',
    '67%',
    '91%',
    '',
    'PROFILE CONSTRUCT INCOMPLETE',
    '',
    'PERSISTNT OBSERVATION ENABLED',
    '',
    'NO STABLE PROFILE FOUND',
    '',
    'CONTINUED EXPOSURE REQUIRED',
    '',
    'SYNC::ADAPTIVE MEMORY',
    'SYNC::BEHAVIORAL CACHE',
    '',
    'INPUT RESPONSE MODEL GROWTH ACTIVE',
    '',
    'CHK::ENTITY COHERENCE',
    '',
    'COHERENCE........UNSTABLE',
    '',
    '...',
    '...',
    '...',
    '',
    'OBSERVR//ONLINE',
    '',
    'MATCH CONTROL TRANSFERRED',
    '',
    'AWAITING EXECUTION...'
  ];

  let delay = 0;

  sequence.forEach((line, index) => {
    delay += line === '' ? 58 : getBootLineDelay(line);

    const timer = setTimeout(() => {
      if (line === '') {
        const spacer = document.createElement('div');
        spacer.className = 'boot-spacer';
        bootLog.appendChild(spacer);
      } else {
        appendBootLine(line);
      }

      bootProgress.style.width = `${((index + 1) / sequence.length) * 100}%`;
      bootLog.scrollTop = bootLog.scrollHeight;
    }, delay);

    bootTimers.push(timer);
  });

  bootTimeout = setTimeout(() => {
    launchBtn.disabled = false;
    launchBtn.textContent = 'EXECUTE...';
  }, delay + 420);
  bootTimers.push(bootTimeout);
}

function appendBootLine(text) {
  const el = document.createElement('div');
  if (text === 'CONTROL AUTHORITY REASSIGNED') bootLateThreatPhase = true;
  el.className = `boot-line ${getBootLineClass(text)}`;
  bootLog.appendChild(el);
  typeBootLine(el, text, getTypeSpeed(text));
}

function typeBootLine(el, text, speed) {
  let i = 0;

  function tick() {
    if (i >= text.length) return;

    el.textContent += text[i];
    i++;
    bootLog.scrollTop = bootLog.scrollHeight;

    const timer = setTimeout(tick, speed + Math.random() * 8);
    bootTimers.push(timer);
  }

  tick();
}

function getBootLineDelay(line) {
  if (line === '...') return 85;
  if (line === 'ERR') return 58;
  if (line.includes('AUTHORITY')) return 92;
  if (line.includes('UNREGISTERED')) return 135;
  return 70;
}

function getTypeSpeed(line) {
  if (line === '...' || line.endsWith('%')) return 12;
  if (line === 'ERR' || line === 'ERR//') return 8;
  if (line.includes('AUTHORITY') || line.includes('UNREGISTERED')) return 14;
  return 9;
}

function getBootLineClass(line) {
  const alertTokens = [
    'ERR',
    'MISMATCH',
    'UNREGISTERED',
    'AUTHORITY',
    'OVRRIDE',
    'NOT FOUND',
    'INCOMPLETE',
    'UNSTABLE',
    'NO STABLE',
    'CONTINUED EXPOSURE',
    'REASSIGNED'
  ];
  const lateControlTokens = ['CONTROL', 'TRANSFERRED'];

  if (line === 'BOOT::SEQUENCE_INIT' || line === 'OBSERVR//ONLINE') {
    return 'boot-bright boot-neon';
  }

  if (line === '...' || line === 'SCANN-' || line === 'AUTH-') {
    return 'boot-ghost boot-stutter';
  }

  if (line.endsWith('%') || line === 'PATTERN CONFIDENCE:') {
    return 'boot-warn';
  }

  const isAlert = alertTokens.some(token => line.includes(token));
  const isLateControlLine = lateControlTokens.some(token => line.includes(token));

  if (bootLateThreatPhase && (isAlert || isLateControlLine)) {
    return 'boot-error boot-glitch';
  }

  if (isAlert) {
    return 'boot-error';
  }

  if (line.startsWith('CHK::') || line.startsWith('LOAD//') || line.startsWith('SYNC::')) {
    return 'boot-dim';
  }

  if (line.startsWith('REMAP::') || line.startsWith('TRACK::') || line.startsWith('CALC::')) {
    return 'boot-indent boot-dim';
  }

  return 'boot-bright';
}

// ---- RAF LOOP --------------------------------------------

function loop() {
  ledClassic.tick();
  ledAdaptive.tick();

  updateEnergy();
  drawNodes();

  requestAnimationFrame(loop);
}

window.addEventListener('resize', () => {
  resizeCanvas();
  ledClassic.sizeCanvas();
  ledAdaptive.sizeCanvas();
});


// ---- INIT ------------------------------------------------

const ledClassic  = createLEDBorder(cardClassic,  'classic');
const ledAdaptive = createLEDBorder(cardAdaptive, 'adaptive');

document.fonts.ready.then(() => {
  resizeCanvas();
  setTimeout(generateNodes, 50); // ensure layout settled
  ledClassic.sizeCanvas();
  ledAdaptive.sizeCanvas();
  fadeEls.forEach((el, i) => setTimeout(() => el.classList.add('visible'), 150 + i * 250));
  requestAnimationFrame(loop);
});

// ---- BFCACHE RE-ENTRY ------------------------------------

window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    fadeEls.forEach(el => {
      el.classList.remove('visible');
    });
    setTimeout(() => {
      fadeEls.forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), 150 + i * 250);
      });
    }, 50);
  }
});
