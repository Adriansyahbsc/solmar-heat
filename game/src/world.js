// Port Solmar itself: a procedural city on a road grid, and the whole game state that
// lives in it. Buildings, the park, the beach and the sea are generated once from the
// seed; everything that moves (player, cars, pedestrians, police, bullets, pickups,
// particles) is created here too, so the other systems only ever move what exists.
//
// Coordinates are world units. A circle (player, car, pedestrian) collides against
// building rectangles, the sea and the world edge; roads and sidewalks never block.

import {
  CAR,
  PARK,
  PEDS,
  PICKUPS,
  ROAD_HALF,
  ROADS_H,
  ROADS_V,
  SAND_Y,
  SIDEWALK,
  TRAFFIC,
  WATER_Y,
  WORLD,
} from './config.js';
import { pick, range, rangeInt } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_PICKUP = 1;
export const EVENT_CRASH = 2;
export const EVENT_SHOT = 4;
export const EVENT_COP_SHOT = 8;
export const EVENT_HIT_PED = 16;
export const EVENT_CAR_DISABLED = 32;
export const EVENT_COP_DOWN = 64;
export const EVENT_BUSTED = 128;
export const EVENT_WASTED = 256;
export const EVENT_MISSION_DONE = 512;
export const EVENT_MISSION_FAILED = 1024;
export const EVENT_MISSION_START = 2048;

const CAR_COLORS = ['#ff6b4a', '#ffd319', '#37e08b', '#b388ff', '#ff9f43', '#e8e4f2', '#5ec8e8', '#ff5e7a'];
const PED_COLORS = ['#ffd319', '#37e08b', '#ff9f43', '#b388ff', '#5ec8e8', '#ff5e7a', '#e8e4f2'];
const BUILDING_COLORS = ['#241a3d', '#2c2145', '#1f2a4d', '#33244d', '#2a1f3d'];

/** The rectangles between the roads: x/y spans a building block may use. */
function blockSpans() {
  const xs = [];
  const ys = [];
  const vEdges = [0, ...ROADS_V, WORLD.width];
  const hEdges = [0, ...ROADS_H, WORLD.height];
  for (let i = 0; i < vEdges.length - 1; i += 1) {
    const a = vEdges[i];
    const b = vEdges[i + 1];
    const x0 = a === 0 ? 24 : a + ROAD_HALF + SIDEWALK;
    const x1 = b === WORLD.width ? WORLD.width - 24 : b - ROAD_HALF - SIDEWALK;
    xs.push([x0, x1]);
  }
  for (let i = 0; i < hEdges.length - 1; i += 1) {
    const a = hEdges[i];
    const b = hEdges[i + 1];
    const y0 = a === 0 ? 24 : a + ROAD_HALF + SIDEWALK;
    const y1 = b === WORLD.height ? SAND_Y - SIDEWALK : b - ROAD_HALF - SIDEWALK;
    ys.push([y0, y1]);
  }
  return { xs, ys };
}

function generateCity(random) {
  const buildings = [];
  const trees = [];
  const palms = [];
  const { xs, ys } = blockSpans();
  for (const [bx0, bx1] of xs) {
    for (const [by0, by1] of ys) {
      const bw = bx1 - bx0;
      const bh = by1 - by0;
      if (bw < 60 || bh < 60) continue;
      // The park block stays green; the strip by the sea stays sand.
      if (bx0 >= PARK.x - 1 && by0 >= PARK.y - 1 && bx1 <= PARK.x + PARK.width + 1 && by1 <= PARK.y + PARK.height + 1) continue;
      if (by1 > SAND_Y) continue;
      const cols = bw > 340 ? 2 : 1;
      const rows = bh > 340 ? 2 : 1;
      for (let col = 0; col < cols; col += 1) {
        for (let row = 0; row < rows; row += 1) {
          const lotX0 = bx0 + (col * bw) / cols;
          const lotX1 = bx0 + ((col + 1) * bw) / cols;
          const lotY0 = by0 + (row * bh) / rows;
          const lotY1 = by0 + ((row + 1) * bh) / rows;
          const inset = range(random, 8, 22);
          const w = lotX1 - lotX0 - inset * 2;
          const h = lotY1 - lotY0 - inset * 2;
          if (w < 50 || h < 50) continue;
          buildings.push({
            x: lotX0 + inset,
            y: lotY0 + inset,
            width: w,
            height: h,
            color: pick(random, BUILDING_COLORS),
            seed: rangeInt(random, 0, 9999),
          });
        }
      }
    }
  }
  for (let i = 0; i < 46; i += 1) {
    trees.push({
      x: range(random, PARK.x + 24, PARK.x + PARK.width - 24),
      y: range(random, PARK.y + 24, PARK.y + PARK.height - 24),
      r: range(random, 10, 18),
    });
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: range(random, 60, WORLD.width - 60), y: range(random, SAND_Y + 14, WATER_Y - 16), r: range(random, 9, 13) });
  }
  return { buildings, trees, palms };
}

