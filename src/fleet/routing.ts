/**
 * Choosing a border crossing.
 *
 * The nearest crossing to the truck is the wrong answer. A truck in Albuquerque
 * bound for Milton is closest to Sweetgrass and should cross at Detroit. The
 * crossing has to be picked as a via-point: minimise truck -> crossing -> delivery,
 * then let the live CBP wait break ties between the close ones.
 */

import { CROSSINGS, ROADSTAR_BASE, roadKm, type Crossing, type LatLon } from '../legal/geo';
import { lookupPlace, normalisePlace, type Place } from './places';

/** Resolve a TMS destination string. Unknown Ontario towns fall back to Milton. */
export function locate(place: string | null): Place | null {
  const hit = lookupPlace(place);
  if (hit) return hit;
  if (place && /,ON$/.test(normalisePlace(place))) {
    return { at: ROADSTAR_BASE, country: 'CA' };
  }
  return null;
}

export interface CrossingChoice {
  crossing: Crossing;
  toBorderKm: number;
  borderToDestKm: number;
  totalKm: number;
}

/** Ranked crossings for a run from `from` to `to`, shortest total journey first. */
export function rankCrossings(from: LatLon, to: LatLon): CrossingChoice[] {
  return CROSSINGS.map((crossing) => {
    const toBorderKm = roadKm(from, crossing.at);
    const borderToDestKm = roadKm(crossing.at, to);
    return { crossing, toBorderKm, borderToDestKm, totalKm: toBorderKm + borderToDestKm };
  }).sort((a, b) => a.totalKm - b.totalKm);
}

/** Highway average for a loaded tractor-trailer, used to turn km into clock hours. */
export const AVG_KMH = 85;

export const driveHours = (km: number): number => km / AVG_KMH;
