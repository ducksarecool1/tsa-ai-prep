// Optional AI features through a local Ollama server (https://ollama.com):
// the Prompt Practice coach, "Ask the AI to check my answer", and running a student's prompt.
// Everything stays on the student's computer: no API key, no cloud service.
// Callers fall back to offline grading when anything fails.
import type { PromptChallenge } from '../types';
import { DEFAULT_MODEL, DEFAULT_OLLAMA_URL } from './storage';
import { checkCriterion } from './promptGrader';

/** Local models can be slow on laptops without a GPU, so allow plenty of time. */
export const AI_TIMEOUT_MS = 120_000;

export class AIError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'model' | 'timeout' | 'bad_response' | 'api',
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface AIConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
}

export function aiEnabled(config: AIConfig): boolean {
  return config.enabled && config.baseUrl.trim().length > 0;
}

function baseUrl(config: Pick<AIConfig, 'baseUrl'>): string {
  return (config.baseUrl.trim() || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
}

function modelName(config: AIConfig): string {
  return config.model.trim() || DEFAULT_MODEL;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function request(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('The local AI took too long to respond. Try a smaller model.', 'timeout');
    }
    // A TypeError here means the request never got an answer: Ollama is not running, or it
    // blocked this website (see OLLAMA_ORIGINS in Settings).
    throw new AIError(`Could not reach Ollama at ${new URL(url).origin}. Check that it is running and allows this site.`, 'network');
  } finally {
    clearTimeout(timer);
  }
}

