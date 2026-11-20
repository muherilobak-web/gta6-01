// The HUD: DOM bars and readouts (health, armor, cash, wanted stars, weapon and
// ammo, speed, objective, clock) plus a live canvas minimap with blips for the
// player, the objective, police, traffic and mission cars. Menus are DOM too.
export function createHud() {
  const $ = (id) => document.getElementById(id);
  const els = {
    healthFill: $('health-fill'),
    armorFill: $('armor-fill'),
    cash: $('cash'),
    stars: $('stars'),
    weapon: $('weapon'),
    ammo: $('ammo'),
    speed: $('speed'),
    speedWrap: $('speed-wrap'),
    objective: $('objective'),
    objectiveText: $('objective-text'),
    clock: $('clock'),
    toast: $('toast'),
    card: $('mission-card'),
    cardTitle: $('mission-card-title'),
    cardBody: $('mission-card-body'),
    title: $('title-screen'),
    pause: $('pause-screen'),
    over: $('over-screen'),
    overTitle: $('over-title'),
    overBody: $('over-body'),
    crosshair: $('crosshair'),
    minimap: $('minimap'),
  };
  const mm = els.minimap.getContext('2d');
  let toastTimer = null;
  let cardTimer = null;
  let mapZoom = 1;

  function starString(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    return s;
  }

  return {
    toggleMapZoom() {
      mapZoom = mapZoom === 1 ? 2 : 1;
      return mapZoom;
    },
    update(state) {
      // state: {health, armor, cash, wanted, weaponName, ammo, speed, inCar,
      //         objective, time, minimap:{player, heading, objective, police, cars, enemies, packages}}
      els.healthFill.style.width = `${Math.max(0, state.health)}%`;
      els.armorFill.style.width = `${Math.max(0, state.armor)}%`;
      els.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
      els.stars.textContent = starString(state.wanted);
      els.stars.classList.toggle('hot', state.wanted > 0);
      els.weapon.textContent = state.weaponName;
      els.ammo.textContent = state.ammo === Infinity ? '∞' : String(state.ammo);
      els.speedWrap.style.display = state.inCar ? 'block' : 'none';
      els.speed.textContent = `${Math.round(Math.abs(state.speed) * 3.6)}`;
      els.objective.style.display = state.objective ? 'block' : 'none';
      els.objectiveText.textContent = state.objective || '';
      const mins = Math.floor(state.time / 60) % 60;
      const hrs = 18 + Math.floor(state.time / 3600);
      els.clock.textContent = `${String(((hrs - 1) % 12) + 1).padStart(2, '0')}:${String(mins).padStart(2, '0')} PM`;
      this.drawMinimap(state.minimap);
    },
    drawMinimap(m) {
      const S = els.minimap.width;
      const half = 190 / mapZoom;
      const px = m.player.x, pz = m.player.z;
      const toMap = (x, z) => [
        S / 2 + ((x - px) / half) * (S / 2),
        S / 2 + ((z - pz) / half) * (S / 2),
      ];
      mm.fillStyle = '#10151d';
      mm.fillRect(0, 0, S, S);
      // Roads: draw the street grid in view.
      mm.strokeStyle = '#3a4150';
      mm.lineWidth = 5;
      const centers = [-174, -116, -58, 0, 58, 116, 174];
      for (const c of centers) {
        const [ax] = toMap(c, 0);
        if (ax > -10 && ax < S + 10) { mm.beginPath(); mm.moveTo(ax, 0); mm.lineTo(ax, S); mm.stroke(); }
        const [, bz] = toMap(0, c);
        if (bz > -10 && bz < S + 10) { mm.beginPath(); mm.moveTo(0, bz); mm.lineTo(S, bz); mm.stroke(); }
      }
      // Canal.
      mm.strokeStyle = '#2f7fa8';
      mm.lineWidth = 4;
      const [, canalY] = toMap(0, 58);
      if (canalY > 0 && canalY < S) { mm.beginPath(); mm.moveTo(0, canalY); mm.lineTo(S, canalY); mm.stroke(); }
      // Beach + sea on the west edge.
      const [seaX] = toMap(-198, 0);
      if (seaX > -10 && seaX < S) {
        mm.fillStyle = '#2f7fa8';
        mm.fillRect(0, 0, Math.max(0, seaX), S);
        mm.fillStyle = '#e8d3a0';
        mm.fillRect(Math.max(0, seaX), 0, 8, S);
      }
      function blip(x, z, color, size) {
        const [bx, bz] = toMap(x, z);
        if (bx < 0 || bx > S || bz < 0 || bz > S) return;
        mm.fillStyle = color;
        mm.beginPath();
        mm.arc(bx, bz, size, 0, Math.PI * 2);
        mm.fill();
      }
      for (const c of m.cars || []) blip(c.x, c.z, '#c8c8c8', 2.5);
      for (const p of m.police || []) blip(p.x, p.z, '#3f8cff', 3.5);
      for (const e of m.enemies || []) blip(e.x, e.z, '#ff4444', 3);
      for (const p of m.packages || []) blip(p.x, p.z, '#ffd23f', 2);
      if (m.objective) {
        const [ox, oz] = toMap(m.objective.x, m.objective.z);
        if (ox >= 0 && ox <= S && oz >= 0 && oz <= S) {
          mm.fillStyle = '#ffd23f';
          mm.beginPath();
          mm.arc(ox, oz, 6, 0, Math.PI * 2);
          mm.fill();
          mm.strokeStyle = '#10151d';
          mm.lineWidth = 2;
          mm.stroke();
        }
      }
      // Player arrow, rotated to heading.
      const [cx, cy] = toMap(px, pz);
      mm.save();
      mm.translate(cx, cy);
      mm.rotate(Math.PI - m.heading);
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(0, -7);
      mm.lineTo(5, 6);
      mm.lineTo(-5, 6);
      mm.closePath();
      mm.fill();
      mm.restore();
      // Frame.
      mm.strokeStyle = 'rgba(255,255,255,0.35)';
      mm.lineWidth = 2;
      mm.strokeRect(1, 1, S - 2, S - 2);
    },
    toast(text) {
      els.toast.textContent = text;
      els.toast.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3600);
    },
    showCard(title, body) {
      els.cardTitle.textContent = title;
      els.cardBody.textContent = body;
      els.card.classList.add('show');
      if (cardTimer) clearTimeout(cardTimer);
      cardTimer = setTimeout(() => els.card.classList.remove('show'), 5200);
    },
    showTitle() {
      els.title.style.display = 'flex';
      els.pause.style.display = 'none';
      els.over.style.display = 'none';
    },
    hideTitle() { els.title.style.display = 'none'; },
    showPause(show) { els.pause.style.display = show ? 'flex' : 'none'; },
    showOver(title, body) {
      els.overTitle.textContent = title;
      els.overBody.textContent = body;
      els.over.style.display = 'flex';
    },
    hideOver() { els.over.style.display = 'none'; },
    setCrosshair(show) { els.crosshair.style.display = show ? 'block' : 'none'; },
    setObjectivePulse(on) { els.objective.classList.toggle('pulse', on); },
  };
}
