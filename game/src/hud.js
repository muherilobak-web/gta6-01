// HUD: DOM overlay (cash, health, wanted stars, objective, banners,
// speedometer) plus a live canvas minimap with roads, blips and the
// waypoint marker.

import { ROAD_POSITIONS, WORLD_HALF } from './config.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.root.innerHTML = `
      <div id="hud-top-left">
        <div id="hud-cash">$150</div>
        <div id="hud-stars"></div>
        <div id="hud-health"><div id="hud-health-fill"></div></div>
        <div id="hud-armor"><div id="hud-armor-fill"></div></div>
        <div id="hud-weapon">Fists</div>
      </div>
      <div id="hud-top-right">
        <canvas id="minimap" width="180" height="180"></canvas>
      </div>
      <div id="hud-objective"></div>
      <div id="hud-banner"></div>
      <div id="hud-bottom-right">
        <div id="hud-speed">0</div>
        <div id="hud-speed-label">mph</div>
        <div id="hud-hint"></div>
      </div>
      <div id="hud-progress"><div id="hud-progress-fill"></div></div>
    `;
    this.cashEl = document.getElementById('hud-cash');
    this.starsEl = document.getElementById('hud-stars');
    this.healthFill = document.getElementById('hud-health-fill');
    this.armorFill = document.getElementById('hud-armor-fill');
    this.weaponEl = document.getElementById('hud-weapon');
    this.objectiveEl = document.getElementById('hud-objective');
    this.bannerEl = document.getElementById('hud-banner');
    this.speedEl = document.getElementById('hud-speed');
    this.hintEl = document.getElementById('hud-hint');
    this.progressEl = document.getElementById('hud-progress');
    this.progressFill = document.getElementById('hud-progress-fill');
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.bannerTimer = 0;
  }

  setCash(n) {
    this.cashEl.textContent = `$${Math.floor(n).toLocaleString('en-US')}`;
  }

  setWanted(stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < stars ? '★' : '☆';
    this.starsEl.textContent = s;
    this.starsEl.className = stars > 0 ? 'wanted' : '';
  }

  setHealth(h, armor) {
    this.healthFill.style.width = `${Math.max(0, Math.min(100, h))}%`;
    this.armorFill.style.width = `${Math.max(0, Math.min(100, armor))}%`;
  }

  setWeapon(name, ammo) {
    this.weaponEl.textContent = ammo === undefined ? name : `${name} · ${ammo}`;
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
  }

  banner(text, sub) {
    this.bannerEl.innerHTML = `<div class="banner-title">${text}</div>${sub ? `<div class="banner-sub">${sub}</div>` : ''}`;
    this.bannerEl.classList.add('show');
    this.bannerTimer = 3.2;
  }

  setSpeed(mph, inCar) {
    this.speedEl.textContent = inCar ? String(Math.round(mph)) : '';
  }

  setHint(text) {
    this.hintEl.textContent = text;
  }

  setProgress(frac) {
    if (frac === null || frac === undefined) {
      this.progressEl.style.display = 'none';
      return;
    }
    this.progressEl.style.display = 'block';
    this.progressFill.style.width = `${Math.max(0, Math.min(100, frac * 100))}%`;
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('show');
    }
  }

  drawMinimap(playerPos, heading, waypoint, cars, enemies, packages) {
    const g = this.mapCtx;
    const S = 180;
    const span = WORLD_HALF * 2;
    const px = (v) => ((v + WORLD_HALF) / span) * S;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#10141a';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#1d2f3a';
    g.fillRect(0, 0, px(-180) - px(-210), S);
    g.fillStyle = '#1d2f3a';
    g.fillRect(px(120), px(120), S - px(120), S - px(120));
    g.strokeStyle = '#3a4552';
    g.lineWidth = 4;
    for (const p of ROAD_POSITIONS) {
      g.beginPath();
      g.moveTo(px(p), 0);
      g.lineTo(px(p), S);
      g.stroke();
      g.beginPath();
      g.moveTo(0, px(p));
      g.lineTo(S, px(p));
      g.stroke();
    }
    g.fillStyle = '#e8c020';
    for (const pkg of packages) {
      if (pkg.taken) continue;
      g.fillRect(px(pkg.pos.x) - 1.5, px(pkg.pos.z) - 1.5, 3, 3);
    }
    g.fillStyle = '#ff4a3a';
    for (const e of enemies) {
      g.fillRect(px(e.pos.x) - 2, px(e.pos.z) - 2, 4, 4);
    }
    g.fillStyle = '#ffd98a';
    for (const car of cars) {
      g.fillRect(px(car.pos.x) - 1.5, px(car.pos.z) - 1.5, 3, 3);
    }
    if (waypoint) {
      g.fillStyle = '#ff9a5a';
      g.beginPath();
      g.arc(px(waypoint.x), px(waypoint.z), 5, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.stroke();
    }
    // Player arrow.
    const x = px(playerPos.x);
    const y = px(playerPos.z);
    g.save();
    g.translate(x, y);
    g.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)));
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -6);
    g.lineTo(4.5, 5);
    g.lineTo(-4.5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
}
