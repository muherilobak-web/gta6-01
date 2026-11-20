// Vice Point, the district itself: a 6x6-block coastal city at golden hour, all art
// procedural — BoxGeometry buildings with canvas-drawn facades, palms, lamps, a canal
// with one bridge, a beach and a marina. Exports the colliders, the traffic loops,
// the traffic-light phase and the named places the missions drive to.
import * as THREE from 'three';
import { CFG } from './config.js';
import { createRng, pick, range } from './rng.js';

const SIGNS = ['PALM', 'TACO', 'NEON', 'SURF', 'HOTEL', 'BAR', 'MARKET', '24H', 'PIER', 'CAFE', 'GYM', 'DIVE'];
const FACADE_COLORS = [0xe8d8c0, 0xd9c1a3, 0xc7d3dd, 0xe0b8a0, 0xb8c9b0, 0xd8c8d0, 0xf0e0b8, 0xc0c8d8];

function makeFacadeTexture(rng, base, floors, sign) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + base.toString(16).padStart(6, '0');
  g.fillRect(0, 0, 128, 256);
  // Slight vertical shading so the sun side reads.
  const grad = g.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, 'rgba(255,180,110,0.18)');
  grad.addColorStop(1, 'rgba(40,30,60,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 256);
  // Window grid, some lit warm.
  const rows = Math.max(3, floors);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < 4; col++) {
      const x = 10 + col * 30, y = 14 + r * ((256 - 70) / rows);
      const lit = rng() < 0.35;
      g.fillStyle = lit ? '#ffd98a' : (rng() < 0.5 ? '#2c3a4d' : '#46586e');
      g.fillRect(x, y, 20, 26);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 20, 3);
    }
  }
  // Ground-floor shop band with a sign.
  g.fillStyle = '#20242e';
  g.fillRect(0, 222, 128, 34);
  g.fillStyle = pick(rng, ['#ff5a7a', '#39d0c0', '#ffd23f', '#7ab8ff', '#ff9a3d']);
  g.font = 'bold 20px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText(sign, 64, 246);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalmTexture() {
  // A palm crown drawn once, used as an alpha sprite on a crossed pair of planes.
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#2e7d4f';
  g.lineWidth = 7;
  g.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(64, 64);
    g.quadraticCurveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34 - 12, 64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58 + 10);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCity(scene, seed) {
  const rng = createRng(seed);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const loops = [];     // traffic loops: arrays of {x,z} waypoints
  const lights = [];    // traffic light heads {x,z,axis}
  const group = new THREE.Group();
  scene.add(group);

  // ---- sky dome (canvas gradient, golden hour) ----
  {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const g = c.getContext('2d');
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
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }),
    );
    scene.add(sky);
  }

  // ---- lights ----
  const sun = new THREE.DirectionalLight(CFG.SUN_COLOR, CFG.SUN_INTENSITY);
  sun.position.set(-260, 150, 90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffd9b0, 0x3a4a5a, 0.85));
  scene.fog = new THREE.Fog(CFG.FOG_COLOR, 260, 780);

  // ---- ground: concrete base, roads, sidewalks, beach, sea, canal ----
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x42484f, roughness: 0.95 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c25a });
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a4, roughness: 1 });
  const S = CFG.STREET, H = CFG.HALF;
  for (const cx of CFG.STREET_CENTERS) {
    // North-south road, except the canal replaces the east-west road at CANAL_Z.
    const road = new THREE.Mesh(new THREE.PlaneGeometry(S, TOTAL_LEN()), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.01, 0);
    road.receiveShadow = true;
    group.add(road);
    // Sidewalks along it.
    for (const off of [-S / 2 - 1.5, S / 2 + 1.5]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(3, TOTAL_LEN()), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(cx + off, 0.015, 0);
      walk.receiveShadow = true;
      group.add(walk);
    }
    // Centre dashes.
    for (let z = -H + 8; z < H - 8; z += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(cx, 0.02, z);
      group.add(dash);
    }
  }
  function TOTAL_LEN() { return H * 2; }
  for (const cz of CFG.STREET_CENTERS) {
    if (Math.abs(cz - CFG.CANAL_Z) < 1) continue; // the canal takes this street
    const road = new THREE.Mesh(new THREE.PlaneGeometry(TOTAL_LEN(), S), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, cz);
    road.receiveShadow = true;
    group.add(road);
    for (const off of [-S / 2 - 1.5, S / 2 + 1.5]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(TOTAL_LEN(), 3), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.015, cz + off);
      walk.receiveShadow = true;
      group.add(walk);
    }
    for (let x = -H + 8; x < H - 8; x += 12) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.35), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.02, cz);
      group.add(dash);
    }
  }

  // Beach (west) and sea.
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xe8d3a0, roughness: 1 });
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(34, 560), sandMat);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CFG.BEACH_X - 17, 0.012, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f7fa8, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(180, 560), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CFG.SEA_X - 90, 0.005, 0);
  group.add(sea);

  // Canal east-west at CANAL_Z with a bridge on the x=0 avenue.
  const canal = new THREE.Mesh(new THREE.PlaneGeometry(TOTAL_LEN(), CFG.CANAL_W), waterMat);
  canal.rotation.x = -Math.PI / 2;
  canal.position.set(0, 0.008, CFG.CANAL_Z);
  group.add(canal);
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.9 });
  // Deck flush with the road (a plane), railings on the sides.
  const bridge = new THREE.Mesh(new THREE.PlaneGeometry(16, CFG.CANAL_W + 6), bridgeMat);
  bridge.rotation.x = -Math.PI / 2;
  bridge.position.set(0, 0.02, CFG.CANAL_Z);
  bridge.receiveShadow = true;
  group.add(bridge);
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 0.4), bridgeMat);
    rail.position.set(0, 0.5, CFG.CANAL_Z + side * (CFG.CANAL_W / 2 + 2.6));
    rail.castShadow = true;
    group.add(rail);
  }
  // Canal walls.
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x7a756a, roughness: 1 });
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(TOTAL_LEN(), 1, 0.8), wallMat);
    wall.position.set(0, 0.5, CFG.CANAL_Z + side * (CFG.CANAL_W / 2 + 0.4));
    group.add(wall);
  }

  // Marina basin in the south-east corner block (145,145): water, a wooden dock
  // along its north edge, and moored boats (visual only). The block holds no buildings.
  const marina = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), waterMat);
  marina.rotation.x = -Math.PI / 2;
  marina.position.set(145, 0.008, 145);
  group.add(marina);
  const dockMat = new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 });
  const dock = new THREE.Mesh(new THREE.BoxGeometry(40, 0.5, 5), dockMat);
  dock.position.set(145, 0.25, 123.5);
  dock.castShadow = true; dock.receiveShadow = true;
  group.add(dock);
  const boatMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.6 });
  const boatMat2 = new THREE.MeshStandardMaterial({ color: 0x3f6fb5, roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 9), i % 2 ? boatMat : boatMat2);
    hull.position.set(128 + i * 9, 0.6, 138 + (i % 2) * 14);
    hull.castShadow = true;
    group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    mast.position.set(hull.position.x, 4, hull.position.z);
    group.add(mast);
  }

  // ---- palms: materials defined before the building loop, which plants park palms ----
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8a4f, roughness: 0.9, side: THREE.DoubleSide });
  const frondGeo = new THREE.ConeGeometry(0.55, 3.6, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 });
  const UP = new THREE.Vector3(0, 1, 0);
  function addPalm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    // Crown: seven fronds fanning out and down from the trunk top.
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
      const dir = new THREE.Vector3(Math.cos(a) * 0.85, 0.42, Math.sin(a) * 0.85).normalize();
      const frond = new THREE.Mesh(frondGeo, frondMat);
      frond.quaternion.setFromUnitVectors(UP, dir);
      frond.position.set(x + dir.x * 1.4, 7.1 + dir.y * 1.4, z + dir.z * 1.4);
      frond.castShadow = true;
      group.add(frond);
    }
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }

  // ---- buildings ----
  const facadeCache = new Map();
  function facade(base, floors, sign) {
    const key = `${base}-${floors}-${sign}`;
    if (!facadeCache.has(key)) facadeCache.set(key, makeFacadeTexture(rng, base, floors, sign));
    return facadeCache.get(key);
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 1 });
  const downtown = (bx, bz) => Math.abs(bx) <= 1 && Math.abs(bz) <= 1;

  for (let bi = 0; bi < CFG.BLOCKS; bi++) {
    for (let bj = 0; bj < CFG.BLOCKS; bj++) {
      const cx = CFG.BLOCK_CENTERS[bi];
      const cz = CFG.BLOCK_CENTERS[bj];
      // The canal row is the street, not a block — blocks never sit on it.
      if (Math.abs(cz - CFG.CANAL_Z) < CFG.BLOCK / 2 + 4) continue;
      // The south-east corner block is the marina basin — no buildings there.
      if (Math.abs(cx - 145) < 1 && Math.abs(cz - 145) < 1) continue;
      const roll = rng();
      if (roll < 0.12) {
        // Park block: green grass, palms + benches, no buildings.
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x5a8a4a, roughness: 1 });
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), grassMat);
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(cx, 0.018, cz);
        grass.receiveShadow = true;
        group.add(grass);
        for (let i = 0; i < 7; i++) {
          addPalm(cx + range(rng, -18, 18), cz + range(rng, -18, 18));
        }
        continue;
      }
      if (roll < 0.2) {
        // Parking lot block (the repo job's lot lives on the market block).
        const lotMat = new THREE.MeshStandardMaterial({ color: 0x555a63, roughness: 1 });
        const lot = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), lotMat);
        lot.rotation.x = -Math.PI / 2;
        lot.position.set(cx, 0.02, cz);
        lot.receiveShadow = true;
        group.add(lot);
        continue;
      }
      const count = downtown(bi - 3, bj - 3) ? (rng() < 0.5 ? 1 : 2) : (rng() < 0.4 ? 2 : 3);
      for (let k = 0; k < count; k++) {
        const w = range(rng, 12, 20);
        const d = range(rng, 12, 20);
        const h = downtown(bi - 3, bj - 3) ? range(rng, 22, 46) : range(rng, 8, 22);
        const ox = count === 1 ? 0 : (k % 2 === 0 ? -11 : 11);
        const oz = count === 1 ? 0 : (k < 2 ? -11 : 11);
        const x = cx + ox, z = cz + oz;
        const base = pick(rng, FACADE_COLORS);
        const floors = Math.max(3, Math.round(h / 4));
        const tex = facade(base, floors, pick(rng, SIGNS));
        const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
        const mats = [side, side, roofMat, roofMat, side, side];
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
        b.position.set(x, h / 2, z);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        // Neon sign strip on some towers.
        if (h > 24 && rng() < 0.6) {
          const neon = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.7, 1.2, 0.4),
            new THREE.MeshBasicMaterial({ color: pick(rng, [0xff5a7a, 0x39d0c0, 0xffd23f, 0x7ab8ff]) }),
          );
          neon.position.set(x, h - 2, z + d / 2 + 0.3);
          group.add(neon);
        }
      }
    }
  }

  // ---- palms along the beachfront avenue and lamps everywhere ----
  for (let z = -H + 20; z < H - 10; z += 26) {
    addPalm(CFG.BEACH_X + 6, z);
    if (rng() < 0.7) addPalm(-CFG.BEACH_X - 6, z);
  }
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.7, metalness: 0.4 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe6a0 });
  for (const cx of CFG.STREET_CENTERS) {
    for (const cz of CFG.STREET_CENTERS) {
      if (Math.abs(cz - CFG.CANAL_Z) < 1) continue;
      if (rng() < 0.55) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), lampMat);
      pole.position.set(cx + CFG.STREET / 2 + 1.6, 3.25, cz + CFG.STREET / 2 + 1.6);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampGlowMat);
      head.position.set(cx + CFG.STREET / 2 + 1.6, 6.6, cz + CFG.STREET / 2 + 1.6);
      group.add(head);
      // Traffic light at this intersection (one per intersection, on the corner).
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.5), lampMat);
      light.position.set(cx - CFG.STREET / 2 - 1.2, 4.2, cz - CFG.STREET / 2 - 1.2);
      group.add(light);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x33ff66 }));
      bulb.position.set(cx - CFG.STREET / 2 - 1.2, 4.6, cz - CFG.STREET / 2 - 1.2);
      group.add(bulb);
      lights.push({ x: cx, z: cz, bulb });
    }
  }

  // ---- hydrants, benches ----
  const hydMat = new THREE.MeshStandardMaterial({ color: 0xd84a2f, roughness: 0.7 });
  for (let i = 0; i < 26; i++) {
    const x = pick(rng, CFG.STREET_CENTERS) + (rng() < 0.5 ? -8.5 : 8.5);
    const z = range(rng, -H + 10, H - 10);
    const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.9, 8), hydMat);
    hyd.position.set(x, 0.45, z);
    hyd.castShadow = true;
    group.add(hyd);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }

  // ---- traffic loops: rectangles around each block, on the streets ----
  for (let bi = 0; bi < CFG.BLOCKS; bi++) {
    for (let bj = 0; bj < CFG.BLOCKS; bj++) {
      const x0 = CFG.STREET_CENTERS[bi], x1 = CFG.STREET_CENTERS[bi + 1];
      const z0 = CFG.STREET_CENTERS[bj], z1 = CFG.STREET_CENTERS[bj + 1];
      if (Math.abs(z0 - CFG.CANAL_Z) < 1 || Math.abs(z1 - CFG.CANAL_Z) < 1) continue;
      loops.push([
        { x: x0 + 3.2, z: z0 + 3.2 }, { x: x1 - 3.2, z: z0 + 3.2 },
        { x: x1 - 3.2, z: z1 - 3.2 }, { x: x0 + 3.2, z: z1 - 3.2 },
      ]);
    }
  }

  // ---- named places for the missions ----
  const LOCATIONS = {
    docks: { x: -158, z: 132, name: 'The Docks' },
    garage: { x: 44, z: 44, name: 'Canal Row Garage' },
    lot: { x: -80, z: -20, name: 'Market Street Lot' },
    stashHouse: { x: 116, z: -116, name: 'Palm Row Stash House' },
    marina: { x: 150, z: 124, name: 'Marina Boat' },
    tower: { x: 29, z: -29, name: 'Sunrise Tower' },
    hospital: { x: -116, z: -145, name: 'Vice Point General' },
    start: { x: -160, z: -20, name: 'Beachfront Avenue' },
  };

  // Circle-vs-AABB collision: push a circle out of every building/prop it overlaps.
  function collideCircle(x, z, r) {
    let px = x, pz = z;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(px, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pz, c.maxZ));
      const dx = px - cx, dz = pz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px = cx + (dx / d) * r;
          pz = cz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration.
          const pl = px - c.minX, pr = c.maxX - px, pt = pz - c.minZ, pb = c.maxZ - pz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) px = c.minX - r;
          else if (m === pr) px = c.maxX + r;
          else if (m === pt) pz = c.minZ - r;
          else pz = c.maxZ + r;
        }
      }
    }
    // District bounds + canal water (no swimming): the bridge is the only crossing.
    const onBridge = Math.abs(px) < 8 && Math.abs(pz - CFG.CANAL_Z) < CFG.CANAL_W / 2 + 4;
    if (Math.abs(pz - CFG.CANAL_Z) < CFG.CANAL_W / 2 - 0.4 && !onBridge) {
      pz = pz < CFG.CANAL_Z ? CFG.CANAL_Z - CFG.CANAL_W / 2 + 0.4 : CFG.CANAL_Z + CFG.CANAL_W / 2 - 0.4;
    }
    // Marina basin water (no swimming): the dock strip is the only way along it.
    const onDock = pz > 120 && pz < 127 && px > 124 && px < 166;
    if (px > 125 && px < 165 && pz > 125 && pz < 165 && !onDock) {
      const dl = px - 125, dr = 165 - px, dt = pz - 125, db = 165 - pz;
      const m = Math.min(dl, dr, dt, db);
      if (m === dl) px = 125 - r;
      else if (m === dr) px = 165 + r;
      else if (m === dt) pz = 125 - r;
      else pz = 165 + r;
    }
    px = Math.max(-H - 30, Math.min(H, px));
    pz = Math.max(-H, Math.min(H, pz));
    return { x: px, z: pz };
  }

  function isOnRoad(x, z) {
    for (const c of CFG.STREET_CENTERS) {
      if (Math.abs(x - c) < S / 2 + 1) return true;
      if (Math.abs(z - c) < S / 2 + 1 && Math.abs(c - CFG.CANAL_Z) > 1) return true;
    }
    return false;
  }

  // Traffic-light phase: 12 s north-south green, 12 s east-west green.
  function lightPhase(time) {
    return Math.floor(time / 12) % 2 === 0 ? 'NS' : 'EW';
  }

  return {
    group, colliders, loops, lights, LOCATIONS,
    collideCircle, isOnRoad, lightPhase,
    update(dt, time) {
      // Blink the light bulbs with the phase.
      const phase = lightPhase(time);
      for (const l of lights) l.bulb.material.color.setHex(phase === 'NS' ? 0x33ff66 : 0xff3333);
    },
  };
}
