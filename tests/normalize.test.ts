import { describe, expect, it } from 'vitest';
import { canonical, compact, expandAbbreviations, normalize } from '../src/lib/normalize';
import { levenshtein, similarity } from '../src/lib/levenshtein';

describe('normalize', () => {
  it('lowercases and trims', () => {
    expect(normalize('  Machine Learning  ')).toBe('machine learning');
  });

  it('collapses internal whitespace', () => {
    expect(normalize('neural    network\t\nmodel')).toBe('neural network model');
  });

  it('strips punctuation, turning hyphens into spaces', () => {
    expect(normalize('fine-tuning!')).toBe('fine tuning');
    expect(normalize('"Overfitting."')).toBe('overfitting');
  });

  it('drops apostrophes instead of splitting words', () => {
    expect(normalize("it's")).toBe('its');
  });

  it('removes one leading article', () => {
    expect(normalize('The transformer')).toBe('transformer');
    expect(normalize('a neural network')).toBe('neural network');
    expect(normalize('An algorithm')).toBe('algorithm');
  });

  it('does not strip articles from the middle or from words that start with them', () => {
    expect(normalize('theory of the mind')).toBe('theory of the mind');
    expect(normalize('another model')).toBe('another model');
  });

  it('removes accents', () => {
    expect(normalize('résumé')).toBe('resume');
  });
});

describe('abbreviation expansion', () => {
  it('expands common AI abbreviations token by token', () => {
    expect(expandAbbreviations('ml')).toBe('machine learning');
    expect(expandAbbreviations('nn')).toBe('neural network');
    expect(expandAbbreviations('llm')).toBe('large language model');
  });

  it('canonical() normalizes and expands together', () => {
    expect(canonical('The LLM')).toBe('large language model');
    expect(canonical('ML!')).toBe('machine learning');
  });

  it('compact() removes spaces', () => {
    expect(compact('fine tuning')).toBe('finetuning');
  });
});

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });

  it('similarity is 1 for identical strings and drops with edits', () => {
    expect(similarity('recall', 'recall')).toBe(1);
    expect(similarity('overfitting', 'overfiting')).toBeCloseTo(1 - 1 / 11);
  });
});
