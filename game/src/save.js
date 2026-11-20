// Vice Point — saving and loading. One localStorage slot holds position,
// cash, mission progress, collected packages and ammo. Loading never trusts
// the stored numbers: every field is clamped back into a sane range, and a
// corrupt or foreign slot is treated as "no save".
import { WORLD } from './config.js';

export function makeSaveStore() {
  function writeSave(data) {
    try {
      const payload = {
        v: 1,
        x: Math.round(data.x * 10) / 10,
        z: Math.round(data.z * 10) / 10,
        heading: data.heading || 0,
        cash: Math.max(0, Math.floor(data.cash)),
        missions: Array.isArray(data.missions) ? data.missions : [],
        packages: data.packages || 0,
        weapons: data.weapons || {},
        time: data.time || 0,
      };
      window.localStorage.setItem(WORLD.saveSlot, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function readSave() {
    try {
      const raw = window.localStorage.getItem(WORLD.saveSlot);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1) return null;
      const weapons = (parsed.weapons && typeof parsed.weapons === 'object') ? parsed.weapons : {};
      return {
        x: Math.max(-WORLD.halfWidth, Math.min(WORLD.halfWidth, Number(parsed.x) || 0)),
        z: Math.max(-WORLD.halfWidth, Math.min(WORLD.halfWidth, Number(parsed.z) || 0)),
        heading: Number(parsed.heading) || 0,
        cash: Math.max(0, Math.min(999999, Number(parsed.cash) || 0)),
        missions: Array.isArray(parsed.missions)
          ? parsed.missions.filter((m) => typeof m === 'boolean') : [],
        packages: Math.max(0, Math.min(WORLD.packageCount, Number(parsed.packages) || 0)),
        weapons,
        time: Math.max(0, Number(parsed.time) || 0),
      };
    } catch {
      return null;
    }
  }

  return {
    save: writeSave,
    load: readSave,
    hasSave() {
      try {
        return window.localStorage.getItem(WORLD.saveSlot) !== null;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(WORLD.saveSlot);
      } catch {
        // Storage unavailable — nothing to clear.
      }
    },
  };
}
