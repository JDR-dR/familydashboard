/**
 * Money is rand. Amounts are stored as numeric(14,2) and handled here as integer
 * cents so no sum ever drifts. Nothing in the app adds floats.
 */

export type Cents = number;

export function toCents(value: string | number | null | undefined): Cents {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return 0;
  return Math.round(Number(cleaned) * 100);
}

/** For writing back to numeric(14,2). */
export function centsToDecimal(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function sumCents(values: Array<string | number | null | undefined>): Cents {
  return values.reduce<Cents>((total, value) => total + toCents(value), 0);
}

/** R12,500 — no decimals, minus sign for negatives. */
export function money(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const rand = Math.round(cents / 100);
  const sign = rand < 0 ? "−" : "";
  return `${sign}R${Math.abs(rand).toLocaleString("en-US")}`;
}

/** R160k, R1.2m — for the summary band, where space is tight. */
export function moneyShort(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const rand = Math.round(cents / 100);
  const abs = Math.abs(rand);
  const sign = rand < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    return `${sign}R${(abs >= 10_000_000 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, ""))}m`;
  }
  if (abs >= 10_000) return `${sign}R${Math.round(abs / 1000)}k`;
  return `${sign}R${abs.toLocaleString("en-US")}`;
}

export function percent(part: Cents, whole: Cents): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
