// The screenshot scenes behind ?shot=chase|foot|mission|menu. Each one builds a fresh
// game from the seed, arranges a real situation (a chase, a walk through the city, a
// mission in progress, the title screen), then plays the rules forward for a fixed
// number of steps with a scripted driver, so the frame is what live play looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { setHeat } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Steps the game forward with a fixed scripted input. */
function drive(game, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) game.step(input);
}

const IDLE = { move: { x: 0, y: 0 }, running: false, firing: false, aim: null, actions: {} };

function placePlayerInCar(game, x, y, angle) {
  const { state } = game;
  const car = state.cars.find((c) => c.kind === 'traffic' && !c.disabled);
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 300;
  car.kind = 'player';
  car.driver = true;
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  return car;
}

function centreCamera(state) {
  state.camera.x = Math.max(640, Math.min(3600 - 640, state.player.x));
  state.camera.y = Math.max(360, Math.min(2420 - 360, state.player.y));
}

/** A police chase in a car: wanted 3 stars, cruisers on the tail, objective on the HUD. */
function stageChase(game) {
  const { state } = game;
  game.newGame(null);
  startMission(state, 0);
  state.mission.timer = 58;
  const car = placePlayerInCar(game, 1500, 1480, 0);
  setHeat(state, 52);
  // Two cruisers trailing behind on either side, lights flashing, closing in —
  // and a foot cop ahead for good measure.
  const cruiserSpots = [
    { x: 1500 - 190, y: 1500 - 110 },
    { x: 1500 - 230, y: 1500 + 130 },
  ];
  for (let i = 0; i < 2; i += 1) {
    const spot = cruiserSpots[i];
    const cruiser = {
      id: 9000 + i,
      kind: 'police',
      x: spot.x,
      y: spot.y,
      angle: 0,
      speed: 330,
      color: '#2456d6',
      driver: true,
      health: 55,
      disabled: false,
      smoke: 0,
      axis: 'h',
      line: 1500,
      dir: 1,
      lane: 0,
      targetSpeed: 0,
    };
    state.cars.push(cruiser);
  }
  state.cops.push({ x: 1830, y: 1420, angle: Math.PI, speed: 0, health: 68, shootTimer: 1, down: false });
  state.aim = { x: 1500 + 420, y: 1480 - 60 };
  drive(game, 0.6, { move: { x: 0, y: -1 }, running: false, firing: false, aim: state.aim, actions: {} });
  state.player.car.speed = Math.max(300, state.player.car.speed);
  void car;
  return { screen: SCREEN_PLAY };
}

/** On foot in the city: walkers on the sidewalk, traffic on the road, HUD up. */
function stageFoot(game) {
  const { state } = game;
  game.newGame(null);
  startMission(state, 0);
  state.mission.timer = 64;
  state.player.x = 1470;
  state.player.y = 900;
  state.player.angle = Math.PI / 2;
  state.aim = { x: 1470 + 260, y: 900 + 120 };
  drive(game, 2.2, { move: { x: 0, y: 1 }, running: false, firing: false, aim: state.aim, actions: {} });
  state.player.x = 1470;
  state.player.y = 900 + 120;
  centreCamera(state);
  return { screen: SCREEN_PLAY };
}

/** Mission 2 in progress: the coral cruiser marked, the player closing in on foot. */
function stageMission(game) {
  const { state } = game;
  game.newGame(null);
  startMission(state, 1);
  const cruiser = state.mission.targetCar;
  state.player.x = cruiser.x - 170;
  state.player.y = cruiser.y + 60;
  state.player.angle = Math.atan2(cruiser.y - state.player.y, cruiser.x - state.player.x);
  state.aim = { x: cruiser.x, y: cruiser.y };
  drive(game, 1.2, IDLE);
  state.player.x = cruiser.x - 170;
  state.player.y = cruiser.y + 60;
  return { screen: SCREEN_PLAY };
}

/** The title screen over a living city backdrop. */
function stageMenu(game) {
  const { state } = game;
  game.newGame(null);
  state.player.x = 1500;
  state.player.y = 1500;
  state.camera.x = 1500;
  state.camera.y = 1500;
  drive(game, 5, IDLE);
  state.camera.x = 1500;
  state.camera.y = 1500;
  return { screen: SCREEN_TITLE };
}

/**
 * Set `game` to the named scene (chase, foot, mission or menu; any other name is the
 * menu) and return the screen to draw over it.
 */
export function stageShot(name, game) {
  if (name === 'chase') return stageChase(game);
  if (name === 'foot') return stageFoot(game);
  if (name === 'mission') return stageMission(game);
  return stageMenu(game);
}
