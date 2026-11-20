// Vice Point — the district itself. One dense coastal district, ~6x6 blocks:
// a beachfront avenue with palms, a downtown of mid-rise towers with neon,
// a canal crossed by one bridge, a market street and a marina corner. The
// edges are fenced by water and the beach, so the district IS the map.
// All art is procedural: boxes plus canvas-drawn facades, no external assets.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { makeSeededRandom, chooseOne, inRange, clampNumber } from './rng.js';

const SIGN_WORDS = ['PALM', 'TACO', 'NEON', 'SURF', 'HOTEL', 'BAR', 'MARKET', '24H', 'PIER', 'CAFE', 'GYM', 'DIVE'];
const FACADE_TINTS = [0xe8d8c0, 0xd9c1a3, 0xc7d3dd, 0xe0b8a0, 0xb8c9b0, 0xd8c8d0, 0xf0e0b8, 0xc0c8d8];
const NEON_COLOURS = [0xff5a7a, 0x39d0c0, 0xffd23f, 0x7ab8ff];

function paintFacade(random, baseColour, floors, sign) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const hex = `#${baseColour.toString(16).padStart(6, '0')}`;
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, hex);
  grad.addColorStop(1, '#8a7a68');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  const rows = Math.max(3, floors);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const x = 10 + c * 38;
      const y = 14 + r * ((256 - 70) / rows);
      g.fillStyle = random() < 0.35 ? '#ffd98a' : '#2a3542';
      g.fillRect(x, y, 26, 18);
    }
  }
  g.fillStyle = '#1c1c22';
  g.fillRect(0, 0, 128, 22);
  g.fillStyle = '#ffd23f';
  g.font = 'bold 15px sans-serif';
  g.textAlign = 'center';
  g.fillText(sign, 64, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildCity(scene, seed) {
  const random = makeSeededRandom(seed);
  const obstacles = [];
  const loops = [];
  const lampLights = [];
  const group = new THREE.Group();
  const half = WORLD.halfWidth;
  const street = WORLD.streetWidth;

  // ---- sky dome: warm gradient, orange at the horizon ----
  {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const g = canvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    // Warm band sits AT the horizon (v ~0.5), not below it: the dome's
    // equator is eye level, so the orange has to live around v 0.42–0.6 to
    // read as golden hour from any street-level camera.
    grad.addColorStop(0, '#7fb2e8');
    grad.addColorStop(0.3, '#9db8dd');
    grad.addColorStop(0.42, '#ffc98a');
    grad.addColorStop(0.52, '#ff9a5a');
    grad.addColorStop(0.65, '#e07a45');
    grad.addColorStop(1, '#b85a30');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);
  }
  scene.fog = new THREE.Fog(WORLD.fogColour, 220, 720);
  const sun = new THREE.DirectionalLight(WORLD.sunColour, WORLD.sunStrength);
  sun.position.set(-180, 130, -90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffd9b0, 0.55));
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x8a6a44, 0.5));

  // ---- ground, roads, sidewalks ----
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x42484f, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a4, roughness: 1 });
  const span = half * 2;
  for (const cx of WORLD.streetLines) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(street, span), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.01, 0);
    road.receiveShadow = true;
    group.add(road);
    for (const side of [-street / 2 - 1.5, street / 2 + 1.5]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(3, span), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx + side, 0.015, 0);
      group.add(walk);
    }
    for (let z = -half + 8; z < half - 4; z += 14) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(cx, 0.02, z);
      group.add(dash);
    }
  }
  for (const cz of WORLD.streetLines) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(span, street), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, cz);
    road.receiveShadow = true;
    group.add(road);
    for (const side of [-street / 2 - 1.5, street / 2 + 1.5]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(span, 3), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.015, cz + side);
      group.add(walk);
    }
    for (let x = -half + 8; x < half - 4; x += 14) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.35), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.02, cz);
      group.add(dash);
    }
  }

  // ---- beach, sea, canal, bridge, marina ----
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe8d3a0, roughness: 1 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(34, 560), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(WORLD.beachEdgeX - 17, 0.02, 0);
  group.add(sand);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2f7fa8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(180, 560), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(WORLD.seaEdgeX - 90, 0.03, 0);
  group.add(sea);
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(span, WORLD.canalWidth), waterMat);
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(0, 0.03, WORLD.canalZ);
  group.add(canal);
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
  const bridge = new THREE.Mesh(new THREE.PlaneGeometry(16, WORLD.canalWidth + 6), bridgeMat);
  bridge.rotation.x = -Math.PI / 2;
  bridge.position.set(0, 0.06, WORLD.canalZ);
  bridge.receiveShadow = true;
  group.add(bridge);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 0.4), bridgeMat);
    rail.position.set(0, 0.6, WORLD.canalZ + side * (WORLD.canalWidth / 2 + 2.5));
    group.add(rail);
  }
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7a756a, roughness: 1 });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(span, 1, 0.8), wallMat);
    wall.position.set(0, 0.5, WORLD.canalZ + side * (WORLD.canalWidth / 2 + 0.4));
    group.add(wall);
  }
  const marina = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), waterMat);
  marina.rotation.x = -Math.PI / 2;
  marina.position.set(145, 0.03, 145);
  group.add(marina);
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 5), dockMat);
  dock.position.set(145, 0.25, 123);
  group.add(dock);
  const hullWhite = new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.6 });
  const hullBlue = new THREE.MeshStandardMaterial({ color: 0x3f6fb5, roughness: 0.6 });
  for (let i = 0; i < 4; i += 1) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 9), i % 2 ? hullBlue : hullWhite);
    hull.position.set(132 + i * 8, 0.6, 138 + (i % 2) * 6);
    hull.castShadow = true;
    group.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888 }),
    );
    mast.position.set(132 + i * 8, 4, 138 + (i % 2) * 6);
    group.add(mast);
  }

  // ---- palms ----
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8a4f, roughness: 0.9, side: THREE.DoubleSide });
  const frondGeo = new THREE.ConeGeometry(0.55, 3.6, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  function plantPalm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2 + random() * 0.4;
      const dir = new THREE.Vector3(Math.cos(a) * 0.85, 0.42, Math.sin(a) * 0.85).normalize();
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.position.set(x + dir.x * 1.4, 7 + dir.y * 1.4, z + dir.z * 1.4);
      frond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      group.add(frond);
    }
  }

  // ---- buildings: parks, lots and towers per block ----
  const facadeCache = new Map();
  function facadeTexture(base, floors, sign) {
    const key = `${base}-${floors}-${sign}`;
    if (!facadeCache.has(key)) facadeCache.set(key, paintFacade(random, base, floors, sign));
    return facadeCache.get(key);
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 1 });
  const isDowntown = (bx, bz) => Math.abs(bx) <= 1 && Math.abs(bz) <= 1;
  for (let bi = 0; bi < WORLD.blocksPerSide; bi += 1) {
    for (let bj = 0; bj < WORLD.blocksPerSide; bj += 1) {
      const cx = WORLD.blockLines[bi];
      const cz = WORLD.blockLines[bj];
      if (Math.abs(cz - WORLD.canalZ) < WORLD.blockSize / 2 + 4) continue;
      if (Math.abs(cx - 145) < 1 && Math.abs(cz - 145) < 1) continue;
      const roll = random();
      if (roll < 0.12) {
        const grass = new THREE.Mesh(
          new THREE.PlaneGeometry(40, 40),
          new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 1 }),
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(cx, 0.018, cz);
        grass.receiveShadow = true;
        group.add(grass);
        for (let i = 0; i < 7; i += 1) plantPalm(cx + inRange(random, -18, 18), cz + inRange(random, -18, 18));
        continue;
      }
      if (roll < 0.2) {
        const lot = new THREE.Mesh(
          new THREE.PlaneGeometry(36, 36),
          new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 1 }),
        );
        lot.rotation.x = -Math.PI / 2;
        lot.position.set(cx, 0.02, cz);
        lot.receiveShadow = true;
        group.add(lot);
        continue;
      }
      const downtown = isDowntown(bi - 3, bj - 3);
      const count = downtown ? (random() < 0.5 ? 1 : 2) : (random() < 0.4 ? 2 : 3);
      for (let k = 0; k < count; k += 1) {
        const w = inRange(random, 12, 20);
        const d = inRange(random, 12, 20);
        const h = downtown ? inRange(random, 22, 46) : inRange(random, 8, 22);
        const ox = count === 1 ? 0 : (k % 2 === 0 ? -11 : 11);
        const oz = count === 1 ? 0 : (k < 2 ? -11 : 11);
        const x = cx + ox;
        const z = cz + oz;
        const base = chooseOne(random, FACADE_TINTS);
        const floors = Math.max(3, Math.round(h / 4));
        const tex = facadeTexture(base, floors, chooseOne(random, SIGN_WORDS));
        const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
        const mats = [side, side, roofMat, roofMat, side, side];
        const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        obstacles.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        if (h > 24 && random() < 0.6) {
          const neon = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.7, 1.2, 0.4),
            new THREE.MeshBasicMaterial({ color: chooseOne(random, NEON_COLOURS) }),
          );
          neon.position.set(x, h - 2, z + d / 2 + 0.3);
          group.add(neon);
        }
      }
    }
  }

  // ---- palms on the beachfront, lamps and traffic lights at intersections ----
  for (let z = -half + 20; z < half - 10; z += 26) {
    plantPalm(WORLD.beachEdgeX + 6, z);
    if (random() < 0.7) plantPalm(-WORLD.beachEdgeX - 6, z);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.7, metalness: 0.4 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
  for (const cx of WORLD.streetLines) {
    for (const cz of WORLD.streetLines) {
      if (Math.abs(cz - WORLD.canalZ) < 1) continue;
      if (random() < 0.55) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), lampMat);
      pole.position.set(cx + street / 2 + 1.6, 3.25, cz + street / 2 + 1.6);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), glowMat);
      head.position.set(cx + street / 2 + 1.6, 6.6, cz + street / 2 + 1.6);
      group.add(head);
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), lampMat);
      light.position.set(cx - street / 2 - 1.2, 4.2, cz - street / 2 - 1.2);
      group.add(light);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x33ff66 }),
      );
      bulb.position.set(cx - street / 2 - 1.2, 4.6, cz - street / 2 - 1.2);
      group.add(bulb);
      lampLights.push({ x: cx, z: cz, bulb });
    }
  }

  // ---- hydrants ----
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xd84a2f, roughness: 0.7 });
  for (let i = 0; i < 26; i += 1) {
    const x = chooseOne(random, WORLD.streetLines) + (random() < 0.5 ? -8.5 : 8.5);
    const z = inRange(random, -half + 10, half - 10);
    const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.9, 8), hydrantMat);
    hyd.position.set(x, 0.45, z);
    hyd.castShadow = true;
    group.add(hyd);
    obstacles.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }

  // ---- traffic loops: rectangles around each block, on the streets ----
  for (let bi = 0; bi < WORLD.blocksPerSide; bi += 1) {
    for (let bj = 0; bj < WORLD.blocksPerSide; bj += 1) {
      const x0 = WORLD.streetLines[bi];
      const x1 = WORLD.streetLines[bi + 1];
      const z0 = WORLD.streetLines[bj];
      const z1 = WORLD.streetLines[bj + 1];
      if (Math.abs(z0 - WORLD.canalZ) < 1 || Math.abs(z1 - WORLD.canalZ) < 1) continue;
      loops.push([
        { x: x0 + 3.2, z: z0 + 3.2 }, { x: x1 - 3.2, z: z0 + 3.2 },
        { x: x1 - 3.2, z: z1 - 3.2 }, { x: x0 + 3.2, z: z1 - 3.2 },
      ]);
    }
  }

  const PLACES = {
    docks: { x: -158, z: 132, name: 'The Docks' },
    garage: { x: 44, z: 44, name: 'Canal Row Garage' },
    lot: { x: -80, z: -20, name: 'Market Street Lot' },
    stashHouse: { x: 116, z: -116, name: 'Palm Row Stash House' },
    marina: { x: 150, z: 124, name: 'Marina Boat' },
    // The tower waypoint sits on the street crossing, not inside a block:
    // a waypoint inside a building footprint can never be reached, because
    // collision pushes the player just outside its trigger radius.
    tower: { x: 0, z: -58, name: 'Sunrise Tower' },
    hospital: { x: -116, z: -145, name: 'Vice Point General' },
    start: { x: -160, z: -20, name: 'Beachfront Avenue' },
  };

  function resolveCircle(x, z, radius) {
    let px = x;
    let pz = z;
    for (const c of obstacles) {
      const cx = Math.max(c.minX, Math.min(px, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - cx;
      const dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px = cx + (dx / d) * radius;
          pz = cz + (dz / d) * radius;
        } else {
          const penL = px - c.minX;
          const penR = c.maxX - px;
          const penT = pz - c.minZ;
          const penB = c.maxZ - pz;
          const m = Math.min(penL, penR, penT, penB);
          if (m === penL) px = c.minX - radius;
          else if (m === penR) px = c.maxX + radius;
          else if (m === penT) pz = c.minZ - radius;
          else pz = c.maxZ + radius;
        }
      }
    }
    // Canal water: no swimming — the bridge at x=0 is the only crossing.
    const onBridge = Math.abs(px) < 8 && Math.abs(pz - WORLD.canalZ) < WORLD.canalWidth / 2 + 4;
    if (Math.abs(pz - WORLD.canalZ) < WORLD.canalWidth / 2 - 0.4 && !onBridge) {
      pz = pz < WORLD.canalZ
        ? WORLD.canalZ - WORLD.canalWidth / 2 + 0.4
        : WORLD.canalZ + WORLD.canalWidth / 2 - 0.4;
    }
    // Marina basin: the dock strip is the only way along it.
    const onDock = pz > 120 && pz < 127 && px > 124 && px < 166;
    if (px > 125 && px < 165 && pz > 125 && pz < 165 && !onDock) {
      const dl = px - 125;
      const dr = 165 - px;
      const dt = pz - 125;
      const db = 165 - pz;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) px = 125 - radius;
      else if (m === dr) px = 165 + radius;
      else if (m === dt) pz = 125 - radius;
      else pz = 165 + radius;
    }
    px = Math.max(-half - 30, Math.min(half, px));
    pz = Math.max(-half, Math.min(half, pz));
    return { x: px, z: pz };
  }

  function onRoad(x, z) {
    for (const line of WORLD.streetLines) {
      if (Math.abs(x - line) < street / 2 + 1) return true;
      if (Math.abs(z - line) < street / 2 + 1 && Math.abs(line - WORLD.canalZ) > 1) return true;
    }
    return false;
  }

  function lightPhase(time) {
    return Math.floor(time / 12) % 2 === 0 ? 'NS' : 'EW';
  }

  scene.add(group);
  return {
    group,
    obstacles,
    loops,
    lights: lampLights,
    LOCATIONS: PLACES,
    collideCircle: resolveCircle,
    isOnRoad: onRoad,
    lightPhase,
    update(dt, time) {
      const phase = lightPhase(time);
      for (const lamp of lampLights) {
        lamp.bulb.material.color.setHex(phase === 'NS' ? 0x33ff66 : 0xff3333);
      }
    },
  };
}
