// Vice Point — the one place every tuning number lives.
// The district is a grid: 6 blocks of 44 units, separated by 14-unit streets,
// 362 units across, centred on the origin. A canal cuts across it east-west
// and a single bridge carries the avenue over the water. One unit is about
// a metre. Golden hour is fixed: low warm sun, orange horizon, long shadows.
export const WORLD = {
  blockSize: 44,
  streetWidth: 14,
  blocksPerSide: 6,
  canalZ: 58,
  canalWidth: 12,
  beachEdgeX: -181,
  seaEdgeX: -215,
  halfWidth: 0,
  streetLines: [],
  blockLines: [],
  sunColour: 0xffb36b,
  sunStrength: 2.6,
  skyTop: 0x7fb2e8,
  skyLow: 0xffc98a,
  fogColour: 0xf2b98a,
  walkSpeed: 6.5,
  runSpeed: 10,
  jumpSpeed: 8.5,
  gravity: 24,
  playerRadius: 0.55,
  playerHealth: 100,
  carTopSpeed: 42,
  carAccel: 22,
  carBrake: 34,
  carSteer: 1.9,
  maxWanted: 5,
  wantedCoolSeconds: 14,
  policePerStar: [0, 1, 2, 3, 4, 5],
  missionPayouts: [250, 400, 500, 700, 900, 2500],
  packageCount: 20,
  packageValue: 25,
  taxiFare: 60,
  vigilantePayout: 150,
  stuntPayout: 100,
  killBonus: 40,
  saveSlot: 'vicepoint-save-v1',
  weapons: {
    fists: { label: 'Fists', damage: 12, reach: 2.2, cooldown: 0.45, automatic: false, ammo: Infinity },
    pistol: { label: 'Pistol', damage: 22, reach: 55, cooldown: 0.28, automatic: false, ammo: 60 },
    smg: { label: 'SMG', damage: 11, reach: 45, cooldown: 0.085, automatic: true, ammo: 120 },
  },
};

const totalSpan = WORLD.blocksPerSide * WORLD.blockSize
  + (WORLD.blocksPerSide + 1) * WORLD.streetWidth;
WORLD.halfWidth = totalSpan / 2;
for (let i = 0; i <= WORLD.blocksPerSide; i += 1) {
  WORLD.streetLines.push(
    -WORLD.halfWidth + WORLD.streetWidth / 2 + i * (WORLD.blockSize + WORLD.streetWidth),
  );
}
for (let i = 0; i < WORLD.blocksPerSide; i += 1) {
  WORLD.blockLines.push(
    -WORLD.halfWidth + WORLD.streetWidth + WORLD.blockSize / 2
    + i * (WORLD.blockSize + WORLD.streetWidth),
  );
}

// Five drivable models. Each has its own colour, top speed, acceleration,
// grip and body length, so stealing a different car feels different.
export const VEHICLE_TYPES = [
  { id: 'sedan', label: 'Coastline Sedan', colour: 0x3f6fb5, topFactor: 0.92, accelFactor: 0.95, grip: 1.0, length: 4.6, width: 1.9 },
  { id: 'coupe', label: 'Sunset Coupe', colour: 0xd84a2f, topFactor: 1.12, accelFactor: 1.15, grip: 0.92, length: 4.3, width: 1.85 },
  { id: 'suv', label: 'Palm SUV', colour: 0x2e7d5b, topFactor: 0.85, accelFactor: 0.85, grip: 1.1, length: 4.9, width: 2.05 },
  { id: 'pickup', label: 'Dock Pickup', colour: 0xc9a227, topFactor: 0.9, accelFactor: 0.9, grip: 1.05, length: 5.1, width: 2.0 },
  { id: 'taxi', label: 'Vice Cab', colour: 0xf2c230, topFactor: 0.95, accelFactor: 1.0, grip: 1.0, length: 4.6, width: 1.9 },
];

// Mara Reyes, ex-getaway driver, pulled back in for one last job. Six
// missions, one arc: learn the car, steal one, tail one, defend one,
// steal two, then run the whole force to the boat.
export const STORY = [
  {
    id: 'first-gear', title: 'First Gear',
    brief: 'Mara is back in Vice Point. Take the coupe to the docks — and shake the tail.',
    intro: 'One last job. Drive to the docks and lose the patrol car on your tail.',
  },
  {
    id: 'repo-run', title: 'Repo Run',
    brief: 'A client wants his coupe back. Steal it from the lot on Market Street and bring it to the garage.',
    intro: 'Steal the marked coupe from the lot, then deliver it to the garage on Canal Row.',
  },
  {
    id: 'courier', title: 'The Courier',
    brief: 'Follow the courier van through traffic. Stay close enough to see it, far enough not to be seen.',
    intro: 'Tail the courier van. Keep it in sight — but do not get spotted.',
  },
  {
    id: 'stash-house', title: 'Stash House',
    brief: 'The crew hid the cash in a house on Palm Row. Hold the street while they load it.',
    intro: 'Defend the stash house. The street gang is coming for the cash.',
  },
  {
    id: 'getaway-fleet', title: 'Getaway Fleet',
    brief: 'The big job needs two clean cars. Steal both marked cars and park them at the marina.',
    intro: 'Steal the two marked cars and deliver them to the marina lockup.',
  },
  {
    id: 'the-big-one', title: 'The Big One',
    brief: 'Grab the cash from the tower, then run a four-star chase to the boat at the marina. This is the last job.',
    intro: 'Grab the cash, then outrun the whole Vice Point force to the marina boat.',
  },
];
