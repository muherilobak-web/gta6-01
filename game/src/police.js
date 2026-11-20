// The wanted system: stars 1–5, police cars that spawn, chase and ram, roadblocks
// from 3 stars, decay when the player is out of sight, and busted / wasted respawns.
// Police drive the same arcade cars as traffic, with a light bar and a siren.
import * as THREE from 'three';
import { CFG, CAR_MODELS } from './config.js';
import { createCar } from './vehicles.js';
import { clamp, wrapAngle } from './rng.js';

const POLICE_MODEL = { id: 'police', name: 'VPPD Interceptor', color: 0x1c1c22, top: 1.02, accel: 1.08, grip: 0.98, len: 4.6, wid: 1.9 };

export function createPolice(scene, city, rng) {
  const cars = [];
  let wanted = 0;
  let unseenTimer = 0;
  let roadblocks = [];

  function spawnCar(x, z) {
    const car = createCar(scene, POLICE_MODEL, x, z, 0, { driver: 'police', police: true });
    car.chase = true;
    cars.push(car);
    return car;
  }

  function spawnNear(px, pz, dist) {
    // Spawn on a street near the player, off-screen if possible.
    const angle = Math.random() * Math.PI * 2;
    let x = px + Math.sin(angle) * dist;
    let z = pz + Math.cos(angle) * dist;
    x = clamp(x, -CFG.HALF + 10, CFG.HALF - 10);
    z = clamp(z, -CFG.HALF + 10, CFG.HALF - 10);
    // Snap onto the nearest street so the car is on a road.
    const sx = CFG.STREET_CENTERS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const sz = CFG.STREET_CENTERS.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
    if (Math.abs(x - sx) < Math.abs(z - sz)) x = sx + 3.2; else z = sz + 3.2;
    return spawnCar(x, z);
  }

  function clearRoadblocks() {
    for (const b of roadblocks) {
      scene.remove(b.mesh);
    }
    roadblocks = [];
  }

  function makeRoadblock(x, z, heading) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x2c3a4d, roughness: 0.8 });
    const stripe = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    for (let i = -1; i <= 1; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.8), mat);
      car.position.set(i * 4.6, 0.55, 0);
      car.castShadow = true;
      g.add(car);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 0.2), stripe);
      bar.position.set(i * 4.6, 1.1, 0.95);
      g.add(bar);
    }
    g.position.set(x, 0, z);
    g.rotation.y = heading;
    scene.add(g);
    roadblocks.push({ mesh: g, x, z });
  }

  return {
    get wanted() { return wanted; },
    set wanted(v) { wanted = clamp(Math.round(v), 0, CFG.WANTED_MAX); },
    cars,
    /** Spawn a pursuit car at an exact spot (screenshot staging, missions). */
    spawnAt(x, z, heading = 0) {
      const car = spawnCar(x, z);
      car.heading = heading;
      car.mesh.group.rotation.y = heading;
      return car;
    },
    raise(amount, reason) {
      const before = wanted;
      wanted = clamp(wanted + amount, 0, CFG.WANTED_MAX);
      return { before, after: wanted, reason };
    },
    clear() {
      wanted = 0;
      unseenTimer = 0;
      for (const c of cars) {
        c.chase = false;
        scene.remove(c.mesh.group);
      }
      cars.length = 0;
      clearRoadblocks();
    },
    update(dt, time, player, playerCar, onBusted, onRam) {
      const px = playerCar ? playerCar.x : player.x;
      const pz = playerCar ? playerCar.z : player.z;
      const playerSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
      // Keep the right number of pursuit cars on the road.
      const want = CFG.POLICE_PER_STAR[wanted];
      while (cars.length < want) spawnNear(px, pz, 55 + Math.random() * 30);
      while (cars.length > want) {
        const c = cars.pop();
        scene.remove(c.mesh.group);
      }
      // Roadblocks from 3 stars: two of them, ahead of the player on the avenue.
      if (wanted >= 3 && roadblocks.length === 0) {
        makeRoadblock(px + 40, pz, 0);
        makeRoadblock(px - 40, pz, 0);
      }
      if (wanted < 3) clearRoadblocks();
      // Decay: unseen for a while and the heat cools off.
      const nearest = cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.z - pz)), Infinity);
      if (wanted > 0 && nearest > 55) {
        unseenTimer += dt;
        if (unseenTimer > CFG.WANTED_DECAY_SECONDS) {
          wanted = Math.max(0, wanted - 1);
          unseenTimer = 0;
        }
      } else unseenTimer = 0;

      for (const car of cars) {
        // Chase the player's position, ramming when close.
        const dx = px - car.x, dz = pz - car.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        const turn = wrapAngle(wantHeading - car.heading);
        const steer = clamp(turn * 2.2, -1, 1);
        const throttle = dist > 4 ? (car.speed < 30 ? 1 : 0.4) : 0.3;
        const collided = car.update(dt, throttle, steer, false, (x, z, r) => city.collideCircle(x, z, r));
        if (collided && dist < 8 && onRam) onRam(car);
        // Siren lights flash.
        const red = car.mesh.group.getObjectByName('sirenRed');
        const blue = car.mesh.group.getObjectByName('sirenBlue');
        if (red && blue) {
          const on = Math.floor(time * 6) % 2 === 0;
          red.material.color.setHex(on ? 0xff2222 : 0x551111);
          blue.material.color.setHex(on ? 0x113366 : 0x2266ff);
        }
        // Busted: a police car touches the player on foot, or rams the player's car to a stop.
        if (dist < 2.6) {
          if (!playerCar && playerSpeed < 1) {
            if (onBusted) onBusted('busted');
            return;
          }
          if (playerCar && Math.abs(playerCar.speed) < 2) {
            if (onBusted) onBusted('busted');
            return;
          }
        }
      }
    },
  };
}
