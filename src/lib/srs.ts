// Leitner-box spaced repetition for review across days.
// Box 0 = never answered. A correct answer moves an item up one box (max 5);
// a wrong answer sends it back to box 1 and makes it due right away.

export const DAY_MS = 86_400_000;
export const MAX_BOX = 5;
/** Days until the next review, indexed by box. */
export const LEITNER_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16] as const;

export interface Schedule {
  box: number;
  nextDue: number;
}

export function scheduleNext(box: number, correct: boolean, now: number): Schedule {
  if (!correct) return { box: 1, nextDue: now };
  const nextBox = Math.min(MAX_BOX, Math.max(1, box + 1));
  return { box: nextBox, nextDue: now + LEITNER_INTERVAL_DAYS[nextBox] * DAY_MS };
}

export function isDue(nextDue: number | null, now: number): boolean {
  return nextDue !== null && nextDue <= now;
}

/** Whole days an item is overdue (0 if not due or never seen). */
export function daysOverdue(nextDue: number | null, now: number): number {
  if (nextDue === null || nextDue > now) return 0;
  return Math.floor((now - nextDue) / DAY_MS);
}
