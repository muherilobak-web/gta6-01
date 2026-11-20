// Vice Point — boot and the one loop. Screens: title, play, paused, over. The loop
// reads input, advances the player (on foot or in a car), traffic, pedestrians,
// police, combat, missions and effects, then paints the HUD and the minimap.
// ?seed=N fixes the city. ?shot=chase|street|combat|marina stages a screenshot scene
// and sets window.__shotReady once it has settled.
import * as THREE from 'three';
import { CFG, CAR_MODELS, MISSIONS } from './config.js';
import { createRng, pick, clamp } from './rng.js';
import { createCity } from './city.js';
import { createPlayer } from './player.js';
import { createCar } from './vehicles.js';
import { createTraffic } from './traffic.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createSave } from './save.js';
import { createEffects } from './effects.js';
import { createInput, ACTION_ENTER, ACTION_JUMP, ACTION_PAUSE, ACTION_CONFIRM, ACTION_WEAPON, ACTION_HORN, ACTION_MAP } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const shotName = params.get('shot');
const rng = createRng(seed);

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

const city = createCity(scene, seed);
const effects = createEffects(scene);
const audio = createAudio();
const hud = createHud();
const input = createInput(canvas);
const save = createSave();
const player = createPlayer(scene, city.LOCATIONS.start.x, city.LOCATIONS.start.z);
const traffic = createTraffic(scene, city, rng, 14);
const peds = createPedestrians(scene, city, rng, 24);
const police = createPolice(scene, city, rng);
const combat = createCombat(scene, rng);
const missions = createMissions(scene, city);

// Parked cars around the district, free to steal.
const allCars = [...traffic.cars];
const parkedSpots = [
  [-80, -20, 0.4], [-116, 58, 1.2], [58, -58, -0.6], [116, -116, 0.9],
  [-29, 116, 0.1], [174, -29, 1.5], [29, 174, -1.1], [-174, 116, 0.7],
];
for (const [x, z, h] of parkedSpots) {
  const car = createCar(scene, pick(rng, CAR_MODELS), x, z, h, { driver: 'parked' });
  allCars.push(car);
}

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
  addCash(n) { G.cash += n; },
  enterCar(car) {
    if (car.driver === 'traffic') {
      traffic.steal(car);
      const nearPolice = police.cars.some((p) => Math.hypot(p.x - car.x, p.z - car.z) < 45);
      if (nearPolice) police.raise(1, 'stolen in view of police');
      else if (Math.random() < 0.35) { car.alarm = true; police.raise(1, 'car alarm'); }
      hud.toast(`Stole the ${car.model.name}.`);
      peds.scare(car.x, car.z, 12);
    }
    if (car.driver === 'parked') hud.toast(`Took the ${car.model.name}.`);
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
    const hit = city.collideCircle(px, pz, CFG.PLAYER_RADIUS);
    player.x = hit.x; player.z = hit.z; player.y = 0;
    player.heading = car.heading;
    player.camYaw = car.heading;
    player.inCar = null;
    G.playerCar = null;
    player.mesh.group.visible = true;
  },
  saveGame() {
    // Save the car position when driving: the on-foot position goes stale the
    // moment the player gets in a car, and restoring that would teleport the
    // player back to where they entered the car (usually far away).
    const px = G.playerCar ? G.playerCar.x : player.x;
    const pz = G.playerCar ? G.playerCar.z : player.z;
    const ph = G.playerCar ? G.playerCar.heading : player.heading;
    save.save({
      x: px, z: pz, heading: ph,
      cash: G.cash, missions: missions.state.completed,
      packages: G.packagesCollected, weapons: G.ammo, time: G.time,
    });
  },
  /** Debug/test accessor: 'title' | 'play' | 'paused' | 'over'. */
  screenState() { return screen; },
  onMissionPass: null,
  onMissionFail: null,
};

G.onMissionPass = (idx) => {
  if (idx === MISSIONS.length - 1) {
    hud.showCard('Vice Point complete', 'Mara made it out. The last job is done — the city is yours now.');
  }
};
G.onMissionFail = () => { /* the mission can be retried from the pause menu */ };

