/**
 * Roadstar's driver roster, as exported from their TMS.
 *
 * The interesting columns are REMAINING_HOURS_US_7/8 and REMAINING_HOURS_CAN_7/8/14.
 * Their own system already tracks the two rulebooks separately, which is the
 * clearest possible evidence that the cross-border clock is a real operating
 * problem rather than something invented for a hackathon.
 */

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import type { Country, LatLon } from '../legal/geo';

const NULLS = new Set(['', '<null>', 'NULL', 'null', 'N/A']);

const CA_PROVINCES = new Set(['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']);

/** Status codes seen in the export, with what dispatch means by them. */
export const STATUS_MEANING: Record<string, string> = {
  AVAIL: 'available at the yard',
  ASSGN: 'assigned to a trip',
  DISP: 'dispatched',
  ARRSHIP: 'arrived at shipper',
  PICKD: 'picked up',
  DEPSHIP: 'departed shipper, loaded',
  ARRCONS: 'arrived at consignee, unloading',
  DEPCONS: 'departed consignee, empty',
  YARD: 'in the yard',
  VACATION: 'off',
  UNAVL: 'unavailable',
};

/** Statuses where the truck is empty or about to be. These are the backhaul moments. */
export const EMPTY_SOON = new Set(['DEPCONS', 'ARRCONS']);

export interface Driver {
  id: string;
  name: string;
  status: string;
  statusMeaning: string;
  /** Cycle currently in force: 'U' US, 'C' Canadian. */
  cycleZone: string | null;
  remainingHours: number | null;
  usRemaining7: number | null;
  usRemaining8: number | null;
  canRemaining7: number | null;
  canRemaining8: number | null;
  canRemaining14: number | null;
  /** Free-text satellite position, e.g. "0.63M SSE of CINCINNATI, OH". */
  lastKnownPlace: string | null;
  position: LatLon | null;
  country: Country | null;
  destination: string | null;
  deliverBy: string | null;
  hoursUpdated: string | null;
  assignedUnit: string | null;
}

const clean = (v: string | undefined): string | null => {
  const s = (v ?? '').trim();
  return NULLS.has(s) ? null : s;
};

const numeric = (v: string | undefined): number | null => {
  const s = clean(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** TMS position format is packed DDMMSS + hemisphere: "0433201N" -> 43.5336 */
export function parseDms(v: string | null): number | null {
  if (!v || v.length < 8) return null;
  const hemisphere = v.slice(-1).toUpperCase();
  const degrees = Number(v.slice(0, 3));
  const minutes = Number(v.slice(3, 5));
  const seconds = Number(v.slice(5, 7));
  if (![degrees, minutes, seconds].every(Number.isFinite)) return null;
  const decimal = degrees + minutes / 60 + seconds / 3600;
  return hemisphere === 'S' || hemisphere === 'W' ? -decimal : decimal;
}

/**
 * Trust the state or province code in the position text rather than guessing from
 * geometry. "MILTON, ON" is unambiguous; a lat/lon near the river is not.
 */
export function countryFromPlace(place: string | null): Country | null {
  if (!place || !place.includes(',')) return null;
  const code = place.slice(place.lastIndexOf(',') + 1).trim().toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return CA_PROVINCES.has(code) ? 'CA' : 'US';
}

export function loadDrivers(path: string): Driver[] {
  const rows = parse(readFileSync(path, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  return rows
    .filter((r) => clean(r.DRIVER_ID))
    .map((r) => {
      const place = clean(r.LAST_SAT_LOC);
      const lat = parseDms(clean(r.POSLAT));
      const lon = parseDms(clean(r.POSLONG));
      const status = clean(r.STATUS) ?? 'unknown';
      return {
        id: clean(r.DRIVER_ID)!,
        name: clean(r.FIRST_NAME) ?? `Driver ${clean(r.DRIVER_ID)}`,
        status,
        statusMeaning: STATUS_MEANING[status] ?? status,
        cycleZone: clean(r.CURRENT_DRIVER_CYCLE_ZONE) ?? clean(r.DRIVER_CYCLE_ZONE),
        remainingHours: numeric(r.REMAINING_HOURS),
        usRemaining7: numeric(r.REMAINING_HOURS_US_7),
        usRemaining8: numeric(r.REMAINING_HOURS_US_8),
        canRemaining7: numeric(r.REMAINING_HOURS_CAN_7),
        canRemaining8: numeric(r.REMAINING_HOURS_CAN_8),
        canRemaining14: numeric(r.REMAINING_HOURS_CAN_14),
        lastKnownPlace: place,
        position: lat !== null && lon !== null ? { lat, lon } : null,
        country: countryFromPlace(place),
        destination: clean(r.FINAL_DESTINATION_DESC),
        deliverBy: clean(r.DELIVER_BY),
        hoursUpdated: clean(r.HOURS_UPDATED),
        assignedUnit: clean(r.DEFAULT_PUNIT),
      };
    });
}

/** Trucks sitting south of the border. Each one either finds a load home or runs empty. */
export function trucksInTheUS(drivers: Driver[]): Driver[] {
  return drivers.filter((d) => d.country === 'US');
}
