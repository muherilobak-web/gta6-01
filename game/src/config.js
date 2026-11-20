// Vice Point — shared constants. One dense coastal district, ~6x6 blocks, golden hour.
// All numbers are world units (1 unit ~ 1 metre). Streets run on a grid; the canal
// crosses the district east-west and one bridge carries the avenue over it.
export const CFG = {
  // District layout
  BLOCK: 44,            // block side
  STREET: 14,           // street width
  BLOCKS: 6,            // blocks per side
  // Derived below
  HALF: 0,              // half the district width (computed)
  STREET_CENTERS: [],   // x (and z) of the 7 street centre-lines
  BLOCK_CENTERS: [],    // x (and z) of the 6 block centres
  CANAL_Z: 58,          // canal centre-line (replaces the street at z=58)
  CANAL_W: 12,          // canal width
  BEACH_X: -181,        // beach starts west of this x
  SEA_X: -215,          // water plane starts here
  // Golden hour
  SUN_COLOR: 0xffb36b,
  SUN_INTENSITY: 2.6,
  SKY_TOP: 0x7fb2e8,
  SKY_HORIZON: 0xffc98a,
  FOG_COLOR: 0xf2b98a,
  // Player
  WALK_SPEED: 6.5,
  RUN_SPEED: 10,
  JUMP_SPEED: 8.5,
  GRAVITY: 24,
  PLAYER_RADIUS: 0.55,
  PLAYER_HEALTH: 100,
  // Driving
  CAR_MAX_SPEED: 42,    // ~150 km/h feel
  CAR_ACCEL: 22,
  CAR_BRAKE: 34,
  CAR_STEER: 1.9,
  // Wanted
  WANTED_MAX: 5,
  WANTED_DECAY_SECONDS: 14,
  POLICE_PER_STAR: [0, 1, 2, 3, 4, 5],
  // Combat
  WEAPONS: {
    fists: { name: 'Fists', damage: 12, range: 2.2, rate: 0.45, auto: false, ammo: Infinity },
    pistol: { name: 'Pistol', damage: 22, range: 55, rate: 0.28, auto: false, ammo: 60 },
    smg: { name: 'SMG', damage: 11, range: 45, rate: 0.085, auto: true, ammo: 120 },
  },
  // Missions
  MISSION_REWARDS: [250, 400, 500, 700, 900, 2500],
  // Collectibles / side work
  PACKAGES: 20,
  TAXI_FARE: 60,
  VIGILANTE_REWARD: 150,
  // Save
  SAVE_KEY: 'vicepoint-save-v1',
};

// Derive the grid: 6 blocks of 44 + 7 streets of 14 = 362 wide, centred on 0.
const TOTAL = CFG.BLOCKS * CFG.BLOCK + (CFG.BLOCKS + 1) * CFG.STREET; // 362
CFG.HALF = TOTAL / 2; // 181
for (let i = 0; i <= CFG.BLOCKS; i++) {
  CFG.STREET_CENTERS.push(-CFG.HALF + CFG.STREET / 2 + i * (CFG.BLOCK + CFG.STREET));
}
for (let i = 0; i < CFG.BLOCKS; i++) {
  CFG.BLOCK_CENTERS.push(-CFG.HALF + CFG.STREET + CFG.BLOCK / 2 + i * (CFG.BLOCK + CFG.STREET));
}

// Car models: name, colour, top speed factor, accel factor, handling, body style.
export const CAR_MODELS = [
  { id: 'sedan', name: 'Coastline Sedan', color: 0x3f6fb5, top: 0.92, accel: 0.95, grip: 1.0, len: 4.6, wid: 1.9 },
  { id: 'coupe', name: 'Sunset Coupe', color: 0xd84a2f, top: 1.12, accel: 1.15, grip: 0.92, len: 4.3, wid: 1.85 },
  { id: 'suv', name: 'Palm SUV', color: 0x2e7d5b, top: 0.85, accel: 0.85, grip: 1.1, len: 4.9, wid: 2.05 },
  { id: 'pickup', name: 'Dock Pickup', color: 0xc9a227, top: 0.9, accel: 0.9, grip: 1.05, len: 5.1, wid: 2.0 },
  { id: 'taxi', name: 'Vice Cab', color: 0xf2c230, top: 0.95, accel: 1.0, grip: 1.0, len: 4.6, wid: 1.9 },
];

// Mission script: one arc for Mara Reyes, ex-getaway driver pulled back in.
export const MISSIONS = [
  {
    id: 'first-gear', name: 'First Gear',
    brief: 'Mara is back in Vice Point. Take the coupe to the docks — and shake the tail.',
    intro: 'One last job. Drive to the docks and lose the patrol car on your tail.',
  },
  {
    id: 'repo-run', name: 'Repo Run',
    brief: 'A client wants his coupe back. Steal it from the lot on Market Street and bring it to the garage.',
    intro: 'Steal the marked coupe from the lot, then deliver it to the garage on Canal Row.',
  },
  {
    id: 'courier', name: 'The Courier',
    brief: 'Follow the courier van through traffic. Stay close enough to see it, far enough not to be seen.',
    intro: 'Tail the courier van. Keep it in sight — but do not get spotted.',
  },
  {
    id: 'stash-house', name: 'Stash House',
    brief: 'The crew hid the cash in a house on Palm Row. Hold the street while they load it.',
    intro: 'Defend the stash house. The street gang is coming for the cash.',
  },
  {
    id: 'getaway-fleet', name: 'Getaway Fleet',
    brief: 'The big job needs two clean cars. Steal both marked cars and park them at the marina.',
    intro: 'Steal the two marked cars and deliver them to the marina lockup.',
  },
  {
    id: 'the-big-one', name: 'The Big One',
    brief: 'Grab the cash from the tower, then run a four-star chase to the boat at the marina. This is the last job.',
    intro: 'Grab the cash, then outrun the whole Vice Point force to the marina boat.',
  },
];