// ---- screens ----
let screen = 'title';
let fireCooldown = 0;
let saveTimer = 0;
let shot = null;
let shotTimer = 0;
let shotReady = false;

function startNewGame() {
  save.clear();
  G.cash = 150;
  G.ammo = { fists: Infinity, pistol: 48, smg: 0 };
  G.playerWeapon = 'fists';
  missions.state.completed = [false, false, false, false, false, false];
  G.packagesCollected = 0;
  player.health = CFG.PLAYER_HEALTH;
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
  player.health = CFG.PLAYER_HEALTH;
  player.x = data.x; player.z = data.z; player.heading = data.heading;
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
  player.health = CFG.PLAYER_HEALTH;
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

// ---- title screen buttons (DOM) ----
document.getElementById('btn-new').addEventListener('click', () => { audio.unlock(); audio.click(); startNewGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { audio.unlock(); audio.click(); continueGame(); });
document.getElementById('btn-resume').addEventListener('click', () => { screen = 'play'; hud.showPause(false); audio.click(); });
document.getElementById('btn-save').addEventListener('click', () => { G.saveGame(); hud.toast('Game saved.'); audio.click(); });
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  const next = missions.nextMission();
  screen = 'play'; hud.showPause(false);
  if (next >= 0) missions.start(next, G);
  audio.click();
});
document.getElementById('btn-quit').addEventListener('click', () => {
  G.saveGame();
  screen = 'title'; hud.showPause(false); hud.showTitle(); audio.click();
});
document.getElementById('btn-respawn').addEventListener('click', () => {
  hud.hideOver();
  screen = 'play';
  const next = missions.nextMission();
  if (next >= 0) missions.start(next, G);
  audio.click();
});
document.getElementById('btn-continue').style.display = save.hasSave() ? 'block' : 'none';
if (shotName) {
  hud.hideTitle();
  screen = 'play';
  audio.unlock();
}

// ---- per-frame helpers ----
function nearestCar(x, z, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of allCars) {
    if (car === G.playerCar) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function carVsCar(dt) {
  for (let i = 0; i < allCars.length; i++) {
    for (let j = i + 1; j < allCars.length; j++) {
      const a = allCars[i], b = allCars[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = a.radius + b.radius - 0.6;
      if (d > 0.01 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
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
            if (other.driver === 'traffic') { peds.scare(other.x, other.z, 14); }
          }
        }
      }
    }
  }
}

function fireWeapon() {
  const w = CFG.WEAPONS[G.playerWeapon];
  if (G.ammo[G.playerWeapon] <= 0) {
    hud.toast('Out of ammo — find a pickup.');
    audio.click();
    return;
  }
  fireCooldown = w.rate;
  if (G.playerWeapon !== 'fists') G.ammo[G.playerWeapon] -= 1;
  const dirX = Math.sin(player.camYaw), dirZ = Math.cos(player.camYaw);
  const mx = player.x + dirX * 0.8, mz = player.z + dirZ * 0.8;
  if (G.playerWeapon === 'fists') {
    player.punch();
    audio.punch();
    const hit = combat.enemies.find((e) => e.alive && Math.hypot(e.x - player.x, e.z - player.z) < 2.4);
    if (hit) {
      hit.health -= w.damage;
      effects.blood(hit.x, 1.2, hit.z);
      if (hit.health <= 0) { hit.alive = false; hit.mesh.group.visible = false; }
    }
    return;
  }
  audio.gunshot();
  effects.muzzle(mx, 1.45, mz, dirX, dirZ);
  effects.addShake(0.08);
  const res = combat.shoot(camera, G.playerWeapon, { x: player.x, z: player.z }, (enemy, point) => {
    effects.blood(point.x, point.y, point.z);
    audio.hit();
  });
  if (res.enemy && res.killed) {
    G.addCash(40);
    hud.toast('Target down — +$40');
    if (res.enemy.kind === 'cop') police.raise(1, 'officer down');
  }
  // Firing in the open draws heat.
  if (police.wanted === 0 && Math.random() < 0.4) police.raise(1, 'shots fired');
  peds.scare(player.x, player.z, 26);
}

