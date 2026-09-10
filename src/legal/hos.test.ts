import { describe, it, expect } from 'vitest';
import { bindingConstraint, planTrip, type DriverState, type Step } from './hos';

const fresh = (over: Partial<DriverState> = {}): DriverState => ({
  drivingHoursUsed: 0,
  onDutyHoursUsed: 0,
  elapsedSinceComingOnDuty: 0,
  drivingSinceLastBreak: 0,
  cycleOnDutyHours: 20,
  cycle: 'US_70_8',
  ...over,
});

describe('hours of service', () => {
  it('gives a rested US driver 11 hours, bound by the driving limit', () => {
    const c = bindingConstraint(fresh(), 'US');
    expect(c.remainingHours).toBe(11);
    expect(c.citation).toBe('49 CFR 395.3(a)(3)(i)');
  });

  it('gives a rested Canadian driver 13 hours', () => {
    const c = bindingConstraint(fresh({ cycle: 'CA_CYCLE_1' }), 'CA');
    expect(c.remainingHours).toBe(13);
    expect(c.citation).toBe('SOR/2005-313 s. 12');
  });

  it('gives the same driver more time once he crosses into Canada', () => {
    // 10h driving, 12h on duty, same driver, same minute. South of the border the
    // US 11-hour driving limit leaves him one hour. North of it the Canadian
    // 13-hour limit is not the binding rule any more, the 14-hour on-duty one is,
    // and he has two. Crossing buys him an hour, and no single-jurisdiction
    // planner can see that.
    const state = fresh({
      drivingHoursUsed: 10,
      onDutyHoursUsed: 12,
      elapsedSinceComingOnDuty: 12,
      cycleOnDutyHours: 30,
      cycle: 'CA_CYCLE_1',
    });

    const us = bindingConstraint(state, 'US');
    expect(us.remainingHours).toBe(1);
    expect(us.citation).toBe('49 CFR 395.3(a)(3)(i)');

    const ca = bindingConstraint(state, 'CA');
    expect(ca.remainingHours).toBe(2);
    expect(ca.citation).toBe('SOR/2005-313 s. 12');
  });

  it('spends border wait on the window, not on the driving limit', () => {
    const steps: Step[] = [
      { kind: 'border', portCode: '380001', name: 'Ambassador Bridge', waitMinutes: 45, entering: 'CA' },
    ];
    const plan = planTrip(fresh({ drivingHoursUsed: 5, onDutyHoursUsed: 6, elapsedSinceComingOnDuty: 6 }), steps);
    expect(plan.finalState.drivingHoursUsed).toBe(5);
    expect(plan.finalState.elapsedSinceComingOnDuty).toBeCloseTo(6.75);
    expect(plan.finalState.onDutyHoursUsed).toBeCloseTo(6.75);
  });

  it('lets a 45-minute border wait satisfy the US 30-minute break', () => {
    const steps: Step[] = [
      { kind: 'border', portCode: '380201', name: 'Bluewater Bridge', waitMinutes: 45, entering: 'CA' },
    ];
    const plan = planTrip(fresh({ drivingSinceLastBreak: 7.5 }), steps);
    expect(plan.finalState.drivingSinceLastBreak).toBe(0);
    expect(plan.events[0].detail).toContain('395.3(a)(3)(ii)');
  });

  it('does not let a 10-minute wait count as the break', () => {
    const steps: Step[] = [
      { kind: 'border', portCode: '380201', name: 'Bluewater Bridge', waitMinutes: 10, entering: 'CA' },
    ];
    const plan = planTrip(fresh({ drivingSinceLastBreak: 7.5 }), steps);
    expect(plan.finalState.drivingSinceLastBreak).toBe(7.5);
  });

  it('plans a legal run home across the border and reports the slack', () => {
    const state = fresh({
      drivingHoursUsed: 6,
      onDutyHoursUsed: 7,
      elapsedSinceComingOnDuty: 7,
      drivingSinceLastBreak: 6,
      cycleOnDutyHours: 40,
    });
    const steps: Step[] = [
      { kind: 'drive', jurisdiction: 'US', hours: 3, label: 'Columbus to the border' },
      { kind: 'border', portCode: '380201', name: 'Bluewater Bridge', waitMinutes: 45, entering: 'CA' },
      { kind: 'drive', jurisdiction: 'CA', hours: 2, label: 'Sarnia to Brampton' },
    ];
    const plan = planTrip(state, steps);
    expect(plan.feasible).toBe(true);
    expect(plan.marginHours).toBeGreaterThan(0);
    // The 8-hour break rule bites partway through the US leg.
    expect(plan.events.some((e) => e.label === '30-minute break')).toBe(true);
  });

  it('calls a run illegal and names the rule that stopped it', () => {
    const state = fresh({
      drivingHoursUsed: 10,
      onDutyHoursUsed: 13,
      elapsedSinceComingOnDuty: 13,
      drivingSinceLastBreak: 1,
      cycleOnDutyHours: 40,
    });
    const steps: Step[] = [
      { kind: 'drive', jurisdiction: 'US', hours: 4, label: 'Columbus to the border' },
    ];
    const plan = planTrip(state, steps);
    expect(plan.feasible).toBe(false);
    expect(plan.binding?.citation).toBe('49 CFR 395.3(a)(3)(i)');
  });
});
