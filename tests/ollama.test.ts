import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadContentFromDisk } from '../scripts/loadContent';
import { AIError, checkAnswerWithAI, evidenceInPrompt, listModels, normalizeReview, reviewPromptWithAI } from '../src/lib/ai';
import { reviewPrompt } from '../src/lib/promptReview';

const content = loadContentFromDisk();
const challenge = content.challenges[0];
const config = { enabled: true, baseUrl: 'http://localhost:11434/', model: 'llama3.2' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('Ollama client', () => {
  it('lists installed models from /api/tags', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ models: [{ name: 'qwen2.5:7b' }, { name: 'llama3.2:latest' }] }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await listModels(config)).toEqual(['llama3.2:latest', 'qwen2.5:7b']);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/tags');
  });

  it('leaves embedding-only models out of the list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ models: [{ name: 'nomic-embed-text:latest' }, { name: 'qwen3.5:4b' }] })));
    expect(await listModels(config)).toEqual(['qwen3.5:4b']);
  });

  it('turns thinking off, and retries without the switch if a model rejects it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{"error":"\\"llama2\\" does not support thinking"}', { status: 400 }))
      .mockResolvedValueOnce(json({ message: { content: '{"correct": true, "feedback": "Yes."}' } }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await checkAnswerWithAI(config, 'q', 'a', [], 'a')).toEqual({ correct: true, feedback: 'Yes.' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).think).toBe(false);
    expect('think' in JSON.parse(fetchMock.mock.calls[1][1].body)).toBe(false);
  });

  it('strips inline <think> reasoning from replies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: { content: '<think>hmm</think>{"correct": false, "feedback": "No."}' } })));
    expect(await checkAnswerWithAI(config, 'q', 'a', [], 'b')).toEqual({ correct: false, feedback: 'No.' });
  });

  it('reports an unreachable server as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(listModels(config)).rejects.toMatchObject({ kind: 'network' });
  });

  it('tells the student to pull a missing model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"error":"model \\"llama3.2\\" not found, try pulling it first"}', { status: 404 })));
    const err = await checkAnswerWithAI(config, 'q', 'a', [], 'b').catch((e) => e);
    expect(err).toBeInstanceOf(AIError);
    expect(err.kind).toBe('model');
    expect(err.message).toContain('ollama pull llama3.2');
  });

  it('runs the prompt, then reviews it with a JSON schema, and scores from the checklist', async () => {
    const judgments = challenge.rubric.map((r, i) => ({ name: r.name, met: i !== 0, evidence: i !== 0 ? 'make a quiz' : '', feedback: `Feedback ${i}` }));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ message: { role: 'assistant', content: '1. What do plants need?' } }))
      .mockResolvedValueOnce(json({ message: { role: 'assistant', content: JSON.stringify({ criteria: judgments, summary: 'Good start.', improvedPrompt: 'Better prompt' }) } }));
    vi.stubGlobal('fetch', fetchMock);
    const steps: string[] = [];
    const review = await reviewPromptWithAI(config, challenge, 'Make a quiz', (s) => steps.push(s));
    expect(steps).toEqual(['running', 'reviewing']);
    expect(review.output).toBe('1. What do plants need?');
    expect(review.score).toBe(Math.round(((challenge.rubric.length - 1) / challenge.rubric.length) * 100));
    expect(review.criteria[0]).toMatchObject({ name: challenge.rubric[0].name, met: false });
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toMatchObject({ model: 'llama3.2', stream: false });
    expect(body.format.required).toContain('criteria');
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:11434/api/chat');
  });

  it('falls back to the offline checklist when Ollama is not running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const r = await reviewPrompt(config, challenge, challenge.strongExample);
    expect(r.source).toBe('offline');
    expect(r.score).toBe(100);
    expect(r.notice).toMatch(/Could not reach Ollama/);
  });
});

describe('normalizeReview', () => {
  const prompt = 'Write a quiz about photosynthesis for my science class with 5 questions.';

  it('rejects a review that skips checklist items', () => {
    expect(() => normalizeReview({ criteria: [], summary: 'x', improvedPrompt: '' }, challenge, prompt)).toThrow(AIError);
  });

  it('uses rubric names and order even if the model renames them', () => {
    const criteria = challenge.rubric.map(() => ({ name: 'something else', met: true, evidence: 'photosynthesis', feedback: '' }));
    const r = normalizeReview({ criteria, summary: 'Great.', improvedPrompt: 'p' }, challenge, prompt);
    expect(r.criteria.map((c) => c.name)).toEqual(challenge.rubric.map((x) => x.name));
    expect(r.score).toBe(100);
    expect(r.criteria[0].feedback).toBe(challenge.rubric[0].description);
  });

  it('does not count a "met" whose quoted evidence is not in the prompt', () => {
    // The live failure: a small model claimed the format was met, but the prompt never asked for a list.
    const criteria = challenge.rubric.map((rule) => ({
      name: rule.name,
      met: true,
      evidence: rule.id === 'format' ? 'a numbered list with answers at the end' : rule.id === 'audience' ? '' : 'quiz',
      feedback: 'Looks good.',
    }));
    const r = normalizeReview({ criteria, summary: 'x', improvedPrompt: '' }, challenge, prompt);
    const format = r.criteria[challenge.rubric.findIndex((x) => x.id === 'format')];
    const audience = r.criteria[challenge.rubric.findIndex((x) => x.id === 'audience')];
    expect(format.met).toBe(false);
    expect(format.feedback).toBe(challenge.rubric.find((x) => x.id === 'format')!.suggestion);
    expect(audience.met).toBe(false);
    expect(r.score).toBe(60);
  });

  it('matches evidence regardless of case, quotes and spacing', () => {
    expect(evidenceInPrompt('"5  Questions."', prompt)).toBe(true);
    expect(evidenceInPrompt('', prompt)).toBe(false);
    expect(evidenceInPrompt('numbered list', prompt)).toBe(false);
  });

  it('checks personal data with the offline detector, not the model', () => {
    const c = content.challenges.find((x) => x.rubric.some((r) => r.check === 'noPersonalData'))!;
    const idx = c.rubric.findIndex((r) => r.check === 'noPersonalData');
    const criteria = c.rubric.map(() => ({ name: '', met: true, evidence: 'letter', feedback: '' }));
    const leaky = 'Write a letter. My email is sam@example.com';
    expect(normalizeReview({ criteria, summary: 'x', improvedPrompt: '' }, c, leaky).criteria[idx].met).toBe(false);
    const clean = 'Write a letter using [My name] as a placeholder.';
    expect(normalizeReview({ criteria, summary: 'x', improvedPrompt: '' }, c, clean).criteria[idx].met).toBe(true);
  });
});
