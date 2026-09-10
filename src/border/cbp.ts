/**
 * Live commercial border wait times from CBP.
 *
 * https://bwt.cbp.gov/api/waittimes is public JSON, no key, no auth, refreshed
 * through the day. It is the external grader for every crossing claim Northbound
 * makes: I do not author it and cannot influence it.
 *
 * The feed splits commercial traffic into standard lanes and FAST lanes, which is
 * a genuine dispatch decision rather than a detail.
 */

import { CROSSINGS, type Crossing } from '../legal/geo';

export const CBP_ENDPOINT = 'https://bwt.cbp.gov/api/waittimes';

interface RawLane {
  update_time?: string;
  operational_status?: string;
  delay_minutes?: string;
  lanes_open?: string;
}

interface RawPort {
  port_number: string;
  port_name: string;
  crossing_name?: string;
  border?: string;
  port_status?: string;
  hours?: string;
  date?: string;
  time?: string;
  commercial_vehicle_lanes?: {
    maximum_lanes?: string;
    standard_lanes?: RawLane;
    FAST_lanes?: RawLane;
  };
}

export interface LaneWait {
  /** Null when CBP reports no figure, which is not the same as zero. */
  delayMinutes: number | null;
  status: string;
  lanesOpen: number | null;
  updatedAt: string | null;
}

export interface CrossingWait {
  crossing: Crossing;
  portStatus: string;
  standard: LaneWait;
  fast: LaneWait;
  /** Whichever lane the truck should actually use, given FAST eligibility. */
  best(fastEligible: boolean): { lane: 'FAST' | 'standard'; delayMinutes: number };
}

const laneOf = (raw: RawLane | undefined): LaneWait => {
  const minutes = Number(raw?.delay_minutes);
  const open = Number(raw?.lanes_open);
  return {
    delayMinutes: Number.isFinite(minutes) && raw?.delay_minutes !== '' ? minutes : null,
    status: raw?.operational_status || 'N/A',
    lanesOpen: Number.isFinite(open) && raw?.lanes_open !== '' ? open : null,
    updatedAt: raw?.update_time || null,
  };
};

const isUsable = (lane: LaneWait): boolean =>
  lane.delayMinutes !== null && !/closed/i.test(lane.status);

export async function fetchBorderWaits(
  signal?: AbortSignal,
): Promise<Map<string, CrossingWait>> {
  const res = await fetch(CBP_ENDPOINT, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CBP feed returned ${res.status}`);
  const ports = (await res.json()) as RawPort[];

  const byCode = new Map(ports.map((p) => [p.port_number, p]));
  const out = new Map<string, CrossingWait>();

  for (const crossing of CROSSINGS) {
    const raw = byCode.get(crossing.portCode);
    if (!raw) continue;
    const standard = laneOf(raw.commercial_vehicle_lanes?.standard_lanes);
    const fast = laneOf(raw.commercial_vehicle_lanes?.FAST_lanes);

    out.set(crossing.portCode, {
      crossing,
      portStatus: raw.port_status || 'unknown',
      standard,
      fast,
      best(fastEligible: boolean) {
        if (fastEligible && isUsable(fast) && (!isUsable(standard) || fast.delayMinutes! <= standard.delayMinutes!)) {
          return { lane: 'FAST', delayMinutes: fast.delayMinutes! };
        }
        if (isUsable(standard)) return { lane: 'standard', delayMinutes: standard.delayMinutes! };
        if (isUsable(fast)) return { lane: 'FAST', delayMinutes: fast.delayMinutes! };
        // CBP is reporting nothing usable. Say so rather than inventing a zero.
        return { lane: 'standard', delayMinutes: Number.NaN };
      },
    });
  }
  return out;
}
