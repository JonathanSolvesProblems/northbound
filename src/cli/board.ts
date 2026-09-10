/**
 * Northbound dispatch board.
 *
 * Real Roadstar trucks, real positions, real hours under both rulebooks, live CBP
 * border waits, and a cabotage verdict on every US-domestic move already on the
 * board. Run: npx tsx src/cli/board.ts
 */

import { loadDrivers, trucksInTheUS, type Driver } from '../fleet/drivers';
import { locate, rankCrossings, driveHours } from '../fleet/routing';
import { fetchBorderWaits, type CrossingWait } from '../border/cbp';
import { planTrip, type DriverState, type Step } from '../legal/hos';
import { assessCabotage, type Truck } from '../legal/cabotage';
import { ROADSTAR_BASE } from '../legal/geo';
import { loadHistory, repeatedLanes, ATRI_COST_PER_MILE_2025 } from '../analysis/history';

const HISTORY = new URL('../../data/raw/sheets/dispatch.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DATA = new URL('../../data/raw/sheets/driver.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** One shift's worth of driving under the tighter of the two rulebooks. */
const SHIFT_DRIVING_HOURS = 11;

const hrs = (h: number): string => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const pad = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));

/**
 * The TMS export gives cycle hours remaining rather than a duty log, so the daily
 * clocks start fresh and the cycle carries the real figure. Enough to rank a
 * board. Not enough to certify a logbook, and Northbound does not claim to.
 */
function stateFrom(d: Driver): DriverState {
  const cycleRemaining = d.usRemaining8 ?? d.remainingHours ?? 0;
  return {
    drivingHoursUsed: 0,
    onDutyHoursUsed: 0,
    elapsedSinceComingOnDuty: 0,
    drivingSinceLastBreak: 0,
    cycleOnDutyHours: Math.max(0, 70 - cycleRemaining),
    cycle: 'US_70_8',
  };
}

const asTruck = (d: Driver): Truck => ({
  id: d.assignedUnit ?? d.id,
  domicile: 'CA',
  base: ROADSTAR_BASE,
  driverAdmission: 'B1',
});

function reportHomeward(d: Driver, waits: Map<string, CrossingWait> | null): void {
  const dest = locate(d.destination)!;
  const ranked = rankCrossings(d.position!, dest.at);
  const first = ranked[0];
  const wait = waits?.get(first.crossing.portCode);
  const chosen = wait?.best(true);

  const legToBorder = driveHours(first.toBorderKm);
  const legHome = driveHours(first.borderToDestKm);
  const total = legToBorder + legHome;

  console.log(`  ${pad(d.name, 10)} ${pad(d.lastKnownPlace ?? '?', 34)} → ${d.destination ?? '?'}`);
  console.log(
    `    via ${pad(first.crossing.name, 36)} ${Math.round(first.totalKm)} km  ·  ` +
      `${hrs(legToBorder)} to the line, ${hrs(legHome)} home`,
  );

  if (wait && chosen) {
    const std = wait.standard.delayMinutes;
    const fast = wait.fast.delayMinutes;
    const detail =
      fast !== null && std !== null && fast < std
        ? `FAST ${fast} min against standard ${std} min, saves ${std - fast} min`
        : `${chosen.lane} lane, ${Number.isFinite(chosen.delayMinutes) ? `${chosen.delayMinutes} min` : 'CBP reporting no figure'}`;
    console.log(`    border  ${detail}  (${wait.portStatus})`);
  }

  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.totalKm - first.totalKm < 120) {
    const alt = waits?.get(runnerUp.crossing.portCode)?.best(true);
    if (alt && Number.isFinite(alt.delayMinutes)) {
      console.log(
        `    also     ${pad(runnerUp.crossing.name, 36)} +${Math.round(runnerUp.totalKm - first.totalKm)} km, ${alt.delayMinutes} min`,
      );
    }
  }

  const us = d.usRemaining7;
  const ca = d.canRemaining7;
  if (us !== null && ca !== null) {
    const gap = ca - us;
    const note =
      Math.abs(gap) < 1
        ? ''
        : gap > 0
          ? `  gains ${gap.toFixed(1)}h crossing`
          : `  LOSES ${Math.abs(gap).toFixed(1)}h crossing`;
    console.log(`    hours    ${us.toFixed(1)}h US cycle, ${ca.toFixed(1)}h Canadian${note}`);
  }

  if (total <= SHIFT_DRIVING_HOURS) {
    const steps: Step[] = [
      { kind: 'drive', jurisdiction: 'US', hours: legToBorder, label: 'to the border' },
      {
        kind: 'border',
        portCode: first.crossing.portCode,
        name: first.crossing.name,
        waitMinutes: Number.isFinite(chosen?.delayMinutes) ? chosen!.delayMinutes : 0,
        entering: 'CA',
      },
      { kind: 'drive', jurisdiction: 'CA', hours: legHome, label: 'home' },
    ];
    const plan = planTrip(stateFrom(d), steps);
    console.log(
      `    verdict  ${plan.feasible ? 'makes it home on this shift' : 'cannot finish on this shift'}` +
        (plan.binding
          ? `, ${hrs(Math.abs(plan.marginHours))} ${plan.feasible ? 'to spare on' : 'short of'} ${plan.binding.rule} [${plan.binding.citation}]`
          : ''),
    );
  } else {
    const shifts = Math.ceil(total / SHIFT_DRIVING_HOURS);
    console.log(`    verdict  ${hrs(total)} of driving, a ${shifts}-shift run. Not a same-day decision.`);
  }
  console.log('');
}

