import { describe, expect, it } from 'vitest';
import { emptyProgress, nextLevel, recordAnswer } from '../src/lib/mastery';
import { DAY_MS } from '../src/lib/srs';

describe('nextLevel', () => {
  it('moves up one level on a correct answer', () => {
    expect(nextLevel('new', true)).toBe('familiar');
    expect(nextLevel('familiar', true)).toBe('mastered');
  });

  it('stays mastered on a correct answer', () => {
    expect(nextLevel('mastered', true)).toBe('mastered');
  });

  it('moves back exactly one level on a wrong answer', () => {
    expect(nextLevel('mastered', false)).toBe('familiar');
    expect(nextLevel('familiar', false)).toBe('new');
  });

  it('stays new on a wrong answer', () => {
    expect(nextLevel('new', false)).toBe('new');
  });
});

describe('recordAnswer', () => {
  const now = 1_700_000_000_000;

  it('creates progress for an unseen item', () => {
    const p = recordAnswer(undefined, 'q1', true, now, 'familiar');
    expect(p).toMatchObject({ itemId: 'q1', level: 'familiar', attempts: 1, correct: 1, misses: 0, streak: 1 });
    expect(p.lastSeen).toBe(now);
    expect(p.box).toBe(1);
    expect(p.nextDue).toBe(now + DAY_MS);
  });

  it('counts misses and resets the streak', () => {
    let p = recordAnswer(undefined, 'q1', true, now);
    p = recordAnswer(p, 'q1', true, now);
    expect(p.streak).toBe(2);
    p = recordAnswer(p, 'q1', false, now);
    expect(p).toMatchObject({ attempts: 3, correct: 2, misses: 1, streak: 0, lastResult: 'incorrect' });
  });

  it('drops a mastered item to familiar on a miss when no level is given', () => {
    const mastered = { ...emptyProgress('q1'), level: 'mastered' as const };
    expect(recordAnswer(mastered, 'q1', false, now).level).toBe('familiar');
  });

  it('keeps the level when no level is given and the answer is correct', () => {
    const familiar = { ...emptyProgress('q1'), level: 'familiar' as const };
    expect(recordAnswer(familiar, 'q1', true, now).level).toBe('familiar');
  });
});
