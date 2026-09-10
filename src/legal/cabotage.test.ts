import { describe, it, expect } from 'vitest';
import { assessCabotage, bookableLoads, type Load, type Truck } from './cabotage';
import { ROADSTAR_BASE, type LatLon } from './geo';

const COLUMBUS: LatLon = { lat: 39.9612, lon: -82.9988 };
const BRAMPTON: LatLon = { lat: 43.7315, lon: -79.7624 };
const ATLANTA: LatLon = { lat: 33.749, lon: -84.388 };
const DETROIT: LatLon = { lat: 42.3314, lon: -83.0458 };
const TORONTO: LatLon = { lat: 43.6532, lon: -79.3832 };
const MONTREAL: LatLon = { lat: 45.5019, lon: -73.5674 };

/** A Roadstar power unit: Canadian equipment, Canadian driver on B-1. */
const TRUCK_412: Truck = {
  id: '412',
  domicile: 'CA',
  base: ROADSTAR_BASE,
  driverAdmission: 'B1',
};

const load = (id: string, origin: LatLon, originCountry: 'US' | 'CA', dest: LatLon, destCountry: 'US' | 'CA', revenue?: number): Load =>
  ({ id, origin, originCountry, dest, destCountry, revenue });

describe('cabotage', () => {
  it('clears an international move home', () => {
    const a = assessCabotage(load('L1', COLUMBUS, 'US', BRAMPTON, 'CA'), TRUCK_412);
    expect(a.verdict).toBe('GREEN');
    expect(a.brokerCall).toBe(false);
    expect(a.citations).toContain('19 CFR 123.14(a)');
  });

  it('refuses a US domestic move away from the border', () => {
    const a = assessCabotage(load('L2', COLUMBUS, 'US', ATLANTA, 'US'), TRUCK_412);
    expect(a.verdict).toBe('RED');
    expect(a.towardBaseCountryKm).toBeLessThan(0);
  });

  it('flags a US domestic move toward home as amber, not red', () => {
    // The whole point. Columbus to Detroit is US point-to-point, and 19 CFR
    // 123.14(c)(1) treats it as incidental because it is part of the return.
    const a = assessCabotage(load('L3', COLUMBUS, 'US', DETROIT, 'US'), TRUCK_412);
    expect(a.verdict).toBe('AMBER');
    expect(a.brokerCall).toBe(true);
    expect(a.towardBaseCountryKm).toBeGreaterThan(200);
    expect(a.citations).toContain('19 CFR 123.14(c)(1)');
  });

  it('does not treat a trivial shuffle as a return move', () => {
    const nearColumbus: LatLon = { lat: 40.05, lon: -82.99 };
    const a = assessCabotage(load('L4', COLUMBUS, 'US', nearColumbus, 'US'), TRUCK_412);
    expect(a.verdict).toBe('RED');
  });

  it('leaves domestic Canadian freight alone', () => {
    const a = assessCabotage(load('L5', TORONTO, 'CA', MONTREAL, 'CA'), TRUCK_412);
    expect(a.verdict).toBe('GREEN');
  });

  it('surfaces bookable loads best-paying first and drops only the red ones', () => {
    const loads = [
      load('home', COLUMBUS, 'US', BRAMPTON, 'CA', 2650),
      load('illegal', COLUMBUS, 'US', ATLANTA, 'US', 4000),
      load('toward', COLUMBUS, 'US', DETROIT, 'US', 1100),
    ];
    const out = bookableLoads(loads, TRUCK_412);
    expect(out.map((l) => l.id)).toEqual(['home', 'toward']);
    expect(out[0].cabotage.verdict).toBe('GREEN');
    expect(out[1].cabotage.verdict).toBe('AMBER');
  });
});
