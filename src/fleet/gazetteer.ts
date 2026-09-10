/**
 * Place lookup, ported from scripts/geocode.py so the live board and the offline
 * analysis resolve identically. Backed by GeoNames US + CA populated places.
 *
 * Roadstar's TMS records place names the way dispatchers type them, so the raw key
 * misses often: "ST-MODESTE" against GeoNames' "Saint-Modeste", "SHELBY TOWNSHIP"
 * against "Shelby". The candidate ladder closes that; anything still unresolved is
 * reported by callers rather than dropped.
 */

import { readFileSync } from 'node:fs';
import type { Country, LatLon } from '../legal/geo';

const GAZ: Record<string, [number, number]> = JSON.parse(
  readFileSync(new URL('../../data/ref/gazetteer.json', import.meta.url), 'utf8'),
);

const CA_PROVINCES = new Set(['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']);

/** Obsolete codes still present in older TMS records. */
const STATE_ALIAS: Record<string, string> = { PQ: 'QC', NF: 'NL' };

/** Amalgamated districts GeoNames files under the parent city. Fine at lane scale. */
const DISTRICTS: Record<string, string> = {
  'NORTHYORK,ON': 'TORONTO,ON',
  'SCARBOROUGH,ON': 'TORONTO,ON',
  'ETOBICOKE,ON': 'TORONTO,ON',
  'EASTYORK,ON': 'TORONTO,ON',
  'YORK,ON': 'TORONTO,ON',
  'CONCORD,ON': 'VAUGHAN,ON',
  'REXDALE,ON': 'TORONTO,ON',
  'WESTON,ON': 'TORONTO,ON',
  'AGINCOURT,ON': 'TORONTO,ON',
};

const PREFIX: Array<[string, string]> = [
  ['ST', 'SAINT'], ['SAINT', 'ST'], ['STE', 'SAINTE'], ['SAINTE', 'STE'], ['MT', 'MOUNT'], ['MOUNT', 'MT'],
];

const SUFFIX = [' TOWNSHIP', ' TWP', ' TOWN', ' VILLAGE', ' CITY OF', ' TOWN OF'];

const squash = (s: string): string => s.toUpperCase().replace(/[\s\-.']/g, '');

function candidates(city: string): string[] {
  const raw = city.trim().toUpperCase();
  const forms = [raw];
  for (const suf of SUFFIX) {
    if (raw.endsWith(suf)) forms.push(raw.slice(0, -suf.length).trim());
  }
  const out: string[] = [];
  for (const form of forms) {
    out.push(squash(form));
    const tokens = form.replace(/-/g, ' ').replace(/\./g, '').split(/\s+/).filter(Boolean);
    if (tokens.length) {
      for (const [a, b] of PREFIX) {
        if (tokens[0] === a) out.push(squash([b, ...tokens.slice(1)].join(' ')));
      }
    }
  }
  return out;
}

export function geocode(city: string | null, state: string | null): LatLon | null {
  if (!city || !state) return null;
  let st = state.trim().toUpperCase().slice(0, 2);
  st = STATE_ALIAS[st] ?? st;
  for (const cand of candidates(city)) {
    const key = DISTRICTS[`${cand},${st}`] ?? `${cand},${st}`;
    const hit = GAZ[key];
    if (hit) return { lat: hit[0], lon: hit[1] };
  }
  return null;
}

/** "NORWALK, OH" -> coordinates. The format the Dispatch sheet uses. */
export function geocodeDesc(desc: string | null): LatLon | null {
  if (!desc || !desc.includes(',')) return null;
  const i = desc.lastIndexOf(',');
  return geocode(desc.slice(0, i), desc.slice(i + 1));
}

/** "MILTON, ON" -> 'CA'. Trust the code, not geometry. */
export function countryOf(desc: string | null): Country | null {
  if (!desc || !desc.includes(',')) return null;
  const code = desc.slice(desc.lastIndexOf(',') + 1).trim().toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return CA_PROVINCES.has(code) ? 'CA' : 'US';
}
