// The story chain: four missions, each with a target on the map and a way to finish
// or fail. Missions start one after another; finishing one pays out and starts the
// next, failing one restarts it after a short breather. The HUD reads state.mission
// for the objective line, the timer and the marker.
//
// 1 Sunset Courier — a timed delivery across the city.
// 2 Coral Cruiser — steal one marked car and bring it to Vera's Garage.
// 3 Heat Breaker — disable two police cruisers, by ramming or by shooting.
// 4 Ghost the Heat — reach the park hideout at 3 stars, then lie low till the heat dies.

import { MISSION_DEFS, PARK, POLICE } from './config.js';
import { addHeat, setHeat } from './police.js';
import { EVENT_MISSION_DONE, EVENT_MISSION_FAILED, EVENT_MISSION_START } from './world.js';

const MARINA_DROP = { x: 3180, y: 1960, label: 'Marina Drop' };
const GARAGE = { x: 1500, y: 300, label: "Vera's Garage" };
const HIDEOUT = { x: PARK.x + PARK.width / 2, y: PARK.y + PARK.height / 2, label: 'Park Hideout' };
const CRUISER_SPOT = { x: 918, y: 1450 };

function banner(state, text) {
  state.mission.banner = text;
  state.mission.bannerTimer = 3.2;
}

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  const mission = state.mission;
  mission.index = index;
  mission.name = def.name;
  mission.objective = def.objective;
  mission.timer = def.timeLimit;
  mission.progress = 0;
  mission.needed = index === 2 ? 2 : 0;
  mission.done = false;
  mission.failed = false;
  mission.started = true;
  mission.targetCar = null;

  if (index === 0) {
    mission.target = { ...MARINA_DROP };
  } else if (index === 1) {
    mission.target = { ...GARAGE };
    // The coral convertible, parked where the player can find it.
    const car = {
      id: Math.floor(state.rng() * 1e9),
      kind: 'target',
      x: CRUISER_SPOT.x,
      y: CRUISER_SPOT.y,
      angle: Math.PI / 2,
      speed: 0,
      color: '#ff6b4a',
      driver: false,
      health: 60,
      disabled: false,
      smoke: 0,
      axis: 'v',
      line: 0,
      dir: 1,
      lane: 0,
      targetSpeed: 0,
    };
    state.cars.push(car);
    mission.targetCar = car;
  } else if (index === 2) {
    mission.target = null;
    setHeat(state, 48);
  } else if (index === 3) {
    mission.target = { ...HIDEOUT };
    setHeat(state, 52);
  }
  banner(state, `${def.name} — ${def.objective}`);
  return EVENT_MISSION_START;
}

/** Called when a police cruiser is disabled during mission 3. Returns an event flag. */
export function notePoliceCarDisabled(state) {
  const mission = state.mission;
  if (mission.index !== 2 || mission.done) return 0;
  mission.progress += 1;
  if (mission.progress >= mission.needed) return completeMission(state);
  return 0;
}

function completeMission(state) {
  const mission = state.mission;
  const def = MISSION_DEFS[mission.index];
  state.player.money += def.reward;
  state.stats.missionsDone += 1;
  mission.done = true;
  banner(state, `Mission complete — $${def.reward} banked.`);
  if (mission.index === 1 && mission.targetCar) {
    // Vera keeps the cruiser; take it off the street.
    state.cars = state.cars.filter((c) => c !== mission.targetCar);
    if (state.player.car === mission.targetCar) {
      state.player.car = null;
      state.player.onFoot = true;
    }
    mission.targetCar = null;
  }
  return EVENT_MISSION_DONE;
}

function failMission(state, reason) {
  const mission = state.mission;
  mission.failed = true;
  banner(state, reason);
  return EVENT_MISSION_FAILED;
}

export function stepMissions(state, dt) {
  const mission = state.mission;
  if (!mission.started || mission.done) return 0;
  if (mission.bannerTimer > 0) mission.bannerTimer -= dt;

  // A failed mission restarts itself after the banner has been read.
  if (mission.failed) {
    mission.failTimer = (mission.failTimer ?? 2.6) - dt;
    if (mission.failTimer <= 0) {
      mission.failed = false;
      mission.failTimer = undefined;
      return startMission(state, mission.index);
    }
    return 0;
  }

  const { player } = state;
  if (mission.timer > 0) {
    mission.timer -= dt;
    if (mission.timer <= 0) {
      return failMission(state, 'Out of time — the package is late. Try again.');
    }
  }

  if (mission.index === 0) {
    if (Math.hypot(player.x - MARINA_DROP.x, player.y - MARINA_DROP.y) < 70) return completeMission(state);
  } else if (mission.index === 1) {
    const car = mission.targetCar;
    if (!car) return 0;
    const inGarage = Math.hypot(car.x - GARAGE.x, car.y - GARAGE.y) < 80;
    if (inGarage) {
      if (player.car === car) return completeMission(state);
      // The car is there but the player walked away: point them back to it.
      mission.objective = 'The cruiser is at the garage — get back in it to finish the job.';
    } else if (player.car === car) {
      mission.objective = MISSION_DEFS[1].objective;
    }
  } else if (mission.index === 2) {
    // Progress is counted by notePoliceCarDisabled(); nothing to check here.
    if (state.wanted.stars === 0 && mission.progress < mission.needed) {
      // The heat died before the job was done: stir it back up.
      setHeat(state, 48);
    }
  } else if (mission.index === 3) {
    const atHideout = Math.hypot(player.x - HIDEOUT.x, player.y - HIDEOUT.y) < 130;
    if (atHideout && state.wanted.stars === 0) return completeMission(state);
    if (!atHideout && state.wanted.stars === 0 && mission.progress === 0) {
      return failMission(state, 'The heat died before you reached the hideout. Try again.');
    }
    if (atHideout) mission.progress = 1;
  }
  return 0;
}

/** After the last mission, the story is done and the city is the player's. */
export function advanceAfterMission(state) {
  if (state.mission.index >= MISSION_DEFS.length - 1) {
    state.storyDone = true;
    state.mission.started = false;
    state.mission.index = MISSION_DEFS.length;
    state.mission.name = 'Free Roam';
    state.mission.objective = 'Port Solmar is yours. Steal, drive, and stay out of trouble.';
    state.mission.target = null;
    return;
  }
  startMission(state, state.mission.index + 1);
}
