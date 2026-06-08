/* ============================================================
   SETTINGS.JS — Settings overlay open/close + all setting logic.
   Reads/writes: settings (state.js), CSS custom properties,
   and applies live changes to render.js via the settings object.
   No game logic. No canvas drawing.
   ============================================================ */

const settingsBtn      = document.getElementById('settings-btn');
const settingsOverlay  = document.getElementById('overlay-settings');
const settingsBack     = document.getElementById('back-settings');
const settingsDimLayer = document.getElementById('dim-layer');

let settingsOpen = false;


// ================================================================
//  OPEN / CLOSE
// ================================================================

function openSettings() {
  if (settingsOpen) return;
  settingsOpen = true;
  settingsDimLayer.classList.add('visible');
  settingsOverlay.setAttribute('aria-hidden', 'false');
  settingsOverlay.classList.add('entering');
  settingsOverlay.addEventListener('animationend', () => {
    settingsOverlay.classList.remove('entering');
    settingsOverlay.classList.add('active');
  }, { once: true });
}

function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  closeAllDropdowns();
  settingsDimLayer.classList.remove('visible');
  settingsOverlay.classList.remove('active');
  settingsOverlay.classList.add('exiting');
  settingsOverlay.addEventListener('animationend', () => {
    settingsOverlay.classList.remove('exiting');
    settingsOverlay.setAttribute('aria-hidden', 'true');
  }, { once: true });
}

settingsBtn.addEventListener('click', openSettings);
settingsBack.addEventListener('click', closeSettings);
settingsDimLayer.addEventListener('click', closeSettings);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && settingsOpen) closeSettings();
});


// ================================================================
//  APPLY HELPERS — each writes to `settings` and does side effects
// ================================================================

function applyPlayerName(name) {
  const val = name.trim().toUpperCase().slice(0, 3) || 'USR';
  settings.playerName = val;
  const hudEl = document.getElementById('hud-player-name');
  if (hudEl) hudEl.textContent = val;
}

function applyPlayerColor(hex) {
  settings.playerColor = hex;
  document.documentElement.style.setProperty('--color-player', hex);
}

function applyBallColor(hex) {
  settings.ballColor = hex;
}

function applyBallShape(shape) {
  settings.ballShape = shape;
}

function applyToggle(key, value) {
  settings[key] = value;
}


// ================================================================
//  DROPDOWN SYSTEM
// ================================================================

let openDropdown = null;

function closeAllDropdowns() {
  document.querySelectorAll('.settings-dropdown.open').forEach(dd => {
    dd.classList.remove('open');
  });
  openDropdown = null;
}

function toggleDropdown(ddEl) {
  const isOpen = ddEl.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen) {
    ddEl.classList.add('open');
    openDropdown = ddEl;
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', e => {
  if (openDropdown && !openDropdown.contains(e.target)) {
    closeAllDropdowns();
  }
});

// ---- PLAYER NAME input ----
(function () {
  const input = document.getElementById('input-player-name');

  input.addEventListener('input', () => {
    applyPlayerName(input.value);
  });

  // On blur with empty field, snap input back to empty so placeholder shows
  input.addEventListener('blur', () => {
    if (input.value.trim() === '') {
      input.value = '';
      applyPlayerName('USR');
    } else {
      input.value = settings.playerName;  // normalize to resolved uppercase
    }
  });
})();

// ---- PLAYER COLOR picker ----
(function () {
  const pick   = document.getElementById('pick-player-color');
  const btn    = document.getElementById('btn-player-color');
  const valEl  = document.getElementById('val-player-color');
  const swatch = document.getElementById('swatch-player');

  btn.addEventListener('click', () => pick.click());

  pick.addEventListener('input', () => {
    const hex = pick.value;
    applyPlayerColor(hex);
    swatch.style.background = hex;
    valEl.textContent = hex.toUpperCase();
  });
})();

// ---- BALL COLOR picker ----
(function () {
  const pick   = document.getElementById('pick-ball-color');
  const btn    = document.getElementById('btn-ball-color');
  const valEl  = document.getElementById('val-ball-color');
  const swatch = document.getElementById('swatch-ball');

  btn.addEventListener('click', () => pick.click());

  pick.addEventListener('input', () => {
    const hex = pick.value;
    applyBallColor(hex);
    swatch.style.background = hex;
    valEl.textContent = hex.toUpperCase();
  });
})();

