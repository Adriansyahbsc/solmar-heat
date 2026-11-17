// Boot and the one loop: input is read every frame, the game advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, busted and wasted.
//
// ?seed=N fixes the city. ?shot=chase|foot|mission|menu (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for
// a screenshot.

import { STEP } from './config.js';
import { createGame } from './game.js';
import {
  ACTION_CONFIRM,
  ACTION_CONTINUE,
  ACTION_ENTER_CAR,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART_MISSION,
  createInput,
} from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { readSave, writeSave, clearSave } from './save.js';
import { startMission } from './missions.js';
import { clearPolice } from './police.js';
import {
  EVENT_BUSTED,
  EVENT_CAR_DISABLED,
  EVENT_COP_SHOT,
  EVENT_CRASH,
  EVENT_HIT_PED,
  EVENT_MISSION_DONE,
  EVENT_MISSION_FAILED,
  EVENT_MISSION_START,
  EVENT_PICKUP,
  EVENT_SHOT,
  EVENT_WASTED,
} from './world.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
const BAIL = 200;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const game = createGame(seed);
const renderer = createRenderer(canvas);
const audio = createAudio();
game.view = renderer.view;

function runShot(name) {
  const scene = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game.state, scene.screen, readSave());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  game.state.muted = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame(continued) {
    audio.unlock();
    game.newGame(continued ? save : null);
    screen = SCREEN_PLAY;
    announce(continued ? 'Continuing your story in Port Solmar.' : 'Playing SOLMAR HEAT.');
  }

  function endGame(wasted) {
    if (wasted) {
      screen = SCREEN_OVER;
      clearSave();
      announce('Wasted. Press Enter to try again.');
    } else {
      screen = SCREEN_BUSTED;
      const bail = Math.min(BAIL, Math.floor(game.state.player.money));
      game.state.bail = bail;
      game.state.player.money -= bail;
      announce(`Busted. Bail $${bail}. Press Enter to walk free.`);
    }
  }

  function releaseFromBust() {
    audio.unlock();
    clearPolice(game.state);
    const { player } = game.state;
    player.x = 1500;
    player.y = 2050;
    player.angle = -Math.PI / 2;
    if (player.car) {
      player.car.kind = 'parked';
      player.car.driver = false;
      player.car.speed = 0;
      player.car = null;
    }
    player.onFoot = true;
    player.health = Math.max(player.health, 50);
    screen = SCREEN_PLAY;
    announce('Free. The heat is off — for now.');
  }

  // One-shot presses, taken once per frame: screens first, then the step below
  // receives the enter-car bit so it lands in the same frame as the movement keys.
  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      game.state.muted = muted;
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame(false);
      else if (actions & ACTION_CONTINUE && save) startGame(true);
    } else if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        game.newGame(null);
        screen = SCREEN_PLAY;
      }
    } else if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) releaseFromBust();
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        writeSave(game.state);
        announce('Paused. Progress saved.');
      } else if (actions & ACTION_RESTART_MISSION && game.state.mission.started) {
        startMission(game.state, game.state.mission.index);
        announce('Mission restarted.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function readStepInput(enterCar) {
    const move = input.move();
    const mouse = input.mouse();
    let aim = null;
    if (mouse) {
      const cam = game.state.camera;
      aim = {
        x: cam.x - renderer.view.width / 2 + mouse.x,
        y: cam.y - renderer.view.height / 2 + mouse.y,
      };
    }
    game.state.aim = screen === SCREEN_PLAY ? aim : null;
    return {
      move,
      running: input.running(),
      firing: input.firing(),
      aim,
      actions: { enterCar },
    };
  }

  function react(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_COP_SHOT) audio.copShot();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT_PED) announce('A pedestrian is down — the heat is rising.');
    if (events & EVENT_CAR_DISABLED) announce('A cruiser is out of the chase.');
    if (events & EVENT_MISSION_START) audio.missionStart();
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      writeSave(game.state);
      announce('Mission complete.');
    }
    if (events & EVENT_MISSION_FAILED) {
      audio.missionFailed();
      announce('Mission failed — it will restart.');
    }
    if (events & EVENT_BUSTED) {
      audio.bust();
      endGame(false);
    } else if (events & EVENT_WASTED) {
      endGame(true);
    }
  }

  function step(enterCar) {
    const events = game.step(readStepInput(enterCar));
    const { player } = game.state;
    const sirenNear = game.state.cars.some((c) => c.kind === 'police' && !c.disabled && Math.hypot(c.x - player.x, c.y - player.y) < 620)
      || game.state.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 620);
    audio.update(!player.onFoot && Boolean(player.car), player.car ? Math.abs(player.car.speed) / 520 : 0, sirenNear);
    react(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actionsTaken = input.takeActions();
    let actions = actionsTaken;
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(Boolean(actions & ACTION_ENTER_CAR));
        accumulator -= STEP;
        actions &= ~ACTION_ENTER_CAR;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game.state, screen, save);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave(game.state);
      announce('Paused. Progress saved.');
    }
  });

  announce('SOLMAR HEAT. Press Enter or click to start. C continues a saved game.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
