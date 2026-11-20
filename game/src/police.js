// Wanted stars and the police who answer them. Heat rises with crimes
// and decays out of sight; interceptors spawn, chase and ram; at three
// stars and up they set roadblocks; cornered on foot, the player is
// busted.

import * as THREE from 'three';
import { Car } from './vehicles.js';
import { POLICE_PER_STAR, MAX_WANTED, HEAT_PER_STAR, HEAT_DECAY_PER_SECOND, HEAT_LOSE_SIGHT_SECONDS, POLICE_VIEW_RANGE, ROAD_POSITIONS } from './config.js';
import { makeRng, range } from './rng.js';

export class Police {
  constructor(scene, resolveCircle, onBusted) {
    this.scene = scene;
    this.resolveCircle = resolveCircle;
    this.onBusted = onBusted;
    this.heat = 0;
    this.stars = 0;
    this.cars = [];
    this.rng = makeRng(47);
    this.unseenTimer = 0;
    this.bustedTimer = 0;
    this.flashPhase = 0;
    this.roadblocks = [];
  }

  get wanted() {
    return this.stars;
  }

  addHeat(amount, pos) {
    this.heat = Math.min(MAX_WANTED * HEAT_PER_STAR, this.heat + amount);
    this.unseenTimer = 0;
    this.syncStars();
    void pos;
  }

  setWanted(stars) {
    // Start at the top of the star's heat band, so the level survives
    // a few seconds of decay, and restart the unseen timer so the
    // player has to break sight after the heat is gained, not before.
    this.heat = Math.min(
      MAX_WANTED * HEAT_PER_STAR,
      stars * HEAT_PER_STAR + HEAT_PER_STAR - 1,
    );
    this.unseenTimer = 0;
    this.syncStars();
  }

  syncStars() {
    const s = Math.min(MAX_WANTED, Math.floor(this.heat / HEAT_PER_STAR));
    if (s !== this.stars) {
      this.stars = s;
      this.syncCars();
    }
  }

  spawnPoint(playerPos) {
    // A road point 60-90 units from the player.
    for (let tries = 0; tries < 12; tries++) {
      const road = ROAD_POSITIONS[Math.floor(this.rng() * ROAD_POSITIONS.length)];
      const along = range(this.rng, -165, 165);
      const p = this.rng() < 0.5 ? { x: road, z: along } : { x: along, z: road };
      const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
      if (d > 55 && d < 110) return p;
    }
    return { x: playerPos.x + 70, z: playerPos.z };
  }

  syncCars() {
    const want = POLICE_PER_STAR[this.stars];
    while (this.cars.length < want) {
      const p = this.spawnPoint(this.lastPlayerPos || new THREE.Vector3(0, 0, 0));
      const car = new Car(this.scene, 'sedan', p.x, p.z, 0, true);
      car.isPolice = true;
      this.cars.push(car);
    }
    while (this.cars.length > want) {
      const car = this.cars.pop();
      car.remove();
    }
    // Roadblocks at 3+ stars: two parked interceptors ahead of the player.
    if (this.stars >= 3 && this.roadblocks.length === 0 && this.lastPlayerPos) {
      for (let i = 0; i < 2; i++) {
        const p = this.spawnPoint(this.lastPlayerPos);
        const car = new Car(this.scene, 'sedan', p.x, p.z, this.rng() * Math.PI * 2, true);
        car.isPolice = true;
        car.isRoadblock = true;
        this.cars.push(car);
        this.roadblocks.push(car);
      }
    }
    if (this.stars < 3) {
      for (const rb of this.roadblocks) {
        const idx = this.cars.indexOf(rb);
        if (idx >= 0) this.cars.splice(idx, 1);
        rb.remove();
      }
      this.roadblocks = [];
    }
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.unseenTimer = 0;
    this.bustedTimer = 0;
    for (const car of this.cars) car.remove();
    this.cars = [];
    this.roadblocks = [];
  }

