// Vice Point — the wanted system. Stars 1–5: police interceptors spawn,
// chase and ram, roadblocks appear from 3 stars, and the heat cools off
// when the player stays out of sight for a while. Busted on foot (or rammed
// to a stop in a car) ends the run with a fine.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeCar } from './vehicles.js';
import { clampNumber, normaliseAngle } from './rng.js';

const INTERCEPTOR = {
  id: 'police', label: 'VPPD Interceptor', colour: 0x1c1c22,
  topFactor: 1.02, accelFactor: 1.08, grip: 0.98, length: 4.6, width: 1.9,
};

export function makePolice(scene, city) {
  const cars = [];
  let wanted = 0;
  let unseenFor = 0;
  let blocks = [];

  function spawnCar(x, z) {
    const car = makeCar(scene, INTERCEPTOR, x, z, 0, { driver: 'police', police: true });
    car.chase = true;
    cars.push(car);
    return car;
  }

  function spawnNear(px, pz, distance) {
    const angle = Math.random() * Math.PI * 2;
    let x = clampNumber(px + Math.sin(angle) * distance, -WORLD.halfWidth + 10, WORLD.halfWidth - 10);
    let z = clampNumber(pz + Math.cos(angle) * distance, -WORLD.halfWidth + 10, WORLD.halfWidth - 10);
    const snapX = WORLD.streetLines.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const snapZ = WORLD.streetLines.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
    if (Math.abs(x - snapX) < Math.abs(z - snapZ)) x = snapX + 3.2;
    else z = snapZ + 3.2;
    return spawnCar(x, z);
  }

  function clearBlocks() {
    for (const block of blocks) scene.remove(block.mesh);
    blocks = [];
  }

  function buildBlock(x, z, heading) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2c3a4d, roughness: 0.8 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    for (let i = -1; i <= 1; i += 1) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.1, 1.8), bodyMat);
      barrier.position.set(i * 4.6, 0.55, 0);
      barrier.castShadow = true;
      group.add(barrier);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.25, 0.2), stripeMat);
      stripe.position.set(i * 4.6, 1.1, 0.95);
      group.add(stripe);
    }
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    scene.add(group);
    blocks.push({ mesh: group, x, z });
  }

  return {
    get wanted() { return wanted; },
    set wanted(value) { wanted = clampNumber(Math.round(value), 0, WORLD.maxWanted); },
    cars,
    spawnAt(x, z, heading = 0) {
      const car = spawnCar(x, z);
      car.heading = heading;
      car.mesh.group.rotation.y = heading;
      return car;
    },
    raise(amount) {
      const before = wanted;
      wanted = clampNumber(wanted + amount, 0, WORLD.maxWanted);
      return { before, after: wanted };
    },
    clear() {
      wanted = 0;
      unseenFor = 0;
      for (const car of cars) {
        car.chase = false;
        scene.remove(car.mesh.group);
      }
      cars.length = 0;
      clearBlocks();
    },
    update(dt, time, player, playerCar, onBusted, onRam) {
      const px = playerCar ? playerCar.x : player.x;
      const pz = playerCar ? playerCar.z : player.z;
      const playerSpeed = playerCar ? Math.abs(playerCar.speed) : 0;
      const wantCount = WORLD.policePerStar[wanted];
      while (cars.length < wantCount) spawnNear(px, pz, 55 + Math.random() * 30);
      while (cars.length > wantCount) {
        const car = cars.pop();
        scene.remove(car.mesh.group);
      }
      if (wanted >= 3 && blocks.length === 0) {
        buildBlock(px + 40, pz, 0);
        buildBlock(px - 40, pz, 0);
      }
      if (wanted < 3) clearBlocks();
      const nearest = cars.reduce((m, c) => Math.min(m, Math.hypot(c.x - px, c.z - pz)), Infinity);
      if (wanted > 0 && nearest > 55) {
        unseenFor += dt;
        if (unseenFor > WORLD.wantedCoolSeconds) {
          wanted = Math.max(0, wanted - 1);
          unseenFor = 0;
        }
      } else {
        unseenFor = 0;
      }
      for (const car of cars) {
        const dx = px - car.x;
        const dz = pz - car.z;
        const dist = Math.hypot(dx, dz);
        const wantHeading = Math.atan2(dx, dz);
        const turn = normaliseAngle(wantHeading - car.heading);
        const steer = clampNumber(turn * 2.2, -1, 1);
        const throttle = dist > 4 ? (car.speed < 30 ? 1 : 0.4) : 0.3;
        const hitWall = car.update(dt, throttle, steer, false, (x, z, r) => city.collideCircle(x, z, r));
        if (hitWall && dist < 8 && onRam) onRam(car);
        const red = car.mesh.group.getObjectByName('sirenRed');
        const blue = car.mesh.group.getObjectByName('sirenBlue');
        if (red && blue) {
          const lit = Math.floor(time * 6) % 2 === 0;
          red.material.color.setHex(lit ? 0xff2222 : 0x551111);
          blue.material.color.setHex(lit ? 0x113366 : 0x2266ff);
        }
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
