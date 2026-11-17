// The game itself: one state, one step. main.js owns the screens and the frame loop;
// this module owns the rules. A step reads the player's input, moves the player (on
// foot or in a car), runs traffic, pedestrians, police, missions and combat, and
// returns what happened as event flags so the caller can play sounds and announce.
//
// The player drives with W/S for gas and brake and A/D to steer; on foot, WASD moves
// and Shift runs. E climbs into the nearest car — pulling a driver out of a moving
// car, or taking a parked one, is a crime and the wanted level says so.

import { CAR, PLAYER, STEP, WANTED, WORLD, WATER_Y } from './config.js';
import {
  createGameState,
  resolveCircle,
  EVENT_NONE,
  EVENT_CRASH,
  EVENT_HIT_PED,
  EVENT_MISSION_DONE,
  EVENT_WASTED,
} from './world.js';
import { stepTraffic, nearestEnterableCar } from './traffic.js';
import { stepPedestrians, scarePedestrians } from './pedestrians.js';
import { stepPolice, addHeat, clearPolice } from './police.js';
import { stepMissions, startMission, advanceAfterMission, notePoliceCarDisabled } from './missions.js';
import { stepBullets, stepPickups, stepParticles, playerShoot, hurtPlayer, spawnParticles } from './combat.js';

const ENTER_RANGE = 64;
const RAM_DAMAGE = 14;

