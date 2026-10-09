// Optional AI features (Prompt Lab grading, "Run my prompt", checking typed answers).
// Uses the official Anthropic SDK, loaded only when a feature is used so the offline
// app never downloads it. The API key comes from Settings and lives only in this
// browser's localStorage. Callers fall back to offline grading when anything fails.
import type { PromptChallenge } from '../types';
import { DEFAULT_MODEL } from './storage';

export const AI_TIMEOUT_MS = 60_000;

export class AIError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'rate_limit' | 'timeout' | 'network' | 'refusal' | 'bad_response' | 'api',
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface AIConfig {
  apiKey: string;
  model: string;
}

export function aiEnabled(config: AIConfig): boolean {
  return config.apiKey.trim().length > 0;
}

export interface AIPromptReview {
  score: number;
  criteria: { name: string; met: boolean; feedback: string }[];
  summary: string;
  improvedPrompt: string;
}

export interface AIAnswerCheck {
  correct: boolean;
  feedback: string;
}

/** Zod and the SDK's structured-output helper, loaded on demand to keep the offline bundle small. */
async function schemas() {
  const [{ z }, { betaZodOutputFormat }] = await Promise.all([
    import('zod'),
    import('@anthropic-ai/sdk/helpers/beta/zod'),
  ]);
  const promptReview = z.object({
    score: z.number(),
    criteria: z.array(z.object({ name: z.string(), met: z.boolean(), feedback: z.string() })),
    summary: z.string(),
    improvedPrompt: z.string(),
  });
  const answerCheck = z.object({ correct: z.boolean(), feedback: z.string() });
  return {
    promptReviewFormat: betaZodOutputFormat(promptReview),
    answerCheckFormat: betaZodOutputFormat(answerCheck),
  };
}

async function client(config: AIConfig) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  return {
    Anthropic,
    api: new Anthropic({
      apiKey: config.apiKey.trim(),
      // The key is the student's or advisor's own, entered in Settings and kept in this browser.
      dangerouslyAllowBrowser: true,
      timeout: AI_TIMEOUT_MS,
      maxRetries: 1,
    }),
  };
}

/** Converts SDK errors into friendly messages. */
async function toAIError(err: unknown): Promise<AIError> {
  if (err instanceof AIError) return err;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AIError('The API key was rejected. Check it in Settings.', 'auth');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AIError('Too many requests right now. Wait a minute and try again.', 'rate_limit');
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AIError('The AI took too long to respond.', 'timeout');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AIError('Could not reach the AI service. Check your internet connection.', 'network');
  }
  if (err instanceof Anthropic.NotFoundError) {
    return new AIError('That model name was not found. Check the model in Settings.', 'api');
  }
  if (err instanceof Anthropic.APIError) {
    return new AIError(`The AI service returned an error (${err.status ?? 'unknown'}).`, 'api');
  }
  return new AIError('Something went wrong talking to the AI.', 'api');
}

/** Shared request options: server-side fallback if the model declines, explicit effort. */
const BASE_REQUEST = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
};

/** Longest AI output passed to the reviewer, so a runaway answer cannot crowd out the rubric. */
const MAX_OUTPUT_FOR_REVIEW = 8000;

function reviewInstructions(challenge: PromptChallenge, studentPrompt: string, output: string | null): string {
  const rubric = challenge.rubric.map((r) => `- ${r.name}: ${r.description}`).join('\n');
  const shownOutput =
    output === null
      ? '(The prompt could not be run, so judge the prompt on its own.)'
      : output.length > MAX_OUTPUT_FOR_REVIEW
        ? `${output.slice(0, MAX_OUTPUT_FOR_REVIEW)}\n[output truncated]`
        : output;
  return [
    'You are a supportive prompt-engineering coach reviewing work by a high school student.',
    'The student wrote a prompt for the scenario below. That prompt was then sent to an AI model, and its actual output is included.',
    'Do not carry out the prompt yourself. Review it.',
    '',
    `Scenario the student was given:\n${challenge.scenario}`,
    '',
    `Rubric criteria:\n${rubric}`,
    '',
    'Instructions:',
    '- Judge each rubric criterion against the student\'s prompt, in the same order and with the same names. For each, say whether it is met and give one short, specific sentence of feedback.',
    '- Give a score from 0 to 100 that reflects the rubric. A prompt that meets every criterion should score at least 90.',
    '- Write a summary of 2 or 3 sentences addressed to the student: one real strength, the single most important fix, and how the AI output shows the effect of their wording (for example, output that guessed at an audience because none was given).',
    '- Write an improved version of the student\'s prompt that keeps their intent and meets every criterion.',
    '- If the prompt includes personal information such as a real email address, phone number or home address, say so in the summary and replace it with a placeholder in the improved prompt.',
    '',
    '<student_prompt>',
    studentPrompt,
    '</student_prompt>',
    '',
    '<ai_output>',
    shownOutput,
    '</ai_output>',
  ].join('\n');
}

