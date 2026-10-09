import { describe, expect, it } from 'vitest';
import {
  answerCurrent,
  createLearnSession,
  currentItemId,
  requeueIndex,
  sessionCounts,
  sessionProgress,
  startNextRound,
} from '../src/lib/learnSession';
import { seededRng } from '../src/lib/random';

const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const fixed = (v: number) => () => v;

describe('requeueIndex', () => {
  const ten = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  const noRetry = new Set<string>();

  it('returns a gap of 3 to 5 when enough items remain', () => {
    expect(requeueIndex(ten, noRetry, fixed(0))).toBe(3);
    expect(requeueIndex(ten, noRetry, fixed(0.5))).toBe(4);
    expect(requeueIndex(ten, noRetry, fixed(0.999))).toBe(5);
  });

  it('never exceeds the remaining queue length', () => {
    expect(requeueIndex(['a', 'b'], noRetry, fixed(0.999))).toBe(2);
    expect(requeueIndex([], noRetry, fixed(0.5))).toBe(0);
  });

  it('stays within 3..5 for many random draws', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 500; i++) {
      const idx = requeueIndex(ten, noRetry, rng);
      expect(idx).toBeGreaterThanOrEqual(3);
      expect(idx).toBeLessThanOrEqual(5);
    }
  });

  it('counts only items that are not waiting for a retry', () => {
    // b and c are retries, so the gap of 3 is counted over a, d, e.
    expect(requeueIndex(['a', 'b', 'c', 'd', 'e', 'f'], new Set(['b', 'c']), fixed(0))).toBe(5);
  });
});

describe('Learn session', () => {
  it('keeps the given order when shuffle is off', () => {
    const s = createLearnSession(ids, {}, 7, { shuffle: false });
    expect(s.queue).toEqual(ids);
    expect(currentItemId(s)).toBe('a');
  });

  it('starts unseen items at New and keeps known levels', () => {
    const s = createLearnSession(['a', 'b'], { b: 'familiar' }, 7, { shuffle: false });
    expect(s.levels).toEqual({ a: 'new', b: 'familiar' });
  });

  it('a wrong answer comes back 3 to 5 questions later, not immediately', () => {
    for (const [r, gap] of [
      [0, 3],
      [0.5, 4],
      [0.99, 5],
    ] as const) {
      let s = createLearnSession(ids, {}, 7, { shuffle: false });
      s = answerCurrent(s, false, fixed(r));
      expect(s.queue[0]).not.toBe('a');
      expect(s.queue.indexOf('a')).toBe(gap);
    }
  });

  it('a correct answer at New moves the item to Familiar and to the back of the queue', () => {
    let s = createLearnSession(ids, {}, 7, { shuffle: false });
    s = answerCurrent(s, true);
    expect(s.levels.a).toBe('familiar');
    expect(s.queue[s.queue.length - 1]).toBe('a');
  });

  it('a correct answer at Familiar masters the item and removes it from the queue', () => {
    let s = createLearnSession(['a', 'b'], { a: 'familiar' }, 7, { shuffle: false });
    s = answerCurrent(s, true);
    expect(s.levels.a).toBe('mastered');
    expect(s.queue).toEqual(['b']);
  });

  it('a wrong answer moves the item back one level', () => {
    let s = createLearnSession(['a', 'b'], { a: 'familiar' }, 7, { shuffle: false });
    s = answerCurrent(s, false);
    expect(s.levels.a).toBe('new');
  });

  it('a mastered item missed in review drops to Familiar and is requeued', () => {
    let s = createLearnSession(ids, { a: 'mastered' }, 7, { shuffle: false });
    s = answerCurrent(s, false, fixed(0));
    expect(s.levels.a).toBe('familiar');
    expect(s.queue).toContain('a');
  });

  it('marks the round complete after roundSize answers', () => {
    let s = createLearnSession(ids, {}, 3, { shuffle: false });
    s = answerCurrent(s, true);
    s = answerCurrent(s, true);
    expect(s.roundComplete).toBe(false);
    s = answerCurrent(s, false, fixed(0));
    expect(s.roundComplete).toBe(true);
    expect(s.roundAnswers).toHaveLength(3);
    s = startNextRound(s);
    expect(s).toMatchObject({ round: 2, roundComplete: false, roundAnswers: [] });
  });

  it('finishes when every item is mastered, after exactly two correct answers each', () => {
    let s = createLearnSession(['a', 'b', 'c'], {}, 10, { shuffle: false });
    let steps = 0;
    while (!s.finished && steps < 100) {
      s = answerCurrent(s, true);
      steps++;
    }
    expect(s.finished).toBe(true);
    expect(steps).toBe(6);
    expect(sessionCounts(s)).toEqual({ new: 0, familiar: 0, mastered: 3 });
    expect(sessionProgress(s)).toBe(1);
  });

  it('eventually finishes even with random wrong answers', () => {
    const rng = seededRng(7);
    let s = createLearnSession(ids, {}, 7, { shuffle: true, rng });
    let steps = 0;
    while (!s.finished && steps < 1000) {
      s = answerCurrent(s, rng() > 0.3, rng);
      if (s.roundComplete) s = startNextRound(s);
      steps++;
    }
    expect(s.finished).toBe(true);
    expect(s.queue).toHaveLength(0);
  });

  it('reaches every item even when the student misses everything', () => {
    let s = createLearnSession(ids, {}, 100, { shuffle: false });
    const asked = new Set<string>();
    for (let i = 0; i < 3 * ids.length; i++) {
      asked.add(currentItemId(s)!);
      s = answerCurrent(s, false, fixed(0));
    }
    expect([...asked].sort()).toEqual([...ids].sort());
  });

  it('tracks retries and clears them once answered correctly', () => {
    let s = createLearnSession(ids, {}, 100, { shuffle: false });
    s = answerCurrent(s, false, fixed(0));
    expect(s.retry).toEqual(['a']);
    while (currentItemId(s) !== 'a') s = answerCurrent(s, true);
    s = answerCurrent(s, true);
    expect(s.retry).toEqual([]);
  });

  it('removes duplicate ids', () => {
    const s = createLearnSession(['a', 'a', 'b'], {}, 7, { shuffle: false });
    expect(s.itemIds).toEqual(['a', 'b']);
  });

  it('counts progress with Familiar as half', () => {
    const s = createLearnSession(['a', 'b'], { a: 'familiar' }, 7, { shuffle: false });
    expect(sessionProgress(s)).toBe(0.25);
  });
});
