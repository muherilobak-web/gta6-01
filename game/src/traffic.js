// Traffic: cars that drive the block loops, stop at red lights, honk when blocked and
// brake for the player. Each car follows its loop's waypoints; at a corner it turns
// toward the next one. A car the player steals loses its driver and leaves traffic.
import * as THREE from 'three';
import { CAR_MODELS } from './config.js';
import { createCar } from './vehicles.js';
import { pick, range, clamp, wrapAngle } from './rng.js';

export function createTraffic(scene, city, rng, count = 14) {
  const cars = [];
  const loops = city.loops;
  for (let i = 0; i < count; i++) {
    const model = pick(rng, CAR_MODELS);
    const loop = loops[Math.floor(rng() * loops.length)];
    const wp = Math.floor(rng() * loop.length);
    const p = loop[wp];
    const car = createCar(scene, model, p.x, p.z, rng() * Math.PI * 2, { driver: 'traffic' });
    car.loop = loop;
    car.wp = (wp + 1) % loop.length;
    car.cruise = range(rng, 7, 11);
    car.wait = 0;
    car.honked = 0;
    cars.push(car);
  }

  function nearestAhead(car, others, player) {
    // Something directly ahead within braking distance?
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let best = Infinity;
    for (const o of others) {
      if (o === car) continue;
      const dx = o.x - car.x, dz = o.z - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 12 && side < 2.4) best = Math.min(best, along);
    }
    if (player && !player.inCar) {
      const dx = player.x - car.x, dz = player.z - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 10 && side < 2) best = Math.min(best, along);
    }
    return best;
  }

  return {
    cars,
    update(dt, time, player, allCars, onHonk) {
      const phase = city.lightPhase(time);
      for (const car of cars) {
        if (!car.driver) continue; // stolen: the player (or nobody) owns it now
        const target = car.loop[car.wp];
        const dx = target.x - car.x, dz = target.z - car.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.5) { car.wp = (car.wp + 1) % car.loop.length; continue; }
        const wantHeading = Math.atan2(dx, dz);
        const turn = wrapAngle(wantHeading - car.heading);
        // Red light: stop before the intersection when crossing it.
        let stop = false;
        const nearIntersection = Math.abs(car.x - Math.round(car.x / 58) * 58) < 6 || Math.abs(car.z - Math.round(car.z / 58) * 58) < 6;
        const crossingNS = Math.abs(Math.sin(car.heading)) < 0.5;
        if (nearIntersection && ((crossingNS && phase === 'EW') || (!crossingNS && phase === 'NS'))) {
          // Only stop if actually approaching the crossing, not past it.
          stop = true;
        }
        const ahead = nearestAhead(car, allCars, player);
        if (ahead < 9) stop = true;
        if (stop) {
          car.wait += dt;
          if (car.wait > 2.5 && car.honked < 1) { car.honked += 1; if (onHonk) onHonk(car); }
          car.update(dt, 0, 0, false, (x, z, r) => city.collideCircle(x, z, r));
          continue;
        }
        car.wait = 0; car.honked = 0;
        const steer = clamp(turn * 1.6, -1, 1);
        const throttle = car.speed < car.cruise ? 0.55 : 0;
        car.update(dt, throttle, steer, false, (x, z, r) => city.collideCircle(x, z, r));
      }
    },
    /** Remove a car from traffic (stolen by the player). */
    steal(car) {
      car.driver = null;
    },
    /** The nearest traffic car to a point, within maxDist. */
    nearest(x, z, maxDist) {
      let best = null, bestD = maxDist;
      for (const car of cars) {
        if (!car.driver) continue;
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) { bestD = d; best = car; }
      }
      return best;
    },
  };
}
