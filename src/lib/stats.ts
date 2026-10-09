// Dashboard statistics.
import type { Content, ItemProgress, Term, Unit } from '../types';
import { termItemId, unitItemIds } from './items';
import { isDue } from './srs';

/** Local calendar date as YYYY-MM-DD. */
export function localDate(ts: number = Date.now()): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d - 1).getTime());
}

/** Consecutive study days ending today (or yesterday, so a streak survives until tonight). */
export function computeStreak(studyDays: string[], today: string = localDate()): number {
  const days = new Set(studyDays);
  let cursor = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  return streak;
}

export interface MasteryStats {
  total: number;
  mastered: number;
  familiar: number;
  /** 0 to 100. */
  percent: number;
}

export function masteryFor(ids: string[], progress: Record<string, ItemProgress>): MasteryStats {
  let mastered = 0;
  let familiar = 0;
  for (const id of ids) {
    const level = progress[id]?.level;
    if (level === 'mastered') mastered++;
    else if (level === 'familiar') familiar++;
  }
  const total = ids.length;
  return { total, mastered, familiar, percent: total ? Math.round((mastered / total) * 100) : 0 };
}

export function unitMastery(content: Content, unit: Unit, progress: Record<string, ItemProgress>): MasteryStats {
  return masteryFor(unitItemIds(content, unit), progress);
}

function everyItemId(content: Content): string[] {
  return content.units.flatMap((u) => unitItemIds(content, u));
}

export function overallMastery(content: Content, progress: Record<string, ItemProgress>): MasteryStats {
  return masteryFor(everyItemId(content), progress);
}

export function dueCount(content: Content, progress: Record<string, ItemProgress>, now = Date.now()): number {
  return everyItemId(content).filter((id) => isDue(progress[id]?.nextDue ?? null, now)).length;
}

export interface WeakTerm {
  term: Term;
  accuracy: number;
  misses: number;
}

/** Terms answered at least once, lowest accuracy first, then most misses. */
export function weakestTerms(units: Unit[], progress: Record<string, ItemProgress>, limit = 10): WeakTerm[] {
  const out: WeakTerm[] = [];
  for (const t of units.flatMap((u) => u.terms)) {
    const p = progress[termItemId(t)];
    if (!p || p.attempts === 0 || p.misses === 0) continue;
    out.push({ term: t, accuracy: p.correct / p.attempts, misses: p.misses });
  }
  out.sort((a, b) => a.accuracy - b.accuracy || b.misses - a.misses);
  return out.slice(0, limit);
}
