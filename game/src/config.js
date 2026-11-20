// Vice Point — tuning and world layout.
// One dense coastal district, 6x6 blocks. All numbers are the game's own
// design: a driveable grid, a beach on the west edge, a harbour basin in
// the south-east corner where the docks are.

export const WORLD_HALF = 180;
export const ROAD_POSITIONS = [-150, -90, -30, 30, 90, 150];
export const ROAD_WIDTH = 14;
export const BLOCK_PITCH = 60;

// Beach and water on the west edge.
export const BEACH_X0 = -210;
export const BEACH_X1 = -180;
export const WATER_X = -210;

// Harbour basin (south-east corner) and the docks waypoint.
export const HARBOUR = { x0: 120, z0: 120, x1: 180, z1: 180 };
export const DOCKS = { x: 150, z: 112 };

// Key places.
export const PLAYER_START = { x: -140, z: -140, heading: Math.PI / 2 };
export const HOSPITAL = { x: -150, z: -150 };
export const GARAGE = { x: -140, z: 140 };
export const STASH_HOUSE = { x: -90, z: 90 };
export const BANK = { x: 30, z: -30 };

// Story: six missions for Mara Reyes, one arc.
export const MISSIONS = [
  { title: 'First Gear', reward: 250 },
  { title: 'Repo Run', reward: 400 },
  { title: 'The Courier', reward: 500 },
  { title: 'Stash House', reward: 700 },
  { title: 'Getaway Fleet', reward: 900 },
  { title: 'The Big One', reward: 2500 },
];
export const MISSION_TITLES = MISSIONS.map((m) => m.title);
export const MISSION_REWARDS = MISSIONS.map((m) => m.reward);
export const PACKAGE_COUNT = 20;
export const START_CASH = 150;

// Wanted: police cars per star, heat model.
export const POLICE_PER_STAR = [0, 1, 2, 3, 4, 5];
export const MAX_WANTED = 5;
export const HEAT_PER_STAR = 20;
export const HEAT_DECAY_PER_SECOND = 8;
export const HEAT_LOSE_SIGHT_SECONDS = 5;
export const POLICE_VIEW_RANGE = 45;

// On-foot movement.
export const WALK_SPEED = 6.5;
export const RUN_SPEED = 9.5;
export const JUMP_SPEED = 8;
export const GRAVITY = 22;

// Driving.
export const CAR_TOP_SPEEDS = { sedan: 30, coupe: 38, suv: 26, pickup: 31, taxi: 30 };
export const CAR_ACCEL = { sedan: 14, coupe: 18, suv: 11, pickup: 14, taxi: 13 };
export const CAR_GRIP = { sedan: 7.5, coupe: 8.5, suv: 6.5, pickup: 7, taxi: 7.5 };

// Combat.
export const WEAPONS = {
  fists: { damage: 12, range: 2.2, rate: 2.2, ammo: Infinity, auto: false },
  pistol: { damage: 26, range: 60, rate: 3.5, ammo: 48, auto: false },
  smg: { damage: 13, range: 50, rate: 11, ammo: 120, auto: true },
};
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_MAX_ARMOR = 100;

// Traffic and pedestrians.
export const TRAFFIC_COUNT = 14;
export const TRAFFIC_SPEED = 10;
export const PED_COUNT = 24;
export const PED_SPEED = 1.6;

// Clock: the whole game sits at golden hour.
export const GAME_CLOCK = '06:00 PM';
export const SAVE_KEY = 'vicepoint-save-v1';
export const ENEMY_DAMAGE = 8;
export const ENEMY_HEALTH = 60;
export const ENEMY_SHOOT_INTERVAL = 2.2;
export const BUSTED_FINE = 200;
export const WASTED_FINE = 150;
export const PACKAGE_REWARD = 50;
