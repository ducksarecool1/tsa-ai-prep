import { describe, expect, it } from 'vitest';
import { DAY_MS, LEITNER_INTERVAL_DAYS, MAX_BOX, daysOverdue, isDue, scheduleNext } from '../src/lib/srs';
import { mistakeItems, priorityScore, selectSessionItems } from '../src/lib/selection';
import { emptyProgress, recordAnswer } from '../src/lib/mastery';
import type { ItemProgress } from '../src/types';

const now = 1_700_000_000_000;

describe('Leitner scheduler', () => {
  it('moves a new item to box 1, due in one day, after a correct answer', () => {
    expect(scheduleNext(0, true, now)).toEqual({ box: 1, nextDue: now + DAY_MS });
  });

  it('moves up one box per correct answer with growing intervals', () => {
    let box = 0;
    const intervals: number[] = [];
    for (let i = 0; i < 5; i++) {
      const s = scheduleNext(box, true, now);
      intervals.push((s.nextDue - now) / DAY_MS);
      box = s.box;
    }
    expect(intervals).toEqual([1, 2, 4, 8, 16]);
    expect(box).toBe(MAX_BOX);
  });

  it('never goes above the top box', () => {
    expect(scheduleNext(MAX_BOX, true, now).box).toBe(MAX_BOX);
    expect(scheduleNext(MAX_BOX, true, now).nextDue).toBe(now + LEITNER_INTERVAL_DAYS[MAX_BOX] * DAY_MS);
  });

  it('sends a missed item back to box 1 and makes it due now', () => {
    expect(scheduleNext(4, false, now)).toEqual({ box: 1, nextDue: now });
  });

  it('reports due and overdue status', () => {
    expect(isDue(null, now)).toBe(false);
    expect(isDue(now + 1, now)).toBe(false);
    expect(isDue(now, now)).toBe(true);
    expect(daysOverdue(now - 3 * DAY_MS, now)).toBe(3);
    expect(daysOverdue(now + DAY_MS, now)).toBe(0);
  });
});

describe('targeted review selection', () => {
  const seen = (overrides: Partial<ItemProgress>): ItemProgress => ({
    ...emptyProgress(overrides.itemId ?? 'x'),
    attempts: 4,
    correct: 4,
    lastSeen: now,
    nextDue: now + 4 * DAY_MS,
    box: 3,
    lastResult: 'correct',
    ...overrides,
  });

  it('ranks a recent miss above a well-known item', () => {
    const missed = recordAnswer(seen({ itemId: 'm' }), 'm', false, now);
    const strong = seen({ itemId: 's', level: 'mastered' });
    expect(priorityScore(missed, now)).toBeGreaterThan(priorityScore(strong, now));
  });

  it('ranks low accuracy above high accuracy', () => {
    const low = seen({ itemId: 'l', correct: 1 });
    const high = seen({ itemId: 'h', correct: 4 });
    expect(priorityScore(low, now)).toBeGreaterThan(priorityScore(high, now));
  });

  it('ranks a due item above the same item when not due', () => {
    const due = seen({ itemId: 'd', nextDue: now - DAY_MS });
    const notDue = seen({ itemId: 'd' });
    expect(priorityScore(due, now)).toBeGreaterThan(priorityScore(notDue, now));
  });

  it('ranks an item not seen for weeks above one seen today', () => {
    const old = seen({ itemId: 'o', lastSeen: now - 14 * DAY_MS });
    const fresh = seen({ itemId: 'f' });
    expect(priorityScore(old, now)).toBeGreaterThan(priorityScore(fresh, now));
  });

  it('selects the highest-priority items first', () => {
    const progress: Record<string, ItemProgress> = {
      mastered: seen({ itemId: 'mastered', level: 'mastered' }),
      missed: recordAnswer(seen({ itemId: 'missed' }), 'missed', false, now),
    };
    const picked = selectSessionItems(['mastered', 'missed', 'unseen'], progress, 2, now, () => 0);
    expect(picked).toEqual(['missed', 'unseen']);
  });

  it('returns every item when count is 0', () => {
    expect(selectSessionItems(['a', 'b', 'c'], {}, 0, now)).toHaveLength(3);
  });

  it('Review My Mistakes lists only missed items, most-missed first', () => {
    const progress: Record<string, ItemProgress> = {
      once: seen({ itemId: 'once', misses: 1, attempts: 4, correct: 3 }),
      thrice: seen({ itemId: 'thrice', misses: 3, attempts: 4, correct: 1 }),
      never: seen({ itemId: 'never', misses: 0 }),
    };
    expect(mistakeItems(['once', 'never', 'thrice', 'unseen'], progress)).toEqual(['thrice', 'once']);
  });
});
