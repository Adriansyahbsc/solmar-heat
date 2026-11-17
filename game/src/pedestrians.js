// Pedestrians: Port Solmar's walkers. They stroll the sidewalks, turning at corners
// and pausing now and then; when something violent happens nearby — a gunshot, a car
// tearing past, a wanted star going up — they run for it, and a knocked-down walker
// stays down a moment before getting up and fleeing.

import { PEDS, ROAD_HALF, SIDEWALK } from './config.js';
import { range } from './random.js';
import { nearestRoadPoint, resolveCircle } from './world.js';

function wander(ped, state, dt) {
  ped.timer -= dt;
  if (ped.timer <= 0) {
    ped.timer = range(state.rng, 2, 7);
    // Pick a fresh heading along the nearest sidewalk, either way along the road.
    const road = nearestRoadPoint(ped.x, ped.y);
    const along = road.axis === 'v' ? Math.PI / 2 : 0;
    ped.angle = along + (state.rng() < 0.5 ? 0 : Math.PI) + range(state.rng, -0.25, 0.25);
    if (state.rng() < 0.25) ped.speed = 0;
    else ped.speed = PEDS.walkSpeed * range(state.rng, 0.7, 1.15);
  }
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  // Sidewalks hug the roads: a walker who drifts off one finds the nearest again.
  const road = nearestRoadPoint(ped.x, ped.y);
  const off = road.axis === 'v' ? Math.abs(ped.x - road.line) : Math.abs(ped.y - road.line);
  if (off > ROAD_HALF + SIDEWALK + 30 || off < ROAD_HALF - 6) {
    const side = road.axis === 'v' ? Math.sign(ped.x - road.line) || 1 : Math.sign(ped.y - road.line) || 1;
    if (road.axis === 'v') ped.x = road.line + side * (ROAD_HALF + SIDEWALK / 2);
    else ped.y = road.line + side * (ROAD_HALF + SIDEWALK / 2);
  }
}

export function stepPedestrians(state, dt) {
  for (const ped of state.peds) {
    if (ped.down > 0) {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.state = 'flee';
        ped.timer = 2.5;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.timer -= dt;
      const dx = ped.x - ped.fleeX;
      const dy = ped.y - ped.fleeY;
      const d = Math.hypot(dx, dy) || 1;
      ped.angle = Math.atan2(dy / d, dx / d);
      ped.speed = PEDS.fleeSpeed;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (ped.timer <= 0) {
        ped.state = 'walk';
        ped.timer = range(state.rng, 1, 4);
        ped.speed = 0;
      }
    } else {
      wander(ped, state, dt);
    }
    resolveCircle(state.city, ped, 12);
  }
}

/** Every walker near (x, y) runs away from it. */
export function scarePedestrians(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.down > 0) continue;
    const dx = ped.x - x;
    const dy = ped.y - y;
    if (dx * dx + dy * dy < radius * radius) {
      ped.state = 'flee';
      ped.fleeX = x;
      ped.fleeY = y;
      ped.timer = 2.5;
    }
  }
}
