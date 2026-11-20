// Cars: five models with distinct stats and colours, arcade driving,
// and the shared car factory the player, traffic and police all use.

import * as THREE from 'three';
import { CAR_TOP_SPEEDS, CAR_ACCEL, CAR_GRIP } from './config.js';

export const CAR_TYPES = ['sedan', 'coupe', 'suv', 'pickup', 'taxi'];

const CAR_COLORS = {
  sedan: 0x5a7a9a,
  coupe: 0xc03028,
  suv: 0x2e4a2e,
  pickup: 0xd07a20,
  taxi: 0xe8c020,
  police: 0x181c22,
};

const CAR_SIZES = {
  sedan: { w: 1.9, l: 4.4, h: 0.72, cabin: 0.62 },
  coupe: { w: 1.85, l: 4.2, h: 0.62, cabin: 0.55 },
  suv: { w: 2.05, l: 4.7, h: 0.95, cabin: 0.85 },
  pickup: { w: 2.0, l: 4.9, h: 0.8, cabin: 0.7 },
  taxi: { w: 1.9, l: 4.4, h: 0.72, cabin: 0.62 },
  police: { w: 1.95, l: 4.5, h: 0.75, cabin: 0.62 },
};

export function buildCarMesh(type, police) {
  const key = police ? 'police' : type;
  const size = CAR_SIZES[key];
  const color = police ? CAR_COLORS.police : CAR_COLORS[type];
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.7 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(size.w, size.h, size.l), bodyMat);
  body.position.y = 0.62;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(size.w * 0.86, size.cabin, size.l * 0.48), glassMat);
  cabin.position.set(0, 0.62 + size.h / 2 + size.cabin / 2 - 0.08, -size.l * 0.06);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheels = [];
  for (const [wx, wz] of [[-size.w / 2, size.l * 0.32], [size.w / 2, size.l * 0.32], [-size.w / 2, -size.l * 0.32], [size.w / 2, -size.l * 0.32]]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), headMat);
    hl.position.set(sx * (size.w / 2 - 0.3), 0.72, size.l / 2 + 0.01);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
    tl.position.set(sx * (size.w / 2 - 0.3), 0.72, -size.l / 2 - 0.01);
    g.add(tl);
  }
  if (police) {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.4), darkMat);
    barBase.position.set(0, 0.62 + size.h / 2 + size.cabin + 0.02, -0.1);
    g.add(barBase);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.38), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.28, 0.62 + size.h / 2 + size.cabin + 0.03, -0.1);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.38), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.28, 0.62 + size.h / 2 + size.cabin + 0.03, -0.1);
    g.add(blue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }));
    door.position.set(0, 0.62, size.w / 2 + 0.01);
    door.rotation.y = Math.PI / 2;
    g.add(door);
  }
  if (type === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    sign.position.set(0, 0.62 + size.h / 2 + size.cabin + 0.05, 0);
    g.add(sign);
  }
  // Soft blob shadow.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, size.l / 2.2, 1);
  shadow.position.y = 0.03;
  g.add(shadow);
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(scene, type, x, z, heading, police) {
    this.type = type;
    this.police = !!police;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.hp = 100;
    this.topSpeed = CAR_TOP_SPEEDS[type] || 30;
    this.accel = CAR_ACCEL[type] || 14;
    this.grip = CAR_GRIP[type] || 7.5;
    this.mesh = buildCarMesh(type, this.police);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    scene.add(this.mesh);
    this.scene = scene;
  }

  // Arcade drive: throttle -1..1, steer -1..1, handbrake bool.
  drive(dt, throttle, steer, handbrake) {
    const targetSteer = steer * (0.55 + 0.25 * (1 - Math.min(1, Math.abs(this.speed) / this.topSpeed)));
    this.steer += (targetSteer - this.steer) * Math.min(1, dt * 8);
    const accel = throttle * this.accel;
    this.speed += accel * dt;
    if (throttle === 0) this.speed -= this.speed * 0.6 * dt;
    if (handbrake) {
      this.speed -= this.speed * 1.4 * dt;
      this.heading += this.steer * dt * (this.speed / 8) * 1.7;
    } else {
      this.heading += this.steer * dt * (this.speed / 6);
    }
    this.speed = Math.max(-this.topSpeed * 0.45, Math.min(this.topSpeed, this.speed));
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
    return handbrake && Math.abs(this.speed) > 12;
  }

  remove() {
    this.scene.remove(this.mesh);
  }
}
