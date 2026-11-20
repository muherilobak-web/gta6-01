// Vice Point: the game loop. Wires the city, the player, traffic,
// pedestrians, police, combat and missions together, and owns the
// camera, the menus, save/load and the mission economy.

import * as THREE from 'three';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { Car } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { MissionManager } from './missions.js';
import { Combat } from './combat.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { Effects } from './effects.js';
import { readSave, writeSave, clearSave } from './save.js';
import {
  PLAYER_START, START_CASH, HOSPITAL, GARAGE, BANK, STASH_HOUSE, DOCKS,
  BUSTED_FINE, WASTED_FINE, PACKAGE_REWARD,
} from './config.js';
import { makeRng, pick } from './rng.js';

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.set(-120, 30, -120);
    this.clock = new THREE.Clock();
    this.input = new Input(this.renderer.domElement);
    this.input.attach(this.renderer.domElement);
    this.audio = new AudioEngine();
    this.effects = new Effects(this.scene);
    this.city = buildCity(this.scene);
    this.player = new Player(this.scene);
    this.player.setPosition(PLAYER_START.x, PLAYER_START.z, Math.PI / 2);
    this.traffic = new Traffic(this.scene, this.city.intersections, this.city.resolveCircle);
    this.peds = new Pedestrians(this.scene, this.city.resolveCircle);
    this.police = new Police(this.scene, this.city.resolveCircle, (reason) => this.onBusted(reason));
    this.combat = new Combat(this.scene, this.effects, this.audio, (pos, r) => this.peds.scare(pos, r));
    this.hud = new Hud();
    this.parkedCars = [];
    this.missionCars = [];
    this.cash = START_CASH;
    this.completedMissions = [];
    this.state = 'menu';
    this.shotCamera = null;
    this.camPos = new THREE.Vector3(-120, 30, -120);
    this.camLook = new THREE.Vector3(-140, 1, -140);
    this.saveTimer = 0;
    this.sirenOn = false;
    this.prevKeys = new Set();
    this.respawnTimer = 0;
    this.missionBannerShown = false;
    this.rng = makeRng(20261120);
    this.missions = new MissionManager({
      playerPos: () => this.player.pos,
      playerCar: () => this.player.inCar,
      police: this.police,
      spawnMissionCar: (type, x, z, heading, marked) => this.spawnMissionCar(type, x, z, heading, marked),
      removeMissionCar: (car) => this.removeMissionCar(car),
      makeCourierRoute: () => this.makeCourierRoute(),
      driveCourier: (car, dt) => this.driveCourier(car, dt),
      spawnEnemy: (x, z) => this.combat.makeEnemy(x, z),
      enemiesAlive: () => this.combat.enemiesAlive(),
      exitCarToFoot: () => this.exitCar(),
      deliverCar: (car) => this.deliverCar(car),
      onPackage: (pkg) => this.onPackage(pkg),
    });
    this.missions.onPass = (idx, reward) => this.onMissionPass(idx, reward);
    this.missions.onFail = (idx, reason) => this.onMissionFail(idx, reason);
    this.missions.onStage = (idx, stage) => this.onMissionStage(idx, stage);
    this.wireMenu();
    this.wireResize();
    this.missions.packages.forEach(() => {});
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    window.__game = this;
    window.__gameReady = true;
  }

  wireMenu() {
    const menu = document.getElementById('menu');
    const startBtn = document.getElementById('menu-start');
    const continueBtn = document.getElementById('menu-continue');
    const title = document.getElementById('menu-title');
    if (readSave()) {
      continueBtn.style.display = 'inline-block';
    }
    startBtn.addEventListener('click', () => {
      this.audio.ensure();
      clearSave();
      this.newGame();
    });
    continueBtn.addEventListener('click', () => {
      this.audio.ensure();
      this.loadGame();
    });
    void title;
    void menu;
    document.getElementById('pause-resume').addEventListener('click', () => this.setState('playing'));
    document.getElementById('pause-save').addEventListener('click', () => {
      this.doSave();
      this.hud.banner('Saved', 'Progress saved');
    });
    document.getElementById('pause-quit').addEventListener('click', () => this.setState('menu'));
    document.getElementById('busted-respawn').addEventListener('click', () => this.respawn());
    document.getElementById('wasted-respawn').addEventListener('click', () => this.respawn());
  }

  wireResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  newGame() {
    this.cash = START_CASH;
    this.completedMissions = [];
    this.player.health = 100;
    this.player.armor = 0;
    this.police.clear();
    this.combat.clearEnemies();
    this.player.setPosition(PLAYER_START.x, PLAYER_START.z, Math.PI / 2);
    this.player.inCar = null;
    this.combat.weapon = 'fists';
    this.combat.ammo = { pistol: 0, smg: 0 };
    this.combat.hasWeapon = { fists: true, pistol: false, smg: false };
    this.missions.packages.forEach((p) => { p.taken = false; });
    this.missions.start(0);
    this.hud.setCash(this.cash);
    this.hud.setObjective(`Mission 1 — ${this.missions.title}`);
    this.hud.banner('First Gear', 'Drive to the docks');
    this.setState('playing');
  }

  loadGame() {
    const s = readSave();
    if (!s) {
      this.newGame();
      return;
    }
    this.cash = s.cash;
    this.completedMissions = (s.completed || []).map((done, i) => (done ? i : -1)).filter((i) => i >= 0);
    this.player.health = s.health ?? 100;
    this.player.armor = s.armor ?? 0;
    if (s.pos) this.player.setPosition(s.pos.x, s.pos.z, s.heading ?? Math.PI / 2);
    this.player.inCar = null;
    this.police.clear();
    this.combat.clearEnemies();
    this.combat.ammo = { pistol: s.pistolAmmo || 0, smg: s.smgAmmo || 0 };
    this.combat.hasWeapon = { fists: true, pistol: (s.pistolAmmo || 0) > 0, smg: !!s.hasSmg };
    this.combat.weapon = this.combat.hasWeapon.smg ? 'smg' : this.combat.hasWeapon.pistol ? 'pistol' : 'fists';
    (s.packages || []).forEach((i) => {
      if (this.missions.packages[i]) this.missions.packages[i].taken = true;
    });
    const next = Math.min(5, this.completedMissions.length);
    this.missions.start(next);
    this.hud.setCash(this.cash);
    this.hud.banner('Welcome back', `Mission ${next + 1} — ${this.missions.title}`);
    this.setState('playing');
  }

  doSave() {
    const completed = [false, false, false, false, false, false];
    for (const idx of this.completedMissions) completed[idx] = true;
    writeSave({
      cash: this.cash,
      pos: { x: this.player.pos.x, z: this.player.pos.z },
      heading: this.player.heading,
      completed,
      missionIndex: this.missions.index,
      packages: this.missions.packages.map((p, i) => (p.taken ? i : -1)).filter((i) => i >= 0),
      pistolAmmo: this.combat.ammo.pistol || 0,
      smgAmmo: this.combat.ammo.smg || 0,
      hasSmg: !!this.combat.hasWeapon.smg,
      armor: this.player.armor,
      health: this.player.health,
    });
  }

  setState(state) {
    this.state = state;
    document.getElementById('menu').style.display = state === 'menu' ? 'flex' : 'none';
    document.getElementById('pause').style.display = state === 'paused' ? 'flex' : 'none';
    document.getElementById('busted').style.display = state === 'busted' ? 'flex' : 'none';
    document.getElementById('wasted').style.display = state === 'wasted' ? 'flex' : 'none';
    document.getElementById('hud').style.display = state === 'playing' ? 'block' : 'none';
    if (state === 'playing') {
      this.audio.startRadio();
    }
  }

  spawnMissionCar(type, x, z, heading, marked) {
    const car = new Car(this.scene, type, x, z, heading, false);
    car.isMission = true;
    car.marked = !!marked;
    this.missionCars.push(car);
    return car;
  }

  removeMissionCar(car) {
    const idx = this.missionCars.indexOf(car);
    if (idx >= 0) this.missionCars.splice(idx, 1);
    if (this.player.inCar === car) this.player.inCar = null;
    car.remove();
  }

  makeCourierRoute() {
    const route = [];
    for (let i = 0; i < 8; i++) {
      route.push(pick(this.rng, this.city.intersections));
    }
    return route;
  }

  driveCourier(car, dt) {
    if (!car.route || car.route.length === 0) car.route = this.makeCourierRoute();
    const target = car.route[0];
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5) {
      car.route.shift();
      return;
    }
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.drive(dt, 0.5, Math.max(-1, Math.min(1, dh * 1.6)), false);
    car.speed = Math.min(car.speed, 13);
    this.city.resolveCircle(car.pos, 1.6);
  }

  nearestStealable(maxDist) {
    let best = null;
    let bestD = maxDist;
    const consider = (car) => {
      const d = car.pos.distanceTo(this.player.pos);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    };
    for (const car of this.traffic.cars) consider(car);
    for (const car of this.parkedCars) consider(car);
    for (const car of this.missionCars) consider(car);
    return best;
  }

  enterCar(car) {
    const ti = this.traffic.cars.indexOf(car);
    if (ti >= 0) this.traffic.cars.splice(ti, 1);
    const pi = this.parkedCars.indexOf(car);
    if (pi >= 0) this.parkedCars.splice(pi, 1);
    this.player.inCar = car;
    this.player.group.visible = false;
    this.audio.setEngine(0, 30);
    if (car.isMission && car.marked) {
      this.police.addHeat(30, this.player.pos);
      this.hud.banner('Stolen', 'The owner called it in');
    }
  }

  exitCar() {
    const car = this.player.inCar;
    if (!car) return;
    this.player.inCar = null;
    const side = 2.4;
    this.player.setPosition(car.pos.x + Math.cos(car.heading) * side, car.pos.z - Math.sin(car.heading) * side, car.heading);
    this.player.group.visible = true;
    this.parkedCars.push(car);
    this.audio.setEngine(0, 1);
  }

  deliverCar(car) {
    // Mission delivery: the car leaves the world, the player steps out.
    if (this.player.inCar === car) {
      this.player.inCar = null;
      this.player.setPosition(car.pos.x + 2.4, car.pos.z, car.heading);
      this.player.group.visible = true;
      this.audio.setEngine(0, 1);
    }
    this.removeMissionCar(car);
  }

  wreckPlayerCar(car) {
    // The player's car is destroyed: explosion, player on foot beside it.
    this.effects.explosion(car.pos);
    this.audio.crash();
    if (this.player.inCar === car) {
      this.player.inCar = null;
      this.player.setPosition(car.pos.x + 2.4, car.pos.z, car.heading);
      this.player.group.visible = true;
      this.audio.setEngine(0, 1);
    }
    const mi = this.missionCars.indexOf(car);
    if (mi >= 0) this.missionCars.splice(mi, 1);
    const pi = this.parkedCars.indexOf(car);
    if (pi >= 0) this.parkedCars.splice(pi, 1);
    car.remove();
  }

  onPackage(pkg) {
    this.cash += PACKAGE_REWARD;
    this.hud.setCash(this.cash);
    this.audio.pickup();
    this.hud.banner('Package found', `+$${PACKAGE_REWARD}`);
  }

  onMissionPass(idx, reward) {
    this.cash += reward;
    this.completedMissions.push(idx);
    this.hud.setCash(this.cash);
    this.audio.missionPass();
    this.hud.banner('Mission passed', `${this.missions.title} · +$${reward}`);
    this.doSave();
    if (idx === 2) this.combat.giveWeapon('pistol', 48);
    if (idx === 4) this.combat.giveWeapon('smg', 120);
    const next = idx + 1;
    if (next < 6) {
      setTimeout(() => {
        if (this.state !== 'playing') return;
        this.missions.start(next);
        this.hud.setObjective(`Mission ${next + 1} — ${this.missions.title}`);
        this.hud.banner(this.missions.title, this.missions.objective);
      }, 2500);
    } else {
      setTimeout(() => {
        if (this.state !== 'playing') return;
        this.hud.banner('The Big One — complete', 'Vice Point is yours. All six missions done.');
      }, 2500);
    }
  }

  onMissionFail(idx, reason) {
    this.audio.missionFail();
    this.hud.banner('Mission failed', reason);
    setTimeout(() => {
      if (this.state !== 'playing') return;
      this.missions.start(idx);
      this.hud.setObjective(`Mission ${idx + 1} — ${this.missions.title}`);
    }, 2000);
  }

  onMissionStage(idx, stage) {
    void idx;
    void stage;
    this.hud.setObjective(`Mission ${this.missions.index + 1} — ${this.missions.title}: ${this.missions.objective}`);
  }

  onBusted(reason) {
    if (this.state !== 'playing') return;
    this.setState('busted');
    this.audio.missionFail();
    const fine = Math.min(BUSTED_FINE, Math.floor(this.cash * 0.2));
    this.cash = Math.max(0, this.cash - fine);
    this.hud.setCash(this.cash);
    void reason;
  }

  onWasted() {
    if (this.state !== 'playing') return;
    this.setState('wasted');
    this.audio.missionFail();
    const fine = Math.min(WASTED_FINE, Math.floor(this.cash * 0.15));
    this.cash = Math.max(0, this.cash - fine);
    this.hud.setCash(this.cash);
  }

  respawn() {
    this.police.clear();
    this.combat.clearEnemies();
    this.player.health = 100;
    this.player.armor = 0;
    if (this.player.inCar) this.exitCar();
    this.player.setPosition(HOSPITAL.x, HOSPITAL.z, Math.PI / 2);
    this.doSave();
    this.setState('playing');
  }

  pressed(code) {
    const down = this.input.isDown(code);
    const was = this.prevKeys.has(code);
    if (down) this.prevKeys.add(code);
    else this.prevKeys.delete(code);
    return down && !was;
  }

  handlePlayerInput(dt) {
    const input = this.input;
    if (this.pressed('KeyE')) {
      if (this.player.inCar) {
        this.exitCar();
      } else {
        const car = this.nearestStealable(4);
        if (car) this.enterCar(car);
      }
    }
    if (this.pressed('Digit1')) this.combat.selectWeapon('fists');
    if (this.pressed('Digit2')) this.combat.selectWeapon('pistol');
    if (this.pressed('Digit3')) this.combat.selectWeapon('smg');
    if (this.pressed('Escape') || this.pressed('KeyP')) {
      this.setState(this.state === 'playing' ? 'paused' : 'playing');
    }
    if (this.player.inCar) {
      input.consumeMouse();
      const car = this.player.inCar;
      const axes = input.axes();
      const handbrake = input.isDown('Space');
      const drifting = car.drive(dt, axes.y, -axes.x, handbrake);
      if (drifting) this.effects.driftSmoke(car.pos, car.heading);
      this.city.resolveCircle(car.pos, 1.7);
      this.audio.setEngine(car.speed, car.topSpeed);
      // Collisions with police and traffic cars.
      for (const other of [...this.police.cars, ...this.traffic.cars, ...this.missionCars]) {
        if (other === car) continue;
        const d = other.pos.distanceTo(car.pos);
        if (d < 3.6 && d > 0.01) {
          const push = (3.6 - d) * 0.5;
          const nx = (car.pos.x - other.pos.x) / d;
          const nz = (car.pos.z - other.pos.z) / d;
          car.pos.x += nx * push;
          car.pos.z += nz * push;
          if (other.isPolice && Math.abs(car.speed) > 6) {
            car.hp -= 4;
            this.effects.addShake(0.2);
            if (car.hp <= 0) {
              this.wreckPlayerCar(car);
            }
          }
        }
      }
      // The player's world position follows the car while driving, so
      // missions, police and the minimap track the car, not the spot
      // where the player got in.
      if (this.player.inCar === car) this.player.pos.set(car.pos.x, 0, car.pos.z);
    } else {
      this.player.update(dt, input, this.city.resolveCircle);
      if (input.mouseDown) {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        const origin = this.player.pos.clone();
        this.combat.shoot(origin, dir, true);
      }
    }
  }

  updateHud(dt) {
    this.hud.setWanted(this.police.wanted);
    const sirenOn = this.police.wanted > 0;
    if (sirenOn !== this.sirenOn) {
      this.sirenOn = sirenOn;
      this.audio.setSiren(sirenOn);
    }
    this.hud.setHealth(this.player.health, this.player.armor);
    const w = this.combat.weapon;
    const label = w === 'fists' ? 'Fists' : w === 'pistol' ? 'Pistol' : 'SMG';
    this.hud.setWeapon(label, w === 'fists' ? undefined : this.combat.ammo[w]);
    this.hud.setSpeed(this.player.inCar ? Math.abs(this.player.inCar.speed) * 2.24 : 0, !!this.player.inCar);
    this.hud.setObjective(`Mission ${this.missions.index + 1} — ${this.missions.title}: ${this.missions.objective}`);
    if (this.missions.index === 2 && this.missions.active) {
      this.hud.setProgress(this.missions.progress);
    } else if (this.missions.index === 5 && this.missions.stage === 1) {
      this.hud.setProgress(this.missions.progress);
    } else {
      this.hud.setProgress(null);
    }
    let hint = '';
    if (!this.player.inCar) {
      const car = this.nearestStealable(4);
      if (car) hint = 'Press E to steal the car';
      else if (this.combat.weapon !== 'fists') hint = 'Click to shoot · 1/2/3 weapons';
    } else {
      hint = 'E to exit · Space handbrake';
    }
    this.hud.setHint(hint);
    this.hud.drawMinimap(
      this.player.pos,
      this.player.inCar ? this.player.inCar.heading : this.player.heading,
      this.missions.waypoint,
      [...this.missionCars, ...this.police.cars],
      this.combat.enemies,
      this.missions.packages,
    );
    this.hud.update(dt);
  }

  updateCamera(dt) {
    if (this.shotCamera) {
      this.camera.position.copy(this.shotCamera.pos);
      this.camera.lookAt(this.shotCamera.look);
      return;
    }
    let target;
    let pos;
    if (this.player.inCar) {
      const car = this.player.inCar;
      target = new THREE.Vector3(car.pos.x, 1.5, car.pos.z);
      const back = 9.5;
      pos = new THREE.Vector3(
        car.pos.x - Math.sin(car.heading) * back,
        4.2,
        car.pos.z - Math.cos(car.heading) * back,
      );
    } else {
      target = this.player.cameraTarget();
      pos = this.player.cameraPosition();
    }
    const k = 1 - Math.exp(-dt * 7);
    this.camPos.lerp(pos, k);
    this.camLook.lerp(target, k);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.state === 'playing') {
      this.handlePlayerInput(dt);
      const allCars = [...this.traffic.cars, ...this.police.cars, ...this.missionCars];
      this.traffic.update(dt, this.player.pos, allCars);
      this.peds.update(dt);
      this.police.update(dt, this.player.pos, !!this.player.inCar, this.player.inCar ? this.player.inCar.speed : 0, allCars);
      const died = this.combat.update(dt, this.player.pos, (dmg) => {
        const dead = this.player.damage(dmg, this.effects, this.audio);
        if (dead) this.onWasted();
        return dead;
      });
      void died;
      this.missions.update(dt);
      this.city.update(dt);
      this.effects.update(dt);
      this.updateHud(dt);
      this.saveTimer += dt;
      if (this.saveTimer > 30) {
        this.saveTimer = 0;
        this.doSave();
      }
    }
    if (this.state === 'paused') {
      if (this.pressed('Escape') || this.pressed('KeyP')) {
        this.setState('playing');
      }
    }
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
