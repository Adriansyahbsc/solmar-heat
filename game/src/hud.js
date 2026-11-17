// The HUD: money, health and armour bars, the wanted stars and the bust meter, the
// mission objective, and the minimap. The minimap is the city shrunk small: roads as
// lines, the player as an arrow, police as blue blips and the mission target as a
// gold diamond. Everything here draws in screen space, after the world.

import { PALETTE, ROADS_H, ROADS_V, WORLD, WATER_Y } from './config.js';

const MAP = { width: 208, height: 148, margin: 16 };
const BAR = { width: 190, height: 12 };

function bar(ctx, x, y, width, height, ratio, fill, back) {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * width, height);
}

function star(ctx, x, y, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? size : size * 0.45;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, state, view) {
  const x0 = view.width - MAP.width - MAP.margin;
  const y0 = view.height - MAP.height - MAP.margin;
  const sx = MAP.width / WORLD.width;
  const sy = MAP.height / WATER_Y;
  ctx.fillStyle = 'rgba(12, 8, 26, 0.85)';
  ctx.fillRect(x0 - 4, y0 - 4, MAP.width + 8, MAP.height + 8);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 4, y0 - 4, MAP.width + 8, MAP.height + 8);

  // Water along the bottom, the park as a green block.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0 + 2300 * sy, MAP.width, MAP.height - 2300 * sy);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0 + 955 * sx, y0 + 955 * sy, 490 * sx, 490 * sy);

  // Roads.
  ctx.strokeStyle = '#5a5470';
  ctx.lineWidth = 2;
  for (const v of ROADS_V) {
    ctx.beginPath();
    ctx.moveTo(x0 + v * sx, y0);
    ctx.lineTo(x0 + v * sx, y0 + MAP.height);
    ctx.stroke();
  }
  for (const h of ROADS_H) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h * sy);
    ctx.lineTo(x0 + MAP.width, y0 + h * sy);
    ctx.stroke();
  }

  const dot = (wx, wy, color, size) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + wx * sx, y0 + wy * sy, size, 0, Math.PI * 2);
    ctx.fill();
  };

  // Mission target first, so the player and police draw over it.
  const target = state.mission.target;
  if (target) {
    const tx = x0 + target.x * sx;
    const ty = y0 + target.y * sy;
    const pulse = 5 + Math.sin(state.time * 5) * 2;
    ctx.fillStyle = PALETTE.mission;
    ctx.beginPath();
    ctx.moveTo(tx, ty - pulse);
    ctx.lineTo(tx + pulse, ty);
    ctx.lineTo(tx, ty + pulse);
    ctx.lineTo(tx - pulse, ty);
    ctx.closePath();
    ctx.fill();
  }
  for (const car of state.cars) {
    if (car.kind === 'police' && !car.disabled) dot(car.x, car.y, '#2e9bff', 3.5);
    else if (car.kind === 'target') dot(car.x, car.y, '#ff6b4a', 4);
  }
  for (const cop of state.cops) dot(cop.x, cop.y, '#7fb2ff', 3);

  // The player: a cyan arrow pointing where they face.
  const px = x0 + state.player.x * sx;
  const py = y0 + state.player.y * sy;
  const angle = state.player.angle;
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(angle) * 8, py + Math.sin(angle) * 8);
  ctx.lineTo(px + Math.cos(angle + 2.5) * 6, py + Math.sin(angle + 2.5) * 6);
  ctx.lineTo(px + Math.cos(angle - 2.5) * 6, py + Math.sin(angle - 2.5) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** The whole HUD for the play screen. `view` is {width, height} in CSS pixels. */
export function drawHud(ctx, state, view, muted) {
  const { player, wanted } = state;
  ctx.textBaseline = 'top';

  // Money, health, armour — top left.
  ctx.font = 'bold 26px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.cash;
  ctx.textAlign = 'left';
  ctx.fillText(`$${Math.floor(player.money).toLocaleString('en-US')}`, 18, 14);
  ctx.font = '13px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('HEALTH', 18, 48);
  bar(ctx, 18, 64, BAR.width, BAR.height, player.health / 100, '#ff5e7a', 'rgba(255,255,255,0.14)');
  ctx.fillText('ARMOUR', 18, 84);
  bar(ctx, 18, 100, BAR.width, BAR.height, player.armor / 100, '#2e9bff', 'rgba(255,255,255,0.14)');

  // Wanted stars — top right, above the minimap.
  for (let i = 0; i < 5; i += 1) {
    star(ctx, view.width - MAP.width - 8 - (4 - i) * 30, 30, 11, i < wanted.stars ? PALETTE.danger : 'rgba(255,255,255,0.16)');
  }
  if (state.bust > 0.02) {
    ctx.font = 'bold 13px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.danger;
    ctx.textAlign = 'right';
    ctx.fillText('BUSTED?', view.width - 18, 48);
    bar(ctx, view.width - MAP.width - 8, 66, MAP.width - 10, 8, state.bust, PALETTE.danger, 'rgba(255,255,255,0.14)');
  }

  // Mission objective — top centre.
  if (state.mission.started && !state.storyDone) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.mission;
    ctx.fillText(state.mission.name, view.width / 2, 12);
    ctx.font = '15px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(state.mission.objective, view.width / 2, 36);
    if (state.mission.timer > 0) {
      ctx.font = 'bold 20px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillStyle = state.mission.timer < 15 ? PALETTE.danger : PALETTE.text;
      ctx.fillText(`${Math.ceil(state.mission.timer)}s`, view.width / 2, 58);
    }
    if (state.mission.index === 2) {
      ctx.font = 'bold 16px "Trebuchet MS", system-ui, sans-serif';
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(`Cruisers disabled: ${state.mission.progress} / ${state.mission.needed}`, view.width / 2, 58);
    }
  } else if (state.storyDone) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.mission;
    ctx.fillText('FREE ROAM — Port Solmar is yours', view.width / 2, 12);
  }

  // Mission banner — centre, fades with its timer.
  if (state.mission.bannerTimer > 0 && state.mission.banner) {
    ctx.globalAlpha = Math.min(1, state.mission.bannerTimer);
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px "Trebuchet MS", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.strokeStyle = 'rgba(18, 10, 36, 0.9)';
    ctx.lineWidth = 5;
    const lines = wrapBanner(ctx, state.mission.banner, view.width - 120);
    lines.forEach((line, i) => {
      const y = view.height * 0.3 + i * 30;
      ctx.strokeText(line, view.width / 2, y);
      ctx.fillText(line, view.width / 2, y);
    });
    ctx.globalAlpha = 1;
  }

  // Context hint — bottom left.
  ctx.textAlign = 'left';
  ctx.font = '14px "Trebuchet MS", system-ui, sans-serif';
  ctx.fillStyle = PALETTE.muted;
  const hint = player.onFoot
    ? 'WASD move · Shift run · E enter car · Click shoot · P pause · M mute'
    : 'W/S gas & brake · A/D steer · E get out · Click shoot · P pause · M mute';
  ctx.fillText(hint, 18, view.height - 26);
  if (muted) {
    ctx.fillStyle = PALETTE.danger;
    ctx.textAlign = 'right';
    ctx.fillText('MUTED', view.width - 18, view.height - 26);
  }

  drawMinimap(ctx, state, view);
}

function wrapBanner(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
