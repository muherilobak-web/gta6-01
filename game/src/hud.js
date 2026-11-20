// Vice Point — the HUD: health/armor bars, cash, wanted stars, weapon and
// ammo, objective banner, speedometer, mission cards, toasts, pause/title
// screens, and the live canvas minimap with blips for the player, the
// objective, police, traffic, enemies and packages.
import { WORLD } from './config.js';

export function makeHud() {
  const el = (id) => document.getElementById(id);
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  let mapZoomed = false;
  let toastTimer = null;
  let cardTimer = null;

  function drawMinimap(data) {
    const size = minimap.width;
    const half = WORLD.halfWidth;
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.fillStyle = '#10151d';
    mapCtx.fillRect(0, 0, size, size);
    const scale = size / (half * 2);
    const toMap = (x, z) => [size / 2 + x * scale, size / 2 + z * scale];
    // Water: sea on the west, canal band, marina basin.
    mapCtx.fillStyle = '#2f7fa8';
    mapCtx.fillRect(0, 0, size * 0.06, size);
    const canalY = size / 2 + WORLD.canalZ * scale;
    mapCtx.fillRect(0, canalY - 3, size, 6);
    mapCtx.fillRect(size * 0.88, size * 0.84, size * 0.12, size * 0.16);
    // Streets as a grid.
    mapCtx.strokeStyle = 'rgba(255,255,255,0.28)';
    mapCtx.lineWidth = 4;
    for (const line of WORLD.streetLines) {
      const [px] = toMap(line, 0);
      mapCtx.beginPath();
      mapCtx.moveTo(px, 0);
      mapCtx.lineTo(px, size);
      mapCtx.stroke();
      const [, pz] = toMap(0, line);
      mapCtx.beginPath();
      mapCtx.moveTo(0, pz);
      mapCtx.lineTo(size, pz);
      mapCtx.stroke();
    }
    function dot(x, z, colour, radius) {
      const [mx, my] = toMap(x, z);
      mapCtx.fillStyle = colour;
      mapCtx.beginPath();
      mapCtx.arc(mx, my, radius, 0, Math.PI * 2);
      mapCtx.fill();
    }
    for (const p of data.packages || []) dot(p.x, p.z, '#ffd23f', 2);
    for (const c of data.cars || []) dot(c.x, c.z, '#9aa5b1', 2.5);
    for (const e of data.enemies || []) dot(e.x, e.z, '#ff5a4a', 3);
    for (const p of data.police || []) dot(p.x, p.z, '#2266ff', 3.5);
    if (data.objective) {
      const [ox, oy] = toMap(data.objective.x, data.objective.z);
      mapCtx.fillStyle = '#ffd23f';
      mapCtx.beginPath();
      mapCtx.moveTo(ox, oy - 7);
      mapCtx.lineTo(ox + 6, oy + 5);
      mapCtx.lineTo(ox - 6, oy + 5);
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Player arrow, rotated to the heading.
    const [px, py] = toMap(data.player.x, data.player.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.atan2(Math.sin(data.heading), Math.cos(data.heading)));
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    mapCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    mapCtx.strokeRect(1, 1, size - 2, size - 2);
  }

  return {
    update(state) {
      el('health-fill').style.width = `${Math.max(0, Math.min(100, state.health))}%`;
      el('armor-fill').style.width = `${Math.max(0, Math.min(100, state.armor))}%`;
      el('cash').textContent = `$${Math.floor(state.cash)}`;
      const stars = el('stars');
      stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(WORLD.maxWanted - state.wanted);
      stars.classList.toggle('hot', state.wanted >= 3);
      const hours = 18 + Math.floor(state.time / 3600);
      const minutes = Math.floor((state.time % 3600) / 60);
      const displayHour = ((hours - 1) % 12) + 1;
      el('clock').textContent = `${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours >= 24 || hours < 12 ? 'AM' : 'PM'}`;
      el('weapon').textContent = state.weaponName;
      el('ammo').textContent = state.ammo === Infinity ? '∞' : String(state.ammo);
      const objective = el('objective');
      if (state.objective) {
        objective.style.display = 'block';
        el('objective-text').textContent = state.objective;
      } else {
        objective.style.display = 'none';
      }
      const speedWrap = el('speed-wrap');
      speedWrap.style.display = state.inCar ? 'block' : 'none';
      if (state.inCar) el('speed').textContent = String(Math.round(Math.abs(state.speed) * 3.6));
      minimap.style.width = mapZoomed ? '320px' : '190px';
      minimap.style.height = mapZoomed ? '320px' : '190px';
      drawMinimap(state.minimap);
    },
    setCrosshair(show) {
      el('crosshair').style.display = show ? 'block' : 'none';
    },
    toast(text) {
      const toast = el('toast');
      toast.textContent = text;
      toast.classList.add('show');
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => toast.classList.remove('show'), 3200);
    },
    showCard(title, body) {
      const card = el('mission-card');
      el('mission-card-title').textContent = title;
      el('mission-card-body').textContent = body;
      card.classList.add('show');
      if (cardTimer) window.clearTimeout(cardTimer);
      cardTimer = window.setTimeout(() => card.classList.remove('show'), 4200);
    },
    toggleMapZoom() {
      mapZoomed = !mapZoomed;
    },
    showTitle() {
      el('title-screen').style.display = 'flex';
    },
    hideTitle() {
      el('title-screen').style.display = 'none';
    },
    showPause(show) {
      el('pause-screen').style.display = show ? 'flex' : 'none';
    },
    showOver(title, body) {
      el('over-title').textContent = title;
      el('over-body').textContent = body;
      el('over-screen').style.display = 'flex';
    },
    hideOver() {
      el('over-screen').style.display = 'none';
    },
    setContinueVisible(show) {
      el('btn-continue').style.display = show ? 'block' : 'none';
    },
  };
}
