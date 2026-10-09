// Text normalization used by Smart Answers. Pure functions, no DOM access.

const LEADING_ARTICLE = /^(a|an|the) /;

/**
 * Lowercase, trim, strip punctuation and accents, collapse spaces,
 * and remove a leading "a", "an" or "the".
 */
export function normalize(input: string): string {
  let s = input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // Drop apostrophes so "it's" becomes "its" rather than "it s".
  s = s.replace(/['‘’`]/g, '');
  // Every other non-alphanumeric character (hyphens, quotes, commas...) becomes a space.
  s = s.replace(/[^a-z0-9\s]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(LEADING_ARTICLE, '');
  return s;
}

/** Common AI abbreviations, expanded token by token before comparing answers. */
export const ABBREVIATIONS: Record<string, string> = {
  ai: 'artificial intelligence',
  agi: 'artificial general intelligence',
  ml: 'machine learning',
  dl: 'deep learning',
  nn: 'neural network',
  nns: 'neural networks',
  ann: 'artificial neural network',
  cnn: 'convolutional neural network',
  cnns: 'convolutional neural networks',
  llm: 'large language model',
  llms: 'large language models',
  nlp: 'natural language processing',
  cv: 'computer vision',
  rl: 'reinforcement learning',
  rlhf: 'reinforcement learning from human feedback',
  gpu: 'graphics processing unit',
  gpus: 'graphics processing units',
  genai: 'generative artificial intelligence',
  gan: 'generative adversarial network',
  gans: 'generative adversarial networks',
  asr: 'automatic speech recognition',
  sgd: 'stochastic gradient descent',
};

export function expandAbbreviations(normalized: string): string {
  if (!normalized) return normalized;
  return normalized
    .split(' ')
    .map((tok) => ABBREVIATIONS[tok] ?? tok)
    .join(' ');
}

/** Normalize and expand abbreviations: the canonical form used for every comparison. */
export function canonical(input: string): string {
  return expandAbbreviations(normalize(input));
}

/** Canonical form with spaces removed, so "fine tuning" equals "finetuning". */
export function compact(canonicalText: string): string {
  return canonicalText.replace(/ /g, '');
}
