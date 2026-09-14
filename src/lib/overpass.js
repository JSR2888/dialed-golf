// Free, keyless lookup of pin (flag) locations tagged on OpenStreetMap.
// Coverage depends entirely on whether volunteers have mapped golf=pin
// nodes for a given course — many courses have nothing. Callers should
// always have a manual fallback; this is a convenience, not a dependency.

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

/**
 * Find golf=pin nodes within radiusMeters of a point.
 * Returns [{ lat, lng, ref }] where ref is the hole number tag if the
 * mapper included one (not guaranteed).
 */
export async function fetchNearbyPins({ lat, lng }, radiusMeters = 900) {
  const query = `
    [out:json][timeout:25];
    node["golf"="pin"](around:${radiusMeters},${lat},${lng});
    out body;
  `.trim();

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`Overpass request failed (${res.status})`);
  }

  const data = await res.json();
  return (data.elements || []).map((el) => ({
    lat: el.lat,
    lng: el.lon,
    ref: el.tags?.ref || el.tags?.name || null,
  }));
}