function update(dt) {
  G.time += dt;
  const actions = input.takeActions();
  const mouse = input.takeMouse();

  if (screen === 'title') {
    // Attract mode: slow orbit over the district.
    const t = G.time * 0.05;
    camera.position.set(Math.sin(t) * 200, 90, Math.cos(t) * 200);
    camera.lookAt(0, 0, 0);
    city.update(dt, G.time);
    effects.update(dt);
    return;
  }
  if (screen === 'paused') {
    if (actions & ACTION_PAUSE) { screen = 'play'; hud.showPause(false); }
    return;
  }
  if (screen === 'over') return;

  if (actions & ACTION_PAUSE) {
    screen = 'paused';
    hud.showPause(true);
    return;
  }
  if (actions & ACTION_MAP) hud.toggleMapZoom();
  if (actions & ACTION_HORN && G.playerCar) audio.horn();
  if (actions & ACTION_WEAPON) {
    const order = ['fists', 'pistol', 'smg'];
    let i = order.indexOf(G.playerWeapon);
    for (let k = 0; k < 3; k++) {
      i = (i + 1) % 3;
      if (G.ammo[order[i]] > 0) { G.playerWeapon = order[i]; break; }
    }
    hud.toast(`Weapon: ${CFG.WEAPONS[G.playerWeapon].name}`);
  }

  const shake = effects.shakeOffset(dt);
  fireCooldown -= dt;

  // ---- player / car ----
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
    audio.engine(clamp(Math.abs(car.speed) / 40, 0, 1), true);
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
    if (actions & ACTION_ENTER) G.exitCar();
    player.updateCarCamera(camera, car, dt, shake);
    if (shot && shot.name === 'chase') {
      // Cover framing: 3/4 rear view from the front-side of the player car.
      // The old straight-down-the-avenue angle hid the pursuit directly
      // behind the coupe (same lane, occluded by the car body); from this
      // angle the player car and the police behind it separate sideways in
      // frame, and the warm horizon reads at the end of the avenue.
      const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
      const rx = -Math.cos(car.heading), rz = Math.sin(car.heading);
      camera.position.set(
        car.x + fx * 9 + rx * 5.5, 5.0,
        car.z + fz * 9 + rz * 5.5,
      );
      camera.lookAt(car.x - fx * 10, 1.2, car.z - fz * 10);
    }
    // Running over pedestrians.
    const hit = peds.hitByCar(car.x, car.z, 2.1);
    if (hit && Math.abs(car.speed) > 3) {
      police.raise(1, 'pedestrian hit');
      peds.scare(car.x, car.z, 20);
      audio.crash(0.5);
    }
  } else {
    const axes = { ...input.axes(), jump: !!(actions & ACTION_JUMP) };
    player.update(dt, axes, mouse, (x, z, r) => city.collideCircle(x, z, r));
    if (axes.jump && player.onGround) audio.jump();
    audio.engine(0, false);
    if (actions & ACTION_ENTER) {
      const car = nearestCar(player.x, player.z, 3.6);
      if (car) G.enterCar(car);
    }
    player.updateCamera(camera, dt, shake, G.playerWeapon !== 'fists');
    if (shot && shot.name === 'combat') {
      // Screenshot framing: pull the camera up and back so the street, the
      // gang and the stash house all read in one frame (the aim camera is
      // deliberately low and flat, which is good to play but poor to show).
      const yaw = player.camYaw;
      camera.position.set(
        player.x - Math.sin(yaw) * 11, 6.5,
        player.z - Math.cos(yaw) * 11,
      );
      camera.lookAt(player.x + Math.sin(yaw) * 6, 1.2, player.z + Math.cos(yaw) * 6);
    }
    // Pickups.
    const kind = combat.takePickup(player.x, player.z, 1.8);
    if (kind === 'health') { player.health = Math.min(CFG.PLAYER_HEALTH, player.health + 40); hud.toast('Health +40'); audio.pickup(); }
    else if (kind === 'armor') { player.armor = Math.min(100, player.armor + 50); hud.toast('Armor +50'); audio.pickup(); }
    else if (kind === 'smg') { G.ammo.smg += 90; G.playerWeapon = 'smg'; hud.toast('SMG picked up'); audio.pickup(); }
    else if (kind === 'pistol') { G.ammo.pistol += 30; hud.toast('Pistol ammo +30'); audio.pickup(); }
    // Shooting on foot.
    if (input.firing() && fireCooldown <= 0 && G.playerWeapon !== 'fists') fireWeapon();
    else if (input.firing() && fireCooldown <= 0) fireWeapon();
  }
  hud.setCrosshair(!G.playerCar && G.playerWeapon !== 'fists');

  // ---- world systems ----
  traffic.update(dt, G.time, player, allCars, (car) => audio.horn());
  peds.update(dt);
  police.update(dt, G.time, player, G.playerCar, (kind) => wastedOrBusted(kind), () => audio.crash(0.4));
  audio.siren(police.wanted > 0, G.time);
  combat.update(dt, { x: player.x, z: player.z }, (e) => {
    audio.enemyShot();
    effects.muzzle(e.x + Math.sin(e.heading) * 0.5, 1.3, e.z + Math.cos(e.heading) * 0.5, Math.sin(e.heading), Math.cos(e.heading));
  }, (dmg) => {
    if (player.armor > 0) {
      const absorbed = Math.min(player.armor, dmg);
      player.armor -= absorbed;
      dmg -= absorbed;
    }
    player.health -= dmg;
    effects.blood(player.x, 1.3, player.z);
    effects.addShake(0.3);
    if (player.health <= 0) wastedOrBusted('wasted');
  });
  carVsCar(dt);
  missions.update(dt, G);
  city.update(dt, G.time);
  effects.update(dt);

  // ---- save ----
  saveTimer += dt;
  if (saveTimer > 30) { saveTimer = 0; if (screen === 'play') G.saveGame(); }

  // ---- HUD ----
  const minimap = {
    player: { x: player.x, z: player.z },
    heading: G.playerCar ? G.playerCar.heading : player.heading,
    objective: missions.state.objectivePos,
    police: police.cars.map((c) => ({ x: c.x, z: c.z })),
    cars: allCars.filter((c) => c !== G.playerCar).slice(0, 30).map((c) => ({ x: c.x, z: c.z })),
    enemies: combat.enemies.filter((e) => e.alive).map((e) => ({ x: e.x, z: e.z })),
    packages: missions.side.packages.filter((p) => !p.taken).map((p) => ({ x: p.x, z: p.z })),
  };
  hud.update({
    health: player.health,
    armor: player.armor,
    cash: G.cash,
    wanted: police.wanted,
    weaponName: CFG.WEAPONS[G.playerWeapon].name,
    ammo: G.ammo[G.playerWeapon],
    speed: G.playerCar ? G.playerCar.speed : 0,
    inCar: !!G.playerCar,
    objective: missions.state.objective,
    time: G.time,
    minimap,
  });

  // ---- screenshot staging ----
  if (shot && !shotReady) {
    shotTimer += dt;
    if (shotTimer > shot.settleSeconds) {
      shotReady = true;
      window.__shotReady = true;
    }
  }
}

// ---- boot ----
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Esc exits pointer lock in the browser before the page sees the key, so pausing
// on lock exit is what makes Esc actually pause the game.
let pointerLocked = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (pointerLocked && !locked && screen === 'play') {
    screen = 'paused';
    hud.showPause(true);
  }
  pointerLocked = locked;
});

missions.seedSideWork(rng);
// Starter pickups so the player can fight from the start.
combat.spawnPickup('pistol', city.LOCATIONS.start.x + 4, city.LOCATIONS.start.z + 2);
combat.spawnPickup('health', city.LOCATIONS.start.x - 6, city.LOCATIONS.start.z + 8);
combat.spawnPickup('smg', city.LOCATIONS.garage.x + 3, city.LOCATIONS.garage.z);

if (shotName) {
  shot = stageShot(shotName, G);
  shotTimer = 0;
} else if (save.hasSave()) {
  hud.showTitle();
} else {
  hud.showTitle();
}

// Expose the world for play-testing from a script (and for the supervisor).
window.__game = G;

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  try {
    update(dt);
  } catch (err) {
    // Never let one bad frame kill the game: show it, keep rendering.
    console.error(err);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