/** True when the point is inside a building, the sea, or outside the world. */
export function pointBlocked(city, x, y) {
  if (x < 0 || y < 0 || x >= WORLD.width || y >= WATER_Y) return true;
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) return true;
  }
  return false;
}

/**
 * Push a circle out of every building, the sea and the world edge. Returns true when
 * anything pushed it: the caller uses that to know a crash happened.
 */
export function resolveCircle(city, body, radius) {
  let pushed = false;
  const pushOut = (rx, ry, rw, rh) => {
    const cx = Math.max(rx, Math.min(body.x, rx + rw));
    const cy = Math.max(ry, Math.min(body.y, ry + rh));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) return;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      body.x = cx + (dx / d) * radius;
      body.y = cy + (dy / d) * radius;
    } else {
      // Dead centre inside: shove out along the shallowest side.
      const left = body.x - rx;
      const right = rx + rw - body.x;
      const top = body.y - ry;
      const bottom = ry + rh - body.y;
      const min = Math.min(left, right, top, bottom);
      if (min === left) body.x = rx - radius;
      else if (min === right) body.x = rx + rw + radius;
      else if (min === top) body.y = ry - radius;
      else body.y = ry + rh + radius;
    }
    pushed = true;
  };
  for (const b of city.buildings) pushOut(b.x, b.y, b.width, b.height);
  pushOut(-40, WATER_Y, WORLD.width + 80, WORLD.height - WATER_Y + 40);
  if (body.x < radius) { body.x = radius; pushed = true; }
  if (body.x > WORLD.width - radius) { body.x = WORLD.width - radius; pushed = true; }
  if (body.y < radius) { body.y = radius; pushed = true; }
  if (body.y > WATER_Y - radius) { body.y = WATER_Y - radius; pushed = true; }
  return pushed;
}

/** The nearest point on the road network to (x, y): the centre of the closest road. */
export function nearestRoadPoint(x, y) {
  let bestV = ROADS_V[0];
  let bestVd = Math.abs(x - bestV);
  for (const v of ROADS_V) {
    const d = Math.abs(x - v);
    if (d < bestVd) { bestVd = d; bestV = v; }
  }
  let bestH = ROADS_H[0];
  let bestHd = Math.abs(y - bestH);
  for (const h of ROADS_H) {
    const d = Math.abs(y - h);
    if (d < bestHd) { bestHd = d; bestH = h; }
  }
  return bestVd <= bestHd ? { axis: 'v', line: bestV } : { axis: 'h', line: bestH };
}

/** A random point on a road centreline, for spawning traffic and police. */
export function randomRoadPoint(random) {
  if (random() < 0.5) {
    const line = pick(random, ROADS_V);
    return { x: line, y: range(random, 80, WATER_Y - 120), axis: 'v', line };
  }
  const line = pick(random, ROADS_H);
  return { x: range(random, 80, WORLD.width - 80), y: line, axis: 'h', line };
}

/** A random point on a sidewalk, for spawning pedestrians. */
export function randomSidewalkPoint(random) {
  const road = nearestRoadPoint(range(random, 100, WORLD.width - 100), range(random, 100, SAND_Y - 100));
  const side = random() < 0.5 ? -1 : 1;
  const offset = ROAD_HALF + SIDEWALK / 2;
  if (road.axis === 'v') return { x: road.line + side * offset, y: range(random, 100, SAND_Y - 100) };
  return { x: range(random, 100, WORLD.width - 100), y: road.line + side * offset };
}

