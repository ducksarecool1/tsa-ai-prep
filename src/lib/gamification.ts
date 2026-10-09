// XP, levels, daily goals and achievements. Pure functions; React code calls these.
import type { Content, ProgressState } from '../types';
import type { Presentation } from './items';
import { computeStreak, localDate, unitMastery } from './stats';

export const XP = {
  correct: 10,
  /** Typed recall, matching and ordering take more effort than picking an option. */
  effortBonus: 5,
  comboBonus3: 2,
  comboBonus5: 5,
  perfectRound: 10,
  sessionComplete: 20,
  flashcard: 2,
  spot: 10,
  testCorrect: 5,
  promptPass: 10,
} as const;

/** Combo counts that get their own sound and message. */
export const COMBO_MILESTONES = [3, 5, 10, 15, 20, 25, 30];

/**
 * XP for one answer. `combo` is the streak of correct answers including this one.
 * Wrong answers earn nothing, as in most learning games; the item simply comes back.
 */
export function answerXp(input: { correct: boolean; format: Presentation['format']; combo: number; promptScore?: number }): number {
  if (!input.correct) return 0;
  if (input.format === 'prompt') return XP.promptPass + Math.round((input.promptScore ?? 0) / 10);
  let xp: number = XP.correct;
  if (input.format === 'written' || input.format === 'matching' || input.format === 'ordering') xp += XP.effortBonus;
  if (input.combo >= 5) xp += XP.comboBonus5;
  else if (input.combo >= 3) xp += XP.comboBonus3;
  return xp;
}

/** Total XP needed to reach a level: 0, 100, 300, 600, 1000, 1500, ... */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level. */
  into: number;
  /** XP the current level spans. */
  span: number;
  /** 0 to 1. */
  progress: number;
}

export function levelInfo(totalXp: number): LevelInfo {
  let level = 1;
  while (totalXp >= xpForLevel(level + 1)) level++;
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  const into = totalXp - start;
  return { level, into, span, progress: into / span };
}

export function xpToday(progress: ProgressState, today: string = localDate()): number {
  return progress.xp.byDay[today] ?? 0;
}

/** Adds XP to the total and to today's count, keeping only the last 60 days of history. */
export function addXp(progress: ProgressState, amount: number, today: string = localDate()): ProgressState {
  if (amount <= 0) return progress;
  const byDay = { ...progress.xp.byDay, [today]: (progress.xp.byDay[today] ?? 0) + amount };
  const days = Object.keys(byDay).sort();
  for (const d of days.slice(0, Math.max(0, days.length - 60))) delete byDay[d];
  return { ...progress, xp: { total: progress.xp.total + amount, byDay } };
}

// ---------- Achievements ----------

export interface AchievementContext {
  progress: ProgressState;
  content: Content;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: 'spark' | 'flame' | 'target' | 'trophy' | 'star' | 'bolt' | 'wand' | 'eye' | 'test' | 'book' | 'check';
  check: (c: AchievementContext) => boolean;
  /** Short progress text for locked badges, such as "3 / 5". */
  progressText?: (c: AchievementContext) => string;
}

