/**
 * Offer parsing WITHOUT the model. The off-switch arm of the ablation.
 *
 * This has to be a fair opponent or the ablation is theatre. It is a genuine,
 * reasonably careful rules parser: it handles the formats brokers actually use for
 * weight (42,000 lbs / 42k / 43000#), equipment synonyms, rates, bare M/D dates,
 * and "CITY, ST" pairs in both header and prose positions. It is the parser I would
 * have written if SPUR had never issued a credit.
 *
 * Where it loses to the model is the interesting part, and it is reported honestly
 * in scripts/ablation.ts rather than asserted here.
 */

import type { ParsedOffer } from './parseOffer';

const STATES = 'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|ON|QC|BC|AB|MB|SK|NS|NB|PE|NL|YT|NT|NU';

/** "Fairburn, GA" / "FAIRBURN,GA" / "Fairburn GA" in that order of confidence. */
const PLACE = new RegExp(String.raw`\b([A-Z][A-Za-z.\-']+(?:\s+[A-Z][A-Za-z.\-']+){0,2})\s*,\s*(${STATES})\b`, 'g');

const EQUIPMENT: Array<[RegExp, ParsedOffer['equipment']]> = [
  [/\b(reefer|refrigerated|temp[\s-]?control(?:led)?|frozen|chilled)\b/i, 'Reefer'],
  [/\b(dry\s*van|van|dv|53'?\s*van)\b/i, 'Dry Van'],
  [/\b(flat\s*bed|flatbed|fb|step\s*deck)\b/i, 'Flatbed'],
];

function weight(text: string): number | null {
  // 42,000 lbs | 42000# | 42k | 43.5k
  const kilo = text.match(/\b(\d{1,3}(?:\.\d+)?)\s*k\b/i);
  if (kilo) return Math.round(parseFloat(kilo[1]) * 1000);
  const explicit = text.match(/\b(\d{1,3}(?:,\d{3})|\d{4,6})\s*(?:lbs?|pounds|#)\b/i);
  if (explicit) return parseInt(explicit[1].replace(/,/g, ''), 10);
  const bare = text.match(/\bweight\s*[:=]?\s*(\d{1,3}(?:,\d{3})|\d{4,6})\b/i);
  if (bare) return parseInt(bare[1].replace(/,/g, ''), 10);
  return null;
}

function rate(text: string): number | null {
  const m = text.match(/\$\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.\d{2})?/);
  return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
}

function pickup(text: string, today: Date): string | null {
  // pu 9/12 | pickup 09/12/26 | PU: 2026-09-12
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return `${iso[1]}T00:00:00`;
  const md = text.match(/\b(?:pu|pick\s?up|p\/u)\b\D{0,12}?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i)
    ?? text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (!md) return null;
  const month = parseInt(md[1], 10);
  const day = parseInt(md[2], 10);
  let year = md[3] ? parseInt(md[3], 10) : today.getFullYear();
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const hhmm = text.match(/\b(\d{3,4})\s*-\s*(\d{3,4})\b/);
  const hh = hhmm ? hhmm[1].padStart(4, '0').slice(0, 2) : '00';
  const mm = hhmm ? hhmm[1].padStart(4, '0').slice(2, 4) : '00';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hh}:${mm}:00`;
}

export function parseOfferWithoutModel(raw: string, today = new Date()): ParsedOffer {
  const text = raw.replace(/\s+/g, ' ').trim();

  const places: Array<{ city: string; state: string }> = [];
  for (const m of text.matchAll(PLACE)) {
    places.push({ city: m[1].trim(), state: m[2].toUpperCase() });
  }

  let equipment: ParsedOffer['equipment'] = null;
  for (const [re, kind] of EQUIPMENT) {
    if (re.test(text)) { equipment = kind; break; }
  }

  const w = weight(text);
  const r = rate(text);
  const pu = pickup(text, today);

  const missing: string[] = [];
  if (places.length < 2) missing.push('origin/destination');
  if (w === null) missing.push('weightLbs');
  if (!equipment) missing.push('equipment');
  if (r === null) missing.push('rateUsd');
  if (!pu) missing.push('pickupFrom');

  return {
    originCity: places[0]?.city ?? null,
    originState: places[0]?.state ?? null,
    destCity: places[1]?.city ?? null,
    destState: places[1]?.state ?? null,
    pickupFrom: pu,
    pickupTo: null,
    deliverBy: null,
    weightLbs: w,
    equipment,
    temperatureF: null,
    rateUsd: r,
    commodity: null,
    broker: null,
    confidence: places.length >= 2 && w !== null && pu ? 'high' : places.length >= 2 ? 'medium' : 'low',
    missing,
  };
}
