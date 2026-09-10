import { describe, it, expect } from 'vitest';
import { loadHistory, repeatedLanes, ATRI_COST_PER_MILE_2025 } from './history';

const PATH = new URL('../../data/raw/sheets/dispatch.csv', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/**
 * These lock the headline number. If a change to the geocoder or the cabotage
 * threshold moves it, this suite fails rather than letting the pitch quietly drift
 * away from what the data says.
 */
describe('Roadstar dispatch history', () => {
  const h = loadHistory(PATH);

  it('reads every completed leg', () => {
    expect(h.legs).toBe(10_479);
    expect(h.loadedLegs).toBe(6_756);
    expect(h.emptyLegs).toBe(3_723);
  });

  it('agrees with the independent Python analysis on empty running', () => {
    expect(Math.round(h.emptyMiles)).toBe(222_635);
    expect(Math.round(h.totalMiles)).toBe(1_596_093);
    expect(h.emptyShareOfDistance).toBeCloseTo(0.139, 3);
  });

  it('confirms they almost never come home empty', () => {
    // The finding that corrected the original thesis. Guard it.
    expect(h.byLane['US -> CA'].legs).toBe(6);
    expect(h.byLane['US -> US'].legs).toBe(778);
    expect(h.byLane['US -> US'].miles).toBeGreaterThan(h.byLane['US -> CA'].miles * 50);
  });

  it('resolves every empty US leg to coordinates', () => {
    expect(h.unresolved).toBe(0);
  });

  it('holds the headline: border-bound empty legs and what they cost', () => {
    expect(h.borderBound.length).toBe(217);
    expect(Math.round(h.borderBoundMiles)).toBe(66_702);
    expect(Math.round(h.borderBoundCost)).toBe(155_815);
    expect(h.borderBoundCost).toBeCloseTo(h.borderBoundMiles * ATRI_COST_PER_MILE_2025, 6);
  });

  it('every border-bound leg genuinely moves toward the border', () => {
    expect(h.borderBound.every((l) => l.towardBorderKm >= 25)).toBe(true);
  });

  it('surfaces lanes that repeat, which is what makes them fixable', () => {
    const lanes = repeatedLanes(h, 5);
    expect(lanes[0].lane).toContain('FAIRBURN, GA');
    expect(lanes.some((l) => l.legs >= 10)).toBe(true);
  });
});
