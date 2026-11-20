// Vice Point — cars. Five low-poly models built from boxes and cylinders,
// plus the arcade driving model every driver shares: acceleration, braking,
// steering that bites harder with speed, handbrake drift, and damage that
// slows a car and eventually blows it up. Traffic, police, missions and the
// player all drive through the same update() below.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { clampNumber, normaliseAngle } from './rng.js';

const GLASS_MAT = new THREE.MeshStandardMaterial({ color: 0x1c2836, roughness: 0.15, metalness: 0.6 });
const TYRE_MAT = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
const CHROME_MAT = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.35, metalness: 0.7 });

export function buildCarMesh(type, options = {}) {
  const paint = new THREE.MeshStandardMaterial({
    color: options.colour ?? type.colour, roughness: 0.4, metalness: 0.35,
  });
  const group = new THREE.Group();
  const len = type.length;
  const wid = type.width;
  const tall = type.id === 'suv' || type.id === 'pickup' ? 0.85 : 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, tall, wid), paint);
  body.position.y = 0.55 + tall / 2 - 0.31;
  body.castShadow = true;
  group.add(body);
  if (type.id === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(len * 0.42, 0.35, wid * 0.86), CHROME_MAT);
    bed.position.set(-len * 0.24, 0.95, 0);
    group.add(bed);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(len * 0.32, 0.62, wid * 0.92), GLASS_MAT);
    cab.position.set(len * 0.24, 1.05, 0);
    cab.castShadow = true;
    group.add(cab);
  } else {
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(len * 0.5, 0.55, wid * 0.88), GLASS_MAT);
    cabin.position.set(-len * 0.04, body.position.y + tall / 2 + 0.22, 0);
    cabin.castShadow = true;
    group.add(cabin);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.34), headMat);
    head.position.set(len / 2, 0.62, side * (wid / 2 - 0.32));
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.34), tailMat);
    tail.position.set(-len / 2, 0.62, side * (wid / 2 - 0.32));
    group.add(tail);
  }
  if (type.id === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.28, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffd23f }),
    );
    sign.position.set(0, 1.62, 0);
    group.add(sign);
  }
  if (options.police) {
    const barBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    barBase.position.set(-0.1, 1.55, 0);
    group.add(barBase);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    red.position.set(-0.1, 1.7, -0.3);
    red.name = 'sirenRed';
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.2, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2266ff }),
    );
    blue.position.set(-0.1, 1.7, 0.3);
    blue.name = 'sirenBlue';
    group.add(blue);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  wheelGeo.rotateX(Math.PI / 2);
  const wheels = [];
  const wheelSpots = [
    [len * 0.32, wid / 2 - 0.05], [len * 0.32, -wid / 2 + 0.05],
    [-len * 0.32, wid / 2 - 0.05], [-len * 0.32, -wid / 2 + 0.05],
  ];
  for (const [wx, wz] of wheelSpots) {
    const wheel = new THREE.Mesh(wheelGeo, TYRE_MAT);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels, model: type };
}

export function makeCar(scene, type, x, z, heading, options = {}) {
  const mesh = buildCarMesh(type, options);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = heading;
  scene.add(mesh.group);
  const car = {
    mesh,
    model: type,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    damage: 0,
    alarm: false,
    driver: options.driver ?? null,
    radius: Math.max(type.length, type.width) / 2,
    // throttle -1..1, steerTarget -1..1 (left positive), handbrake bool.
    update(dt, throttle, steerTarget, handbrake, collide) {
      const topSpeed = WORLD.carTopSpeed * type.topFactor * (this.damage > 0.8 ? 0.6 : 1);
      const accel = WORLD.carAccel * type.accelFactor;
      if (throttle > 0) {
        this.speed += accel * throttle * dt;
      } else if (throttle < 0) {
        this.speed += (this.speed > 0.5 ? -WORLD.carBrake : -accel * 0.6) * dt;
        if (this.speed < -9) this.speed = -9;
      } else {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
      }
      if (this.speed > topSpeed) this.speed = topSpeed;
      if (this.speed < -9) this.speed = -9;
      const speedFactor = clampNumber(Math.abs(this.speed) / 14, 0, 1);
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
      const grip = handbrake ? 0.45 : type.grip;
      this.heading += this.steer * WORLD.carSteer * speedFactor * grip * dt * Math.sign(this.speed || 1);
      const nextX = this.x + Math.sin(this.heading) * this.speed * dt;
      const nextZ = this.z + Math.cos(this.heading) * this.speed * dt;
      const resolved = collide ? collide(nextX, nextZ, this.radius * 0.8) : { x: nextX, z: nextZ };
      const hitWall = resolved.x !== nextX || resolved.z !== nextZ;
      if (hitWall) {
        this.speed *= 0.55;
        if (Math.abs(this.speed) > 6) this.damage = Math.min(1, this.damage + 0.04);
      }
      this.x = resolved.x;
      this.z = resolved.z;
      mesh.group.position.set(this.x, 0, this.z);
      mesh.group.rotation.y = this.heading;
      mesh.group.rotation.z = -this.steer * speedFactor * 0.05;
      for (const wheel of mesh.wheels) wheel.rotation.y += (this.speed * dt) / 0.36;
      return hitWall;
    },
    addDamage(amount) {
      this.damage = Math.min(1, this.damage + amount);
      return this.damage;
    },
  };
  return car;
}
