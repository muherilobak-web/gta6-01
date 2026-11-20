// Vice Point district: a 6x6-block coastal city at golden hour.
// Ground is one painted canvas (roads, sidewalks, blocks, beach); the
// buildings are procedural boxes with canvas facades; the sky is a
// gradient dome whose warm band straddles the horizon.

import * as THREE from 'three';
import { ROAD_POSITIONS, ROAD_WIDTH, WORLD_HALF, BEACH_X0, BEACH_X1, HARBOUR, WATER_X, PLAYER_START, HOSPITAL, GARAGE, STASH_HOUSE, BANK, DOCKS } from './config.js';
import { makeRng, pick, range, rangeInt } from './rng.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture() {
  const S = 1024;
  const span = 420;
  const toPx = (v) => ((v + span / 2) / span) * S;
  return canvasTexture(S, S, (g) => {
    g.fillStyle = '#b3aa9c';
    g.fillRect(0, 0, S, S);
    // Block pavement tones.
    for (let bx = -3; bx <= 2; bx++) {
      for (let bz = -3; bz <= 2; bz++) {
        const shade = 168 + ((bx * 7 + bz * 13) % 5) * 4;
        g.fillStyle = `rgb(${shade},${shade - 6},${shade - 16})`;
        g.fillRect(toPx(bx * 60 - 23), toPx(bz * 60 - 23), toPx(46) - toPx(0), toPx(46) - toPx(0));
      }
    }
    // Roads.
    g.fillStyle = '#33363c';
    for (const p of ROAD_POSITIONS) {
      g.fillRect(toPx(p - ROAD_WIDTH / 2), 0, toPx(ROAD_WIDTH) - toPx(0), S);
      g.fillRect(0, toPx(p - ROAD_WIDTH / 2), S, toPx(ROAD_WIDTH) - toPx(0));
    }
    // Centre dashes.
    g.fillStyle = '#d8b13a';
    for (const p of ROAD_POSITIONS) {
      for (let d = -200; d < 200; d += 16) {
        g.fillRect(toPx(p - 0.4), toPx(d), toPx(0.8) - toPx(0), toPx(6) - toPx(0));
        g.fillRect(toPx(d), toPx(p - 0.4), toPx(6) - toPx(0), toPx(0.8) - toPx(0));
      }
    }
    // Sidewalks.
    g.fillStyle = '#c9c2b4';
    for (const p of ROAD_POSITIONS) {
      const w = ROAD_WIDTH / 2 + 3;
      g.fillRect(toPx(p - w), 0, toPx(3) - toPx(0), S);
      g.fillRect(toPx(p + w - 3), 0, toPx(3) - toPx(0), S);
      g.fillRect(0, toPx(p - w), S, toPx(3) - toPx(0));
      g.fillRect(0, toPx(p + w - 3), S, toPx(3) - toPx(0));
    }
    // Beach sand on the west edge.
    g.fillStyle = '#d9c08a';
    g.fillRect(toPx(-210), 0, toPx(BEACH_X1) - toPx(-210), S);
    // Harbour basin floor (water plane sits on top).
    g.fillStyle = '#274b5e';
    g.fillRect(toPx(HARBOUR.x0), toPx(HARBOUR.z0), toPx(HARBOUR.x1) - toPx(HARBOUR.x0), toPx(HARBOUR.z1) - toPx(HARBOUR.z0));
  });
}

function facadeTexture(base, lit) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, h - 14, w, 14);
    const cols = 6;
    const rows = 12;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = 8 + c * 20;
        const y = 10 + r * 20;
        const warm = Math.random() < lit;
        g.fillStyle = warm ? '#ffd98a' : '#2c3a4a';
        g.fillRect(x, y, 12, 14);
      }
    }
  });
}

