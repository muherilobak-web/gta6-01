// Vice Point — juice: particles, muzzle flashes, blood puffs, smoke,
// skid marks, explosions and screen shake. All effects are cheap pooled
// meshes so a firefight never allocates per frame.
import * as THREE from 'three';
import { clampNumber } from './rng.js';

export function makeEffects(scene) {
  const particles = [];
  const skidMarks = [];
  let shakeAmount = 0;
  let shakeTime = 0;

  const particleGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const skidGeo = new THREE.PlaneGeometry(0.5, 1.6);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 });

  function spawnParticle(x, y, z, colour, speed, life) {
    const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(particleGeo, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    particles.push({
      mesh,
      vx: (Math.random() - 0.5) * speed,
      vy: Math.random() * speed * 0.7 + 1,
      vz: (Math.random() - 0.5) * speed,
      life,
      maxLife: life,
    });
  }

  function burst(x, y, z, count, colour, speed, life) {
    for (let i = 0; i < count; i += 1) spawnParticle(x, y, z, colour, speed, life);
  }

  return {
    burst,
    blood(x, y, z) { burst(x, y, z, 10, 0xc02020, 4, 0.5); },
    smoke(x, y, z, count) {
      for (let i = 0; i < count; i += 1) {
        spawnParticle(x + (Math.random() - 0.5), y + Math.random(), z + (Math.random() - 0.5), 0x888888, 1.5, 1.1);
      }
    },
    muzzle(x, y, z, dirX, dirZ) {
      burst(x, y, z, 6, 0xffd23f, 6, 0.12);
      spawnParticle(x + dirX * 0.5, y, z + dirZ * 0.5, 0xfff2b0, 2, 0.08);
    },
    explosion(x, y, z) {
      burst(x, y, z, 34, 0xff7a2a, 11, 0.9);
      burst(x, y + 0.5, z, 16, 0xffd23f, 7, 0.6);
      burst(x, y, z, 10, 0x555555, 4, 1.4);
      this.addShake(0.7);
    },
    skid(x, z, heading) {
      if (skidMarks.length > 120) {
        const old = skidMarks.shift();
        scene.remove(old);
      }
      const mark = new THREE.Mesh(skidGeo, skidMat);
      mark.rotation.x = -Math.PI / 2;
      mark.rotation.z = heading;
      mark.position.set(x, 0.03, z);
      scene.add(mark);
      skidMarks.push(mark);
    },
    addShake(amount) {
      shakeAmount = Math.max(shakeAmount, amount);
      shakeTime = 0.4;
    },
    shakeOffset(dt) {
      if (shakeTime <= 0 || shakeAmount <= 0) return { x: 0, y: 0 };
      shakeTime -= dt;
      const decay = clampNumber(shakeTime / 0.4, 0, 1);
      if (shakeTime <= 0) shakeAmount = 0;
      return {
        x: (Math.random() - 0.5) * shakeAmount * decay,
        y: (Math.random() - 0.5) * shakeAmount * decay,
      };
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.material.dispose();
          particles.splice(i, 1);
          continue;
        }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= 9 * dt;
        p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
        p.mesh.rotation.x += dt * 4;
        p.mesh.rotation.y += dt * 5;
      }
    },
    particleCount() { return particles.length; },
  };
}
