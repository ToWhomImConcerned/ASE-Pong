/* ============================================================

   STATE.JS — Single source of truth for all game data.

   No logic. No rendering. No event listeners.

   Everything else reads from and writes to this module.

   ============================================================ */





// ================================================================

//  CONFIG — immutable constants

// ================================================================



const CONFIG = {

  TARGET_WIDTH:    960,

  TARGET_HEIGHT:   540,

  ASPECT:          1000 / 580,



  BALL_SIZE:       10,

  BALL_SPEED_INIT: 3.2,

  BALL_SPEED_INC:  0.16,

  BALL_SPEED_MAX:  10,



  PADDLE_W:        13,

  PADDLE_H:        90,

  PADDLE_MARGIN:   36,

  PLAYER_SPEED:    6.2,



  ARENA_INSET:     2,

  ARENA_CORNER:    14,



  MAX_SCORE:       11,

  COUNTDOWN_FROM:  3,

};





// ================================================================

//  ADAPTIVE PROFILE

// ================================================================



const ADAPTIVE_PROFILE = {

  label: '[ OBSERVR ]',

};





// ================================================================

//  GAME PHASE

//

//  Valid values:

//    'ENTERING'   page load animation running

//    'READY'      waiting for player to start

//    'COUNTDOWN'  3-2-1 ticking down

//    'PLAYING'    live

//    'PAUSED'     paused

//    'ROUND_END'  brief pause between points

//    'GAME_OVER'  match finished

// ================================================================



let phase = 'ENTERING';





// ================================================================

//  LIVE GAME STATE

// ================================================================



const state = {

  ball:   { x: 0, y: 0, vx: 0, vy: 0 },

  playerVY: 0,

  playerMouseTarget: 0,

  player: { x: 0, y: 0, w: CONFIG.PADDLE_W, h: CONFIG.PADDLE_H, score: 0, hitPulse: 0 },

  ai:     { x: 0, y: 0, w: CONFIG.PADDLE_W, h: CONFIG.PADDLE_H, score: 0, targetY: 0, hitPulse: 0 },

  speed:  CONFIG.BALL_SPEED_INIT,

  rallyCount: 0,

  particleIntensity: 0,

  ballFade: 0,



  // Canvas overlay data — written by gameplay.js, read by render.js

  countdownValue: 3,

  gameOverResult: null,   // 'OVERRIDDEN' | 'TERMINATED' | null



  // Input mode

  pointerLocked: false,



  // Trail

  lastHit: null,        // 'player' | 'ai' | null

  ballTrail: [],        // array of { x, y, rotation } positions



  pulses: {

    player:  { active: false, t: 0 },  // left side, diffColor1

    ai: { active: false, t: 0 },       // right side, blue

  },



  particles: [],



  // Collision burst particles — spawned by gameplay.js, drawn by render.js

  // Separate from the background debris field so the two pools never interfere.

  collisionParticles: [],

};





// ================================================================

//  INPUT STATE — written by input.js, read by gameplay.js

// ================================================================



const keys = { ArrowUp: false, ArrowDown: false, w: false, s: false };





// ================================================================

//  SETTINGS — written by settings.js, read by render.js

// ================================================================



const settings = {

  playerName:            'USR',       // display name — max 3 chars

  playerColor:           '#ffffff',     // CSS hex — also synced to --color-player

  ballColor:             '#e8e8e8',     // actual ball core color

  ballShape:             'square',      // 'square' | 'circle' | 'triangle'

  ballTrail:             true,

  ballSpin:              true,

  goalPulse:             true,

  backgroundParticles:   true,

  hitParticles:          true,

  paddlePulse:           true,

  paddleShatter:         true,

};





// ================================================================

//  AI MEMORY — persists across rounds; reset on page refresh / restart

// ================================================================



const aiMemory = {

  behavior: {

    reactionDelay:   180,

    missRate:        0.38,

    predictionNoise: 48,

  },

  sessionStats: {

    playerServeZones: [0, 0, 0],

    returnZones:      [0, 0, 0],

    crossCourtCount:  0,

    straightCount:    0,

  },

  qTable: {},

  epsilon: 0.35,

  totalRounds: 0,

};



// Per-rally AI internals — written by ai.js

let aiSmoothedTarget   = null;

let aiApproachStart    = null;

let aiForcedMiss       = false;

let aiMissRolled       = false;

let aiLastQState       = null;

let aiLastQAction      = null;

let aiRecomputeTimer      = 0;

let aiTrajectoryCommitY   = null;

let aiBiasSmoothed        = 0;



// SYL <3 ---------------



let ballRotation = 0;