function makeCar(random, kind, x, y, angle) {
  return {
    id: Math.floor(random() * 1e9),
    kind,
    x,
    y,
    angle,
    speed: 0,
    color: kind === 'police' ? '#2456d6' : pick(random, CAR_COLORS),
    driver: kind === 'traffic' || kind === 'police',
    health: kind === 'police' ? CAR.policeHealth : CAR.health,
    disabled: false,
    smoke: 0,
    axis: 'v',
    line: 0,
    dir: 1,
    lane: 0,
    targetSpeed: 0,
  };
}

export function createGameState(seed) {
  const rng = (function seededRandom() {
    let a = seed | 0;
    return function random() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const city = generateCity(rng);

  const player = {
    x: 1500,
    y: 2050,
    angle: -Math.PI / 2,
    speed: 0,
    onFoot: true,
    health: 100,
    armor: 0,
    money: 0,
    car: null,
    hurtCooldown: 0,
    moving: false,
  };

  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const spot = randomRoadPoint(rng);
    const car = makeCar(rng, 'traffic', spot.x, spot.y, spot.axis === 'v' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI));
    car.axis = spot.axis;
    car.line = spot.line;
    car.dir = rng() < 0.5 ? 1 : -1;
    car.lane = (rng() < 0.5 ? -1 : 1) * 18;
    car.targetSpeed = range(rng, TRAFFIC.minSpeed, TRAFFIC.maxSpeed);
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  // Parked cars along the kerb, waiting to be borrowed.
  for (let i = 0; i < 6; i += 1) {
    const spot = randomRoadPoint(rng);
    const along = spot.axis === 'v' ? spot.y : spot.x;
    const parked = makeCar(rng, 'parked', spot.axis === 'v' ? spot.line + (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 16) : spot.x, spot.axis === 'v' ? along : spot.line + (rng() < 0.5 ? -1 : 1) * (ROAD_HALF - 16), spot.axis === 'v' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI));
    parked.driver = false;
    cars.push(parked);
  }

  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const spot = randomSidewalkPoint(rng);
    peds.push({
      x: spot.x,
      y: spot.y,
      angle: range(rng, 0, Math.PI * 2),
      speed: 0,
      state: 'walk',
      color: pick(rng, PED_COLORS),
      timer: range(rng, 2, 8),
      fleeX: 0,
      fleeY: 0,
      down: 0,
    });
  }

  const pickups = [];
  const pickupSpots = [
    { x: 900, y: 300, kind: 'cash' },
    { x: 2100, y: 900, kind: 'health' },
    { x: 2700, y: 1500, kind: 'armor' },
    { x: 300, y: 2100, kind: 'cash' },
    { x: 1200, y: 1200, kind: 'health' },
    { x: 3300, y: 300, kind: 'cash' },
    { x: 1500, y: 2100, kind: 'armor' },
    { x: 2100, y: 300, kind: 'cash' },
  ];
  for (const spot of pickupSpots) {
    pickups.push({ x: spot.x, y: spot.y, kind: spot.kind, amount: spot.kind === 'cash' ? PICKUPS.cashValue : 0, bob: range(rng, 0, Math.PI * 2) });
  }

  return {
    seed,
    rng,
    city,
    time: 0,
    player,
    cars,
    peds,
    cops: [],
    bullets: [],
    pickups,
    particles: [],
    wanted: { heat: 0, stars: 0 },
    bust: 0,
    mission: {
      index: -1,
      name: '',
      objective: '',
      target: null,
      timer: 0,
      progress: 0,
      needed: 0,
      done: false,
      failed: false,
      banner: '',
      bannerTimer: 0,
      targetCar: null,
      started: false,
    },
    camera: { x: player.x, y: player.y },
    storyDone: false,
    stats: { carsStolen: 0, shotsFired: 0, copsDown: 0, missionsDone: 0 },
  };
}
