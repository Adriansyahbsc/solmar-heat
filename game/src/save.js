// Saving and loading through localStorage: money, mission progress, the player's
// position and health. The wanted level is never saved — a fresh visit starts clean,
// and a busted player wakes up at the marina with a lighter wallet.

import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    if (!Number.isFinite(data.money) || !Number.isInteger(data.missionIndex)) return null;
    return {
      money: Math.max(0, Math.floor(data.money)),
      missionIndex: Math.max(0, Math.min(4, data.missionIndex)),
      x: Number.isFinite(data.x) ? data.x : null,
      y: Number.isFinite(data.y) ? data.y : null,
      health: Number.isFinite(data.health) ? data.health : 100,
      armor: Number.isFinite(data.armor) ? data.armor : 0,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: Math.floor(state.player.money),
      missionIndex: state.mission.index,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: Math.round(state.player.health),
      armor: Math.round(state.player.armor),
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
