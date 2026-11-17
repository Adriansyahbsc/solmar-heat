// Combat: the player's gun, the bullets it fires, and what they hit. Bullets fly
// straight until they hit a building, a car, a pedestrian, a cop — or the player, when
// a cop fired them. Pickups (cash, health, armour) sit on the street and are collected
// by walking or driving over them. Particles are the sparks, smoke and muzzle flashes.

import { CAR, COMBAT, PICKUPS, PLAYER, WANTED } from './config.js';
import { addHeat } from './police.js';
import { scarePedestrians } from './pedestrians.js';
import { notePoliceCarDisabled } from './missions.js';
import { pointBlocked, EVENT_CAR_DISABLED, EVENT_COP_DOWN, EVENT_COP_SHOT, EVENT_HIT_PED, EVENT_PICKUP, EVENT_SHOT } from './world.js';

export function spawnParticles(state, x, y, color, count, speed, life) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const v = speed * (0.4 + state.rng() * 0.6);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: life * (0.6 + state.rng() * 0.4),
      maxLife: life,
      color,
      size: 2 + state.rng() * 3,
    });
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
}

export function stepParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.4 * dt;
    p.vy *= 1 - 2.4 * dt;
  }
}

/** Fire one bullet from the player toward a world point. Returns an event flag. */
export function playerShoot(state, targetX, targetY, fireCooldown) {
  if (fireCooldown > 0) return 0;
  const { player } = state;
  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const d = Math.hypot(dx, dy) || 1;
  const spread = (state.rng() - 0.5) * 0.05;
  const angle = Math.atan2(dy, dx) + spread;
  state.bullets.push({
    x: player.x + Math.cos(angle) * 22,
    y: player.y + Math.sin(angle) * 22,
    vx: Math.cos(angle) * COMBAT.bulletSpeed,
    vy: Math.sin(angle) * COMBAT.bulletSpeed,
    life: COMBAT.bulletRange / COMBAT.bulletSpeed,
    friendly: true,
    damage: COMBAT.bulletDamage,
  });
  spawnParticles(state, player.x + Math.cos(angle) * 26, player.y + Math.sin(angle) * 26, '#ffe45e', 4, 120, 0.15);
  state.stats.shotsFired += 1;
  addHeat(state, WANTED.shoot);
  scarePedestrians(state, player.x, player.y, 320);
  return EVENT_SHOT;
}

function damageCar(state, car, amount) {
  if (car.disabled) return 0;
  car.health -= amount;
  if (car.health > 0) return 0;
  car.health = 0;
  car.disabled = true;
  car.smoke = 1;
  spawnParticles(state, car.x, car.y, '#ff9f43', 22, 260, 0.8);
  spawnParticles(state, car.x, car.y, '#888', 14, 120, 1.4);
  let events = EVENT_CAR_DISABLED;
  if (car.kind === 'police') {
    addHeat(state, WANTED.disablePoliceCar);
    events |= notePoliceCarDisabled(state);
  }
  return events;
}

function damageCop(state, cop, amount) {
  cop.health -= amount;
  if (cop.health > 0) return 0;
  state.cops = state.cops.filter((c) => c !== cop);
  state.stats.copsDown += 1;
  addHeat(state, WANTED.killCop);
  spawnParticles(state, cop.x, cop.y, '#ff2e4d', 16, 200, 0.7);
  state.pickups.push({ x: cop.x, y: cop.y, kind: 'cash', amount: 100, bob: 0 });
  return EVENT_COP_DOWN;
}

export function stepBullets(state, dt) {
  let events = 0;
  const { player } = state;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && pointBlocked(state.city, b.x, b.y)) {
      spawnParticles(state, b.x, b.y, '#ffd319', 5, 140, 0.25);
      dead = true;
    }
    if (!dead && b.friendly) {
      for (const ped of state.peds) {
        if (ped.down > 0) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 15) {
          ped.down = 3;
          ped.state = 'walk';
          addHeat(state, WANTED.hitPed);
          spawnParticles(state, ped.x, ped.y, '#ff5e7a', 8, 150, 0.5);
          events |= EVENT_HIT_PED;
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.friendly) {
      for (const cop of state.cops) {
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 15) {
          events |= damageCop(state, cop, b.damage);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.friendly) {
      for (const car of state.cars) {
        if (car === player.car) continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < CAR.radius) {
          events |= damageCar(state, car, COMBAT.carBulletDamage);
          spawnParticles(state, b.x, b.y, '#ffe45e', 6, 160, 0.3);
          dead = true;
          break;
        }
      }
    }
    if (!dead && !b.friendly) {
      if (Math.hypot(player.x - b.x, player.y - b.y) < PLAYER.radius + 2) {
        hurtPlayer(state, b.damage);
        events |= EVENT_COP_SHOT;
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
  return events;
}

/** Damage the player, armour soaking 60% first. Returns true when the player dies. */
export function hurtPlayer(state, amount) {
  const { player } = state;
  if (player.hurtCooldown > 0 && amount < 20) return false;
  const soaked = Math.min(player.armor, amount * 0.6);
  player.armor -= soaked;
  player.health -= (amount - soaked);
  player.hurtCooldown = PLAYER.hurtCooldown;
  spawnParticles(state, player.x, player.y, '#ff2e4d', 8, 160, 0.4);
  return player.health <= 0;
}

export function stepPickups(state, dt) {
  let events = 0;
  const { player } = state;
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = state.pickups[i];
    pickup.bob += dt * 3;
    const radius = player.onFoot ? 30 : 44;
    if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < radius) {
      if (pickup.kind === 'cash') {
        player.money += pickup.amount;
        spawnParticles(state, pickup.x, pickup.y, '#37e08b', 10, 140, 0.5);
      } else if (pickup.kind === 'health') {
        player.health = Math.min(PLAYER.maxHealth, player.health + PICKUPS.healthValue);
        spawnParticles(state, pickup.x, pickup.y, '#ff5e7a', 10, 140, 0.5);
      } else {
        player.armor = Math.min(PLAYER.maxArmor, player.armor + PICKUPS.armorValue);
        spawnParticles(state, pickup.x, pickup.y, '#2e9bff', 10, 140, 0.5);
      }
      state.pickups.splice(i, 1);
      events |= EVENT_PICKUP;
    }
  }
  return events;
}
