/**
 * Cabotage classification for a foreign-based truck.
 *
 * The industry treats this as binary: a Canadian truck cannot haul US freight.
 * The regulation is not binary, it is directional. 19 CFR 123.14(c)(1) permits
 * carriage between US points where it is "incidental to the immediately prior or
 * subsequent engagement of that vehicle in international traffic", and says
 * carriage "in the general direction of an export move or as part of the return
 * of the vehicle to its base country shall be considered incidental."
 *
 * So the customs test turns on which way the load is going. The driver's B-1
 * admission is a second and more restrictive layer, which is why the directional
 * case comes back AMBER rather than GREEN. See LEGAL.md.
 *
 * This is not legal advice and Northbound does not present it as such. It names
 * the provision and hands the decision to the carrier's broker.
 */

import { type Country, type LatLon, nearestCrossing, roadKm } from './geo';

export type CabotageVerdict = 'GREEN' | 'AMBER' | 'RED';

export interface Load {
  id: string;
  origin: LatLon;
  originCountry: Country;
  dest: LatLon;
  destCountry: Country;
  revenue?: number;
}

export interface Truck {
  id: string;
  /** Country the equipment is based in. 'CA' for a Roadstar power unit. */
  domicile: Country;
  base: LatLon;
  /** A Canadian driver enters the US as a B-1 business visitor. */
  driverAdmission: 'B1' | 'DOMESTIC';
}

export interface CabotageAssessment {
  verdict: CabotageVerdict;
  /** Dispatcher-facing one-liner. Never phrased as a violation warning. */
  headline: string;
  reason: string;
  citations: string[];
  /**
   * Positive means the load moves the truck closer to its base country, measured
   * to the nearest border crossing. This is the test 19 CFR 123.14(c)(1) states.
   */
  towardBaseCountryKm: number;
  /**
   * Positive means the load moves the truck closer to its own terminal. The
   * regulation does not ask this, but a dispatcher does, and the two can disagree:
   * a truck running Nebraska to Idaho closes on the western crossings while moving
   * a thousand kilometres further from an Ontario yard.
   */
  towardBaseTerminalKm: number;
  /** True when the carrier should confirm with their customs broker before booking. */
  brokerCall: boolean;
}

/** Progress toward the base country below this reads as noise, not a return move. */
export const MIN_RETURN_PROGRESS_KM = 25;

export interface AssessOptions {
  minReturnProgressKm?: number;
}

export function assessCabotage(
  load: Load,
  truck: Truck,
  opts: AssessOptions = {},
): CabotageAssessment {
  const minProgress = opts.minReturnProgressKm ?? MIN_RETURN_PROGRESS_KM;

  const originToBorder = nearestCrossing(load.origin).km;
  const destToBorder = nearestCrossing(load.dest).km;
  const towardBaseCountryKm = originToBorder - destToBorder;
  const towardBaseTerminalKm = roadKm(load.origin, truck.base) - roadKm(load.dest, truck.base);

  // International traffic. This is the permitted use of a foreign-based truck.
  if (load.originCountry !== load.destCountry) {
    return {
      verdict: 'GREEN',
      headline: 'International move. No cabotage question.',
      reason: `Crosses the border (${load.originCountry} to ${load.destCountry}), which is what a foreign-based truck is admitted to do.`,
      citations: ['19 CFR 123.14(a)'],
      towardBaseCountryKm,
      towardBaseTerminalKm,
      brokerCall: false,
    };
  }

  // Domestic move inside the truck's own country. Cabotage does not arise.
  if (load.originCountry === truck.domicile) {
    return {
      verdict: 'GREEN',
      headline: 'Domestic move at home. No cabotage question.',
      reason: `Both ends are in ${truck.domicile}, the truck's country of domicile.`,
      citations: [],
      towardBaseCountryKm,
      towardBaseTerminalKm,
      brokerCall: false,
    };
  }

  // Domestic move inside a foreign country. This is where 123.14 bites, and where
  // the direction of travel decides the answer.
  if (towardBaseCountryKm >= minProgress) {
    const awayFromYard = towardBaseTerminalKm < 0;
    return {
      verdict: 'AMBER',
      headline: awayFromYard
        ? `Worth a call. ${Math.round(towardBaseCountryKm)} km closer to the border, ${Math.round(-towardBaseTerminalKm)} km further from the yard.`
        : `Worth a call. This one moves ${Math.round(towardBaseCountryKm)} km closer to home.`,
      reason:
        'Domestic US move, but it carries the truck toward its base country, which 19 CFR 123.14(c)(1) treats as incidental to international traffic. The equipment rule allows it. The driver is admitted B-1, and that is the more restrictive layer, so confirm with your broker before booking.' +
        (awayFromYard
          ? ' Note that the statutory test is the base country rather than the terminal, and here the two point in opposite directions.'
          : ''),
      citations: ['19 CFR 123.14(c)(1)', 'B-1 admission (driver)'],
      towardBaseCountryKm,
      towardBaseTerminalKm,
      brokerCall: true,
    };
  }

  // The refusal is the demo moment, so it names what it just prevented rather than
  // only what it declined. 19 CFR 123.14(d) is explicit about the exposure.
  const rate = load.revenue ? `The $${Math.round(load.revenue).toLocaleString('en-US')} on offer is not worth it. ` : '';
  return {
    verdict: 'RED',
    headline: 'Not available to this truck.',
    reason:
      `Domestic ${load.originCountry} move that does not carry the truck toward its base country, so it is local traffic rather than incidental to international traffic. ` +
      `${rate}Taking it is the cabotage violation 19 CFR 123.14(d) warns of: liabilities under section 592 of the Tariff Act of 1930, and the driver's B-1 admission at risk on his next entry.`,
    citations: ['19 CFR 123.14(a)', '19 CFR 123.14(d)', 'Tariff Act of 1930 § 592'],
    towardBaseCountryKm,
    towardBaseTerminalKm,
    brokerCall: false,
  };
}

/** Loads the dispatcher can act on today, best first. AMBER kept, never hidden. */
export function bookableLoads(
  loads: Load[],
  truck: Truck,
  opts: AssessOptions = {},
): Array<Load & { cabotage: CabotageAssessment }> {
  return loads
    .map((load) => ({ ...load, cabotage: assessCabotage(load, truck, opts) }))
    .filter((l) => l.cabotage.verdict !== 'RED')
    .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0));
}
