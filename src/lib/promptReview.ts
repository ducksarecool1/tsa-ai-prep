// One review shape for prompt practice, whether the AI coach or the offline checklist produced it.
import type { PromptChallenge } from '../types';
import { gradePrompt } from './promptGrader';
import { aiEnabled, reviewPromptWithAI, type AIConfig, type ReviewStep } from './ai';

/** A prompt scoring at least this counts as a correct answer in Learn Mode. */
export const PASS_SCORE = 80;

export interface PromptReview {
  source: 'ai' | 'offline';
  score: number;
  criteria: { name: string; met: boolean; feedback: string }[];
  summary: string;
  improvedPrompt?: string;
  /** What the AI produced when it ran the student's prompt (AI coach only). */
  output?: string | null;
  /** Shown when the AI coach was unavailable and the offline checklist was used instead. */
  notice?: string;
}

export function offlineReview(challenge: PromptChallenge, prompt: string): PromptReview {
  const grade = gradePrompt(prompt, challenge.rubric);
  const met = grade.results.filter((r) => r.met).length;
  const missed = grade.results.filter((r) => !r.met);
  return {
    source: 'offline',
    score: grade.score,
    criteria: grade.results.map((r) => ({
      name: r.criterion.name,
      met: r.met,
      feedback: r.met ? r.criterion.description : r.criterion.suggestion,
    })),
    summary:
      missed.length === 0
        ? 'Your prompt covers every item on the checklist.'
        : `Your prompt covers ${met} of ${grade.results.length} checklist items. The most useful next step: ${missed[0].criterion.suggestion}`,
  };
}

/** Uses the AI coach when an API key is set, and falls back to the offline checklist on any failure. */
export async function reviewPrompt(
  ai: AIConfig,
  challenge: PromptChallenge,
  prompt: string,
  onStep?: (step: ReviewStep) => void,
): Promise<PromptReview> {
  if (!aiEnabled(ai)) return offlineReview(challenge, prompt);
  try {
    const r = await reviewPromptWithAI(ai, challenge, prompt, onStep);
    return { source: 'ai', ...r };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'The AI coach is unavailable.';
    return { ...offlineReview(challenge, prompt), notice: `${reason} Showing the offline checklist instead.` };
  }
}
