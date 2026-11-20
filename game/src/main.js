// Vice Point — boot and the one loop. Screens: title, play, paused, over.
// The loop reads input, advances the player (on foot or in a car), traffic,
// pedestrians, police, combat, missions and effects, then paints the HUD
// and the minimap. ?seed=N fixes the city. ?shot=chase|street|combat|marina
// stages a screenshot scene and sets window.__shotReady once it settles.
import * as THREE from 'three';
import { WORLD, VEHICLE_TYPES, STORY } from './config.js';
import { makeSeededRandom, chooseOne, clampNumber } from './rng.js';
import { buildCity } from './city.js';
import { makePlayer } from './player.js';
import { makeCar } from './vehicles.js';
import { makeTraffic } from './traffic.js';
import { makePedestrians } from './pedestrians.js';
import { makePolice } from './police.js';
import { makeCombat } from './combat.js';
import { makeMissions } from './missions.js';
import { makeHud } from './hud.js';
import { makeAudio } from './audio.js';
import { makeSaveStore } from './save.js';
import { makeEffects } from './effects.js';
import {
  makeInput, ACT_ENTER, ACT_JUMP, ACT_PAUSE, ACT_WEAPON, ACT_HORN, ACT_MAP,
} from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const shotName = params.get('shot');
const random = makeSeededRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(-170, 8, -30);

const city = buildCity(scene, seed);
const effects = makeEffects(scene);
const audio = makeAudio();
const hud = makeHud();
const input = makeInput(canvas);
const save = makeSaveStore();
const player = makePlayer(scene, city.LOCATIONS.start.x, city.LOCATIONS.start.z);
const traffic = makeTraffic(scene, city, random, 14);
const peds = makePedestrians(scene, city, random, 24);
const police = makePolice(scene, city);
const combat = makeCombat(scene, random);
const missions = makeMissions(scene, city);

const allCars = [...traffic.cars];
const parkedSpots = [
  // Note: no parked car on the Market Street lot (-80,-20) — the repo
  // mission's marked coupe spawns there, and two cars on one spot made
  // E enter the wrong one and stall the mission.
  [-104, -20, 0.4], [-116, 58, 1.2], [58, -58, -0.6], [116, -116, 0.9],
  [-29, 116, 0.1], [174, -29, 1.5], [29, 174, -1.1], [-174, 116, 0.7],
];
for (const [x, z, heading] of parkedSpots) {
  const car = makeCar(scene, chooseOne(random, VEHICLE_TYPES), x, z, heading, { driver: 'parked' });
  allCars.push(car);
}

let screen = 'title';
let fireCooldown = 0;
let saveTimer = 0;
let shot = null;
let shotTimer = 0;
let shotReady = false;

const G = {
  scene, camera, renderer, city, player, traffic, peds, police, combat, missions,
  effects, audio, hud, input, save,
  allCars,
  playerCar: null,
  playerWeapon: 'fists',
  ammo: { fists: Infinity, pistol: 48, smg: 0 },
  cash: 150,
  time: 0,
  packagesCollected: 0,
  trafficAvoidPlayer: false,
  addCash(amount) { G.cash += amount; },
  enterCar(car) {
    if (car.driver === 'traffic') {
      traffic.steal(car);
      const watched = police.cars.some((p) => Math.hypot(p.x - car.x, p.z - car.z) < 45);
      if (watched) police.raise(1);
      else if (Math.random() < 0.35) {
        car.alarm = true;
        police.raise(1);
      }
      hud.toast(`Stole the ${car.model.label}.`);
      peds.scare(car.x, car.z, 12);
    }
    if (car.driver === 'parked') hud.toast(`Took the ${car.model.label}.`);
    car.driver = null;
    player.inCar = car;
    G.playerCar = car;
    player.mesh.group.visible = false;
    audio.engine(0, true);
  },
  exitCar() {
    const car = G.playerCar;
    if (!car) return;
    car.speed = 0;
    const side = 2.2;
    const px = car.x + Math.cos(car.heading) * side;
    const pz = car.z - Math.sin(car.heading) * side;
    const resolved = city.collideCircle(px, pz, WORLD.playerRadius);
    player.x = resolved.x;
    player.z = resolved.z;
    player.y = 0;
    player.heading = car.heading;
    player.camYaw = car.heading;
    player.inCar = null;
    G.playerCar = null;
    player.mesh.group.visible = true;
  },
  saveGame() {
    const px = G.playerCar ? G.playerCar.x : player.x;
    const pz = G.playerCar ? G.playerCar.z : player.z;
    const ph = G.playerCar ? G.playerCar.heading : player.heading;
    save.save({
      x: px, z: pz, heading: ph,
      cash: G.cash, missions: missions.state.completed,
      packages: G.packagesCollected, weapons: G.ammo, time: G.time,
    });
  },
  screenState() { return screen; },
  onMissionPass: null,
  onMissionFail: null,
};

