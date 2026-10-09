// Learn Mode session engine (pure, no React). Modeled on Quizlet Learn:
// items climb New -> Familiar -> Mastered within a session; a miss drops an item one level
// and brings it back 3 to 5 questions later. A session ends when every item is Mastered.
import type { MasteryLevel } from '../types';
import { nextLevel } from './mastery';
import { shuffle, type Rng } from './random';

export const MIN_REQUEUE_GAP = 3;
export const MAX_REQUEUE_GAP = 5;

export interface LearnSessionState {
  itemIds: string[];
  levels: Record<string, MasteryLevel>;
  queue: string[];
  /** Items waiting to be retried after a miss. */
  retry: string[];
  roundSize: number;
  round: number;
  roundAnswers: { itemId: string; correct: boolean }[];
  answeredTotal: number;
  correctTotal: number;
  roundComplete: boolean;
  finished: boolean;
}

/**
 * Where to reinsert a missed item: after 3 to 5 other questions (or at the end if fewer remain).
 * Only items that are not themselves waiting for a retry count toward the gap, so retries line
 * up behind fresh questions. Without this, a student who keeps missing the first few items would
 * see only those items, and the rest of the queue would never come up.
 */
export function requeueIndex(rest: string[], retry: ReadonlySet<string>, rng: Rng): number {
  const gap = MIN_REQUEUE_GAP + Math.floor(rng() * (MAX_REQUEUE_GAP - MIN_REQUEUE_GAP + 1));
  let fresh = 0;
  for (let i = 0; i < rest.length; i++) {
    if (!retry.has(rest[i]) && ++fresh === gap) return i + 1;
  }
  return rest.length;
}

export function createLearnSession(
  itemIds: string[],
  startingLevels: Record<string, MasteryLevel>,
  roundSize: number,
  options: { shuffle: boolean; rng?: Rng },
): LearnSessionState {
  const rng = options.rng ?? Math.random;
  const ids = Array.from(new Set(itemIds));
  const levels: Record<string, MasteryLevel> = {};
  for (const id of ids) levels[id] = startingLevels[id] ?? 'new';
  const queue = options.shuffle ? shuffle(ids, rng) : ids;
  return {
    itemIds: ids,
    levels,
    queue,
    retry: [],
    roundSize: Math.max(1, roundSize),
    round: 1,
    roundAnswers: [],
    answeredTotal: 0,
    correctTotal: 0,
    roundComplete: false,
    finished: ids.length === 0,
  };
}

export function currentItemId(state: LearnSessionState): string | undefined {
  return state.queue[0];
}

export function answerCurrent(state: LearnSessionState, correct: boolean, rng: Rng = Math.random): LearnSessionState {
  const [current, ...rest] = state.queue;
  if (current === undefined) return state;
  const level = nextLevel(state.levels[current] ?? 'new', correct);
  const retrySet = new Set(state.retry);
  retrySet.delete(current);
  let queue: string[];
  if (!correct) {
    const idx = requeueIndex(rest, retrySet, rng);
    queue = [...rest.slice(0, idx), current, ...rest.slice(idx)];
    retrySet.add(current);
  } else if (level !== 'mastered') {
    queue = [...rest, current];
  } else {
    queue = rest;
  }
  const roundAnswers = [...state.roundAnswers, { itemId: current, correct }];
  const finished = queue.length === 0;
  return {
    ...state,
    levels: { ...state.levels, [current]: level },
    queue,
    retry: [...retrySet],
    roundAnswers,
    answeredTotal: state.answeredTotal + 1,
    correctTotal: state.correctTotal + (correct ? 1 : 0),
    roundComplete: finished || roundAnswers.length >= state.roundSize,
    finished,
  };
}

export function startNextRound(state: LearnSessionState): LearnSessionState {
  if (state.finished) return state;
  return { ...state, round: state.round + 1, roundAnswers: [], roundComplete: false };
}

export function sessionCounts(state: LearnSessionState): Record<MasteryLevel, number> {
  const counts: Record<MasteryLevel, number> = { new: 0, familiar: 0, mastered: 0 };
  for (const id of state.itemIds) counts[state.levels[id]]++;
  return counts;
}

/** Progress from 0 to 1: Familiar counts half, Mastered counts fully. */
export function sessionProgress(state: LearnSessionState): number {
  if (state.itemIds.length === 0) return 1;
  const c = sessionCounts(state);
  return (c.familiar * 0.5 + c.mastered) / state.itemIds.length;
}
