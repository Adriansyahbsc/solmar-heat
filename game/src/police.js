// The law: the wanted system and the police who answer it.
//
// Heat rises with every crime and falls when the player lies low; the star count is
// a step function of heat. Police cruisers spawn on the roads near the player and chase
// — in a car, they steer straight at the player; on foot, they run and shoot. Stand
// still next to a cop for too long and the bust meter fills: BUSTED.

import { CAR, COMBAT, POLICE, WANTED } from './config.js';
import { randomRoadPoint, resolveCircle, EVENT_BUSTED, EVENT_COP_SHOT } from './world.js';

function starsForHeat(heat) {
  let stars = 0;
  for (const threshold of WANTED.thresholds) if (heat >= threshold) stars += 1;
  return stars;
}

export function addHeat(state, amount) {
  state.wanted.heat = Math.min(100, state.wanted.heat + amount);
  state.wanted.stars = starsForHeat(state.wanted.heat);
}

export function setHeat(state, amount) {
  state.wanted.heat = Math.max(0, Math.min(100, amount));
  state.wanted.stars = starsForHeat(state.wanted.heat);
}

function spawnPoliceCar(state) {
  const { player, rng } = state;
  const spot = randomRoadPoint(rng);
  // Spawn on a road a little way from the player so the chase arrives, not appears.
  let x = spot.x;
  let y = spot.y;
  let tries = 0;
  while (Math.hypot(x - player.x, y - player.y) < 500 && tries < 8) {
    const next = randomRoadPoint(rng);
    x = next.x;
    y = next.y;
    tries += 1;
  }
  const car = {
    id: Math.floor(rng() * 1e9),
    kind: 'police',
    x,
    y,
    angle: Math.atan2(player.y - y, player.x - x),
    speed: 0,
    color: '#2456d6',
    driver: true,
    health: CAR.policeHealth,
    disabled: false,
    smoke: 0,
    axis: 'v',
    line: 0,
    dir: 1,
    lane: 0,
    targetSpeed: 0,
  };
  state.cars.push(car);
  return car;
}

function spawnFootCop(state) {
  const { player, rng } = state;
  const angle = rng() * Math.PI * 2;
  const dist = 420;
  const cop = {
    x: player.x + Math.cos(angle) * dist,
    y: player.y + Math.sin(angle) * dist,
    angle: 0,
    speed: 0,
    health: COMBAT.copHealth,
    shootTimer: range01(rng),
    down: false,
  };
  resolveCircle(state.city, cop, 14);
  state.cops.push(cop);
  return cop;
}

function range01(rng) {
  return rng() * 0.6;
}

function stepPoliceCar(state, car, dt) {
  const { player } = state;
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 2.2));
  const top = Math.min(POLICE.carChaseSpeed, 380 + state.wanted.stars * 45);
  car.speed = Math.min(top, car.speed + CAR.accel * dt);
  car.angle += steer * CAR.steerRate * dt * Math.min(1, car.speed / 200 + 0.25);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const crashed = resolveCircle(state.city, car, CAR.radius - 4);
  if (crashed) {
    // Shoved into a wall: back off and swing wide instead of grinding on it.
    car.speed *= 0.45;
    car.angle += (state.rng() < 0.5 ? 1 : -1) * 0.9 * dt * 8;
  }
  if (car.health <= 0 && !car.disabled) {
    car.disabled = true;
    car.smoke = 1;
  }
}

export function stepPolice(state, dt) {
  const { player, wanted } = state;
  let events = 0;

  // Heat cools when the player lies low, faster when no cop is close.
  const copNear = state.cars.some((c) => c.kind === 'police' && !c.disabled && Math.hypot(c.x - player.x, c.y - player.y) < 500)
    || state.cops.some((c) => Math.hypot(c.x - player.x, c.y - player.y) < 500);
  const inHideout = state.mission.index === 3 && state.mission.target
    && Math.hypot(player.x - state.mission.target.x, player.y - state.mission.target.y) < 130;
  const decay = inHideout ? WANTED.decay * 4 : copNear ? WANTED.decayHot : WANTED.decay;
  if (wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - decay * dt);
    wanted.stars = starsForHeat(wanted.heat);
  }

  // Keep the street force matched to the stars.
  const wantCars = Math.min(POLICE.maxCars, wanted.stars * POLICE.carsPerStar);
  const liveCars = state.cars.filter((c) => c.kind === 'police' && !c.disabled);
  for (let i = liveCars.length; i < wantCars; i += 1) spawnPoliceCar(state);
  const wantFoot = wanted.stars >= POLICE.footFromStars ? Math.min(POLICE.maxFoot, wanted.stars - 1) : 0;
  for (let i = state.cops.length; i < wantFoot; i += 1) spawnFootCop(state);

  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    if (car.disabled) {
      car.speed = Math.max(0, car.speed - 320 * dt);
      car.smoke = Math.max(0, car.smoke - dt * 0.15);
      continue;
    }
    stepPoliceCar(state, car, dt);
  }

  // Foot officers run the player down and shoot from range.
  for (const cop of state.cops) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    cop.angle = Math.atan2(dy, dx);
    if (dist > 60) {
      cop.speed = POLICE.footSpeed;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      resolveCircle(state.city, cop, 14);
    } else {
      cop.speed = 0;
    }
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0 && dist < POLICE.shootRange && dist > 40) {
      cop.shootTimer = POLICE.shootInterval * (0.8 + state.rng() * 0.5);
      const aim = cop.angle + (state.rng() - 0.5) * 0.22;
      state.bullets.push({
        x: cop.x + Math.cos(cop.angle) * 18,
        y: cop.y + Math.sin(cop.angle) * 18,
        vx: Math.cos(aim) * COMBAT.bulletSpeed,
        vy: Math.sin(aim) * COMBAT.bulletSpeed,
        life: COMBAT.bulletRange / COMBAT.bulletSpeed,
        friendly: false,
        damage: POLICE.bulletDamage,
      });
      events |= EVENT_COP_SHOT;
    }
  }

  // The bust meter: a cop breathing down a slow player fills it; space empties it.
  const playerSpeed = player.onFoot ? player.speed : Math.abs(player.car ? player.car.speed : 0);
  let pressure = false;
  for (const car of state.cars) {
    if (car.kind === 'police' && !car.disabled && Math.hypot(car.x - player.x, car.y - player.y) < POLICE.bustRange) pressure = true;
  }
  for (const cop of state.cops) {
    if (Math.hypot(cop.x - player.x, cop.y - player.y) < POLICE.bustRange) pressure = true;
  }
  if (pressure && playerSpeed < POLICE.bustSpeed) {
    state.bust = Math.min(1, state.bust + dt / POLICE.bustSeconds);
    if (state.bust >= 1) events |= EVENT_BUSTED;
  } else {
    state.bust = Math.max(0, state.bust - dt * 0.35);
  }
  return events;
}

/** Remove every cop and clear the heat: used after a bust and on a fresh start. */
export function clearPolice(state) {
  state.cars = state.cars.filter((c) => c.kind !== 'police');
  state.cops = [];
  state.bust = 0;
  setHeat(state, 0);
}