function reportDomestic(d: Driver): void {
  const dest = locate(d.destination);
  if (!dest || !d.position) {
    console.log(`  ${pad(d.name, 10)} ${pad(d.statusMeaning, 28)} ${pad(d.lastKnownPlace ?? '?', 32)} → ${d.destination ?? '?'}   (destination not in gazetteer)`);
    return;
  }
  const verdict = assessCabotage(
    {
      id: d.id,
      origin: d.position,
      originCountry: 'US',
      dest: dest.at,
      destCountry: dest.country,
    },
    asTruck(d),
  );
  const mark = { GREEN: 'GREEN', AMBER: 'AMBER', RED: '  RED' }[verdict.verdict];
  console.log(`  ${mark}  ${pad(d.name, 10)} ${pad(d.lastKnownPlace ?? '?', 32)} → ${pad(d.destination ?? '?', 18)} ${verdict.headline}`);
  if (verdict.verdict === 'AMBER') {
    console.log(`         ${verdict.citations.join('  ·  ')}`);
  }
}

async function main(): Promise<void> {
  const drivers = loadDrivers(DATA);
  const southbound = trucksInTheUS(drivers).filter((d) => d.position !== null);

  let waits: Map<string, CrossingWait> | null = null;
  try {
    waits = await fetchBorderWaits(AbortSignal.timeout(20_000));
  } catch (err) {
    console.warn(`\n  CBP feed unavailable (${(err as Error).message}). Board shown without live waits.`);
  }

  console.log(`\n${'='.repeat(94)}`);
  console.log(`  NORTHBOUND  ·  ${southbound.length} Roadstar trucks in the United States`);
  console.log(`  fleet snapshot ${drivers[0]?.hoursUpdated ?? 'unknown'}  ·  border waits live from CBP`);
  console.log('='.repeat(94));

  const homeward = southbound.filter((d) => locate(d.destination)?.country === 'CA');
  const domestic = southbound.filter((d) => locate(d.destination)?.country !== 'CA');

  console.log(`\n  RUNNING HOME  (${homeward.length})\n`);
  for (const d of homeward) reportHomeward(d, waits);

  console.log(`  ${'-'.repeat(90)}`);
  console.log(`  STAYING IN THE US  (${domestic.length})  ·  cabotage verdict on every move\n`);
  for (const d of domestic) reportDomestic(d);

  const h = loadHistory(HISTORY);
  const n = (x: number) => Math.round(x).toLocaleString('en-US');
  const money = (x: number) => `$${n(x)}`;
  const home = h.byLane['US -> CA'] ?? { legs: 0, miles: 0 };

  console.log(`\n  ${'-'.repeat(90)}`);
  console.log('  WHAT THEIR OWN COMPLETED HISTORY SAYS\n');
  console.log(`    ${n(h.legs)} finished legs, ${n(h.totalMiles)} miles. ` +
    `${n(h.emptyMiles)} of those miles ran empty (${(h.emptyShareOfDistance * 100).toFixed(1)}%).`);
  console.log(`    Only ${home.legs} empty legs came home from the US, ${n(home.miles)} miles.`);
  console.log('    They are good at loading for home. The empty running is inside the States.\n');
  console.log(`    ${n(h.borderBound.length)} empty US legs were already travelling toward the border.`);
  console.log(`    ${n(h.borderBoundMiles)} miles. 19 CFR 123.14(c)(1) would have let those carry freight.`);
  console.log(`    At ATRI 2025 $${ATRI_COST_PER_MILE_2025}/mile that is ${money(h.borderBoundCost)}.`);
  if (h.unresolved) console.log(`    (${h.unresolved} legs unresolved and excluded, not silently counted.)`);

  console.log('\n    Lanes they repeat empty, worth a standing agreement:\n');
  for (const l of repeatedLanes(h, 6)) {
    console.log(`      ${l.lane.padEnd(46)} ${String(l.legs).padStart(3)} runs  ${n(l.miles).padStart(7)} mi`);
  }
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