// ---- BALL SHAPE dropdown ----
(function () {
  const dd    = document.getElementById('dd-ball-shape');
  const valEl = document.getElementById('val-ball-shape');
  const btn   = dd.querySelector('.settings-dd-btn');

  btn.addEventListener('click', e => { e.stopPropagation(); toggleDropdown(dd); });

  dd.querySelectorAll('.settings-dd-item').forEach(item => {
    item.addEventListener('click', () => {
      const shape = item.dataset.value;
      const label = item.dataset.label;
      applyBallShape(shape);
      valEl.textContent = label;
      dd.querySelectorAll('.settings-dd-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      closeAllDropdowns();
    });
  });
  dd.querySelector('[data-value="square"]').classList.add('active');
})();


// ================================================================
//  TOGGLE SYSTEM
// ================================================================

function initToggle(btnId, settingKey, applyFn) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', () => {
    const next = !settings[settingKey];
    applyFn(settingKey, next);
    btn.classList.toggle('active', next);
  });
}

initToggle('toggle-ball-trail',          'ballTrail',          applyToggle);
initToggle('toggle-ball-spin',           'ballSpin',           applyToggle);
initToggle('toggle-goal-pulse',          'goalPulse',          applyToggle);
initToggle('toggle-background-particles','backgroundParticles',applyToggle);
initToggle('toggle-hit-particles',       'hitParticles',       applyToggle);
initToggle('toggle-paddle-pulse',        'paddlePulse',        applyToggle);
initToggle('toggle-paddle-shatter',      'paddleShatter',      applyToggle);

// ================================================================
//  RESET
// ================================================================

const DEFAULTS = {
  playerName:            'USR',
  playerColor:           '#ffffff',
  ballColor:             '#e8e8e8',
  ballShape:             'square',
  ballTrail:             true,
  ballSpin:              true,
  goalPulse:             true,
  backgroundParticles:   true,
  hitParticles:          true,
  paddlePulse:           true,
  paddleShatter:         true,
};

document.getElementById('settings-reset').addEventListener('click', () => {
  // Name
  applyPlayerName(DEFAULTS.playerName);
  document.getElementById('input-player-name').value = '';  // let placeholder show default

  // Colors
  applyPlayerColor(DEFAULTS.playerColor);
  document.getElementById('pick-player-color').value    = DEFAULTS.playerColor;
  document.getElementById('swatch-player').style.background = DEFAULTS.playerColor;
  document.getElementById('val-player-color').textContent   = DEFAULTS.playerColor.toUpperCase();

  applyBallColor(DEFAULTS.ballColor);
  document.getElementById('pick-ball-color').value    = DEFAULTS.ballColor;
  document.getElementById('swatch-ball').style.background = DEFAULTS.ballColor;
  document.getElementById('val-ball-color').textContent   = DEFAULTS.ballColor.toUpperCase();

  // Shape
  applyBallShape(DEFAULTS.ballShape);
  document.getElementById('val-ball-shape').textContent = 'SQUARE';
  document.querySelectorAll('#dd-ball-shape .settings-dd-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === DEFAULTS.ballShape);
  });

  // Toggles
  [
    'ballTrail',
    'ballSpin',
    'goalPulse',
    'backgroundParticles',
    'hitParticles',
    'paddlePulse',
    'paddleShatter'
  ].forEach(key => {
    applyToggle(key, DEFAULTS[key]);
  });
  document.getElementById('toggle-ball-trail')
    .classList.toggle('active', DEFAULTS.ballTrail);

  document.getElementById('toggle-ball-spin')
    .classList.toggle('active', DEFAULTS.ballSpin);

  document.getElementById('toggle-goal-pulse')
    .classList.toggle('active', DEFAULTS.goalPulse);

  document.getElementById('toggle-background-particles')
    .classList.toggle('active', DEFAULTS.backgroundParticles);

  document.getElementById('toggle-hit-particles')
    .classList.toggle('active', DEFAULTS.hitParticles);

  document.getElementById('toggle-paddle-pulse')
    .classList.toggle('active', DEFAULTS.paddlePulse);

  document.getElementById('toggle-paddle-shatter')
    .classList.toggle('active', DEFAULTS.paddleShatter);
});

applyPlayerColor(settings.playerColor);