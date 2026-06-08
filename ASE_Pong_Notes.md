minimal neon grid aesthetic
the page feels like it's pulsating in low frequency
low neon color gradients "radiating" from left and right of screen
feels like the AI is "controlling" the page
capital lock, subtle distortion effects, syntax strewn about
mode selection should feel like you're choosing a system, not options from a menu
mouse movement for up/down, click to pause
small "Paused" overlay on the screen when paused, just game pauses, screen keeps pulsating.
add practice mode where you play yourself

landing page:

title, subtitle, as well as two cards stacked vertically fade in from top to bottom

when user hovers over top or bottom card, they split (top card slides left, bottom card slides right) and small "nodes" appear (refer to excalidraw)

fluid edges as in neon fluid running through a transparent pipe, or those light bar supports for a GPU, or LED RAM

bottom card = red/orange/yellow fluid edges, caps lock, invalid syntax, glitchy aesthetic, like the AI wrote it in an isolated lab

top card = green/blue fluid edges, more subtle font, less capital letters and syntax but still vaguely "corrupted"

bottom card clicked(ADAPTIVE // LEARNING ENTITY):

takes user to a new page that displays an AI initialization and deployment phase, shows uncanny message identifying new or returning user, and adds a "PROCEED..." button at the bottom

top card clicked(CLASSIC // STATIC OPPONENT):

takes user to new page where difficulties are displayed vertically down the screen, fading in from top to bottom

difficulty cards are grey until user hovers over them, then are updated with specific colors depending on which difficulty they are hovering over (e.g. easy = green, hardcore = red)

when user clicks specific difficulty, the card expands and displays difficulty information for that specific card as well as a "Start" button to initiate the game


***GAME MODE ADDITIONS***
cubic 4 player pong with 3 AI opponents
double-paddle-pong, 2 paddles per side
3D pong


***SETTINGS***
ball shape (square, ball, triangle for now) (updates trail shape, currently cubes getting smaller and smaller, should always match ball shape)
ball color (actual ball, not the trail)
player color (paddles, player hud name and score flash, ready overlay shadow, right side goal pulse, player paddle pulse, player ball trail, player color particles)
ball trail (on/off)
goal pulse (on/off)
ball spin (on/off)
particles (on/off)

*ready overlay*
left click and space both start the game
change countdown to 3 2 1 / currently 3 2 1 0
if space is used to start the game, keyboard controls and regular mouse movement as normal
if left click is used to start the game, enable pointer lock

*pointer lock* (done)
-pointer lock is engaged with click on game canvas
-pointer lock is engaged when user clicks on canvas to start game
-pointer lock is NOT engaged when user presses space to start game, as they did not click canvas
-pointer lock is disengaged when any overlay pops up, (READY?, COUNTDOWN, GAME OVER)
-pointer lock is disengaged when user presses esc (already hardcoded) and keyboard controls are restored
-keyboard controls disables when pointer lock active.
-mouse movement on canvas while pointer lock NOT engaged does NOT move player paddle
-cursor invisible when pointer lock is engaged

*TO DO*
add ball trail color to match last paddle touched (done)
find suitable background animation
add goal pulse effects (done)
adjust hud score flash to match goal pulse colors accordingly (done)
make JUST experimental game mode card (pink/purple)
slow down pointer lock sensitivity
remove/replace current base background
add settings menu using DOM overlay (done)
add "player name" setting with a type box

*goal pulse* (done)
player goal (left) pulses ai difficulty color (diffColor1) when goal is scored
system goal (right) pulses player color (blue) when goal is scored
pulse effect fades in and out smoothly from whichever side got scored on
pulse effect has higher opacity towards the canvas edge, and fades as the color moves inward
pulses should be a fluid motion radiating out from one side of the screen and back depending on which goal is scored on
pulse should look like a gradient coming from one side of the canvas of the corresponding color depending on who scores and on what difficulty

*canvas bg*
very subtle hues on game canvas edges (blue left) (diffColor1 right)
very subtle moving particle effect inside game canvas

*boot sequence*
starts relatively contained/full words, readable code, activating.
progressively becomes less contained and breaking in structure / broken syntax, abbreviated words, more errors and threatening colors, feels like the machine is overwriting the system
the dark oranges and browns are ugly, more neon, attention grabbing colors would work better
some progress bars left incomplete and pulsing, like the machine rejected them
predictable code being overwritten mid-write by the broken machine language
a good amount of errors and failures at the end, a short pause, and an uncanny line at the bottom showing that it's ready
the colors need to be organized, should replace diffColor2 with a library of all adaptive colors used in the landing page game card, boot sequence, and actual game page later on
keep "EXECUTE..." as initialization button

*paddle shatter animation*
0 gravity feel, matching all other animations
shards evenly split across directions
feels like a delayed pulse
pulse comes from wherever the ball passes the goal line (e.g. if ball is above paddle, shards are angled more downward. if ball is below paddle, shards are angles more upward. if ball is directly behind paddle, shards are angled more straight on.)
paddle shouldn't break evenly, should instead look like a structural collapse under the "weight" of the pulse.
shards slowly disperse and fade, similar to collision particle effect.

CHANGE NAME LENGTH TO 3 PLAYER NAME: USR STATIC NAME: SYS ADAPTIVE NAME: OBS

add screen scaling, fix adaptive ai, add smoothing and fix stable and prime, fix overclock jitter

MAKE IT IMPOSSIBLE FOR THE AI OPPONENT TO EVER MISS THE BALL IF THE BALL IS SERVED IN THE AI DIRECTION, 100% HIT RATE ON FIRST HIT UNLESS BALL IS SERVED IN DIRECTION OF PLAYER, THEN FIRST RETURN GOES BACK TO NORMAL RULES