export function createGame(seed) {
  const state = createGameState(seed);
  return {
    state,
    fireCooldown: 0,
    nextMissionIn: -1,
    /** The viewport size in CSS pixels, set by main.js so the camera can clamp. */
    view: { width: 1280, height: 720 },
    /** Advance one fixed step. `input` is {move, running, firing, aim, actions}. */
    step(input) {
      let events = EVENT_NONE;
      const { player } = state;
      state.time += STEP;

      if (player.hurtCooldown > 0) player.hurtCooldown -= STEP;
      if (this.fireCooldown > 0) this.fireCooldown -= STEP;

      // --- Entering and leaving cars -------------------------------------------
      if (input.actions.enterCar) {
        if (player.onFoot) {
          const car = nearestEnterableCar(state, ENTER_RANGE);
          if (car) {
            const stolen = car.kind === 'traffic' || car.kind === 'parked' || car.kind === 'target';
            if (car.kind === 'traffic' && car.driver) {
              // Yank the driver out onto the sidewalk.
              car.driver = false;
              state.peds.push({
                x: car.x + 40,
                y: car.y + 40,
                angle: 0,
                speed: 0,
                state: 'flee',
                color: '#e8e4f2',
                timer: 3,
                fleeX: car.x,
                fleeY: car.y,
                down: 0,
              });
              scarePedestrians(state, car.x, car.y, 200);
            }
            player.car = car;
            player.onFoot = false;
            car.kind = 'player';
            car.driver = true;
            if (stolen) {
              addHeat(state, WANTED.stealCar);
              state.stats.carsStolen += 1;
            }
          }
        } else if (player.car) {
          const car = player.car;
          car.kind = car === state.mission.targetCar ? 'target' : 'parked';
          car.driver = false;
          car.speed = 0;
          player.car = null;
          player.onFoot = true;
          player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
          player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
          resolveCircle(state.city, player, PLAYER.radius);
          player.angle = car.angle;
        }
      }

      // --- The player ------------------------------------------------------------
      if (player.onFoot) {
        const speed = input.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
        const mx = input.move.x;
        const my = input.move.y;
        const len = Math.hypot(mx, my) || 1;
        player.speed = mx || my ? speed : 0;
        player.moving = Boolean(mx || my);
        if (player.moving) {
          player.angle = Math.atan2(my / len, mx / len);
          player.x += (mx / len) * speed * STEP;
          player.y += (my / len) * speed * STEP;
          resolveCircle(state.city, player, PLAYER.radius);
        }
        if (input.firing && input.aim) {
          const shot = playerShoot(state, input.aim.x, input.aim.y, this.fireCooldown);
          if (shot) this.fireCooldown = 0.16;
          events |= shot;
        }
      } else if (player.car) {
        const car = player.car;
        if (car.disabled) {
          car.speed = Math.max(0, car.speed - 300 * STEP);
        } else {
          const throttle = input.move.y < 0 ? 1 : input.move.y > 0 ? -0.6 : 0;
          const steer = input.move.x;
          if (throttle > 0) car.speed = Math.min(CAR.topSpeed, car.speed + CAR.accel * STEP);
          else if (throttle < 0) {
            car.speed = car.speed > 0 ? Math.max(0, car.speed - CAR.brake * STEP) : Math.max(-CAR.reverseTop, car.speed - CAR.accel * 0.6 * STEP);
          } else {
            car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * STEP);
          }
          car.angle += steer * CAR.steerRate * STEP * Math.min(1, Math.abs(car.speed) / 160 + 0.2) * Math.sign(car.speed || 1);
          if (input.firing && input.aim) {
            const shot = playerShoot(state, input.aim.x, input.aim.y, this.fireCooldown);
            if (shot) this.fireCooldown = 0.16;
            events |= shot;
          }
        }
        car.x += Math.cos(car.angle) * car.speed * STEP;
        car.y += Math.sin(car.angle) * car.speed * STEP;
        const crashed = resolveCircle(state.city, car, CAR.radius - 4);
        if (crashed && Math.abs(car.speed) > 180) {
          events |= EVENT_CRASH;
          spawnParticles(state, car.x, car.y, '#ffd319', 10, 200, 0.4);
          car.speed *= 0.4;
          if (hurtPlayer(state, 6)) events |= EVENT_WASTED;
        }
        player.x = car.x;
        player.y = car.y;
        player.speed = Math.abs(car.speed);
        player.moving = Math.abs(car.speed) > 5;
      }

      // --- Car-to-car and car-to-pedestrian bumps ---------------------------------
      const driven = player.car;
      if (driven) {
        for (const car of state.cars) {
          if (car === driven || car.disabled) continue;
          const dx = driven.x - car.x;
          const dy = driven.y - car.y;
          const d = Math.hypot(dx, dy);
          if (d >= CAR.radius * 2 - 6) continue;
          const push = (CAR.radius * 2 - 6 - d) / 2 || 1;
          const nx = d > 0.001 ? dx / d : 1;
          const ny = d > 0.001 ? dy / d : 0;
          car.x -= nx * push;
          car.y -= ny * push;
          driven.x += nx * push;
          driven.y += ny * push;
          const impact = Math.abs(driven.speed - car.speed);
          if (impact > 200) {
            events |= EVENT_CRASH;
            spawnParticles(state, (car.x + driven.x) / 2, (car.y + driven.y) / 2, '#ffd319', 8, 180, 0.35);
            if (car.kind === 'police') {
              car.health -= RAM_DAMAGE;
              if (car.health <= 0) {
                car.disabled = true;
                car.smoke = 1;
                addHeat(state, WANTED.disablePoliceCar);
                events |= notePoliceCarDisabled(state);
              }
            }
          }
          driven.speed *= 0.7;
          car.speed *= 0.7;
        }
        for (const ped of state.peds) {
          if (ped.down > 0) continue;
          if (Math.abs(driven.speed) > 120 && Math.hypot(ped.x - player.x, ped.y - player.y) < CAR.radius + 10) {
            ped.down = 3;
            ped.state = 'walk';
            addHeat(state, WANTED.hitPed);
            scarePedestrians(state, ped.x, ped.y, 260);
            spawnParticles(state, ped.x, ped.y, '#ff5e7a', 8, 150, 0.5);
            events |= EVENT_HIT_PED;
          }
        }
      }

      // --- The rest of the city ----------------------------------------------------
      stepTraffic(state, STEP);
      stepPedestrians(state, STEP);
      events |= stepPolice(state, STEP);
      events |= stepBullets(state, STEP);
      events |= stepPickups(state, STEP);
      events |= stepMissions(state, STEP);
      stepParticles(state, STEP);

      if (state.mission.bannerTimer > 0) state.mission.bannerTimer -= STEP;
      if (player.health <= 0) events |= EVENT_WASTED;

      // A finished mission hands over to the next one after the banner is read.
      if (events & EVENT_MISSION_DONE) this.nextMissionIn = 3.5;
      if (this.nextMissionIn > 0) {
        this.nextMissionIn -= STEP;
        if (this.nextMissionIn <= 0) advanceAfterMission(state);
      }

      // The camera trails the player, clamped to the world.
      const view = this.view;
      state.camera.x = Math.max(view.width / 2, Math.min(WORLD.width - view.width / 2, player.x));
      state.camera.y = Math.max(view.height / 2, Math.min(WATER_Y - view.height / 2, player.y));

      return events;
    },
    /** Begin a fresh story from the marina. */
    newGame(save) {
      clearPolice(state);
      const { player } = state;
      player.x = 1500;
      player.y = 2050;
      player.angle = -Math.PI / 2;
      player.speed = 0;
      player.onFoot = true;
      player.health = 100;
      player.armor = 0;
      player.money = save ? save.money : 0;
      player.car = null;
      state.wanted.heat = 0;
      state.wanted.stars = 0;
      state.bust = 0;
      state.bullets = [];
      state.particles = [];
      state.storyDone = false;
      this.nextMissionIn = -1;
      if (save && save.x !== null && save.y !== null) {
        player.x = save.x;
        player.y = save.y;
        player.health = save.health;
        player.armor = save.armor;
      }
      startMission(state, save ? Math.min(save.missionIndex, 3) : 0);
    },
  };
}
