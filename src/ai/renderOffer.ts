/**
 * Render a real order from Roadstar's book as the kind of message a broker sends.
 *
 * Honesty about what this is: every FACT (origin, destination, weight, equipment,
 * pickup date) comes from a real row in their Tlorder sheet, so the ground truth is
 * theirs and not mine. The PHRASING is mine, modelled on the formats freight
 * actually arrives in. That makes this a fair test of reading, and it makes the
 * ablation fair because both arms see byte-identical input.
 *
 * Deterministic: same row and same index always render the same way, so the
 * ablation is reproducible.
 */

export interface OrderFacts {
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  weightLbs: number | null;
  equipment: 'Dry Van' | 'Reefer' | null;
  pickupDate: string | null;   // YYYY-MM-DD
  commodity: string | null;
  rateUsd: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

function md(iso: string | null): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

const equipShort = (e: OrderFacts['equipment']) =>
  e === 'Reefer' ? 'reefer' : e === 'Dry Van' ? 'van' : 'van';

/** Five formats, chosen because freight really does arrive in all of them. */
const STYLES: Array<(f: OrderFacts) => string> = [
  // 1. Trader shorthand, one line.
  (f) => `${equipShort(f.equipment)}, ${f.originCity} ${f.originState} to ${f.destCity} ${f.destState}, pu ${md(f.pickupDate)}` +
    (f.weightLbs ? `, ${Math.round(f.weightLbs / 1000)}k` : '') +
    (f.rateUsd ? `, $${f.rateUsd} all in` : ''),

  // 2. Structured header block.
  (f) => [
    'LOAD AVAILABLE',
    `Origin: ${f.originCity}, ${f.originState}`,
    `Dest: ${f.destCity}, ${f.destState}`,
    f.weightLbs ? `Weight: ${f.weightLbs.toLocaleString('en-US')} lbs` : 'Weight: TBD',
    `Equip: ${f.equipment ?? 'Dry Van'}`,
    f.pickupDate ? `PU: ${f.pickupDate}` : '',
    f.rateUsd ? `Rate: $${f.rateUsd}` : '',
  ].filter(Boolean).join('\n'),

  // 3. Email prose with signature noise.
  (f) => `Hi,\n\nDo you have anything available out of ${f.originCity}, ${f.originState} on the ${md(f.pickupDate).split('/')[1]}th? ` +
    `Going to ${f.destCity}, ${f.destState}. About ${f.weightLbs ? f.weightLbs.toLocaleString('en-US') : 'TBD'} pounds` +
    `${f.commodity ? ` of ${f.commodity.toLowerCase()}` : ''}, needs a ${equipShort(f.equipment)}.` +
    `${f.rateUsd ? ` We can do $${f.rateUsd}.` : ''}\n\nThanks,\nMike\nDispatch | 555-0142\nSent from my iPhone`,

  // 4. Chat message, abbreviated, lowercase.
  (f) => `${f.originCity.toLowerCase()} ${f.originState.toLowerCase()} > ${f.destCity.toLowerCase()} ${f.destState.toLowerCase()} ` +
    `${md(f.pickupDate)} ${f.weightLbs ? `${f.weightLbs}#` : ''} ${equipShort(f.equipment)}` +
    `${f.rateUsd ? ` ${f.rateUsd}` : ''} u want it?`,

  // 5. Forwarded chain, the real facts buried under quoted text.
  (f) => `FW: RE: capacity check\n\n> On Mon, someone wrote:\n> checking on lanes for next week\n\n` +
    `We've got a ${equipShort(f.equipment)} load, ${f.originCity} ${f.originState} loading ${md(f.pickupDate)}, ` +
    `delivering ${f.destCity} ${f.destState}. ${f.weightLbs ? `${f.weightLbs.toLocaleString('en-US')} lbs.` : ''}` +
    `${f.rateUsd ? ` Paying $${f.rateUsd}.` : ''} Let me know.\n\n--\nThis email and any attachments are confidential.`,
];

export const STYLE_NAMES = ['trader shorthand', 'header block', 'email prose', 'chat message', 'forwarded chain'];

export function renderOffer(facts: OrderFacts, index: number): { text: string; style: string } {
  const i = index % STYLES.length;
  return { text: STYLES[i](facts), style: STYLE_NAMES[i] };
}