/** Sends a chat request to Ollama and returns the reply text. `format` is a JSON schema for structured output. */
async function chat(
  config: AIConfig,
  messages: ChatMessage[],
  opts: { format?: object; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const model = modelName(config);
  const send = (think: boolean) =>
    request(
      `${baseUrl(config)}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          // Reasoning models think before answering by default, which can take many times longer
          // on a laptop. These tasks are short, so thinking is turned off for speed.
          ...(think ? {} : { think: false }),
          ...(opts.format ? { format: opts.format } : {}),
          options: { temperature: opts.temperature ?? 0.2, num_predict: opts.maxTokens ?? 1024 },
        }),
      },
      AI_TIMEOUT_MS,
    );
  let res = await send(false);
  let errorText = res.ok ? '' : await res.text().catch(() => '');
  // A model or Ollama version that rejects the thinking switch gets the request without it.
  if (res.status === 400 && /think/i.test(errorText)) {
    res = await send(true);
    errorText = res.ok ? '' : await res.text().catch(() => '');
  }
  if (!res.ok) {
    if (res.status === 404 && /not found/i.test(errorText)) {
      throw new AIError(`The model "${model}" is not installed. Run: ollama pull ${model}`, 'model');
    }
    throw new AIError(`Ollama returned an error (${res.status}).`, 'api');
  }
  const data = (await res.json().catch(() => null)) as { message?: { content?: unknown } } | null;
  const raw = data?.message?.content;
  // Older Ollama versions put a model's reasoning inline in <think> tags.
  const content = typeof raw === 'string' ? raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim() : '';
  if (!content) throw new AIError('The local AI returned an empty response.', 'bad_response');
  return content;
}

/** Installed model names, for the Settings dropdown and the connection check. */
export async function listModels(config: Pick<AIConfig, 'baseUrl'>): Promise<string[]> {
  const res = await request(`${baseUrl(config)}/api/tags`, { method: 'GET' }, 10_000);
  if (!res.ok) throw new AIError(`Ollama returned an error (${res.status}).`, 'api');
  const data = (await res.json().catch(() => null)) as { models?: { name?: unknown }[] } | null;
  return (
    (data?.models ?? [])
      .map((m) => m.name)
      .filter((n): n is string => typeof n === 'string')
      // Embedding models (such as nomic-embed-text) can't chat, so leave them out.
      .filter((n) => !/embed/i.test(n))
      .sort()
  );
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some models wrap JSON in prose or code fences; take the outermost object.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // Fall through.
      }
    }
    throw new AIError('The local AI response could not be read.', 'bad_response');
  }
}

// ---------- Running a student's prompt ----------

export async function runPromptWithAI(config: AIConfig, studentPrompt: string): Promise<string> {
  return chat(
    config,
    [
      {
        role: 'system',
        content:
          'You are a helpful assistant used in a high school classroom to show students how prompt wording changes AI output. Keep responses appropriate for students.',
      },
      { role: 'user', content: studentPrompt },
    ],
    { temperature: 0.7, maxTokens: 900 },
  );
}

// ---------- Prompt Practice coach ----------

export interface AIPromptReview {
  score: number;
  criteria: { name: string; met: boolean; feedback: string }[];
  summary: string;
  improvedPrompt: string;
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' }, feedback: { type: 'string' } },
        required: ['name', 'met', 'evidence', 'feedback'],
      },
    },
    summary: { type: 'string' },
    improvedPrompt: { type: 'string' },
  },
  required: ['criteria', 'summary', 'improvedPrompt'],
};

/** Longest AI output passed to the reviewer, so a runaway answer cannot crowd out the rubric. */
const MAX_OUTPUT_FOR_REVIEW = 6000;

function reviewInstructions(challenge: PromptChallenge, studentPrompt: string, output: string | null): string {
  const rubric = challenge.rubric.map((r, i) => `${i + 1}. ${r.name}: ${r.description}`).join('\n');
  const shownOutput =
    output === null
      ? '(The prompt could not be run, so judge the prompt on its own.)'
      : output.length > MAX_OUTPUT_FOR_REVIEW
        ? `${output.slice(0, MAX_OUTPUT_FOR_REVIEW)}\n[output truncated]`
        : output;
  return [
    'You are a supportive prompt-engineering coach reviewing work by a high school student.',
    'The student wrote a prompt for the scenario below. The prompt was sent to an AI model, and its actual output is included.',
    'Do not carry out the prompt yourself. Review it.',
    '',
    `Scenario:\n${challenge.scenario}`,
    '',
    `Rubric (judge each item against the student's prompt):\n${rubric}`,
    '',
    'Reply with JSON only:',
    `- "criteria": exactly ${challenge.rubric.length} items, in the rubric order, each with "name" (copied from the rubric), "met" (true or false), "evidence" and "feedback" (one short, specific sentence).`,
    '- "evidence": copy the exact words from the student\'s prompt that meet the item. Be strict: if the prompt does not explicitly contain it, use "" and set "met" to false. Do not count things the AI output did on its own.',
    '- "summary": 2 or 3 sentences to the student: one real strength, the most important fix, and how the AI output shows the effect of their wording.',
    '- "improvedPrompt": a better version of the student\'s prompt that keeps their intent and meets every rubric item. Replace any real personal details (email, phone, address) with placeholders.',
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

const squash = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** True when the model's quoted evidence really appears in the student's prompt. */
export function evidenceInPrompt(evidence: unknown, prompt: string): boolean {
  if (typeof evidence !== 'string') return false;
  const e = squash(evidence).replace(/^[.,;:!?\s]+|[.,;:!?\s]+$/g, '');
  return e.length >= 2 && squash(prompt).includes(e);
}

/**
 * Checks the model's JSON and lines its judgments up with the rubric, in order.
 * Small local models sometimes call an item met when it isn't, so a "met" only counts when
 * the model quotes words that really are in the student's prompt. Personal data is checked
 * by the offline detector, which is deterministic.
 */
export function normalizeReview(raw: unknown, challenge: PromptChallenge, studentPrompt: string): AIPromptReview {
  const r = raw as { criteria?: unknown; summary?: unknown; improvedPrompt?: unknown } | null;
  if (!r || !Array.isArray(r.criteria) || typeof r.summary !== 'string') {
    throw new AIError('The local AI response was incomplete.', 'bad_response');
  }
  const items = r.criteria as { met?: unknown; evidence?: unknown; feedback?: unknown }[];
  if (items.length < challenge.rubric.length) throw new AIError('The local AI skipped part of the checklist.', 'bad_response');
  const criteria = challenge.rubric.map((rule, i) => {
    const item = items[i] ?? {};
    const modelFeedback = typeof item.feedback === 'string' && item.feedback.trim() ? item.feedback.trim() : '';
    if (rule.check === 'noPersonalData') {
      const met = checkCriterion(studentPrompt, rule);
      return { name: rule.name, met, feedback: met ? rule.description : rule.suggestion };
    }
    const claimed = item.met === true;
    const met = claimed && evidenceInPrompt(item.evidence, studentPrompt);
    // When a claimed "met" has no real evidence, give the checklist's concrete advice instead.
    const feedback = claimed && !met ? rule.suggestion : modelFeedback || (met ? rule.description : rule.suggestion);
    return { name: rule.name, met, feedback };
  });
  // The score comes from the checklist judgments, which small local models make more
  // consistently than a free-form number.
  const score = Math.round((criteria.filter((c) => c.met).length / criteria.length) * 100);
  return {
    score,
    criteria,
    summary: r.summary.trim(),
    improvedPrompt: typeof r.improvedPrompt === 'string' ? r.improvedPrompt.trim() : '',
  };
}

export type ReviewStep = 'running' | 'reviewing';

/**
 * The AI coach: runs the student's prompt to see what it actually produces, then reviews
 * the prompt and that output against the rubric. Two local calls with a fixed shape.
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
    // An empty run still gets a review of the prompt itself; connection problems stop here.
    if (!(err instanceof AIError) || err.kind !== 'bad_response') throw err;
  }
  onStep?.('reviewing');
  const text = await chat(config, [{ role: 'user', content: reviewInstructions(challenge, studentPrompt, output) }], {
    format: REVIEW_SCHEMA,
    temperature: 0.1,
    maxTokens: 1200,
  });
  return { ...normalizeReview(parseJson(text), challenge, studentPrompt), output };
}

// ---------- Checking a typed answer ----------

export interface AIAnswerCheck {
  correct: boolean;
  feedback: string;
}

const ANSWER_SCHEMA = {
  type: 'object',
  properties: { correct: { type: 'boolean' }, feedback: { type: 'string' } },
  required: ['correct', 'feedback'],
};

export async function checkAnswerWithAI(
  config: AIConfig,
  question: string,
  expected: string,
  accepted: string[],
  studentAnswer: string,
): Promise<AIAnswerCheck> {
  const instructions = [
    'You are checking a high school student\'s short typed answer to a study question about AI.',
    'Decide whether the student\'s answer means the same thing as the expected answer. Accept synonyms, small spelling mistakes and different wording with the same meaning.',
    'Do NOT accept a different concept, even if it is related (for example, precision is not recall, and overfitting is not underfitting).',
    'Reply with JSON only: "correct" (true or false) and "feedback" (one short sentence to the student).',
    '',
    `Question: ${question}`,
    `Expected answer: ${expected}`,
    accepted.length ? `Also accepted: ${accepted.join('; ')}` : '',
    '',
    '<student_answer>',
    studentAnswer,
    '</student_answer>',
  ].join('\n');
  const text = await chat(config, [{ role: 'user', content: instructions }], { format: ANSWER_SCHEMA, temperature: 0, maxTokens: 200 });
  const r = parseJson(text) as { correct?: unknown; feedback?: unknown };
  if (typeof r?.correct !== 'boolean') throw new AIError('The local AI response could not be read.', 'bad_response');
  return { correct: r.correct, feedback: typeof r.feedback === 'string' ? r.feedback : '' };
}
