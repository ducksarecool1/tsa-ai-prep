import { describe, expect, it } from 'vitest';
import { loadContentFromDisk } from '../scripts/loadContent';
import { buildStudyItems, cardForItem, unitItemIds } from '../src/lib/items';
import { PASS_SCORE, offlineReview, reviewPrompt } from '../src/lib/promptReview';
import { seededRng } from '../src/lib/random';
import type { IncludeKey } from '../src/types';

const content = loadContentFromDisk();
const none: Record<IncludeKey, boolean> = { mc: false, tf: false, written: false, matching: false, scenario: false, ordering: false, term: false, prompt: false };

describe('prompt practice in Learn Mode', () => {
  it('adds every challenge and Spot the Problem item to Unit 7 when prompt practice is on', () => {
    const items = buildStudyItems(content, ['u7'], { ...none, prompt: true });
    expect(items.filter((i) => i.kind === 'challenge')).toHaveLength(content.challenges.length);
    expect(items.filter((i) => i.kind === 'spot')).toHaveLength(content.spotProblems.length);
    expect(items.every((i) => i.unitId === 'u7')).toBe(true);
  });

  it('leaves prompt practice out when the toggle is off or Unit 7 is not selected', () => {
    expect(buildStudyItems(content, ['u7'], { ...none, mc: true }).some((i) => i.kind === 'challenge')).toBe(false);
    expect(buildStudyItems(content, ['u1'], { ...none, prompt: true })).toHaveLength(0);
  });

  it('counts practice items toward Unit 7 mastery', () => {
    const u7 = content.units.find((u) => u.id === 'u7')!;
    const ids = unitItemIds(content, u7);
    expect(ids).toContain(content.challenges[0].id);
    expect(ids).toContain(content.spotProblems[0].id);
  });

  it('shows a challenge as a prompt-writing card and a spot item as multiple choice with context', () => {
    const items = buildStudyItems(content, ['u7'], { ...none, prompt: true });
    const challenge = cardForItem(items.find((i) => i.kind === 'challenge')!, 'familiar', 'term', [], seededRng(1));
    expect(challenge.presentation.format).toBe('prompt');
    const spot = cardForItem(items.find((i) => i.kind === 'spot')!, 'new', 'term', [], seededRng(1));
    expect(spot.presentation.format).toBe('choice');
    expect(spot.context?.map((c) => c.label)).toEqual(['The prompt', "The AI's output"]);
  });
});

describe('prompt review', () => {
  it('passes every strong example and fails every weak prompt offline', () => {
    for (const c of content.challenges) {
      expect(offlineReview(c, c.strongExample).score, c.id).toBeGreaterThanOrEqual(PASS_SCORE);
      if (c.weakPrompt) expect(offlineReview(c, c.weakPrompt).score, c.id).toBeLessThan(PASS_SCORE);
    }
  });

  it('gives one criterion row per rubric item, with a suggestion for each miss', () => {
    const c = content.challenges[0];
    const r = offlineReview(c, c.weakPrompt ?? '');
    expect(r.criteria).toHaveLength(c.rubric.length);
    for (const row of r.criteria.filter((x) => !x.met)) {
      expect(c.rubric.some((k) => k.suggestion === row.feedback)).toBe(true);
    }
    expect(r.summary).toMatch(/most useful next step/);
  });

  it('uses the offline checklist when the local AI is turned off', async () => {
    const c = content.challenges[0];
    const r = await reviewPrompt({ enabled: false, baseUrl: 'http://localhost:11434', model: 'llama3.2' }, c, c.strongExample);
    expect(r.source).toBe('offline');
    expect(r.score).toBe(100);
  });
});
