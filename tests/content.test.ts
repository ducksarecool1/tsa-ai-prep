import { describe, expect, it } from 'vitest';
import { loadContentFromDisk } from '../scripts/loadContent';
import { countSentences, validateContent, validateQuestion } from '../src/lib/validateContent';
import { checkCriterion, gradePrompt } from '../src/lib/promptGrader';
import { gradeWritten } from '../src/lib/smartAnswer';
import { knownTermNames } from '../src/lib/items';
import type { Question, RubricCriterion } from '../src/types';

const content = loadContentFromDisk();

describe('bundled content', () => {
  it('passes validation with no errors', () => {
    const report = validateContent(content);
    expect(report.errors).toEqual([]);
  });

  it('has 8 units with at least 25 questions each', () => {
    expect(content.units).toHaveLength(8);
    for (const u of content.units) expect(u.questions.length).toBeGreaterThanOrEqual(25);
  });

  it('has at least 15 prompt challenges whose strong examples score 100', () => {
    expect(content.challenges.length).toBeGreaterThanOrEqual(15);
    for (const c of content.challenges) expect(gradePrompt(c.strongExample, c.rubric).score).toBe(100);
  });

  it('grades every glossary term as correct for itself and never for a different term', () => {
    const known = knownTermNames(content.units);
    const terms = content.units.flatMap((u) => u.terms);
    for (const t of terms) {
      const spec = { answer: t.term, acceptedAnswers: t.acceptedAnswers, confusableWith: t.confusableWith };
      expect(gradeWritten(t.term, spec, { knownTerms: known }).verdict, t.term).toBe('correct');
      for (const other of terms) {
        if (other.id === t.id) continue;
        const accepted = [t.term, ...(t.acceptedAnswers ?? [])].map((s) => s.toLowerCase());
        if (accepted.includes(other.term.toLowerCase())) continue;
        expect(gradeWritten(other.term, spec, { knownTerms: known }).verdict, `${other.term} for ${t.term}`).not.toBe(
          'correct',
        );
      }
    }
  });
});

describe('validator catches broken content', () => {
  const base: Question = {
    id: 'x1',
    unitId: 'u1',
    type: 'mc',
    prompt: 'Which is right?',
    options: ['A', 'B', 'C', 'D'],
    answer: 'A',
    explanation: 'A is right.',
    difficulty: 1,
    tags: [],
  };

  it('accepts a valid question', () => {
    expect(validateQuestion(base)).toEqual([]);
  });

  it('flags options that do not contain the answer', () => {
    expect(validateQuestion({ ...base, answer: 'Z' }).join()).toMatch(/do not contain the answer/);
  });

  it('flags a missing explanation', () => {
    expect(validateQuestion({ ...base, explanation: '' }).join()).toMatch(/missing explanation/);
  });

  it('flags explanations longer than 3 sentences', () => {
    expect(validateQuestion({ ...base, explanation: 'One. Two. Three. Four.' }).join()).toMatch(/max 3/);
  });

  it('flags the wrong number of options', () => {
    expect(validateQuestion({ ...base, options: ['A', 'B', 'C'] }).join()).toMatch(/exactly 4 options/);
  });

  it('flags a confusable term that would be graded correct', () => {
    const q: Question = {
      ...base,
      id: 'x2',
      type: 'written',
      answer: 'overfitting',
      acceptedAnswers: ['underfitting'],
      confusableWith: ['underfitting'],
      options: undefined,
    };
    expect(validateQuestion(q).join()).toMatch(/confusable "underfitting" is graded correct/);
  });

  it('flags duplicate ids and too few questions', () => {
    const unit = content.units[0];
    const broken = {
      ...content,
      units: [{ ...unit, questions: [unit.questions[0], unit.questions[0]] }],
    };
    const errs = validateContent(broken).errors.join('\n');
    expect(errs).toMatch(/Duplicate id/);
    expect(errs).toMatch(/minimum 25/);
  });

  it('counts sentences without splitting on abbreviations or decimals', () => {
    expect(countSentences('Use e.g. ReLU. It scored 0.85 here.')).toBe(2);
    expect(countSentences('The U.S. Copyright Office said so.')).toBe(1);
  });
});

describe('offline prompt grader', () => {
  const crit = (check: RubricCriterion['check'], keywords?: string[]): RubricCriterion => ({
    id: check,
    name: check,
    description: '',
    check,
    keywords,
    suggestion: 'x',
  });

  it('detects audiences, formats and lengths', () => {
    expect(checkCriterion('Write it for 7th graders', crit('audience'))).toBe(true);
    expect(checkCriterion('Write it for a 5th grader', crit('audience'))).toBe(true);
    expect(checkCriterion('Write a story', crit('audience'))).toBe(false);
    expect(checkCriterion('Use a numbered list', crit('format'))).toBe(true);
    expect(checkCriterion('Keep it under 100 words', crit('length'))).toBe(true);
    expect(checkCriterion('Give me 5 questions', crit('length'))).toBe(true);
    expect(checkCriterion('Make it short', crit('length'))).toBe(false);
  });

  it('flags personal data', () => {
    expect(checkCriterion('Email me at sam@example.com', crit('noPersonalData'))).toBe(false);
    expect(checkCriterion('Call 555-201-7788', crit('noPersonalData'))).toBe(false);
    expect(checkCriterion('I live at 18 Maple Avenue', crit('noPersonalData'))).toBe(false);
    expect(checkCriterion('Use [My name] as a placeholder', crit('noPersonalData'))).toBe(true);
  });

  it('requires task keywords when given', () => {
    expect(checkCriterion('Write a quiz', crit('task', ['quiz']))).toBe(true);
    expect(checkCriterion('Write a poem', crit('task', ['quiz']))).toBe(false);
  });

  it('scores an empty prompt as 0', () => {
    expect(gradePrompt('   ', [crit('noPersonalData'), crit('task')]).score).toBe(0);
  });

  it('scores proportionally', () => {
    const g = gradePrompt('Write a quiz for 7th graders', [crit('task'), crit('audience'), crit('format'), crit('length')]);
    expect(g.score).toBe(50);
  });
});
