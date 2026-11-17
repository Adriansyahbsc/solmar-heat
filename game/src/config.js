// SOLMAR HEAT — every tuning number and colour in one place.
//
// Port Solmar is a fictional sunset city: a grid of neon-lit streets, a park in the
// middle, and a beach along the south edge. The world is 3600 by 2600 units; the
// camera follows the player, so no rule below depends on the screen size.

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const WORLD = { width: 3600, height: 2600 };

/** Centrelines of the vertical and horizontal roads that make the city grid. */
export const ROADS_V = [300, 900, 1500, 2100, 2700, 3300];
export const ROADS_H = [300, 900, 1500, 2100];
/** Half the width of a road, asphalt edge to asphalt edge. */
export const ROAD_HALF = 55;
/** The strip between a road's edge and the buildings: where pedestrians walk. */
export const SIDEWALK = 26;

/** South edge: sand starts here, the sea below it. Both block movement. */
export const SAND_Y = 2300;
export const WATER_Y = 2420;

/** The one block with no buildings: the park, between the 900 and 1500 roads. */
export const PARK = { x: 955, y: 955, width: 490, height: 490 };

export const PLAYER = {
  walkSpeed: 235,
  runSpeed: 355,
  radius: 14,
  maxHealth: 100,
  maxArmor: 100,
  /** Seconds of mercy after taking a hit from a car. */
  hurtCooldown: 0.8,
};

export const CAR = {
  /** Top speed of an ordinary street car, units a second. */
  topSpeed: 520,
  policeTopSpeed: 580,
  accel: 420,
  brake: 760,
  reverseTop: 200,
  /** How fast a car turns at full lock, radians a second, scaled by speed. */
  steerRate: 2.6,
  radius: 24,
  /** Hit points before a car is disabled and smokes. */
  health: 40,
  policeHealth: 55,
};

export const TRAFFIC = {
  count: 14,
  minSpeed: 130,
  maxSpeed: 210,
  /** Chance a traffic car turns at an intersection it reaches. */
  turnChance: 0.3,
};

export const PEDS = { count: 26, walkSpeed: 55, fleeSpeed: 190 };

export const POLICE = {
  /** Police cars on the street per wanted star, capped. */
  carsPerStar: 1,
  maxCars: 4,
  /** Foot officers on the street once the wanted level reaches this. */
  footFromStars: 2,
  maxFoot: 3,
  footSpeed: 205,
  carChaseSpeed: 560,
  /** A cop this close, while the player crawls, fills the bust meter. */
  bustRange: 85,
  bustSpeed: 55,
  /** Seconds of that pressure before the bust lands. */
  bustSeconds: 3,
  shootRange: 330,
  shootInterval: 1.1,
  bulletDamage: 8,
};

/** Wanted heat thresholds: crossing one raises the star count. */
export const WANTED = {
  thresholds: [12, 28, 48, 68, 88],
  /** Heat lost a second while no cop is near. */
  decay: 1.0,
  /** Heat lost a second while cops are on the player. */
  decayHot: 0.4,
  stealCar: 20,
  shoot: 4,
  hitPed: 12,
  hurtCop: 14,
  killCop: 22,
  disablePoliceCar: 16,
};

export const COMBAT = {
  bulletSpeed: 950,
  bulletRange: 760,
  bulletDamage: 34,
  fireInterval: 0.16,
  pedHealth: 34,
  copHealth: 68,
  carBulletDamage: 12,
};

export const PICKUPS = {
  cashValue: 50,
  healthValue: 40,
  armorValue: 50,
};

/** Sunset-neon palette: dusk purple ground, hot pink and cyan light, amber roads. */
export const PALETTE = {
  backdrop: '#120a24',
  ground: '#1c1233',
  asphalt: '#2a2438',
  roadLine: '#ffd319',
  sidewalk: '#3b3352',
  grass: '#173d24',
  grassDark: '#12301d',
  sand: '#c98f4e',
  water: '#0e4a6b',
  waterLight: '#1a6f8f',
  buildingEdge: '#ff2e88',
  buildingRoof: '#241a3d',
  windowLit: '#ffd319',
  windowDark: '#4a3f66',
  parkTree: '#2fae5f',
  parkTreeDark: '#1f7a44',
  player: '#00e5ff',
  playerDark: '#0090a8',
  ped: '#e8e4f2',
  cop: '#2f6bff',
  copCar: '#2456d6',
  copLightRed: '#ff2e4d',
  copLightBlue: '#2e9bff',
  bullet: '#ffe45e',
  cash: '#37e08b',
  health: '#ff5e7a',
  armor: '#2e9bff',
  mission: '#ffd319',
  target: '#ff6b4a',
  text: '#f4efff',
  muted: '#a89ec4',
  panel: 'rgba(18, 10, 36, 0.92)',
  panelEdge: '#ff2e88',
  danger: '#ff2e4d',
  gold: '#ffd319',
};

export const FONT = '"Trebuchet MS", system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save lives between visits (this browser only). */
export const SAVE_KEY = 'solmar-heat-save-v1';

/** The story chain, in order: name, objective line, reward. */
export const MISSION_DEFS = [
  {
    name: '1 — Sunset Courier',
    objective: 'Deliver the package to the Marina drop before the clock runs out.',
    reward: 300,
    timeLimit: 75,
  },
  {
    name: '2 — Coral Cruiser',
    objective: 'Steal the coral convertible and bring it to Vera’s Garage.',
    reward: 500,
    timeLimit: 0,
  },
  {
    name: '3 — Heat Breaker',
    objective: 'Disable 2 police cruisers. Ram them hard or shoot them out.',
    reward: 700,
    timeLimit: 0,
  },
  {
    name: '4 — Ghost the Heat',
    objective: 'Reach the park hideout at 3 stars, then stay hidden until the heat dies.',
    reward: 900,
    timeLimit: 0,
  },
];