function signTexture(text, fg, bg) {
  return canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function skyTexture() {
  // v=0 is the top of the canvas (zenith); the warm band 0.42-0.65
  // straddles the horizon so golden hour reads from every angle.
  return canvasTexture(64, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2f6fb4');
    grad.addColorStop(0.25, '#6fa8d8');
    grad.addColorStop(0.42, '#ffc98a');
    grad.addColorStop(0.52, '#ff9a5a');
    grad.addColorStop(0.65, '#e07a45');
    grad.addColorStop(0.85, '#7a4a30');
    grad.addColorStop(1, '#3a2a20');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

export function buildCity(scene) {
  const rng = makeRng(7);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Lights and haze.
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-320, 190, 80);
  group.add(sun);
  group.add(new THREE.HemisphereLight(0xffd9a8, 0x5a4a3a, 0.85));
  scene.fog = new THREE.Fog(0xe8a06a, 200, 760);

  // Sky dome.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(880, 28, 18),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  // Low sun disc over the ocean, west.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(-720, 110, 40);
  sunDisc.lookAt(0, 60, 0);
  group.add(sunDisc);

  // Ground: one painted canvas.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Water: ocean west, harbour basin south-east.
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a6f8e, transparent: true, opacity: 0.88, roughness: 0.25, metalness: 0.35 });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(90, 420), waterMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-255, 0.12, 0);
  group.add(ocean);
  const harbourWater = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), waterMat.clone());
  harbourWater.rotation.x = -Math.PI / 2;
  harbourWater.position.set(150, 0.12, 150);
  group.add(harbourWater);

  // Facade variants shared across buildings.
  const facades = [
    facadeTexture('#8a7a68', 0.45),
    facadeTexture('#6a7a8c', 0.4),
    facadeTexture('#a08a6a', 0.5),
    facadeTexture('#7a6a7a', 0.35),
  ];
  const facadeMats = facades.map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.95 });
  const signNames = [
    ['VICE POINT', '#ffd98a', '#20303c'],
    ['MARINA', '#7adfd8', '#1c2a30'],
    ['HOTEL LUNA', '#ffb3c8', '#2a1c2c'],
    ['TACOS 24H', '#ffe066', '#3a2a10'],
    ['NEON BAR', '#ff7ad9', '#241a2e'],
  ];

  const blockCenters = [-120, -60, 0, 60, 120];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      // The south-east block is the marina, not buildings.
      if (bx === 120 && bz === 120) continue;
      const downtown = Math.abs(bx) <= 60 && Math.abs(bz) <= 60;
      const count = downtown ? rangeInt(rng, 2, 3) : rangeInt(rng, 1, 2);
      for (let i = 0; i < count; i++) {
        const w = range(rng, 16, 30);
        const d = range(rng, 13, 24);
        const h = downtown ? range(rng, 18, 44) : range(rng, 8, 20);
        const ox = range(rng, -9, 9);
        const oz = range(rng, -9, 9);
        const x = bx + ox;
        const z = bz + oz;
        if (x + w / 2 > HARBOUR.x0 - 2 && z + d / 2 > HARBOUR.z0 - 2) continue;
        // Keep the mission landmarks clear of buildings.
        const clearOf = [PLAYER_START, HOSPITAL, GARAGE, STASH_HOUSE, BANK, DOCKS];
        let blocked = false;
        for (const spot of clearOf) {
          if (Math.abs(spot.x - x) < w / 2 + 12 && Math.abs(spot.z - z) < d / 2 + 12) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;
        const mat = pick(rng, facadeMats);
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        body.position.set(x, h / 2, z);
        group.add(body);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6), roofMat);
        roof.position.set(x, h + 0.35, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        if (downtown && Math.random() < 0.45) {
          const [text, fg, bg] = pick(rng, signNames);
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(Math.min(w * 0.9, 22), 5.5),
            new THREE.MeshBasicMaterial({ map: signTexture(text, fg, bg) }),
          );
          sign.position.set(x, h * 0.72, z + d / 2 + 0.15);
          if (Math.random() < 0.5) sign.rotation.y = Math.PI;
          group.add(sign);
        }
      }
    }
  }

  // Palms along the beachfront avenue and the marina.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7a3a, roughness: 0.9 });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 7, 6), trunkMat);
    trunk.position.y = 3.5;
    trunk.rotation.z = (Math.random() - 0.5) * 0.14;
    g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 4), leafMat);
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.5, 7.2, Math.sin(a) * 1.5);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    group.add(g);
    colliders.push({ minX: x - 0.5, maxX: x + 0.5, minZ: z - 0.5, maxZ: z + 0.5 });
  }
  for (let z = -170; z <= 170; z += 17) palm(-172, z + range(rng, -4, 4));
  for (let x = -160; x <= 160; x += 28) {
    if (Math.random() < 0.6) palm(x, -158);
    if (Math.random() < 0.5) palm(x + 8, 158);
  }

  // Street lamps at intersections.
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.6, metalness: 0.5 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffe6a8 });
  for (const ix of ROAD_POSITIONS) {
    for (const iz of ROAD_POSITIONS) {
      if (ix === 150 && iz === 150) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lampPoleMat);
      pole.position.set(ix + 8, 3, iz + 8);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), lampHeadMat);
      head.position.set(ix + 8, 6.1, iz + 8);
      group.add(head);
    }
  }

  // Marina: wooden piers, moored boats, crates.
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 0.9 });
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.5 });
  const boatAccent = new THREE.MeshStandardMaterial({ color: 0x2a6f8e, roughness: 0.5 });
  for (let i = 0; i < 3; i++) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 34), woodMat);
    pier.position.set(132 + i * 18, 0.35, 150);
    group.add(pier);
  }
  for (let i = 0; i < 4; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.4, 11), boatMat);
    hull.position.y = 0.6;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 4), boatAccent);
    cabin.position.set(0, 1.9, -1);
    boat.add(cabin);
    boat.position.set(136 + i * 16, 0, 168);
    boat.rotation.y = (Math.random() - 0.5) * 0.2;
    group.add(boat);
  }
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), crateMat);
    crate.position.set(range(rng, 126, 168), 0.8, range(rng, 124, 140));
    crate.rotation.y = Math.random() * Math.PI;
    group.add(crate);
    colliders.push({ minX: crate.position.x - 0.9, maxX: crate.position.x + 0.9, minZ: crate.position.z - 0.9, maxZ: crate.position.z + 0.9 });
  }

  // Intersections of the road grid (traffic + pedestrian routing).
  const intersections = [];
  for (const ix of ROAD_POSITIONS) {
    for (const iz of ROAD_POSITIONS) {
      if (ix === 150 && iz === 150) continue;
      intersections.push({ x: ix, z: iz });
    }
  }

  function isWater(x, z) {
    if (x < WATER_X) return true;
    return x >= HARBOUR.x0 && x <= HARBOUR.x1 && z >= HARBOUR.z0 && z <= HARBOUR.z1;
  }

  function resolveCircle(pos, radius) {
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = nx + (dx / d) * radius;
          pos.z = nz + (dz / d) * radius;
        } else {
          pos.x = c.maxX + radius;
        }
      }
    }
    pos.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, pos.x));
    pos.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, pos.z));
    if (isWater(pos.x, pos.z)) {
      if (pos.x < WATER_X) pos.x = WATER_X + radius;
      if (pos.x >= HARBOUR.x0 && pos.z >= HARBOUR.z0) pos.z = HARBOUR.z0 - radius;
    }
  }

  let waterPhase = 0;
  function update(dt) {
    waterPhase += dt;
    ocean.position.y = 0.12 + Math.sin(waterPhase * 0.7) * 0.05;
    harbourWater.position.y = 0.12 + Math.sin(waterPhase * 0.9 + 1) * 0.04;
  }

  return { colliders, intersections, isWater, resolveCircle, update, group };
}
