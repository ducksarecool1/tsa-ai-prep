import { describe, expect, it } from 'vitest';
import { loadContentFromDisk } from '../scripts/loadContent';
import { ACHIEVEMENTS, XP, addXp, answerXp, levelInfo, newlyUnlocked, xpForLevel, xpToday } from '../src/lib/gamification';
import { emptyProgressState, mergeSettings, sanitizeProgress } from '../src/lib/storage';
import { localDate } from '../src/lib/stats';

const content = loadContentFromDisk();

describe('answer XP', () => {
  it('gives nothing for a wrong answer', () => {
    expect(answerXp({ correct: false, format: 'choice', combo: 0 })).toBe(0);
    expect(answerXp({ correct: false, format: 'prompt', combo: 0, promptScore: 60 })).toBe(0);
  });

  it('gives base XP for multiple choice and a bonus for typed, matching and ordering answers', () => {
    expect(answerXp({ correct: true, format: 'choice', combo: 1 })).toBe(XP.correct);
    expect(answerXp({ correct: true, format: 'written', combo: 1 })).toBe(XP.correct + XP.effortBonus);
    expect(answerXp({ correct: true, format: 'matching', combo: 1 })).toBe(XP.correct + XP.effortBonus);
    expect(answerXp({ correct: true, format: 'ordering', combo: 1 })).toBe(XP.correct + XP.effortBonus);
  });

  it('adds combo bonuses at 3 and 5 in a row', () => {
    expect(answerXp({ correct: true, format: 'choice', combo: 2 })).toBe(10);
    expect(answerXp({ correct: true, format: 'choice', combo: 3 })).toBe(10 + XP.comboBonus3);
    expect(answerXp({ correct: true, format: 'choice', combo: 7 })).toBe(10 + XP.comboBonus5);
  });

  it('scales prompt practice XP with the review score', () => {
    expect(answerXp({ correct: true, format: 'prompt', combo: 0, promptScore: 80 })).toBe(18);
    expect(answerXp({ correct: true, format: 'prompt', combo: 0, promptScore: 100 })).toBe(20);
  });
});

describe('levels', () => {
  it('uses growing thresholds', () => {
    expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 100, 300, 600, 1000]);
  });

  it('reports the level and progress within it', () => {
    expect(levelInfo(0)).toMatchObject({ level: 1, into: 0, span: 100, progress: 0 });
    expect(levelInfo(99).level).toBe(1);
    expect(levelInfo(100)).toMatchObject({ level: 2, into: 0, span: 200 });
    expect(levelInfo(400)).toMatchObject({ level: 3, into: 100, span: 300 });
  });
});

describe('XP history', () => {
  it('adds to the total and to today', () => {
    let p = emptyProgressState();
    p = addXp(p, 15, '2026-10-09');
    p = addXp(p, 10, '2026-10-09');
    expect(p.xp.total).toBe(25);
    expect(xpToday(p, '2026-10-09')).toBe(25);
  });

  it('ignores zero and negative amounts', () => {
    const p = emptyProgressState();
    expect(addXp(p, 0)).toBe(p);
    expect(addXp(p, -5)).toBe(p);
  });

  it('keeps only the last 60 days', () => {
    let p = emptyProgressState();
    for (let d = 1; d <= 70; d++) p = addXp(p, 1, localDate(new Date(2026, 0, d).getTime()));
    expect(Object.keys(p.xp.byDay)).toHaveLength(60);
    expect(p.xp.total).toBe(70);
  });
});

describe('achievements', () => {
  it('have unique ids', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('unlock nothing for a brand-new student', () => {
    expect(newlyUnlocked({ progress: emptyProgressState(), content })).toEqual([]);
  });

  it('unlock from progress and are not reported twice', () => {
    const p = emptyProgressState();
    p.items['u1-q01'] = { itemId: 'u1-q01', level: 'familiar', attempts: 1, correct: 1, misses: 0, streak: 1, lastSeen: 1, nextDue: 2, box: 1, lastResult: 'correct' };
    p.stats.bestCombo = 6;
    p.xp.total = 600;
    const ids = newlyUnlocked({ progress: p, content }).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['first-answer', 'combo-5', 'xp-500']));
    expect(ids).not.toContain('combo-10');
    p.achievements = Object.fromEntries(ids.map((id) => [id, 1]));
    expect(newlyUnlocked({ progress: p, content })).toEqual([]);
  });

  it('need a practice test of at least 10 questions for Test ace', () => {
    const p = emptyProgressState();
    p.tests = [{ date: '', unitIds: [], score: 5, total: 5 }];
    expect(newlyUnlocked({ progress: p, content }).map((a) => a.id)).not.toContain('test-ace');
    p.tests.push({ date: '', unitIds: [], score: 9, total: 10 });
    expect(newlyUnlocked({ progress: p, content }).map((a) => a.id)).toContain('test-ace');
  });
});

describe('saved data from older versions', () => {
  it('fills in game fields missing from old progress', () => {
    const p = sanitizeProgress({ version: 1, items: {}, studyDays: ['2026-10-08'] });
    expect(p.xp).toEqual({ total: 0, byDay: {} });
    expect(p.stats).toEqual({ sessionsCompleted: 0, bestCombo: 0, perfectRounds: 0 });
    expect(p.studyDays).toEqual(['2026-10-08']);
  });

  it('migrates old cloud AI settings to Ollama defaults and drops the key', () => {
    const s = mergeSettings({ ai: { apiKey: 'old-key', model: 'claude-opus-5-5' } } as never);
    expect(s.ai).toEqual({ enabled: false, baseUrl: 'http://localhost:11434', model: 'llama3.2' });
    expect(JSON.stringify(s)).not.toContain('old-key');
    expect(s.sound).toBe(true);
    expect(s.dailyGoal).toBe(50);
  });

  it('rejects an invalid daily goal or volume', () => {
    const s = mergeSettings({ dailyGoal: 7, volume: 3 } as never);
    expect(s.dailyGoal).toBe(50);
    expect(s.volume).toBe(0.6);
  });
});
