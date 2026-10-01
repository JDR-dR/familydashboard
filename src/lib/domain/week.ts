/**
 * The week runs Friday to Thursday, because the family meets on a Friday.
 * Everything here works on plain ISO date strings (YYYY-MM-DD) in the household
 * timezone, so no Date arithmetic ever drifts across a UTC boundary.
 */

export const TIMEZONE = process.env.APP_TIMEZONE ?? "Africa/Johannesburg";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Today in the household timezone, as YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Days since the epoch for an ISO date, used for all date arithmetic. */
function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromDayNumber(n: number): string {
  const d = new Date(n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(iso: string): number {
  return (((dayNumber(iso) + 4) % 7) + 7) % 7;
}

/**
 * The Friday that starts the week containing this date.
 * Friday itself returns itself; Thursday returns the Friday six days earlier.
 */
export function weekStart(iso: string): string {
  const back = (weekday(iso) + 2) % 7;
  return addDays(iso, -back);
}

/** The Thursday that ends the week containing this date. */
export function weekEnd(iso: string): string {
  return addDays(weekStart(iso), 6);
}

/** The Thursday that ends the week after the one containing this date. */
export function nextWeekEnd(iso: string): string {
  return addDays(weekStart(iso), 13);
}

/** Whole weeks between two dates, counted from the Friday each falls in. */
export function weeksBetween(fromIso: string, toIso: string): number {
  const diff = dayNumber(weekStart(toIso)) - dayNumber(weekStart(fromIso));
  return Math.max(0, Math.round(diff / 7));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(iso: string): string {
  return `${monthKey(iso)}-01`;
}

export function monthEnd(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthKey(iso)}-${String(last).padStart(2, "0")}`;
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function inWindow(iso: string | null, from: string, to: string): boolean {
  if (!iso) return false;
  return iso >= from && iso <= to;
}

/** "15 Sep", or "15 Sep 25" when the year is not the current one. */
export function formatDate(iso: string | null, reference: string = today()): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const sameYear = String(y) === reference.slice(0, 4);
  return `${d} ${MONTHS_SHORT[m - 1]}${sameYear ? "" : ` ${String(y).slice(2)}`}`;
}

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** "Friday 26 Sep to Thursday 2 Oct" — the header of the Weekly Drive. */
export function formatWeekRange(iso: string): string {
  const start = weekStart(iso);
  const end = weekEnd(iso);
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return `Friday ${sd} ${MONTHS_SHORT[sm - 1]} to Thursday ${ed} ${MONTHS_SHORT[em - 1]}`;
}

/** Relative stamp for the activity trail: "today 09:41", "yesterday 18:24", "22 Sep". */
export function formatWhen(at: Date | string, now: Date = new Date()): string {
  const date = typeof at === "string" ? new Date(at) : at;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const iso = `${get("year")}-${get("month")}-${get("day")}`;
  const clock = `${get("hour")}:${get("minute")}`;
  const days = dayNumber(today(now)) - dayNumber(iso);
  if (days === 0) return `today ${clock}`;
  if (days === 1) return `yesterday ${clock}`;
  return formatDate(iso, today(now));
}