  update(dt, playerPos, playerInCar, playerSpeed, allCars) {
    this.lastPlayerPos = playerPos;
    this.flashPhase += dt * 6;
    const flash = Math.sin(this.flashPhase) > 0;
    for (const car of this.cars) {
      if (car.mesh.userData.lightRed && car.mesh.userData.lightBlue) {
        car.mesh.userData.lightRed.material.color.setHex(flash ? 0xff2020 : 0x551010);
        car.mesh.userData.lightBlue.material.color.setHex(flash ? 0x101050 : 0x2040ff);
      }
    }
    // Decay when no interceptor is close.
    let nearest = Infinity;
    for (const car of this.cars) {
      nearest = Math.min(nearest, car.pos.distanceTo(playerPos));
    }
    if (nearest > POLICE_VIEW_RANGE) {
      this.unseenTimer += dt;
      if (this.unseenTimer > HEAT_LOSE_SIGHT_SECONDS) {
        this.heat = Math.max(0, this.heat - HEAT_DECAY_PER_SECOND * dt);
        this.syncStars();
      }
    } else {
      this.unseenTimer = 0;
    }
    // Chase and ram.
    for (const car of this.cars) {
      if (car.isRoadblock) continue;
      // Stuck recovery: a car wedged on a building corner reverses out
      // instead of grinding against the wall forever.
      if (car.stuckCheck === undefined) {
        car.stuckCheck = 0;
        car.lastX = car.pos.x;
        car.lastZ = car.pos.z;
        car.reverseTimer = 0;
      }
      car.stuckCheck += dt;
      if (car.stuckCheck > 2) {
        const moved = Math.hypot(car.pos.x - car.lastX, car.pos.z - car.lastZ);
        if (moved < 2) car.reverseTimer = 1.2;
        car.lastX = car.pos.x;
        car.lastZ = car.pos.z;
        car.stuckCheck = 0;
      }
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // Cornering the player on foot: pull up beside them and stop, so
      // the bust timer can run. At chase speed the stock throttle-0
      // drag (0.6/s) is far too weak to halt before overshooting, so cap
      // the approach speed, brake hard, and creep in from a standstill
      // if halted outside busting range. While cornering the car is
      // parked on purpose, not stuck: keep the stuck timer from firing.
      const cornering = !playerInCar && dist < 10;
      if (cornering) {
        car.stuckCheck = 0;
        car.lastX = car.pos.x;
        car.lastZ = car.pos.z;
        car.reverseTimer = 0;
      }
      let throttle = dist > 6 ? 1 : 0.4;
      let steer = Math.max(-1, Math.min(1, dh * 2.2));
      if (car.reverseTimer > 0) {
        car.reverseTimer -= dt;
        throttle = -0.7;
        steer = -steer;
      }
      if (cornering) {
        // Creep in from outside busting range; halt once inside it.
        throttle = dist > 4 ? 0.25 : 0;
      }
      car.drive(dt, throttle, steer, false);
      if (cornering) {
        // Approach-speed cap + hard brake, applied after drive so the
        // cap holds: halt beside the player inside busting range.
        car.speed = Math.min(car.speed, 6);
        if (throttle === 0) car.speed *= Math.max(0, 1 - 4 * dt);
      }
      // Interceptors get faster with the wanted level, but a one-star
      // tail is always outrunnable — even in the slowest street car —
      // so the player can lose it by driving away, not just by hiding.
      car.speed = Math.min(car.speed, 22 + this.stars * 2.5);
      this.resolveCircle(car.pos, 1.6);
      // Ram: push the player's car, or corner the player on foot.
      if (dist < 4.5) {
        if (!playerInCar) {
          this.bustedTimer += dt;
          if (this.bustedTimer > 1.5 && this.onBusted) this.onBusted('busted');
        } else {
          this.bustedTimer = 0;
        }
      }
    }
    if (nearest > 6 || playerInCar) {
      if (nearest > 6) this.bustedTimer = Math.max(0, this.bustedTimer - dt);
    }
    // Police cars push each other apart lightly.
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 4) {
          const push = (4 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
        }
      }
    }
    void allCars;
    void playerSpeed;
  }
}
