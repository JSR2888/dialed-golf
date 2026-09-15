// Geo helpers. Flat-earth trig is accurate enough at golf-shot scale (a few
// hundred yards), so we skip full great-circle formulas for the offset math.

const EARTH_RADIUS_M = 6371000;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

export function distanceMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function metersToYards(m) {
  return m * 1.09361;
}

export function distanceYards(a, b) {
  return metersToYards(distanceMeters(a, b));
}

// Initial bearing in degrees (0-360, 0 = north) travelling from a to b.
export function bearing(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Break a shot down relative to an intended target (pin or practice target).
 * totalYards: GPS distance from start to where the ball was found (carry + roll).
 * lateralYards: positive = right of the target line, negative = left.
 * longShortYards: positive = ended up past the target, negative = came up short.
 * All but totalYards are null when there's no target for this shot.
 */
export function computeDispersion(start, target, end) {
  const totalYards = distanceYards(start, end);

  if (!target) {
    return {
      totalYards,
      targetDistanceYards: null,
      lateralYards: null,
      longShortYards: null,
    };
  }

  const targetDistanceYards = distanceYards(start, target);
  const targetBearing = bearing(start, target);
  const shotBearing = bearing(start, end);
  const angleDiffRad = toRad(shotBearing - targetBearing);

  const lateralYards = totalYards * Math.sin(angleDiffRad);
  const longComponent = totalYards * Math.cos(angleDiffRad);
  const longShortYards = longComponent - targetDistanceYards;

  return { totalYards, targetDistanceYards, lateralYards, longShortYards };
}
