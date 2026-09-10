/**
 * What Roadstar's own completed dispatch history says about empty running.
 *
 * This replaces an earlier module that estimated what it would cost if the trucks
 * currently in the US ran home empty. Their history says they almost never do
 * (6 legs, 2,044 miles in two months), so that estimate was measuring something
 * that does not happen. The numbers below are counted, not projected.
 *
 * Ground truth is theirs: which legs ran, how far, and whether they ran empty.
 * Coordinates are GeoNames. The rate is ATRI's. None of the three are mine.
 */

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { haversineKm, CROSSINGS, type LatLon } from '../legal/geo';
import { geocodeDesc, countryOf } from '../fleet/gazetteer';
import { MIN_RETURN_PROGRESS_KM } from '../legal/cabotage';

/** ATRI, "An Analysis of the Operational Costs of Trucking: 2025 Update". */
export const ATRI_COST_PER_MILE_2025 = 2.336;
export const ATRI_MARGINAL_COST_PER_MILE_2025 = 1.854;

const NULLS = new Set(['', '<null>', 'NULL', 'null', 'N/A']);

const clean = (v: string | undefined): string | null => {
  const s = (v ?? '').trim();
  return NULLS.has(s) ? null : s;
};

const toNum = (v: string | undefined): number => {
  const n = Number(clean(v));
  return Number.isFinite(n) ? n : 0;
};

const nearestBorderKm = (p: LatLon): number =>
  Math.min(...CROSSINGS.map((c) => haversineKm(p, c.at)));

export interface EmptyLeg {
  driver: string | null;
  fromDesc: string;
  toDesc: string;
  miles: number;
  /** Positive means the leg carried the truck toward its base country. */
  towardBorderKm: number;
}

export interface HistorySummary {
  legs: number;
  loadedLegs: number;
  emptyLegs: number;
  totalMiles: number;
  loadedMiles: number;
  emptyMiles: number;
  emptyShareOfDistance: number;
  /** Empty legs grouped by which side of the border each end sat on. */
  byLane: Record<string, { legs: number; miles: number }>;
  /** Empty US-to-US legs that were already travelling toward the border. */
  borderBound: EmptyLeg[];
  borderBoundMiles: number;
  borderBoundCost: number;
  unresolved: number;
}

export function loadHistory(path: string): HistorySummary {
  const rows = parse(readFileSync(path, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  const byLane: Record<string, { legs: number; miles: number }> = {};
  const borderBound: EmptyLeg[] = [];
  let loadedLegs = 0, emptyLegs = 0, loadedMiles = 0, emptyMiles = 0, unresolved = 0;

  for (const r of rows) {
    const miles = toNum(r.LS_LEG_DIST);
    const isEmpty = (clean(r.LS_MT_LOADED) ?? '').toUpperCase() === 'E';
    if (isEmpty) { emptyLegs++; emptyMiles += miles; } else { loadedLegs++; loadedMiles += miles; }
    if (!isEmpty) continue;

    const fromDesc = clean(r.LEGO_ZONE_DESC) ?? '';
    const toDesc = clean(r.LEGD_ZONE_DESC) ?? '';
    const from = countryOf(fromDesc);
    const to = countryOf(toDesc);
    const lane = `${from ?? '?'} -> ${to ?? '?'}`;
    byLane[lane] ??= { legs: 0, miles: 0 };
    byLane[lane].legs++;
    byLane[lane].miles += miles;

    if (from !== 'US' || to !== 'US') continue;
    const o = geocodeDesc(fromDesc);
    const d = geocodeDesc(toDesc);
    if (!o || !d) { unresolved++; continue; }

    const towardBorderKm = nearestBorderKm(o) - nearestBorderKm(d);
    if (towardBorderKm >= MIN_RETURN_PROGRESS_KM) {
      borderBound.push({ driver: clean(r.NAME), fromDesc, toDesc, miles, towardBorderKm });
    }
  }

  const borderBoundMiles = borderBound.reduce((s, l) => s + l.miles, 0);
  const totalMiles = loadedMiles + emptyMiles;

  return {
    legs: loadedLegs + emptyLegs,
    loadedLegs, emptyLegs, totalMiles, loadedMiles, emptyMiles,
    emptyShareOfDistance: totalMiles ? emptyMiles / totalMiles : 0,
    byLane,
    borderBound,
    borderBoundMiles,
    borderBoundCost: borderBoundMiles * ATRI_COST_PER_MILE_2025,
    unresolved,
  };
}

/** Lanes Roadstar repeats empty, which is what makes a standing agreement worth signing. */
export function repeatedLanes(h: HistorySummary, top = 8): Array<{ lane: string; legs: number; miles: number }> {
  const agg: Record<string, { legs: number; miles: number }> = {};
  for (const l of h.borderBound) {
    const lane = `${l.fromDesc} -> ${l.toDesc}`;
    agg[lane] ??= { legs: 0, miles: 0 };
    agg[lane].legs++;
    agg[lane].miles += l.miles;
  }
  return Object.entries(agg)
    .map(([lane, v]) => ({ lane, ...v }))
    .sort((a, b) => b.miles - a.miles)
    .slice(0, top);
}
