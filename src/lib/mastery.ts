// Mastery levels: New -> Familiar -> Mastered. A wrong answer moves back one level.
import type { ItemProgress, MasteryLevel } from '../types';
import { scheduleNext } from './srs';

export const LEVEL_ORDER: MasteryLevel[] = ['new', 'familiar', 'mastered'];

export const LEVEL_LABELS: Record<MasteryLevel, string> = {
  new: 'New',
  familiar: 'Familiar',
  mastered: 'Mastered',
};

export function nextLevel(level: MasteryLevel, correct: boolean): MasteryLevel {
  const i = LEVEL_ORDER.indexOf(level);
  const j = correct ? Math.min(i + 1, LEVEL_ORDER.length - 1) : Math.max(i - 1, 0);
  return LEVEL_ORDER[j];
}

export function emptyProgress(itemId: string): ItemProgress {
  return {
    itemId,
    level: 'new',
    attempts: 0,
    correct: 0,
    misses: 0,
    streak: 0,
    lastSeen: null,
    nextDue: null,
    box: 0,
    lastResult: null,
  };
}

/**
 * Record one answer. `level` sets the new mastery level explicitly (Learn Mode does this);
 * when omitted the level is left unchanged, except that a miss on a Mastered item drops it.
 */
export function recordAnswer(
  prev: ItemProgress | undefined,
  itemId: string,
  correct: boolean,
  now: number,
  level?: MasteryLevel,
): ItemProgress {
  const base = prev ?? emptyProgress(itemId);
  const schedule = scheduleNext(base.box, correct, now);
  let newLevel = level ?? base.level;
  if (level === undefined && !correct && base.level === 'mastered') newLevel = 'familiar';
  return {
    ...base,
    level: newLevel,
    attempts: base.attempts + 1,
    correct: base.correct + (correct ? 1 : 0),
    misses: base.misses + (correct ? 0 : 1),
    streak: correct ? base.streak + 1 : 0,
    lastSeen: now,
    nextDue: schedule.nextDue,
    box: schedule.box,
    lastResult: correct ? 'correct' : 'incorrect',
  };
}

export function accuracy(p: ItemProgress | undefined): number | null {
  if (!p || p.attempts === 0) return null;
  return p.correct / p.attempts;
}