G.onMissionPass = (idx) => {
  if (idx === STORY.length - 1) {
    hud.showCard('Vice Point complete', 'Mara made it out. The last job is done — the city is yours now.');
  }
};
G.onMissionFail = () => { /* the mission can be retried from the pause menu */ };

function startNewGame() {
  save.clear();
  G.cash = 150;
  G.ammo = { fists: Infinity, pistol: 48, smg: 0 };
  G.playerWeapon = 'fists';
  missions.state.completed = [false, false, false, false, false, false];
  G.packagesCollected = 0;
  player.health = WORLD.playerHealth;
  player.armor = 0;
  police.clear();
  player.x = city.LOCATIONS.start.x;
  player.z = city.LOCATIONS.start.z;
  player.heading = 0;
  player.camYaw = 0;
  screen = 'play';
  hud.hideTitle();
  hud.hideOver();
  audio.unlock();
  const next = missions.nextMission();
  if (next >= 0) missions.start(next, G);
}

function continueGame() {
  const data = save.load();
  if (!data) { startNewGame(); return; }
  G.cash = data.cash;
  G.ammo = { fists: Infinity, pistol: data.weapons.pistol ?? 48, smg: data.weapons.smg ?? 0 };
  G.playerWeapon = G.ammo.smg > 0 ? 'smg' : 'pistol';
  missions.state.completed = data.missions;
  G.packagesCollected = data.packages;
  G.time = data.time;
  player.health = WORLD.playerHealth;
  player.x = data.x;
  player.z = data.z;
  player.heading = data.heading;
  player.camYaw = data.heading;
  screen = 'play';
  hud.hideTitle();
  hud.hideOver();
  audio.unlock();
  const next = missions.nextMission();
  if (next >= 0) missions.start(next, G);
  else hud.showCard('Vice Point complete', 'Every mission done — free-roam the city, or start a new game.');
}

function wastedOrBusted(kind) {
  const fine = Math.min(G.cash, 200);
  G.cash -= fine;
  player.health = WORLD.playerHealth;
  player.armor = 0;
  police.clear();
  if (G.playerCar) {
    G.playerCar.speed = 0;
    G.playerCar = null;
    player.inCar = null;
    player.mesh.group.visible = true;
  }
  player.x = city.LOCATIONS.hospital.x;
  player.z = city.LOCATIONS.hospital.z;
  player.y = 0;
  missions.abort();
  screen = 'over';
  hud.showOver(
    kind === 'busted' ? 'Busted!' : 'Wasted!',
    kind === 'busted'
      ? `The Vice Point force caught you. Fine $${fine}. You wake up at Vice Point General — the mission is off.`
      : `You went down in Vice Point. The medics patched you up for $${fine}. The mission is off.`,
  );
  audio.missionFail();
}