export type ReviewStep = 'running' | 'reviewing';

/**
 * The AI coach: runs the student's prompt to see what it actually produces, then reviews
 * the prompt and that output against the rubric. Two calls with fixed cost, so the wait
 * and spend stay predictable for a classroom.
 */
export async function reviewPromptWithAI(
  config: AIConfig,
  challenge: PromptChallenge,
  studentPrompt: string,
  onStep?: (step: ReviewStep) => void,
): Promise<AIPromptReview & { output: string | null }> {
  onStep?.('running');
  let output: string | null = null;
  try {
    output = await runPromptWithAI(config, studentPrompt);
  } catch (err) {
    // A declined or failed run still gets a review of the prompt itself; other errors stop here.
    if (!(err instanceof AIError) || (err.kind !== 'refusal' && err.kind !== 'bad_response')) throw err;
  }
  onStep?.('reviewing');
  try {
    const [{ api }, { promptReviewFormat }] = await Promise.all([client(config), schemas()]);
    const response = await api.beta.messages.parse({
      ...BASE_REQUEST,
      model: config.model.trim() || DEFAULT_MODEL,
      max_tokens: 4000,
      output_config: { effort: 'medium', format: promptReviewFormat },
      messages: [{ role: 'user', content: reviewInstructions(challenge, studentPrompt, output) }],
    });
    if (response.stop_reason === 'refusal') throw new AIError('The AI coach declined to review this prompt.', 'refusal');
    const parsed = response.parsed_output;
    if (!parsed) throw new AIError('The AI coach response could not be read.', 'bad_response');
    return { ...parsed, score: Math.max(0, Math.min(100, Math.round(parsed.score))), output };
  } catch (err) {
    throw await toAIError(err);
  }
}

export async function runPromptWithAI(config: AIConfig, studentPrompt: string): Promise<string> {
  try {
    const { api } = await client(config);
    const response = await api.beta.messages.create({
      ...BASE_REQUEST,
      model: config.model.trim() || DEFAULT_MODEL,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system:
        'You are a helpful assistant used in a high school classroom to show students how prompt wording changes AI output. Keep responses appropriate for students.',
      messages: [{ role: 'user', content: studentPrompt }],
    });
    if (response.stop_reason === 'refusal') throw new AIError('The AI declined to answer this prompt.', 'refusal');
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new AIError('The AI returned an empty response.', 'bad_response');
    return text;
  } catch (err) {
    throw await toAIError(err);
  }
}

export async function checkAnswerWithAI(
  config: AIConfig,
  question: string,
  expected: string,
  accepted: string[],
  studentAnswer: string,
): Promise<AIAnswerCheck> {
  try {
    const [{ api }, { answerCheckFormat }] = await Promise.all([client(config), schemas()]);
    const instructions = [
      'You are checking a high school student\'s short typed answer to a study question about AI.',
      'Decide whether the student\'s answer means the same thing as the expected answer. Accept synonyms, small spelling mistakes and different wording with the same meaning.',
      'Do NOT accept a different concept, even if it is related (for example, precision is not recall, and overfitting is not underfitting).',
      'Give one short sentence of feedback addressed to the student.',
      '',
      `Question: ${question}`,
      `Expected answer: ${expected}`,
      accepted.length ? `Also accepted: ${accepted.join('; ')}` : '',
      '',
      '<student_answer>',
      studentAnswer,
      '</student_answer>',
    ].join('\n');
    const response = await api.beta.messages.parse({
      ...BASE_REQUEST,
      model: config.model.trim() || DEFAULT_MODEL,
      max_tokens: 1000,
      output_config: { effort: 'low', format: answerCheckFormat },
      messages: [{ role: 'user', content: instructions }],
    });
    if (response.stop_reason === 'refusal') throw new AIError('The AI declined to check this answer.', 'refusal');
    if (!response.parsed_output) throw new AIError('The AI response could not be read.', 'bad_response');
    return response.parsed_output;
  } catch (err) {
    throw await toAIError(err);
  }
}
