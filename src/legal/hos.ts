/**
 * Hours of service across two jurisdictions.
 *
 * A driver leaving Milton for Chicago runs under 49 CFR 395.3 south of the border
 * and SOR/2005-313 north of it, and switches mid-trip. Northbound plans both
 * halves and names the provision that binds.
 *
 * Two details most planners get wrong, both of which favour the dispatcher:
 *
 *   1. Time waiting at the border is on-duty-not-driving. It burns the 14-hour
 *      window and the on-duty limit, but NOT the 11-hour driving limit.
 *   2. A border wait of 30 minutes or more satisfies the US 30-minute break
 *      requirement, because the rule asks for an interruption in driving status
 *      rather than off-duty time.
 *
 * See LEGAL.md for the verified text behind every citation below.
 */

export type Jurisdiction = 'US' | 'CA';

export type CycleType = 'US_60_7' | 'US_70_8' | 'CA_CYCLE_1' | 'CA_CYCLE_2';

export interface DriverState {
  /** Driving hours used in the current daily window. */
  drivingHoursUsed: number;
  /** On-duty hours used in the current daily window. */
  onDutyHoursUsed: number;
  /** Hours elapsed since the driver came on duty. */
  elapsedSinceComingOnDuty: number;
  /** Driving hours since the last qualifying 30-minute interruption. US only. */
  drivingSinceLastBreak: number;
  /** On-duty hours accumulated in the applicable cycle. */
  cycleOnDutyHours: number;
  cycle: CycleType;
}

export interface Constraint {
  remainingHours: number;
  rule: string;
  citation: string;
}

export const US_BREAK_REQUIRED_AFTER_DRIVING_HOURS = 8;
export const US_BREAK_HOURS = 0.5;

function cycleConstraint(state: DriverState): Constraint {
  switch (state.cycle) {
    case 'US_60_7':
      return { remainingHours: 60 - state.cycleOnDutyHours, rule: 'US 60-hour / 7-day cycle', citation: '49 CFR 395.3(b)(1)' };
    case 'US_70_8':
      return { remainingHours: 70 - state.cycleOnDutyHours, rule: 'US 70-hour / 8-day cycle', citation: '49 CFR 395.3(b)(2)' };
    case 'CA_CYCLE_1':
      return { remainingHours: 70 - state.cycleOnDutyHours, rule: 'Canada cycle 1, 70 hours / 7 days', citation: 'SOR/2005-313 s. 26' };
    case 'CA_CYCLE_2':
      return { remainingHours: 120 - state.cycleOnDutyHours, rule: 'Canada cycle 2, 120 hours / 14 days', citation: 'SOR/2005-313 s. 27' };
  }
}

export function constraintsFor(state: DriverState, jurisdiction: Jurisdiction): Constraint[] {
  if (jurisdiction === 'US') {
    return [
      { remainingHours: 11 - state.drivingHoursUsed, rule: 'US 11-hour driving limit', citation: '49 CFR 395.3(a)(3)(i)' },
      { remainingHours: 14 - state.elapsedSinceComingOnDuty, rule: 'US 14-hour driving window', citation: '49 CFR 395.3(a)(2)' },
      cycleConstraint(state),
    ];
  }
  return [
    { remainingHours: 13 - state.drivingHoursUsed, rule: 'Canada 13-hour driving limit', citation: 'SOR/2005-313 s. 12' },
    { remainingHours: 14 - state.onDutyHoursUsed, rule: 'Canada 14-hour on-duty limit', citation: 'SOR/2005-313 s. 12' },
    { remainingHours: 16 - state.elapsedSinceComingOnDuty, rule: 'Canada 16-hour elapsed-time rule', citation: 'SOR/2005-313 s. 18(1)(e)' },
    cycleConstraint(state),
  ];
}

