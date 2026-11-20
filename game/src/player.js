// Mara Reyes on foot: a low-poly articulated figure, third-person camera
// with mouse orbit, run, jump, punch. Entering a car hands control to
// the vehicle module; exiting drops her beside it.

import * as THREE from 'three';
import { WALK_SPEED, RUN_SPEED, JUMP_SPEED, GRAVITY } from './config.js';

function limbMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.pos = new THREE.Vector3(-140, 0, -140);
    this.heading = Math.PI / 2;
    this.camYaw = Math.PI / 2;
    this.camPitch = 0.32;
    this.velY = 0;
    this.grounded = true;
    this.inCar = null;
    this.walkPhase = 0;
    this.moving = false;
    this.health = 100;
    this.armor = 0;
    this.group = new THREE.Group();
    const skin = limbMat(0xc98a5e);
    const jacket = limbMat(0x2e6f6a);
    const pants = limbMat(0x2a2a33);
    const hair = limbMat(0x1c1410);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.26), pants);
    this.legL.position.set(-0.16, 0.42, 0);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.2), jacket);
    this.armL.position.set(-0.36, 1.15, 0);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.36;
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 0.34), jacket);
    this.torso.position.y = 1.2;
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
    this.head.position.y = 1.82;
    this.hairM = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), hair);
    this.hairM.position.y = 2.02;
    this.group.add(this.legL, this.legR, this.armL, this.armR, this.torso, this.head, this.hairM);
    // Soft blob shadow.
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.group.add(shadow);
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  setPosition(x, z, heading) {
    this.pos.set(x, 0, z);
    if (heading !== undefined) {
      this.heading = heading;
      this.camYaw = heading;
    }
    this.group.position.copy(this.pos);
  }

  update(dt, input, resolveCircle) {
    if (this.inCar) return;
    const axes = input.axes();
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = run ? RUN_SPEED : WALK_SPEED;
    const mouse = input.consumeMouse();
    this.camYaw -= mouse.dx * 0.0032;
    this.camPitch = Math.max(-0.15, Math.min(0.7, this.camPitch + mouse.dy * 0.0022));
    const sin = Math.sin(this.camYaw);
    const cos = Math.cos(this.camYaw);
    // Camera-relative movement: forward is where the camera looks.
    let mx = 0;
    let mz = 0;
    if (axes.y !== 0 || axes.x !== 0) {
      const fx = -sin;
      const fz = -cos;
      const rx = -cos;
      const rz = sin;
      mx = fx * axes.y + rx * axes.x;
      mz = fz * axes.y + rz * axes.x;
      const len = Math.hypot(mx, mz) || 1;
      mx /= len;
      mz /= len;
      this.heading = Math.atan2(mx, mz);
    }
    this.moving = axes.x !== 0 || axes.y !== 0;
    this.pos.x += mx * speed * dt;
    this.pos.z += mz * speed * dt;
    if (this.grounded && input.isDown('Space')) {
      this.velY = JUMP_SPEED;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.velY -= GRAVITY * dt;
      this.pos.y += this.velY * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.velY = 0;
        this.grounded = true;
      }
    }
    if (resolveCircle) resolveCircle(this.pos, 0.55);
    // Walk cycle.
    if (this.moving && this.grounded) {
      this.walkPhase += dt * speed * 1.5;
      const s = Math.sin(this.walkPhase) * 0.55;
      this.legL.rotation.x = s;
      this.legR.rotation.x = -s;
      this.armL.rotation.x = -s * 0.8;
      this.armR.rotation.x = s * 0.8;
    } else {
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8;
      this.armR.rotation.x *= 0.8;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  cameraTarget() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.7, this.pos.z);
  }

  cameraPosition() {
    const dist = 6.2;
    const h = 2.6 + Math.sin(this.camPitch) * 3.2;
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.camYaw) * dist,
      this.pos.y + h,
      this.pos.z + Math.cos(this.camYaw) * dist,
    );
  }

  damage(amount, effects, audio) {
    let left = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, left * 0.6);
      this.armor -= absorbed;
      left -= absorbed;
    }
    this.health -= left;
    if (effects) effects.addShake(0.25);
    if (this.health < 0) this.health = 0;
    return this.health <= 0;
  }
}
