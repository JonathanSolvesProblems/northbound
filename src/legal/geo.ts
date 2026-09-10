/**
 * Great-circle helpers and the border crossings Northbound reasons about.
 *
 * Crossing coordinates are approximate bridge midpoints. That is adequate for
 * direction-of-travel logic, which is all the cabotage test needs. Port codes are
 * the real CBP `port_number` values, so they join directly to the live wait-time
 * feed at https://bwt.cbp.gov/api/waittimes.
 */

export type Country = 'CA' | 'US' | 'MX';

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const toRadians = (deg: number): number => (deg * Math.PI) / 180;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Straight-line distance understates road distance, and the backtest should not
 * depend on a routing API being up. 1.20 is the usual North American highway
 * circuity rule of thumb. The live planner can swap in real routing.
 */
export const CIRCUITY_FACTOR = 1.2;

export function roadKm(a: LatLon, b: LatLon): number {
  return haversineKm(a, b) * CIRCUITY_FACTOR;
}

export interface Crossing {
  /** CBP port_number. Joins to the live border wait feed. */
  portCode: string;
  name: string;
  usSide: string;
  caSide: string;
  at: LatLon;
}

export const CROSSINGS: Crossing[] = [
  { portCode: '380001', name: 'Ambassador Bridge', usSide: 'Detroit, MI', caSide: 'Windsor, ON', at: { lat: 42.312, lon: -83.0733 } },
  { portCode: '380102', name: 'Gordie Howe International Bridge', usSide: 'Detroit, MI', caSide: 'Windsor, ON', at: { lat: 42.2925, lon: -83.1085 } },
  { portCode: '380201', name: 'Bluewater Bridge', usSide: 'Port Huron, MI', caSide: 'Sarnia, ON', at: { lat: 42.9997, lon: -82.4223 } },
  { portCode: '090101', name: 'Peace Bridge', usSide: 'Buffalo, NY', caSide: 'Fort Erie, ON', at: { lat: 42.9053, lon: -78.906 } },
  { portCode: '090104', name: 'Lewiston-Queenston Bridge', usSide: 'Lewiston, NY', caSide: 'Queenston, ON', at: { lat: 43.1637, lon: -79.043 } },
  { portCode: '070801', name: 'Thousand Islands Bridge', usSide: 'Alexandria Bay, NY', caSide: 'Lansdowne, ON', at: { lat: 44.335, lon: -75.993 } },
  { portCode: '380301', name: 'Sault Ste. Marie International Bridge', usSide: 'Sault Ste. Marie, MI', caSide: 'Sault Ste. Marie, ON', at: { lat: 46.51, lon: -84.348 } },
  { portCode: '070401', name: 'Massena', usSide: 'Massena, NY', caSide: 'Cornwall, ON', at: { lat: 44.9861, lon: -74.7369 } },
  { portCode: '070101', name: 'Ogdensburg', usSide: 'Ogdensburg, NY', caSide: 'Prescott, ON', at: { lat: 44.7136, lon: -75.4586 } },
  // Roadstar runs to California and New Mexico as well as the Midwest, and those
  // trucks come home through the prairie and west-coast ports, not Ontario.
  { portCode: '360401', name: 'International Falls', usSide: 'International Falls, MN', caSide: 'Fort Frances, ON', at: { lat: 48.6019, lon: -93.4069 } },
  { portCode: '340101', name: 'Pembina', usSide: 'Pembina, ND', caSide: 'Emerson, MB', at: { lat: 48.9436, lon: -97.2408 } },
  { portCode: '331001', name: 'Sweetgrass', usSide: 'Sweetgrass, MT', caSide: 'Coutts, AB', at: { lat: 48.9986, lon: -111.9633 } },
  { portCode: '300401', name: 'Pacific Highway', usSide: 'Blaine, WA', caSide: 'Surrey, BC', at: { lat: 49.0025, lon: -122.7375 } },
  { portCode: '302301', name: 'Lynden', usSide: 'Lynden, WA', caSide: 'Aldergrove, BC', at: { lat: 49.0025, lon: -122.4847 } },
  { portCode: '300901', name: 'Sumas', usSide: 'Sumas, WA', caSide: 'Abbotsford, BC', at: { lat: 49.0025, lon: -122.2647 } },
];

/** Roadstar Trucking, Milton ON. */
export const ROADSTAR_BASE: LatLon = { lat: 43.5183, lon: -79.8774 };

export function nearestCrossing(p: LatLon): { crossing: Crossing; km: number } {
  let best: { crossing: Crossing; km: number } = { crossing: CROSSINGS[0], km: Infinity };
  for (const crossing of CROSSINGS) {
    const km = haversineKm(p, crossing.at);
    if (km < best.km) best = { crossing, km };
  }
  return best;
}
