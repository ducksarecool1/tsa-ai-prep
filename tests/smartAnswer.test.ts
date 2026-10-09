import { describe, expect, it } from 'vitest';
import { gradeWritten, makeHint, type WrittenSpec } from '../src/lib/smartAnswer';

const underfitting: WrittenSpec = {
  answer: 'underfitting',
  acceptedAnswers: ['underfit', 'under-fitting'],
  confusableWith: ['overfitting'],
};

const overfitting: WrittenSpec = {
  answer: 'overfitting',
  acceptedAnswers: ['overfit'],
  confusableWith: ['underfitting'],
};

const recall: WrittenSpec = { answer: 'recall', acceptedAnswers: ['sensitivity'], confusableWith: ['precision'] };
const precision: WrittenSpec = { answer: 'precision', confusableWith: ['recall'] };

describe('exact and normalized matches', () => {
  it('accepts the answer with different case, spacing and punctuation', () => {
    expect(gradeWritten('  Underfitting. ', underfitting).verdict).toBe('correct');
    expect(gradeWritten('UNDER-FITTING', underfitting).verdict).toBe('correct');
  });

  it('accepts any listed accepted answer', () => {
    expect(gradeWritten('underfit', underfitting).verdict).toBe('correct');
    expect(gradeWritten('sensitivity', recall).verdict).toBe('correct');
  });

  it('ignores a leading article', () => {
    expect(gradeWritten('the recall', recall).verdict).toBe('correct');
  });

  it('treats an empty answer as incorrect', () => {
    expect(gradeWritten('   ', recall)).toMatchObject({ verdict: 'incorrect', reason: 'empty' });
  });
});

describe('abbreviations', () => {
  it('accepts ML for machine learning and the reverse', () => {
    expect(gradeWritten('ML', { answer: 'machine learning' }).verdict).toBe('correct');
    expect(gradeWritten('machine learning', { answer: 'ML' }).verdict).toBe('correct');
  });

  it('accepts NN and LLM', () => {
    expect(gradeWritten('NN', { answer: 'neural network' }).verdict).toBe('correct');
    expect(gradeWritten('an LLM', { answer: 'large language model' }).verdict).toBe('correct');
  });
});

describe('typo tolerance', () => {
  it('accepts a small typo at or above the 0.85 similarity threshold', () => {
    expect(gradeWritten('underfiting', underfitting)).toMatchObject({ verdict: 'correct', reason: 'typo' });
    expect(gradeWritten('backpropogation', { answer: 'backpropagation' }).verdict).toBe('correct');
  });

  it('accepts a missing space or hyphen', () => {
    expect(gradeWritten('finetuning', { answer: 'fine-tuning' }).verdict).toBe('correct');
  });

  it('does not accept short answers with a wrong letter', () => {
    // 1 edit in 6 letters is below 0.85 similarity.
    expect(gradeWritten('recalk', recall).verdict).not.toBe('correct');
  });
});

describe('confusableWith blocking', () => {
  it('never accepts overfitting for underfitting', () => {
    expect(gradeWritten('overfitting', underfitting)).toMatchObject({
      verdict: 'incorrect',
      reason: 'confusable',
      confusedWith: 'overfitting',
    });
  });

  it('never accepts underfitting for overfitting', () => {
    expect(gradeWritten('underfitting', overfitting).verdict).toBe('incorrect');
  });

  it('blocks a typo of the confusable term too', () => {
    expect(gradeWritten('overfiting', underfitting)).toMatchObject({ verdict: 'incorrect', reason: 'confusable' });
  });

  it('never accepts precision for recall or recall for precision', () => {
    expect(gradeWritten('precision', recall).verdict).toBe('incorrect');
    expect(gradeWritten('recall', precision).verdict).toBe('incorrect');
  });

  it('blocks a near-miss that is a different known glossary term', () => {
    const spec: WrittenSpec = { answer: 'supervised learning', acceptedAnswers: ['supervised'] };
    // 0.905 similarity: would pass the typo threshold if it were not a known term.
    const knownTerms = ['supervised learning', 'unsupervised learning', 'unsupervised'];
    expect(gradeWritten('unsupervised learning', spec, { knownTerms }).verdict).toBe('incorrect');
    expect(gradeWritten('unsupervised', spec, { knownTerms }).verdict).toBe('incorrect');
    expect(gradeWritten('supervised learning', spec, { knownTerms }).verdict).toBe('correct');
  });

  it('does not block an accepted answer that also appears in the known terms', () => {
    const spec: WrittenSpec = { answer: 'transformer architecture', acceptedAnswers: ['transformer'] };
    expect(gradeWritten('transformer', spec, { knownTerms: ['transformer'] }).verdict).toBe('correct');
  });

  it('keeps generative AI and general AI apart', () => {
    const spec: WrittenSpec = { answer: 'generative AI' };
    expect(gradeWritten('general AI', spec, { knownTerms: ['general AI'] }).verdict).toBe('incorrect');
  });
});

describe('numbers', () => {
  it('requires numeric answers to match exactly', () => {
    const year: WrittenSpec = { answer: '1950' };
    expect(gradeWritten('1950', year).verdict).toBe('correct');
    expect(gradeWritten('1956', year).verdict).toBe('incorrect');
    expect(gradeWritten('1905', year).verdict).toBe('incorrect');
  });

  it('accepts percentages with or without the sign', () => {
    expect(gradeWritten('90', { answer: '90%' }).verdict).toBe('correct');
  });
});

describe('order-insensitive multi-part answers', () => {
  const types: WrittenSpec = {
    answer: 'supervised, unsupervised, reinforcement',
    acceptedAnswers: ['supervised learning, unsupervised learning, reinforcement learning'],
    orderInsensitive: true,
  };

  it('accepts the parts in any order', () => {
    expect(gradeWritten('reinforcement, supervised, unsupervised', types)).toMatchObject({
      verdict: 'correct',
      reason: 'reordered',
    });
  });

  it('accepts "and" as a separator', () => {
    expect(gradeWritten('unsupervised, reinforcement and supervised', types).verdict).toBe('correct');
  });

  it('accepts a small typo inside one part', () => {
    expect(gradeWritten('reinforcment, supervised, unsupervised', types).verdict).toBe('correct');
  });

  it('rejects a list with a repeated part', () => {
    expect(gradeWritten('supervised, supervised, reinforcement', types).verdict).not.toBe('correct');
  });

  it('does not reorder when the item is not marked orderInsensitive', () => {
    const ordered: WrittenSpec = { answer: 'input, hidden, output' };
    expect(gradeWritten('output, hidden, input', ordered).verdict).not.toBe('correct');
  });
});

describe('almost', () => {
  it('marks an answer that contains the key term as almost', () => {
    expect(gradeWritten('the model is overfitting', overfitting)).toMatchObject({ verdict: 'almost', reason: 'partial' });
  });

  it('does not mark a negated answer as almost', () => {
    expect(gradeWritten('not overfitting', overfitting).verdict).toBe('incorrect');
  });

  it('marks a close but not acceptable spelling as almost', () => {
    expect(gradeWritten('hallucnatn', { answer: 'hallucination' }).verdict).toBe('almost');
  });

  it('marks a clearly different answer as incorrect', () => {
    expect(gradeWritten('gradient descent', overfitting).verdict).toBe('incorrect');
  });
});

describe('makeHint', () => {
  it('shows the first letter and letter count', () => {
    expect(makeHint('recall')).toBe('r_____ (6 letters)');
    expect(makeHint('context window')).toBe('c______ w_____ (7 + 6 letters)');
  });
});
