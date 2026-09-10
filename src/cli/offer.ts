/**
 * Northbound: can this truck take this load?
 *
 * A dispatcher pastes the offer exactly as it arrived. The model reads it, the law
 * decides it, and CBP prices the border.
 *
 *   npx tsx src/cli/offer.ts --driver Driver67 "van, Fairburn GA to Walton KY, pu 9/12 0700-1200, 42k, $1450"
 *   cat offer.txt | npx tsx src/cli/offer.ts --driver Driver18
 */

import { readFileSync } from 'node:fs';
import { parseOffer, resolveOffer, type ResolvedOffer } from '../ai/parseOffer';
import { ModelError, describe, readConfig } from '../ai/client';
import { loadDrivers, type Driver } from '../fleet/drivers';
import { assessCabotage, type Truck } from '../legal/cabotage';
import { rankCrossings, driveHours } from '../fleet/routing';
import { fetchBorderWaits } from '../border/cbp';
import { planTrip, type DriverState, type Step } from '../legal/hos';
import { ROADSTAR_BASE } from '../legal/geo';

const DRIVERS = new URL('../../data/raw/sheets/driver.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const hrs = (h: number) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

function readOfferText(argv: string[]): string {
  const inline = argv.filter((a) => !a.startsWith('--') && a !== process.argv[1]).join(' ').trim();
  if (inline) return inline;
  try {
    return readFileSync(0, 'utf8').trim();
  } catch {
    return '';
  }
}

const stateFrom = (d: Driver): DriverState => ({
  drivingHoursUsed: 0,
  onDutyHoursUsed: 0,
  elapsedSinceComingOnDuty: 0,
  drivingSinceLastBreak: 0,
  cycleOnDutyHours: Math.max(0, 70 - (d.usRemaining8 ?? d.remainingHours ?? 0)),
  cycle: 'US_70_8',
});

function show(label: string, value: string): void {
  console.log(`    ${label.padEnd(14)} ${value}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const driverArg = argv[argv.indexOf('--driver') + 1];
  const text = readOfferText(argv.filter((a, i) => a !== '--driver' && argv[i - 1] !== '--driver'));

  if (!text) {
    console.error('Give me an offer, inline or on stdin. See the header of this file.');
    process.exit(2);
  }

  const cfg = readConfig();
  console.log(`\n${'='.repeat(84)}`);
  console.log('  NORTHBOUND  ·  can this truck take this load?');
  console.log(`  model: ${cfg.model} via ${cfg.baseUrl}`);
  console.log('='.repeat(84));
  console.log(`\n  The offer, as it arrived:\n\n    ${text.replace(/\n/g, '\n    ')}\n`);

  let offer: ResolvedOffer;
  try {
    offer = resolveOffer(await parseOffer(text));
  } catch (err) {
    if (err instanceof ModelError) {
      console.error(`\n  Cannot read the offer: ${describe(err.failure)}\n`);
      if (err.failure.kind === 'unfunded') {
        console.error('  Redeem an event access code at ai.spuric.com under Billing, or set a');
        console.error('  funded OPENAI_API_KEY in .env. Nothing else about Northbound depends on it.\n');
      }
      process.exit(1);
    }
    throw err;
  }

  console.log('  What the model read out of it:\n');
  show('origin', `${offer.originCity ?? '?'}, ${offer.originState ?? '?'} (${offer.originCountry ?? '?'})`);
  show('destination', `${offer.destCity ?? '?'}, ${offer.destState ?? '?'} (${offer.destCountry ?? '?'})`);
  show('pickup', offer.pickupFrom ? `${offer.pickupFrom}${offer.pickupTo ? ` to ${offer.pickupTo}` : ''}` : 'not stated');
  show('equipment', offer.equipment ?? 'not stated');
  show('weight', offer.weightLbs ? `${offer.weightLbs.toLocaleString('en-US')} lbs` : 'not stated');
  show('rate', offer.rateUsd ? `$${offer.rateUsd.toLocaleString('en-US')}` : 'not stated');
  show('confidence', offer.confidence + (offer.missing.length ? `, missing: ${offer.missing.join(', ')}` : ''));

  if (!offer.origin || !offer.dest || !offer.originCountry || !offer.destCountry) {
    console.log('\n  Cannot place both ends on a map, so no legal verdict. Not guessing.\n');
    return;
  }

  const drivers = loadDrivers(DRIVERS);
  const driver = driverArg ? drivers.find((d) => d.name.toLowerCase() === driverArg.toLowerCase()) : undefined;
  if (driverArg && !driver) {
    console.log(`\n  No driver called ${driverArg} in the roster.\n`);
    return;
  }

  const truck: Truck = {
    id: driver?.assignedUnit ?? 'ROADSTAR',
    domicile: 'CA',
    base: ROADSTAR_BASE,
    driverAdmission: 'B1',
  };

  const verdict = assessCabotage(
    { id: 'offer', origin: offer.origin, originCountry: offer.originCountry, dest: offer.dest, destCountry: offer.destCountry, revenue: offer.rateUsd ?? undefined },
    truck,
  );

  console.log(`\n  ${'-'.repeat(80)}`);
  console.log(`  ${verdict.verdict}  ·  ${verdict.headline}\n`);
  console.log(`    ${verdict.reason}`);
  if (verdict.citations.length) console.log(`\n    ${verdict.citations.join('   ·   ')}`);

  if (verdict.verdict === 'RED') {
    console.log('\n  Not offered to this truck. Northbound would not have shown it.\n');
    return;
  }

  // Crossing and clock, only when the load actually crosses.
  if (offer.originCountry !== offer.destCountry) {
    const ranked = rankCrossings(offer.origin, offer.dest);
    const first = ranked[0];
    let waitMin = 0;
    try {
      const waits = await fetchBorderWaits(AbortSignal.timeout(15_000));
      const w = waits.get(first.crossing.portCode)?.best(true);
      if (w && Number.isFinite(w.delayMinutes)) waitMin = w.delayMinutes;
      console.log(`\n    crossing       ${first.crossing.name}, ${waitMin} min live from CBP`);
    } catch {
      console.log(`\n    crossing       ${first.crossing.name} (CBP feed unavailable)`);
    }

    if (driver) {
      const toBorder = driveHours(first.toBorderKm);
      const home = driveHours(first.borderToDestKm);
      // Only the two hours-of-service regimes Northbound models. Mexico is out of scope.
      const from = offer.originCountry === 'US' ? 'US' : 'CA';
      const into = offer.destCountry === 'US' ? 'US' : 'CA';
      const steps: Step[] = [
        { kind: 'drive', jurisdiction: from, hours: toBorder, label: 'to the border' },
        { kind: 'border', portCode: first.crossing.portCode, name: first.crossing.name, waitMinutes: waitMin, entering: into },
        { kind: 'drive', jurisdiction: into, hours: home, label: 'to delivery' },
      ];
      const plan = planTrip(stateFrom(driver), steps);
      console.log(`    ${driver.name.padEnd(14)} ${hrs(toBorder + home)} of driving, ` +
        `${plan.feasible ? 'legal on this shift' : 'needs a reset'}` +
        (plan.binding ? `, binding rule ${plan.binding.rule} [${plan.binding.citation}]` : ''));
    }
  }

  if (driver && offer.equipment) {
    const wants = offer.equipment.toLowerCase();
    const note = wants.includes('reefer') ? 'Roadstar runs reefer as well as dry van.' : 'Dry van fleet covers this.';
    console.log(`    equipment      ${offer.equipment}. ${note}`);
  }

  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
