// Targeted review: choose which items a session should focus on.
import type { ItemProgress } from '../types';
import { DAY_MS, daysOverdue, isDue } from './srs';
import type { Rng } from './random';

/**
 * Higher score = more in need of study. Weighs low accuracy, a recent miss,
 * spaced-repetition due dates and time since last seen. Mastered items that
 * are not yet due are heavily discounted.
 */
export function priorityScore(p: ItemProgress | undefined, now: number): number {
  if (!p || p.attempts === 0) return 2;
  const acc = p.correct / p.attempts;
  let score = 1 + (1 - acc) * 3;
  if (p.lastResult === 'incorrect') score += 3;
  if (isDue(p.nextDue, now)) score += 2 + Math.min(daysOverdue(p.nextDue, now), 7) * 0.3;
  if (p.lastSeen !== null) score += Math.min((now - p.lastSeen) / (7 * DAY_MS), 2);
  if (p.level === 'mastered' && !isDue(p.nextDue, now)) score *= 0.25;
  return score;
}

/** Pick up to `count` items (0 = all), highest priority first, with a little random jitter. */
export function selectSessionItems(
  itemIds: string[],
  progress: Record<string, ItemProgress>,
  count: number,
  now: number,
  rng: Rng = Math.random,
): string[] {
  const scored = itemIds.map((id) => ({ id, score: priorityScore(progress[id], now) + rng() * 0.5 }));
  scored.sort((a, b) => b.score - a.score);
  const ids = scored.map((s) => s.id);
  return count > 0 ? ids.slice(0, count) : ids;
}

/** Items the student has missed at least once, most-missed first, then lowest accuracy. */
export function mistakeItems(itemIds: string[], progress: Record<string, ItemProgress>): string[] {
  return itemIds
    .filter((id) => (progress[id]?.misses ?? 0) > 0)
    .sort((a, b) => {
      const pa = progress[a];
      const pb = progress[b];
      if (pb.misses !== pa.misses) return pb.misses - pa.misses;
      return pa.correct / pa.attempts - pb.correct / pb.attempts;
    });
}