/** The tightest rule right now, and the provision it comes from. */
export function bindingConstraint(state: DriverState, jurisdiction: Jurisdiction): Constraint {
  return constraintsFor(state, jurisdiction).reduce((tightest, c) =>
    c.remainingHours < tightest.remainingHours ? c : tightest,
  );
}

export type Step =
  | { kind: 'drive'; jurisdiction: Jurisdiction; hours: number; label: string }
  | { kind: 'border'; portCode: string; name: string; waitMinutes: number; entering: Jurisdiction };

export interface PlanEvent {
  label: string;
  detail: string;
}

export interface TripPlan {
  feasible: boolean;
  /** Slack in hours against the binding constraint at the tightest point of the trip. */
  marginHours: number;
  binding: Constraint | null;
  events: PlanEvent[];
  finalState: DriverState;
}

const hhmm = (hours: number): string => {
  const sign = hours < 0 ? '-' : '';
  const total = Math.round(Math.abs(hours) * 60);
  return `${sign}${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
};

export function planTrip(initial: DriverState, steps: Step[]): TripPlan {
  const state: DriverState = { ...initial };
  const events: PlanEvent[] = [];
  let feasible = true;
  let marginHours = Infinity;
  let binding: Constraint | null = null;

  const advance = (driving: number, onDuty: number) => {
    state.drivingHoursUsed += driving;
    state.drivingSinceLastBreak += driving;
    state.onDutyHoursUsed += onDuty;
    state.elapsedSinceComingOnDuty += onDuty;
    state.cycleOnDutyHours += onDuty;
  };

  for (const step of steps) {
    if (step.kind === 'border') {
      const waitHours = step.waitMinutes / 60;
      advance(0, waitHours);
      const satisfiesBreak = waitHours >= US_BREAK_HOURS;
      if (satisfiesBreak) state.drivingSinceLastBreak = 0;
      events.push({
        label: `${step.name} (${step.waitMinutes} min)`,
        detail: satisfiesBreak
          ? 'On-duty, not driving. Costs the 14-hour window but not the driving limit, and it satisfies the US 30-minute break under 49 CFR 395.3(a)(3)(ii).'
          : 'On-duty, not driving. Costs the 14-hour window but not the driving limit.',
      });
      continue;
    }

    let remaining = step.hours;
    while (remaining > 1e-9) {
      if (step.jurisdiction === 'US' && state.drivingSinceLastBreak >= US_BREAK_REQUIRED_AFTER_DRIVING_HOURS) {
        advance(0, US_BREAK_HOURS);
        state.drivingSinceLastBreak = 0;
        events.push({
          label: '30-minute break',
          detail: 'Required before driving again after 8 hours of driving. 49 CFR 395.3(a)(3)(ii).',
        });
      }

      const untilBreak =
        step.jurisdiction === 'US'
          ? US_BREAK_REQUIRED_AFTER_DRIVING_HOURS - state.drivingSinceLastBreak
          : Infinity;
      const chunk = Math.min(remaining, untilBreak);

      const tightest = bindingConstraint(state, step.jurisdiction);
      const slack = tightest.remainingHours - chunk;
      if (slack < marginHours) {
        marginHours = slack;
        binding = tightest;
      }
      if (slack < 0) {
        feasible = false;
        events.push({
          label: `${step.label}: not legal`,
          detail: `Short by ${hhmm(-slack)} against ${tightest.rule} (${tightest.citation}).`,
        });
        break;
      }

      advance(chunk, chunk);
      remaining -= chunk;
    }

    if (!feasible) break;
    events.push({
      label: step.label,
      detail: `${hhmm(step.hours)} driving in ${step.jurisdiction}. ${hhmm(bindingConstraint(state, step.jurisdiction).remainingHours)} left on ${bindingConstraint(state, step.jurisdiction).rule}.`,
    });
  }

  return {
    feasible,
    marginHours: marginHours === Infinity ? 0 : marginHours,
    binding,
    events,
    finalState: state,
  };
}
