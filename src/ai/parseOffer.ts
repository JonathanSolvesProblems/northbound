/**
 * Turning a load offer into something the legality engine can reason about.
 *
 * This is where the model earns its place. Freight offers arrive as email and rate
 * confirmations written by people in a hurry: "Need a van, Columbus OH to Brampton
 * ON, pu 9/12 0700-1200, 42k, $2650 all in". Regex does that badly and an LLM does
 * it well.
 *
 * The model reads. It does not decide. Whether a Canadian truck may take the load
 * is settled afterwards by 19 CFR 123.14 and the hours-of-service clocks, in code,
 * with a citation. That split is deliberate: a model should never be the thing
 * asserting what the law permits.
 */

import { chat, extractJson } from './client';
import { geocode } from '../fleet/gazetteer';
import type { Country, LatLon } from '../legal/geo';

export interface ParsedOffer {
  originCity: string | null;
  originState: string | null;
  destCity: string | null;
  destState: string | null;
  /** ISO 8601 if the offer gave one, else null. Never invented. */
  pickupFrom: string | null;
  pickupTo: string | null;
  deliverBy: string | null;
  weightLbs: number | null;
  equipment: 'Dry Van' | 'Reefer' | 'Flatbed' | 'Other' | null;
  temperatureF: number | null;
  rateUsd: number | null;
  commodity: string | null;
  broker: string | null;
  /** The model's own reading of how much of this was actually stated. */
  confidence: 'high' | 'medium' | 'low';
  missing: string[];
}

export interface ResolvedOffer extends ParsedOffer {
  origin: LatLon | null;
  originCountry: Country | null;
  dest: LatLon | null;
  destCountry: Country | null;
}

const SYSTEM = `You read North American truckload freight offers and return structured JSON.

Rules:
- Extract only what the text states. Never infer a rate, a weight, or a date that is not there.
- Put anything you could not find in "missing" and set the field to null.
- Cities and states/provinces separately. Use two-letter codes: OH, MI, ON, QC.
- Weight in pounds. "42k" means 42000. "43,000 lbs" means 43000.
- Rate in US dollars as a number, no currency symbol. "$2650 all in" means 2650.
- Equipment: "Dry Van", "Reefer", "Flatbed" or "Other". "van" means Dry Van. "reefer",
  "temp controlled" or a temperature requirement means Reefer.
- Dates as ISO 8601. If a year is absent assume the current year. If only a date is
  given with no time, use 00:00.
- confidence: "high" if origin, destination and pickup window were all explicit.

Return a single JSON object and nothing else.`;

const SHAPE = `{
  "originCity": string|null, "originState": string|null,
  "destCity": string|null, "destState": string|null,
  "pickupFrom": string|null, "pickupTo": string|null, "deliverBy": string|null,
  "weightLbs": number|null, "equipment": string|null, "temperatureF": number|null,
  "rateUsd": number|null, "commodity": string|null, "broker": string|null,
  "confidence": "high"|"medium"|"low", "missing": string[]
}`;

export async function parseOffer(raw: string, signal?: AbortSignal, today = new Date()): Promise<ParsedOffer> {
  // The model has no clock. Without this it resolves "pu 9/12" against its training
  // cutoff and silently dates every load two years ago.
  const dateLine = `Today is ${today.toISOString().slice(0, 10)}. Resolve bare dates like "9/12" against it.`;
  const completion = await chat(
    `${dateLine}\n\nReturn JSON in exactly this shape:\n${SHAPE}\n\nFreight offer:\n"""\n${raw.trim()}\n"""`,
    { system: SYSTEM, json: true, temperature: 0, signal },
  );
  const parsed = extractJson<ParsedOffer>(completion);
  return {
    ...parsed,
    missing: Array.isArray(parsed.missing) ? parsed.missing : [],
    confidence: parsed.confidence ?? 'low',
  };
}

/** Attach coordinates and countries so the cabotage engine can take over. */
export function resolveOffer(offer: ParsedOffer): ResolvedOffer {
  const origin = geocode(offer.originCity, offer.originState);
  const dest = geocode(offer.destCity, offer.destState);
  return {
    ...offer,
    origin,
    dest,
    originCountry: countryOfState(offer.originState),
    destCountry: countryOfState(offer.destState),
  };
}

const CA_PROVINCES = new Set(['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU']);

export function countryOfState(state: string | null): Country | null {
  if (!state) return null;
  const code = state.trim().toUpperCase().slice(0, 2);
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return CA_PROVINCES.has(code) ? 'CA' : 'US';
}
