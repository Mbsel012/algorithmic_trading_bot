/**
 * Consumption-tax maths (VAT / GST / IVA / sales tax).
 *
 * This is a calculator, not tax advice. It answers "how much of this receipt
 * was tax" and "what will this cost once tax is added" at whatever rate the
 * user tells it. Rates come from an editable preset per country.
 *
 * Every split returns integers that add back to the original exactly — no
 * receipt should ever be a cent off because of rounding.
 */

export type TaxSplit = {
  /** Amount before tax, in minor units. */
  net: number;
  /** The tax portion, in minor units. */
  tax: number;
  /** Amount including tax, in minor units. `net + tax` exactly. */
  gross: number;
};

export const MAX_TAX_RATE = 100;

export function isValidRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0 && rate <= MAX_TAX_RATE;
}

/**
 * A price with tax already inside it — the normal case in most of the world,
 * where the shelf price is what you pay.
 */
export function splitInclusive(gross: number, ratePercent: number): TaxSplit {
  if (!isValidRate(ratePercent) || ratePercent === 0) return { net: gross, tax: 0, gross };
  const net = Math.round(gross / (1 + ratePercent / 100));
  // Derive tax by subtraction so the parts always reconstitute the total.
  return { net, tax: gross - net, gross };
}

/**
 * A price with tax still to be added — the normal case in the United States,
 * and for anyone entering a pre-tax invoice figure.
 */
export function splitExclusive(net: number, ratePercent: number): TaxSplit {
  if (!isValidRate(ratePercent) || ratePercent === 0) return { net, tax: 0, gross: net };
  const tax = Math.round((net * ratePercent) / 100);
  return { net, tax, gross: net + tax };
}

export type TaxMode = 'inclusive' | 'exclusive';

export function split(amount: number, ratePercent: number, mode: TaxMode): TaxSplit {
  return mode === 'inclusive' ? splitInclusive(amount, ratePercent) : splitExclusive(amount, ratePercent);
}

/**
 * The effective rate a split represents, as a percentage of the net amount.
 * Useful for showing what a hand-entered tax figure actually works out to.
 */
export function effectiveRate(net: number, tax: number): number {
  if (net <= 0) return 0;
  return (tax / net) * 100;
}

/**
 * Trim a rate for display: "20%", "8.1%", "19.25%", "8.875%".
 *
 * Three decimals, because real rates go that far — a US local sales tax of
 * 8.875% must not be shown back to the user as 8.88%.
 */
export function formatRate(rate: number): string {
  return `${Math.round(rate * 1000) / 1000}%`;
}
