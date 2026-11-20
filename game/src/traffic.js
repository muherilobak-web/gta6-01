// Traffic: cars that follow the road grid, slow for the car ahead and
// for intersections, and respawn far from the player so the streets
// always feel alive.

import * as THREE from 'three';
import { Car, CAR_TYPES } from './vehicles.js';
import { TRAFFIC_COUNT, TRAFFIC_SPEED } from './config.js';
import { makeRng, pick, range } from './rng.js';

export class Traffic {
  constructor(scene, intersections, resolveCircle) {
    this.scene = scene;
    this.intersections = intersections;
    this.resolveCircle = resolveCircle;
    this.cars = [];
    this.rng = makeRng(21);
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
      this.spawn(false);
    }
  }

  randomRoadPoint() {
    const a = pick(this.rng, this.intersections);
    const b = pick(this.rng, this.intersections);
    const t = this.rng();
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  }

  spawn(farFromPlayer) {
    const type = pick(this.rng, CAR_TYPES);
    const p = this.randomRoadPoint();
    const heading = this.rng() * Math.PI * 2;
    const car = new Car(this.scene, type, p.x, p.z, heading, false);
    car.route = this.makeRoute(p);
    car.wait = 0;
    this.cars.push(car);
    return car;
  }

  makeRoute(from) {
    const route = [];
    let cur = from;
    for (let i = 0; i < 6; i++) {
      const next = pick(this.rng, this.intersections);
      route.push({ x: next.x, z: next.z });
      cur = next;
    }
    return route;
  }

  update(dt, playerPos, allCars) {
    for (const car of this.cars) {
      if (!car.route || car.route.length === 0) car.route = this.makeRoute(car.pos);
      const target = car.route[0];
      const dx = target.x - car.pos.x;
      const dz = target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        car.route.shift();
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      // Slow for the car ahead and near intersections.
      let throttle = 0.55;
      for (const other of allCars) {
        if (other === car) continue;
        const ox = other.pos.x - car.pos.x;
        const oz = other.pos.z - car.pos.z;
        const od = Math.hypot(ox, oz);
        if (od < 12) {
          const ahead = (ox * Math.sin(car.heading) + oz * Math.cos(car.heading)) / (od || 1);
          if (ahead > 0.6) {
            throttle = od < 7 ? -0.4 : 0.15;
            break;
          }
        }
      }
      if (dist < 10) throttle = Math.min(throttle, 0.3);
      const drifting = car.drive(dt, throttle, Math.max(-1, Math.min(1, dh * 1.6)), false);
      car.speed = Math.min(car.speed, TRAFFIC_SPEED);
      this.resolveCircle(car.pos, 1.6);
      // Far from the player, recycle the car onto a nearer road.
      if (playerPos && car.pos.distanceTo(playerPos) > 260) {
        const p = this.randomRoadPoint();
        car.pos.set(p.x, 0, p.z);
        car.route = this.makeRoute(p);
        car.speed = 0;
      }
      void drifting;
    }
  }

  nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      const d = car.pos.distanceTo(pos);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }
}
