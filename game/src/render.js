// Drawing only: the state and the current screen in, pixels out. The camera follows
// the player; the world is painted in world units and the HUD in screen units. Sunset
// neon throughout: dusk-purple ground, amber road lines, pink and cyan lights.
//
// Screens: title, play, paused, busted, wasted. The title and the end screens paint
// the city behind their panels, so the game is visible from the first frame.

import { FONT, PALETTE, PARK, ROAD_HALF, ROADS_H, ROADS_V, SAND_Y, WATER_Y, WORLD } from './config.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_OVER = 'over';

function mulberry(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 1280, height: 720, dpr: 1 };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.width = window.innerWidth;
    view.height = window.innerHeight;
    canvas.width = Math.round(view.width * dpr);
    canvas.height = Math.round(view.height * dpr);
  }

  function text(value, x, y, size, color, align, weight) {
    ctx.font = `${weight ? `${weight} ` : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  function drawWorld(state) {
    const cam = state.camera;
    const x0 = cam.x - view.width / 2;
    const y0 = cam.y - view.height / 2;
    ctx.save();
    ctx.translate(-x0, -y0);

    // Ground, sea and sand.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(x0, y0, view.width, view.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(x0, WATER_Y, view.width, view.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let y = WATER_Y + 14; y < y0 + view.height; y += 46) {
      ctx.fillRect(x0, y, view.width, 3);
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(x0, SAND_Y, view.width, WATER_Y - SAND_Y);

    // Park grass and trees.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(PARK.x, PARK.y, PARK.width, PARK.height);
    ctx.fillStyle = PALETTE.grassDark;
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.arc(PARK.x + 60 + i * 58, PARK.y + 70 + (i % 3) * 160, 34, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const tree of state.city.trees) {
      ctx.fillStyle = PALETTE.parkTreeDark;
      ctx.beginPath();
      ctx.arc(tree.x + 2, tree.y + 3, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.parkTree;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const palm of state.city.palms) {
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y + 8);
      ctx.lineTo(palm.x, palm.y - 6);
      ctx.stroke();
      ctx.fillStyle = PALETTE.parkTree;
      ctx.beginPath();
      ctx.arc(palm.x, palm.y - 8, palm.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sidewalks, then asphalt, then the centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const v of ROADS_V) ctx.fillRect(v - ROAD_HALF - 26, y0, 2 * (ROAD_HALF + 26), view.height);
    for (const h of ROADS_H) ctx.fillRect(x0, h - ROAD_HALF - 26, view.width, 2 * (ROAD_HALF + 26));
    ctx.fillStyle = PALETTE.asphalt;
    for (const v of ROADS_V) ctx.fillRect(v - ROAD_HALF, y0, ROAD_HALF * 2, view.height);
    for (const h of ROADS_H) ctx.fillRect(x0, h - ROAD_HALF, view.width, ROAD_HALF * 2);
    ctx.fillStyle = PALETTE.roadLine;
    for (const v of ROADS_V) {
      for (let y = Math.floor(y0 / 44) * 44; y < y0 + view.height; y += 44) ctx.fillRect(v - 2, y, 4, 22);
    }
    for (const h of ROADS_H) {
      for (let x = Math.floor(x0 / 44) * 44; x < x0 + view.width; x += 44) ctx.fillRect(x, h - 2, 22, 4);
    }

    // Buildings: roof, neon edge, lit windows from the building's own seed.
    for (const b of state.city.buildings) {
      if (b.x > x0 + view.width || b.x + b.width < x0 || b.y > y0 + view.height || b.y + b.height < y0) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55;
      ctx.strokeRect(b.x + 1, b.y + 1, b.width - 2, b.height - 2);
      ctx.globalAlpha = 1;
      const rng = mulberry(b.seed);
      const cols = Math.max(1, Math.floor(b.width / 34));
      const rows = Math.max(1, Math.floor(b.height / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          ctx.fillStyle = rng() < 0.45 ? PALETTE.windowLit : PALETTE.windowDark;
          ctx.fillRect(b.x + 10 + c * 34, b.y + 10 + r * 34, 14, 12);
        }
      }
    }

    // Mission target marker: a pulsing ring on the ground.
    const target = state.mission.target;
    if (target) {
      const pulse = 46 + Math.sin(state.time * 4) * 10;
      ctx.strokeStyle = PALETTE.mission;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(target.x, target.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.mission;
      ctx.beginPath();
      ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.mission;
      ctx.fillText(target.label ?? '', target.x, target.y - pulse - 10);
    }

    // Pickups bob on the street.
    for (const pickup of state.pickups) {
      const bob = Math.sin(pickup.bob) * 3;
      ctx.fillStyle = pickup.kind === 'cash' ? PALETTE.cash : pickup.kind === 'health' ? PALETTE.health : PALETTE.armor;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#120a24';
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(pickup.kind === 'cash' ? '$' : pickup.kind === 'health' ? '+' : 'A', pickup.x, pickup.y + bob + 4);
    }

    drawCars(state);
    drawPeds(state);
    drawPlayer(state);
    drawBullets(state);
    drawParticles(state);

    // Aim: a small crosshair at the mouse when the player is armed on foot or driving.
    if (state.aim) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.aim.x, state.aim.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(state.aim.x - 14, state.aim.y);
      ctx.lineTo(state.aim.x - 5, state.aim.y);
      ctx.moveTo(state.aim.x + 5, state.aim.y);
      ctx.lineTo(state.aim.x + 14, state.aim.y);
      ctx.moveTo(state.aim.x, state.aim.y - 14);
      ctx.lineTo(state.aim.x, state.aim.y - 5);
      ctx.moveTo(state.aim.x, state.aim.y + 5);
      ctx.lineTo(state.aim.x, state.aim.y + 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCarShape(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const w = 46;
    const h = 22;
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(18, 10, 36, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -h / 2 + 3, 18, h - 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillRect(w / 2 - 4, -h / 2 + 3, 3, 5);
    ctx.fillRect(w / 2 - 4, h / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff2e4d';
    ctx.fillRect(-w / 2 + 1, -h / 2 + 3, 3, 5);
    ctx.fillRect(-w / 2 + 1, h / 2 - 8, 3, 5);
    ctx.restore();
  }

  function drawCars(state) {
    for (const car of state.cars) {
      const cam = state.camera;
      if (Math.abs(car.x - cam.x) > view.width / 2 + 80 || Math.abs(car.y - cam.y) > view.height / 2 + 80) continue;
      if (car.kind === 'police' && !car.disabled) {
        // Flashing light bar, alternating with the clock.
        const phase = Math.floor(state.time * 6) % 2 === 0;
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = phase ? PALETTE.copLightRed : PALETTE.copLightBlue;
        ctx.beginPath();
        ctx.arc(0, -8, 16, 0, Math.PI * 2);
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      drawCarShape(car);
      if (car.kind === 'police' && !car.disabled) {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = Math.floor(state.time * 6) % 2 === 0 ? PALETTE.copLightRed : PALETTE.copLightBlue;
        ctx.fillRect(-4, -9, 8, 5);
        ctx.restore();
      }
      if (car.kind === 'target') {
        ctx.strokeStyle = PALETTE.target;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(car.x, car.y, 36 + Math.sin(state.time * 5) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (car.disabled) {
        ctx.fillStyle = 'rgba(136, 136, 136, 0.5)';
        ctx.beginPath();
        ctx.arc(car.x - 10, car.y - 12, 10 + Math.sin(state.time * 3) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (car.health < (car.kind === 'police' ? 55 : 40) && !car.disabled) {
        // Health pips above a damaged car.
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(car.x - 20, car.y - 34, 40, 5);
        ctx.fillStyle = car.health > 20 ? '#37e08b' : '#ff2e4d';
        ctx.fillRect(car.x - 20, car.y - 34, 40 * Math.max(0, car.health / 55), 5);
      }
    }
  }

  function drawPeds(state) {
    for (const ped of state.peds) {
      const cam = state.camera;
      if (Math.abs(ped.x - cam.x) > view.width / 2 + 40 || Math.abs(ped.y - cam.y) > view.height / 2 + 40) continue;
      if (ped.down > 0) {
        // Flat on the ground.
        ctx.fillStyle = ped.color;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(18, 10, 36, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ped.x, ped.y);
      ctx.lineTo(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12);
      ctx.stroke();
    }
  }

  function drawPlayer(state) {
    const { player } = state;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    if (player.onFoot) {
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.playerDark;
      ctx.beginPath();
      ctx.arc(7, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      // The gun points where the player aims.
      ctx.strokeStyle = '#e8e4f2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
    }
    ctx.restore();
    if (player.onFoot) {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawBullets(state) {
    ctx.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const lineHeight = 30;
    const height = 170 + lines.length * lineHeight;
    const x = (view.width - width) / 2;
    const y = (view.height - height) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = accent ?? PALETTE.panelEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, width, height);
    ctx.textBaseline = 'alphabetic';
    text(title, view.width / 2, y + 74, 46, PALETTE.text, 'center', 'bold');
    lines.forEach((line, i) => {
      text(line, view.width / 2, y + 128 + i * lineHeight, 19, PALETTE.muted, 'center');
    });
    text(prompt, view.width / 2, y + height - 34, 21, PALETTE.gold, 'center', 'bold');
  }

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, save) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, view.width, view.height);
    drawWorld(state);
    ctx.textBaseline = 'top';
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'SOLMAR HEAT',
        [
          'An original open-world crime game in Port Solmar.',
          'Steal cars, outrun the law, run four missions for Vera.',
          'WASD move · Shift run · E enter car · Mouse aim, click to shoot',
          'P pause · M mute · progress saves automatically',
          save ? `Save found: $${Math.floor(save.money).toLocaleString('en-US')} · mission ${Math.min(save.missionIndex + 1, 4)} of 4` : 'No save yet — a fresh start on the marina.',
        ],
        save ? 'Press Enter — New Game, or C — Continue' : 'Press Enter or click to start',
      );
      return;
    }
    drawHud(ctx, state, view, state.muted ?? false);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city waits. Your progress is saved.', ''], 'Press P to keep playing', '#00e5ff');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel(
        'BUSTED',
        [`The Port Solmar police took you in. Bail cost $${state.bail ?? 200}.`, 'Your wanted level is clear — for now.'],
        'Press Enter to walk free',
        PALETTE.cop,
      );
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'WASTED',
        [`Port Solmar got the better of you.`, `$${Math.floor(state.player.money).toLocaleString('en-US')} banked · ${state.stats.missionsDone} mission${state.stats.missionsDone === 1 ? '' : 's'} done`],
        'Press Enter to try again',
        PALETTE.danger,
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
