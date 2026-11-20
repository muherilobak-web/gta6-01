// Save and load: one localStorage slot holding the player's position, cash,
// mission progress, collected packages and weapons. Loading never trusts the
// stored numbers — every field is clamped back into range.
import { CFG } from './config.js';

export function createSave() {
  return {
    save(data) {
      try {
        const payload = {
          v: 1,
          x: Math.round(data.x * 10) / 10,
          z: Math.round(data.z * 10) / 10,
          heading: data.heading || 0,
          cash: Math.max(0, Math.floor(data.cash)),
          missions: data.missions || [],
          packages: data.packages || 0,
          weapons: data.weapons || {},
          time: data.time || 0,
        };
        window.localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(payload));
        return true;
      } catch {
        return false;
      }
    },
    load() {
      try {
        const raw = window.localStorage.getItem(CFG.SAVE_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (!d || d.v !== 1) return null;
        return {
          x: Math.max(-CFG.HALF, Math.min(CFG.HALF, Number(d.x) || 0)),
          z: Math.max(-CFG.HALF, Math.min(CFG.HALF, Number(d.z) || 0)),
          heading: Number(d.heading) || 0,
          cash: Math.max(0, Math.min(999999, Number(d.cash) || 0)),
          missions: Array.isArray(d.missions) ? d.missions.filter((m) => typeof m === 'boolean') : [],
          packages: Math.max(0, Math.min(CFG.PACKAGES, Number(d.packages) || 0)),
          weapons: typeof d.weapons === 'object' && d.weapons ? d.weapons : {},
          time: Math.max(0, Number(d.time) || 0),
        };
      } catch {
        return null;
      }
    },
    hasSave() {
      try {
        return window.localStorage.getItem(CFG.SAVE_KEY) !== null;
      } catch {
        return false;
      }
    },
    clear() {
      try { window.localStorage.removeItem(CFG.SAVE_KEY); } catch { /* ignore */ }
    },
  };
}
