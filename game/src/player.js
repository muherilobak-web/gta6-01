// Vice Point — Mara on foot. A simple articulated low-poly figure with a
// walk/run cycle, a jump, a punch animation and a third-person camera that
// orbits with the mouse, pulls in close while aiming, and swings behind the
// car while driving.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { clampNumber, normaliseAngle } from './rng.js';

export function buildPlayerFigure() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0xd84a2f, roughness: 0.7 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.85 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1c1210, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), jacket);
  torso.position.y = 1.25;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.85;
  head.castShadow = true;
  group.add(head);
  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  hairMesh.position.y = 1.9;
  group.add(hairMesh);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), jeans);
  legL.position.set(-0.17, 0.4, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), jeans);
  legR.position.set(0.17, 0.4, 0);
  legR.castShadow = true;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), jacket);
  armL.position.set(-0.42, 1.25, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), jacket);
  armR.position.set(0.42, 1.25, 0);
  armR.castShadow = true;
  group.add(armR);
  return { group, legL, legR, armL, armR };
}

export function makePlayer(scene, startX, startZ) {
  const figure = buildPlayerFigure();
  figure.group.position.set(startX, 0, startZ);
  scene.add(figure.group);
  const player = {
    mesh: figure,
    x: startX,
    z: startZ,
    y: 0,
    heading: 0,
    camYaw: 0,
    camPitch: 0.35,
    vy: 0,
    onGround: true,
    health: WORLD.playerHealth,
    armor: 0,
    inCar: null,
    walkCycle: 0,
    punchTimer: 0,
    punch() {
      this.punchTimer = 0.3;
    },
    update(dt, axes, mouse, collide) {
      this.camYaw -= mouse.x * 0.0032;
      this.camPitch = clampNumber(this.camPitch + mouse.y * 0.0022, -0.15, 1.1);
      const moving = Math.abs(axes.forward) > 0 || Math.abs(axes.strafe) > 0;
      const speed = axes.run ? WORLD.runSpeed : WORLD.walkSpeed;
      if (moving) {
        const moveAngle = this.camYaw + Math.atan2(axes.strafe, axes.forward);
        const stepX = Math.sin(moveAngle) * speed * dt;
        const stepZ = Math.cos(moveAngle) * speed * dt;
        const resolved = collide(this.x + stepX, this.z + stepZ, WORLD.playerRadius);
        this.x = resolved.x;
        this.z = resolved.z;
        this.heading = normaliseAngle(moveAngle);
        this.walkCycle += dt * speed * 1.6;
      }
      if (axes.jump && this.onGround) {
        this.vy = WORLD.jumpSpeed;
        this.onGround = false;
      }
      if (!this.onGround) {
        this.vy -= WORLD.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
          this.y = 0;
          this.vy = 0;
          this.onGround = true;
        }
      }
      if (this.punchTimer > 0) this.punchTimer -= dt;
      const swing = moving ? Math.sin(this.walkCycle) * 0.55 : 0;
      figure.legL.rotation.x = swing;
      figure.legR.rotation.x = -swing;
      figure.armL.rotation.x = -swing * 0.8;
      figure.armR.rotation.x = this.punchTimer > 0 ? -1.6 : swing * 0.8;
      figure.group.position.set(this.x, this.y, this.z);
      figure.group.rotation.y = this.heading;
    },
    updateCamera(camera, dt, shake, aiming) {
      const distance = aiming ? 3.4 : 5.2;
      const height = aiming ? 1.9 : 2.6;
      const targetX = this.x - Math.sin(this.camYaw) * distance;
      const targetZ = this.z - Math.cos(this.camYaw) * distance;
      const targetY = this.y + height + this.camPitch * 1.6;
      camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 9);
      camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 9);
      camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 9);
      camera.lookAt(
        this.x + Math.sin(this.camYaw) * 3 + shake.x,
        this.y + 1.4 + shake.y,
        this.z + Math.cos(this.camYaw) * 3,
      );
    },
    updateCarCamera(camera, car, dt, shake) {
      const back = 8.5;
      const height = 3.4;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      const targetX = car.x - fx * back;
      const targetZ = car.z - fz * back;
      camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 6);
      camera.position.y += (height - camera.position.y) * Math.min(1, dt * 6);
      camera.position.z += (targetZ - camera.position.z) * Math.min(1, dt * 6);
      camera.lookAt(car.x + fx * 8 + shake.x, 1.2 + shake.y, car.z + fz * 8);
    },
  };
  return player;
}
