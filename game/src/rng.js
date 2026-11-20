// Vice Point — deterministic randomness and small math helpers.
// Every seeded run (for example ?seed=7) builds the same district, so a
// screenshot can be reproduced exactly. Nothing here touches the DOM.
export function makeSeededRandom(seedValue) {
  let state = (seedValue >>> 0) || 1;
  return function nextRandom() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function chooseOne(random, list) {
  return list[Math.floor(random() * list.length)];
}

export function inRange(random, low, high) {
  return low + random() * (high - low);
}

export function clampNumber(value, low, high) {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

export function mixNumbers(a, b, t) {
  return a + (b - a) * t;
}

// Keep an angle inside [-PI, PI] so headings never drift off to huge values.
export function normaliseAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function turnToward(current, target, amount) {
  return current + normaliseAngle(target - current) * amount;
}

// Shortest distance from a 2D point to a line segment, x/z plane only.
export function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  let t = lengthSq === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / lengthSq;
  t = clampNumber(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
