/**
 * The ablation: what does SPUR's model actually contribute?
 *
 * Every entry at a sponsored hackathon asserts the sponsor's product was essential.
 * This measures it. The same offers are read twice, once by GLM 5.2 on SPUR and
 * once by a genuine rules parser with the model switched off, and the delta is
 * reported in the only unit that matters here: how often the pipeline reaches the
 * correct legal verdict.
 *
 *   npx tsx src/cli/ablation.ts [n]
 *
 * Ground truth is Roadstar's own order book. The phrasings are mine, modelled on
 * real broker formats, and both arms see byte-identical input.
 */

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { parseOffer, resolveOffer, countryOfState, type ParsedOffer } from '../ai/parseOffer';
import { parseOfferWithoutModel } from '../ai/baseline';
import { renderOffer, STYLE_NAMES, type OrderFacts } from '../ai/renderOffer';
import { geocode } from '../fleet/gazetteer';
import { assessCabotage, type Truck, type CabotageVerdict } from '../legal/cabotage';
import { ROADSTAR_BASE } from '../legal/geo';

const ORDERS = new URL('../../data/raw/sheets/tlorder.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const NULLS = new Set(['', '<null>', 'NULL', 'null', 'N/A']);
const TRUCK: Truck = { id: '412', domicile: 'CA', base: ROADSTAR_BASE, driverAdmission: 'B1' };

const clean = (v: string | undefined) => {
  const s = (v ?? '').trim();
  return NULLS.has(s) ? null : s;
};

function loadFacts(limit: number): OrderFacts[] {
  const rows = parse(readFileSync(ORDERS, 'utf8'), {
    columns: true, skip_empty_lines: true, bom: true, relax_column_count: true,
  }) as Record<string, string>[];

  const out: OrderFacts[] = [];
  for (const r of rows) {
    const oc = clean(r.ORIGCITY), os = clean(r.ORIGPROV);
    const dc = clean(r.DESTCITY), ds = clean(r.DESTPROV);
    if (!oc || !os || !dc || !ds) continue;
    // Only orders both ends of which we can place, so ground truth is unambiguous.
    if (!geocode(oc, os) || !geocode(dc, ds)) continue;
    const w = Number(clean(r.WEIGHT_LBS));
    const pu = clean(r.ACTUAL_PICKUP) ?? clean(r.CREATED_TIME);
    out.push({
      originCity: oc, originState: os, destCity: dc, destState: ds,
      weightLbs: Number.isFinite(w) && w > 0 ? w : null,
      equipment: (clean(r.TEMP_CONTROLLED) ?? 'False').toLowerCase() === 'true' ? 'Reefer' : 'Dry Van',
      pickupDate: pu && !pu.startsWith('1980') ? pu.slice(0, 10) : null,
      commodity: clean(r.LOAD_DESCRIPTION),
      rateUsd: null,       // their book carries no rate, so neither arm sees one
    });
    if (out.length >= limit) break;
  }
  return out;
}

function verdictOf(p: ParsedOffer): CabotageVerdict | null {
  const o = geocode(p.originCity, p.originState);
  const d = geocode(p.destCity, p.destState);
  const oc = countryOfState(p.originState);
  const dc = countryOfState(p.destState);
  if (!o || !d || !oc || !dc) return null;
  return assessCabotage({ id: 'x', origin: o, originCountry: oc, dest: d, destCountry: dc }, TRUCK).verdict;
}

interface Score {
  place: number; weight: number; equipment: number; date: number;
  verdict: number; unreadable: number;
}

const blank = (): Score => ({ place: 0, weight: 0, equipment: 0, date: 0, verdict: 0, unreadable: 0 });

function score(p: ParsedOffer, truth: OrderFacts, truthVerdict: CabotageVerdict, into: Score, byStyle: Score): void {
  const same = (a: string | null, b: string) => (a ?? '').trim().toUpperCase() === b.trim().toUpperCase();
  const placeOk = same(p.originCity, truth.originCity) && same(p.originState, truth.originState)
    && same(p.destCity, truth.destCity) && same(p.destState, truth.destState);
  const weightOk = truth.weightLbs === null ? p.weightLbs === null : p.weightLbs === truth.weightLbs;
  const equipOk = p.equipment === truth.equipment;
  const dateOk = truth.pickupDate === null ? true : (p.pickupFrom ?? '').slice(0, 10) === truth.pickupDate;
  const v = verdictOf(p);
  const verdictOk = v === truthVerdict;

  for (const s of [into, byStyle]) {
    if (placeOk) s.place++;
    if (weightOk) s.weight++;
    if (equipOk) s.equipment++;
    if (dateOk) s.date++;
    if (verdictOk) s.verdict++;
    if (v === null) s.unreadable++;
  }
}

const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}%`.padStart(4) : '   -');

async function main(): Promise<void> {
  const n = Number(process.argv[2] ?? 40);
  const facts = loadFacts(n);
  console.log(`\n${'='.repeat(80)}`);
  console.log('  ABLATION  ·  what does SPUR\'s GLM 5.2 contribute to Northbound?');
  console.log('='.repeat(80));
  console.log(`\n  ${facts.length} real orders from Roadstar's book, rendered in ${STYLE_NAMES.length} broker formats.`);
  console.log('  Both arms read byte-identical text. Ground truth is their order record.\n');

  const withModel = blank();
  const withoutModel = blank();
  const styleWith: Record<string, Score> = {};
  const styleWithout: Record<string, Score> = {};
  for (const s of STYLE_NAMES) { styleWith[s] = blank(); styleWithout[s] = blank(); }
  const counts: Record<string, number> = {};

  const today = new Date('2026-09-10T00:00:00Z');
  let done = 0;
  for (const [i, f] of facts.entries()) {
    const { text, style } = renderOffer(f, i);
    counts[style] = (counts[style] ?? 0) + 1;

    const o = geocode(f.originCity, f.originState)!;
    const d = geocode(f.destCity, f.destState)!;
    const truthVerdict = assessCabotage(
      { id: 't', origin: o, originCountry: countryOfState(f.originState)!, dest: d, destCountry: countryOfState(f.destState)! },
      TRUCK,
    ).verdict;

    score(parseOfferWithoutModel(text, today), f, truthVerdict, withoutModel, styleWithout[style]);

    try {
      score(await parseOffer(text, AbortSignal.timeout(90_000), today), f, truthVerdict, withModel, styleWith[style]);
    } catch (err) {
      // A failure to read counts against the model. Not skipped.
      styleWith[style].unreadable++;
      withModel.unreadable++;
      process.stderr.write(`  (offer ${i} failed: ${(err as Error).message.slice(0, 80)})\n`);
    }
    done++;
    if (done % 10 === 0) process.stderr.write(`  ...${done}/${facts.length}\n`);
  }

  const t = facts.length;
  console.log(`  ${'FIELD'.padEnd(22)}${'GLM 5.2'.padStart(10)}${'no model'.padStart(10)}${'delta'.padStart(9)}`);
  console.log('  ' + '-'.repeat(51));
  const rows: Array<[string, keyof Score]> = [
    ['origin + destination', 'place'], ['weight', 'weight'], ['equipment', 'equipment'], ['pickup date', 'date'],
  ];
  for (const [label, key] of rows) {
    const a = withModel[key], b = withoutModel[key];
    console.log(`  ${label.padEnd(22)}${pct(a, t)}      ${pct(b, t)}      ${(a - b >= 0 ? '+' : '') + (((a - b) / t) * 100).toFixed(0)}pp`.padEnd(60));
  }
  console.log('  ' + '-'.repeat(51));
  const a = withModel.verdict, b = withoutModel.verdict;
  console.log(`  ${'CORRECT LEGAL VERDICT'.padEnd(22)}${pct(a, t)}      ${pct(b, t)}      ${(a - b >= 0 ? '+' : '') + (((a - b) / t) * 100).toFixed(0)}pp`);
  console.log(`  ${'could not read at all'.padEnd(22)}${pct(withModel.unreadable, t)}      ${pct(withoutModel.unreadable, t)}`);

  console.log('\n  Where the model earns its place, by format:\n');
  console.log(`  ${'FORMAT'.padEnd(20)}${'n'.padStart(4)}${'GLM 5.2'.padStart(10)}${'no model'.padStart(10)}`);
  console.log('  ' + '-'.repeat(44));
  for (const s of STYLE_NAMES) {
    const c = counts[s] ?? 0;
    if (!c) continue;
    console.log(`  ${s.padEnd(20)}${String(c).padStart(4)}${pct(styleWith[s].verdict, c)}      ${pct(styleWithout[s].verdict, c)}`);
  }
  console.log('');
}

main().catch((err) => { console.error(err); process.exit(1); });
