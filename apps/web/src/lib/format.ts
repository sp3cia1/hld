// One locale for the whole app so the demo looks the same on every machine.
const LOCALE = 'en-IN';

/** The single currency this app trades in. Price filters and inputs use it. */
export const DEFAULT_CURRENCY = 'INR';

function fractionDigits(currency: string): number {
  const formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
  return formatter.resolvedOptions().maximumFractionDigits ?? 2;
}

/** Formats integer minor units (paise, cents) as money. The only place minor units become a decimal. */
export function formatMoney(amountMinor: number, currency: string): string {
  const formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
  return formatter.format(amountMinor / 10 ** fractionDigits(currency));
}

/** Converts what a customer types (e.g. 12.5 rupees) to integer minor units (1250 paise). */
export function toMinorUnits(amount: number, currency: string): number {
  return Math.round(amount * 10 ** fractionDigits(currency));
}

/** Formats an ISO-8601 UTC string in an explicit IANA time zone, e.g. "Asia/Kolkata". */
export function formatDateTime(iso: string, timeZone: string): string {
  // Explicit fields: `dateStyle`/`timeStyle` cannot be combined with `timeZoneName`.
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(iso));
}