document.getElementById('btn-new').addEventListener('click', () => { audio.unlock(); audio.click(); startNewGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); audio.click(); continueGame(); });
document.getElementById('btn-resume').addEventListener('click', () => { screen = 'play'; hud.showPause(false); audio.click(); });
document.getElementById('btn-save').addEventListener('click', () => { G.saveGame(); hud.toast('Game saved.'); audio.click(); });
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  const next = missions.nextMission();
  screen = 'play';
  hud.showPause(false);
  if (next >= 0) missions.start(next, G);
  audio.click();
});
document.getElementById('btn-quit').addEventListener('click', () => {
  G.saveGame();
  screen = 'title';
  hud.showPause(false);
  hud.showTitle();
  audio.click();
});
document.getElementById('btn-respawn').addEventListener('click', () => {
  hud.hideOver();
  screen = 'play';
  const next = missions.nextMission();
  if (next >= 0) missions.start(next, G);
  audio.click();
});
hud.setContinueVisible(save.hasSave());
if (shotName) {
  hud.hideTitle();
  screen = 'play';
  audio.unlock();
}

function nearestCarTo(x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of allCars) {
    if (car === G.playerCar) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function resolveCarCollisions(dt) {
  for (let i = 0; i < allCars.length; i += 1) {
    for (let j = i + 1; j < allCars.length; j += 1) {
      const a = allCars[i];
      const b = allCars[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const minGap = a.radius + b.radius - 0.6;
      if (d > 0.01 && d < minGap) {
        const push = (minGap - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        const aDriven = a === G.playerCar || a.driver === 'police';
        const bDriven = b === G.playerCar || b.driver === 'police';
        if (!aDriven) { a.x -= nx * push; a.z -= nz * push; }
        if (!bDriven) { b.x += nx * push; b.z += nz * push; }
        if (a === G.playerCar || b === G.playerCar) {
          const other = a === G.playerCar ? b : a;
          const mine = a === G.playerCar ? a : b;
          const impact = Math.abs(mine.speed);
          if (impact > 8) {
            mine.addDamage(0.06);
            other.addDamage(0.05);
            audio.crash(impact / 30);
            effects.addShake(0.25);
            if (other.driver === 'traffic') peds.scare(other.x, other.z, 14);
          }
        }
      }
    }
  }
}

function fireWeapon() {
  const weapon = WORLD.weapons[G.playerWeapon];
  if (G.ammo[G.playerWeapon] <= 0) {
    hud.toast('Out of ammo — find a pickup.');
    audio.click();
    return;
  }
  fireCooldown = weapon.cooldown;
  if (G.playerWeapon !== 'fists') G.ammo[G.playerWeapon] -= 1;
  const dirX = Math.sin(player.camYaw);
  const dirZ = Math.cos(player.camYaw);
  const muzzleX = player.x + dirX * 0.8;
  const muzzleZ = player.z + dirZ * 0.8;
  if (G.playerWeapon === 'fists') {
    player.punch();
    audio.punch();
    const hit = combat.enemies.find((e) => e.alive && Math.hypot(e.x - player.x, e.z - player.z) < 2.4);
    if (hit) {
      hit.health -= weapon.damage;
      effects.blood(hit.x, 1.2, hit.z);
      if (hit.health <= 0) { hit.alive = false; hit.mesh.group.visible = false; }
    }
    return;
  }
  audio.gunshot();
  effects.muzzle(muzzleX, 1.45, muzzleZ, dirX, dirZ);
  effects.addShake(0.08);
  const result = combat.shoot(camera, G.playerWeapon, { x: player.x, z: player.z }, (enemy, point) => {
    effects.blood(point.x, point.y, point.z);
    audio.hit();
  });
  if (result.enemy && result.killed) {
    G.addCash(WORLD.killBonus);
    hud.toast(`Target down — +$${WORLD.killBonus}`);
    if (result.enemy.kind === 'cop') police.raise(1);
  }
  if (police.wanted === 0 && Math.random() < 0.4) police.raise(1);
  peds.scare(player.x, player.z, 26);
}

function update(dt) {
  G.time += dt;
  const actions = input.takeActions();
  const mouse = input.takeMouse();

  if (screen === 'title') {
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 200, 90, Math.cos(t) * 200);
    camera.lookAt(0, 0, 0);
    city.update(dt, G.time);
    effects.update(dt);
    return;
  }
  if (screen === 'paused') {
    if (actions & ACT_PAUSE) { screen = 'play'; hud.showPause(false); }
    return;
  }
  if (screen === 'over') return;
  if (actions & ACT_PAUSE) {
    screen = 'paused';
    hud.showPause(true);
    return;
  }
  if (actions & ACT_MAP) hud.toggleMapZoom();
  if (actions & ACT_HORN && G.playerCar) audio.horn();
  if (actions & ACT_WEAPON) {
    const order = ['fists', 'pistol', 'smg'];
    let i = order.indexOf(G.playerWeapon);
    for (let k = 0; k < 3; k += 1) {
      i = (i + 1) % 3;
      if (G.ammo[order[i]] > 0) { G.playerWeapon = order[i]; break; }
    }
    hud.toast(`Weapon: ${WORLD.weapons[G.playerWeapon].label}`);
  }

  const shake = effects.shakeOffset(dt);
  fireCooldown -= dt;

  if (G.playerCar) {
    const car = G.playerCar;
    const drive = input.drive();
    if (shot && shot.autopilot) shot.autopilot(dt);
    else {
      car.update(dt, drive.throttle, drive.steer, drive.handbrake, (x, z, r) => city.collideCircle(x, z, r));
      if (drive.handbrake && Math.abs(car.speed) > 12 && Math.random() < 0.5) {
        effects.skid(car.x - Math.sin(car.heading) * 1.4, car.z - Math.cos(car.heading) * 1.4, car.heading);
      }
    }
    audio.engine(clampNumber(Math.abs(car.speed) / 40, 0, 1), true);
    if (car.damage > 0.55 && Math.random() < dt * 8) effects.smoke(car.x, 1.2, car.z, 2);
    if (car.damage >= 1) {
      effects.explosion(car.x, 1, car.z);
      audio.explosion();
      const idx = allCars.indexOf(car);
      if (idx >= 0) allCars.splice(idx, 1);
      scene.remove(car.mesh.group);
      player.health = Math.max(20, player.health - 35);
      G.exitCar();
      hud.toast('Your car blew up!');
    }
    if (actions & ACT_ENTER) G.exitCar();
    player.updateCarCamera(camera, car, dt, shake);
    if (shot && shot.name === 'chase') {
      // Cover framing: a 3/4 rear view from the front-side of the player
      // car, so the coupe and the police behind it separate sideways in
      // frame and the warm horizon reads at the end of the avenue.
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      const rx = -Math.cos(car.heading);
      const rz = Math.sin(car.heading);
      camera.position.set(car.x + fx * 9 + rx * 5.5, 5.0, car.z + fz * 9 + rz * 5.5);
      camera.lookAt(car.x - fx * 10, 1.2, car.z - fz * 10);
    }
    const victim = peds.hitByCar(car.x, car.z, 2.1);
    if (victim && Math.abs(car.speed) > 3) {
      police.raise(1);
      peds.scare(car.x, car.z, 20);
      audio.crash(0.5);
    }
  } else {
    const axes = { ...input.axes(), jump: !!(actions & ACT_JUMP) };
    player.update(dt, axes, mouse, (x, z, r) => city.collideCircle(x, z, r));
    if (axes.jump && player.onGround) audio.jump();
    audio.engine(0, false);
    if (actions & ACT_ENTER) {
      const car = nearestCarTo(player.x, player.z, 3.6);
      if (car) G.enterCar(car);
    }
    player.updateCamera(camera, dt, shake, G.playerWeapon !== 'fists');
    if (shot && shot.name === 'combat') {
      const yaw = player.camYaw;
      camera.position.set(
        player.x - Math.sin(yaw) * 11, 6.5,
        player.z - Math.cos(yaw) * 11,
      );
      camera.lookAt(player.x + Math.sin(yaw) * 6, 1.2, player.z + Math.cos(yaw) * 6);
    }
    const pickupKind = combat.takePickup(player.x, player.z, 1.8);
    if (pickupKind === 'health') { player.health = Math.min(WORLD.playerHealth, player.health + 40); hud.toast('Health +40'); audio.pickup(); }
    else if (pickupKind === 'armor') { player.armor = Math.min(100, player.armor + 50); hud.toast('Armor +50'); audio.pickup(); }
    else if (pickupKind === 'smg') { G.ammo.smg += 90; G.playerWeapon = 'smg'; hud.toast('SMG picked up'); audio.pickup(); }
    else if (pickupKind === 'pistol') { G.ammo.pistol += 30; hud.toast('Pistol ammo +30'); audio.pickup(); }
    if (input.firing() && fireCooldown <= 0) fireWeapon();
  }
  hud.setCrosshair(!G.playerCar && G.playerWeapon !== 'fists');

  traffic.update(dt, G.time, player, allCars, () => audio.horn());
  peds.update(dt);
  police.update(dt, G.time, player, G.playerCar, (kind) => wastedOrBusted(kind), () => audio.crash(0.4));
  audio.siren(police.wanted > 0, G.time);
  combat.update(dt, { x: player.x, z: player.z }, (enemy) => {
    audio.enemyShot();
    effects.muzzle(enemy.x + Math.sin(enemy.heading) * 0.5, 1.3, enemy.z + Math.cos(enemy.heading) * 0.5, Math.sin(enemy.heading), Math.cos(enemy.heading));
  }, (damage) => {
    let remaining = damage;
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, remaining);
      player.armor -= absorbed;
      remaining -= absorbed;
    }
    player.health -= remaining;
    effects.blood(player.x, 1.3, player.z);
    effects.addShake(0.3);
    if (player.health <= 0) wastedOrBusted('wasted');
  });
  resolveCarCollisions(dt);
  missions.update(dt, G);
  city.update(dt, G.time);
  effects.update(dt);

  saveTimer += dt;
  if (saveTimer > 30) {
    saveTimer = 0;
    if (screen === 'play') G.saveGame();
  }

  hud.update({
    health: player.health,
    armor: player.armor,
    cash: G.cash,
    wanted: police.wanted,
    weaponName: WORLD.weapons[G.playerWeapon].label,
    ammo: G.ammo[G.playerWeapon],
    speed: G.playerCar ? G.playerCar.speed : 0,
    inCar: !!G.playerCar,
    objective: missions.state.objective,
    time: G.time,
    minimap: {
      player: { x: player.x, z: player.z },
      heading: G.playerCar ? G.playerCar.heading : player.heading,
      objective: missions.state.objectivePos,
      police: police.cars.map((c) => ({ x: c.x, z: c.z })),
      cars: allCars.filter((c) => c !== G.playerCar).slice(0, 30).map((c) => ({ x: c.x, z: c.z })),
      enemies: combat.enemies.filter((e) => e.alive).map((e) => ({ x: e.x, z: e.z })),
      packages: missions.side.packages.filter((p) => !p.taken).map((p) => ({ x: p.x, z: p.z })),
    },
  });

  if (shot && !shotReady) {
    shotTimer += dt;
    if (shotTimer > shot.settleSeconds) {
      shotReady = true;
      window.__shotReady = true;
    }
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Esc exits pointer lock before the page sees the key, so pausing on lock
// exit is what makes Esc actually pause the game.
let pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (pointerLocked && !locked && screen === 'play') {
    screen = 'paused';
    hud.showPause(true);
  }
  pointerLocked = locked;
});

missions.seedSideWork(random);
combat.spawnPickup('pistol', city.LOCATIONS.start.x + 4, city.LOCATIONS.start.z + 2);
combat.spawnPickup('health', city.LOCATIONS.start.x - 6, city.LOCATIONS.start.z + 8);
combat.spawnPickup('smg', city.LOCATIONS.garage.x + 3, city.LOCATIONS.garage.z);

if (shotName) {
  shot = stageShot(shotName, G);
  shotTimer = 0;
}

window.__game = G;

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  try {
    update(dt);
  } catch (err) {
    console.error(err);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
