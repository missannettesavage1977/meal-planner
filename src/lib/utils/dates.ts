/** Date helpers working on ISO calendar dates (YYYY-MM-DD) in UTC to avoid timezone drift. */

export function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  // Use the *local* calendar date of the user.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Monday of the week containing `iso`. */
export function weekStartOf(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}

/** 0 = Monday … 6 = Sunday. */
export function dayIndex(iso: string): number {
  return (parseISO(iso).getUTCDay() + 6) % 7;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function formatDayShort(iso: string): string {
  return DAY_SHORT[dayIndex(iso)];
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return parseISO(iso).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

export function isWeekend(iso: string): boolean {
  return dayIndex(iso) >= 5;
}