const passedPrompts = (p: ProgressState) => Object.values(p.prompts).filter((x) => x.bestScore >= 80).length;
const spotted = (p: ProgressState) => Object.values(p.spot).reduce((n, s) => n + s.correct, 0);
const ratio = (n: number, of: number) => `${Math.min(n, of)} / ${of}`;

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-answer',
    title: 'First steps',
    description: 'Answer your first question.',
    icon: 'spark',
    check: ({ progress }) => Object.keys(progress.items).length > 0,
  },
  {
    id: 'first-session',
    title: 'Session complete',
    description: 'Finish a Learn session.',
    icon: 'check',
    check: ({ progress }) => progress.stats.sessionsCompleted >= 1,
  },
  {
    id: 'combo-5',
    title: 'On a roll',
    description: 'Get 5 right in a row.',
    icon: 'bolt',
    check: ({ progress }) => progress.stats.bestCombo >= 5,
    progressText: ({ progress }) => `Best: ${progress.stats.bestCombo}`,
  },
  {
    id: 'combo-10',
    title: 'Unstoppable',
    description: 'Get 10 right in a row.',
    icon: 'bolt',
    check: ({ progress }) => progress.stats.bestCombo >= 10,
    progressText: ({ progress }) => `Best: ${progress.stats.bestCombo}`,
  },
  {
    id: 'perfect-round',
    title: 'Flawless',
    description: 'Finish a Learn round without a miss.',
    icon: 'star',
    check: ({ progress }) => progress.stats.perfectRounds >= 1,
  },
  {
    id: 'streak-3',
    title: 'Warming up',
    description: 'Study 3 days in a row.',
    icon: 'flame',
    check: ({ progress }) => computeStreak(progress.studyDays) >= 3,
    progressText: ({ progress }) => ratio(computeStreak(progress.studyDays), 3),
  },
  {
    id: 'streak-7',
    title: 'Week warrior',
    description: 'Study 7 days in a row.',
    icon: 'flame',
    check: ({ progress }) => computeStreak(progress.studyDays) >= 7,
    progressText: ({ progress }) => ratio(computeStreak(progress.studyDays), 7),
  },
  {
    id: 'daily-goal',
    title: 'Goal getter',
    description: 'Reach your daily XP goal.',
    icon: 'target',
    check: ({ progress }) => progress.goalDays.length >= 1,
  },
  {
    id: 'xp-500',
    title: 'Rising star',
    description: 'Earn 500 XP.',
    icon: 'star',
    check: ({ progress }) => progress.xp.total >= 500,
    progressText: ({ progress }) => ratio(progress.xp.total, 500),
  },
  {
    id: 'xp-2000',
    title: 'AI scholar',
    description: 'Earn 2,000 XP.',
    icon: 'trophy',
    check: ({ progress }) => progress.xp.total >= 2000,
    progressText: ({ progress }) => ratio(progress.xp.total, 2000),
  },
  {
    id: 'unit-master',
    title: 'Unit master',
    description: 'Master every item in one unit.',
    icon: 'book',
    check: ({ progress, content }) => content.units.some((u) => unitMastery(content, u, progress.items).percent === 100),
    progressText: ({ progress, content }) => `Best unit: ${Math.max(0, ...content.units.map((u) => unitMastery(content, u, progress.items).percent))}%`,
  },
  {
    id: 'prompt-pro',
    title: 'Prompt pro',
    description: 'Pass 5 prompt practice challenges.',
    icon: 'wand',
    check: ({ progress }) => passedPrompts(progress) >= 5,
    progressText: ({ progress }) => ratio(passedPrompts(progress), 5),
  },
  {
    id: 'prompt-perfect',
    title: 'Perfect prompt',
    description: 'Score 100 on a prompt challenge.',
    icon: 'wand',
    check: ({ progress }) => Object.values(progress.prompts).some((x) => x.bestScore === 100),
  },
  {
    id: 'sharp-eye',
    title: 'Sharp eye',
    description: 'Spot 5 prompt problems correctly.',
    icon: 'eye',
    check: ({ progress }) => spotted(progress) >= 5,
    progressText: ({ progress }) => ratio(spotted(progress), 5),
  },
  {
    id: 'test-ace',
    title: 'Test ace',
    description: 'Score 90% or higher on a practice test of 10 or more questions.',
    icon: 'test',
    check: ({ progress }) => progress.tests.some((t) => t.total >= 10 && t.score / t.total >= 0.9),
  },
];

/** Achievements whose condition is met but which are not yet recorded as unlocked. */
export function newlyUnlocked(ctx: AchievementContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !ctx.progress.achievements[a.id] && a.check(ctx));
}
