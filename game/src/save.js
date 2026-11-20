// Save / load through localStorage. A save holds cash, position, mission
// progress, collected packages and the weapon state — enough to Continue
// exactly where the player left off.

import { SAVE_KEY, START_CASH } from './config.js';

export function freshSave() {
  return {
    cash: START_CASH,
    pos: null,
    heading: 0,
    completed: [false, false, false, false, false, false],
    missionIndex: 0,
    packages: [],
    pistolAmmo: 48,
    smgAmmo: 0,
    hasSmg: false,
    armor: 0,
    health: 100,
  };
}

export function writeSave(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.cash !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    /* storage unavailable */
  }
}
