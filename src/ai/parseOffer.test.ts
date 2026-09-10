import { describe, it, expect } from 'vitest';
import { resolveOffer, countryOfState, type ParsedOffer } from './parseOffer';
import { extractJson, readConfig, describe as describeFailure } from './client';
import { assessCabotage, type Truck } from '../legal/cabotage';
import { ROADSTAR_BASE } from '../legal/geo';

/**
 * The network call is the model's job and is not tested here. Everything that
 * happens to the model's output before a legal verdict is reached is, because that
 * is the part that must not drift.
 */

const base: ParsedOffer = {
  originCity: null, originState: null, destCity: null, destState: null,
  pickupFrom: null, pickupTo: null, deliverBy: null,
  weightLbs: null, equipment: null, temperatureF: null,
  rateUsd: null, commodity: null, broker: null,
  confidence: 'low', missing: [],
};

const TRUCK: Truck = { id: '412', domicile: 'CA', base: ROADSTAR_BASE, driverAdmission: 'B1' };

describe('offer parsing plumbing', () => {
  it('reads a fenced JSON completion', () => {
    const raw = 'Here you go:\n```json\n{"originCity":"Columbus","weightLbs":42000}\n```';
    expect(extractJson<{ originCity: string; weightLbs: number }>(raw)).toEqual({
      originCity: 'Columbus', weightLbs: 42000,
    });
  });

  it('reads a bare JSON completion', () => {
    expect(extractJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it('refuses to guess when there is no JSON', () => {
    expect(() => extractJson('I could not parse that offer.')).toThrow(/No JSON object/);
  });

  it('tells Canadian provinces from US states', () => {
    expect(countryOfState('ON')).toBe('CA');
    expect(countryOfState('QC')).toBe('CA');
    expect(countryOfState('OH')).toBe('US');
    // The trap: Ontario, California.
    expect(countryOfState('CA')).toBe('US');
    expect(countryOfState(null)).toBeNull();
  });
});

describe('offer to legal verdict', () => {
  it('clears an international load home', () => {
    const o = resolveOffer({ ...base, originCity: 'Columbus', originState: 'OH', destCity: 'Brampton', destState: 'ON' });
    expect(o.origin).not.toBeNull();
    expect(o.dest).not.toBeNull();
    const v = assessCabotage(
      { id: 'x', origin: o.origin!, originCountry: o.originCountry!, dest: o.dest!, destCountry: o.destCountry! },
      TRUCK,
    );
    expect(v.verdict).toBe('GREEN');
  });

  it('refuses a US domestic load running away from the border', () => {
    const o = resolveOffer({ ...base, originCity: 'Columbus', originState: 'OH', destCity: 'Atlanta', destState: 'GA' });
    const v = assessCabotage(
      { id: 'x', origin: o.origin!, originCountry: o.originCountry!, dest: o.dest!, destCountry: o.destCountry! },
      TRUCK,
    );
    expect(v.verdict).toBe('RED');
  });

  it('flags a real lane from their history as worth a broker call', () => {
    // Fairburn GA to Walton KY: ten empty runs in the dispatch data.
    const o = resolveOffer({ ...base, originCity: 'Fairburn', originState: 'GA', destCity: 'Walton', destState: 'KY' });
    const v = assessCabotage(
      { id: 'x', origin: o.origin!, originCountry: o.originCountry!, dest: o.dest!, destCountry: o.destCountry! },
      TRUCK,
    );
    expect(v.verdict).toBe('AMBER');
    expect(v.citations).toContain('19 CFR 123.14(c)(1)');
  });

  it('leaves coordinates null rather than guessing an unknown place', () => {
    const o = resolveOffer({ ...base, originCity: 'Nowheresville', originState: 'ZZ' });
    expect(o.origin).toBeNull();
  });
});

describe('model configuration', () => {
  it('prefers SPUR and falls back to any OpenAI-compatible key', () => {
    expect(readConfig({ SPUR_API_KEY: 'a', SPUR_MODEL: 'm' } as NodeJS.ProcessEnv).apiKey).toBe('a');
    expect(readConfig({ OPENAI_API_KEY: 'b' } as NodeJS.ProcessEnv).apiKey).toBe('b');
  });

  it('explains an unfunded account in words a person can act on', () => {
    expect(describeFailure({ kind: 'unfunded', detail: 'x' })).toMatch(/no credit/i);
    expect(describeFailure({ kind: 'no-key' })).toMatch(/SPUR_API_KEY/);
  });
});
