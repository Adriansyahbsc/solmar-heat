// Traffic: ordinary drivers who follow the road grid, and parked cars. A traffic car
// holds a road (axis + centreline), a direction along it and a lane offset; at an
// intersection it sometimes turns onto the crossing road. Cars keep a little distance
// from the car ahead in their lane, and never leave the asphalt.

import { CAR, ROAD_HALF, ROADS_H, ROADS_V, TRAFFIC, WATER_Y, WORLD } from './config.js';
import { range } from './random.js';
import { resolveCircle } from './world.js';

function atIntersection(car) {
  const along = car.axis === 'v' ? car.y : car.x;
  const crossings = car.axis === 'v' ? ROADS_H : ROADS_V;
  for (const line of crossings) {
    if (Math.abs(along - line) < 26) return line;
  }
  return null;
}

function turnOnto(car, crossing, random) {
  if (car.axis === 'v') {
    car.axis = 'h';
    car.line = crossing;
    car.y = crossing;
    car.dir = random() < 0.5 ? 1 : -1;
    car.lane = (random() < 0.5 ? -1 : 1) * 18;
  } else {
    car.axis = 'v';
    car.line = crossing;
    car.x = crossing;
    car.dir = random() < 0.5 ? 1 : -1;
    car.lane = (random() < 0.5 ? -1 : 1) * 18;
  }
}

/** The car ahead in the same lane, if one is close enough to matter. */
function carAhead(state, car) {
  let nearest = null;
  let nearestGap = Infinity;
  for (const other of state.cars) {
    if (other === car || other.kind === 'parked' || other.disabled) continue;
    if (other.axis !== car.axis || other.line !== car.line || other.dir !== car.dir) continue;
    if (Math.sign(other.lane) !== Math.sign(car.lane)) continue;
    const along = car.axis === 'v' ? other.y - car.y : other.x - car.x;
    const gap = along * car.dir;
    if (gap > 0 && gap < nearestGap) {
      nearestGap = gap;
      nearest = other;
    }
  }
  return { car: nearest, gap: nearestGap };
}

export function stepTraffic(state, dt) {
  const { rng } = state;
  for (const car of state.cars) {
    if (car.kind !== 'traffic') continue;
    if (car.disabled) {
      car.speed = Math.max(0, car.speed - 300 * dt);
    } else {
      const ahead = carAhead(state, car);
      let want = car.targetSpeed;
      if (ahead.car && ahead.gap < 70) want = Math.min(want, Math.max(0, ahead.car.speed - 20));
      car.speed += Math.max(-CAR.brake * dt, Math.min(CAR.accel * dt, want - car.speed));
      const crossing = atIntersection(car);
      if (crossing !== null && rng() < TRAFFIC.turnChance * dt * 4) turnOnto(car, crossing, rng);
    }
    const step = car.speed * car.dir * dt;
    if (car.axis === 'v') {
      car.y += step;
      car.x = car.line + car.lane;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y > WATER_Y - 90) { car.y = 90; }
      if (car.y < 80) { car.y = WATER_Y - 100; }
    } else {
      car.x += step;
      car.y = car.line + car.lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x > WORLD.width - 80) { car.x = 80; }
      if (car.x < 80) { car.x = WORLD.width - 90; }
    }
    resolveCircle(state.city, car, CAR.radius - 4);
  }
}

/** The closest car the player could climb into, within reach, or null. */
export function nearestEnterableCar(state, maxDist) {
  const { player } = state;
  let best = null;
  let bestDist = maxDist;
  for (const car of state.cars) {
    if (car.disabled) continue;
    if (car === player.car) continue;
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}
