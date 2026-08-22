import { BUSINESS } from "@/lib/business";

/**
 * Single source of truth for "what date/time is it at the lodge right now,"
 * and whether a given check-in date is currently sellable. Used both
 * client-side (calendar min/disabling, inline messaging) and server-side
 * (createBooking's Zod schema) — pure functions, no I/O, safe to import
 * from anywhere.
 *
 * Deliberately native-only (Intl.DateTimeFormat), no new dependency: plain
 * `date-fns` is already installed but has no timezone support on its own,
 * and `date-fns-tz` isn't in package.json. Given the OquMail/Cloudflare
 * lockfile incident, adding an unpinned new package to fix a date bug isn't
 * a trade worth making — Intl with an explicit IANA zone works everywhere
 * this code runs (browsers and Cloudflare Workers) with zero install.
 */

export const LODGE_TIMEZONE = "Africa/Lusaka";

export const SAME_DAY_CUTOFF_MESSAGE =
  "Same-day check-in is no longer available. Please select tomorrow or contact the lodge.";
export const PAST_DATE_MESSAGE = "This check-in date has already passed. Please choose a date from today onward.";
export const CHECKOUT_BEFORE_CHECKIN_MESSAGE = "Check-out must be after check-in.";

interface LodgeNow {
  /** Today's date at the lodge, right now, as YYYY-MM-DD. */
  dateISO: string;
  hour: number;
  minute: number;
}

/** What date/time it currently is at the lodge, regardless of the caller's own timezone. */
export function getLodgeNow(reference: Date = new Date()): LodgeNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LODGE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(reference);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** Has today's same-day check-in cutoff already passed, lodge-local? */
export function isPastCheckInCutoff(reference: Date = new Date()): boolean {
  const now = getLodgeNow(reference);
  const { hour, minute } = BUSINESS.hours.checkInCutoff;
  return now.hour > hour || (now.hour === hour && now.minute >= minute);
}

/** Add N calendar days to a YYYY-MM-DD string. Pure Y/M/D arithmetic — not a real timezone conversion, just calendar math, so UTC is used internally only as a neutral base to avoid DST edge cases. */
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export type CheckInIssue = "past" | "cutoff" | null;

/**
 * Whether a given check-in date is currently sellable, lodge-local. The one
 * function both the booking form and createBooking call — if this changes,
 * both sides change together.
 */
export function checkInDateIssue(checkInISO: string, reference: Date = new Date()): CheckInIssue {
  if (!checkInISO) return null;
  const now = getLodgeNow(reference);
  if (checkInISO < now.dateISO) return "past";
  if (checkInISO === now.dateISO && isPastCheckInCutoff(reference)) return "cutoff";
  return null;
}

export function checkInIssueMessage(issue: CheckInIssue): string | null {
  if (issue === "past") return PAST_DATE_MESSAGE;
  if (issue === "cutoff") return SAME_DAY_CUTOFF_MESSAGE;
  return null;
}

/** Earliest check-in date currently selectable, lodge-local (today, or tomorrow if today's cutoff has passed). */
export function earliestSelectableCheckInISO(reference: Date = new Date()): string {
  const now = getLodgeNow(reference);
  return isPastCheckInCutoff(reference) ? addDaysISO(now.dateISO, 1) : now.dateISO;
}

/** Earliest check-out date currently selectable, given the chosen check-in (or lodge-local today, if none chosen yet). */
export function earliestSelectableCheckOutISO(checkInISO: string, reference: Date = new Date()): string {
  if (checkInISO) return addDaysISO(checkInISO, 1);
  return getLodgeNow(reference).dateISO;
}
