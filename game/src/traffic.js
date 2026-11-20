// Vice Point — traffic. Cars drive the block loops, brake for the car
// ahead and for pedestrians, stop at red lights, and honk when they have
// waited too long. A stolen car loses its driver and leaves traffic.
import { VEHICLE_TYPES } from './config.js';
import { makeCar } from './vehicles.js';
import { chooseOne, inRange, clampNumber, normaliseAngle } from './rng.js';

export function makeTraffic(scene, city, random, count = 14) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const type = chooseOne(random, VEHICLE_TYPES);
    const loop = city.loops[Math.floor(random() * city.loops.length)];
    const wp = Math.floor(random() * loop.length);
    const spot = loop[wp];
    const car = makeCar(scene, type, spot.x, spot.z, random() * Math.PI * 2, { driver: 'traffic' });
    car.loop = loop;
    car.wp = (wp + 1) % loop.length;
    car.cruise = inRange(random, 7, 11);
    car.wait = 0;
    car.honked = 0;
    cars.push(car);
  }

  function distanceAhead(car, others, player) {
    const fx = Math.sin(car.heading);
    const fz = Math.cos(car.heading);
    let best = Infinity;
    for (const other of others) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const along = dx * fx + dz * fz;
      const side = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along < 12 && side < 2.4) best = Math.min(best, along);
    }
    if (player && !player.inCar) {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
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
        if (!car.driver) continue;
        const target = car.loop[car.wp];
        const dx = target.x - car.x;
        const dz = target.z - car.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 3.5) {
          car.wp = (car.wp + 1) % car.loop.length;
          continue;
        }
        const wantHeading = Math.atan2(dx, dz);
        const turn = normaliseAngle(wantHeading - car.heading);
        let stopped = false;
        const nearCrossing = Math.abs(car.x - Math.round(car.x / 58) * 58) < 6
          || Math.abs(car.z - Math.round(car.z / 58) * 58) < 6;
        const crossingNS = Math.abs(Math.sin(car.heading)) < 0.5;
        if (nearCrossing && ((crossingNS && phase === 'EW') || (!crossingNS && phase === 'NS'))) stopped = true;
        if (distanceAhead(car, allCars, player) < 9) stopped = true;
        if (stopped) {
          car.wait += dt;
          if (car.wait > 2.5 && car.honked < 1) {
            car.honked += 1;
            if (onHonk) onHonk(car);
          }
          car.update(dt, 0, 0, false, (x, z, r) => city.collideCircle(x, z, r));
          continue;
        }
        car.wait = 0;
        car.honked = 0;
        const steer = clampNumber(turn * 1.6, -1, 1);
        const throttle = car.speed < car.cruise ? 0.55 : 0;
        car.update(dt, throttle, steer, false, (x, z, r) => city.collideCircle(x, z, r));
      }
    },
    steal(car) {
      car.driver = null;
    },
    nearest(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const car of cars) {
        if (!car.driver) continue;
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },
  };
}
