// Smart Answers: lenient but correct offline grading of typed answers.
import { canonical, compact } from './normalize';
import { similarity } from './levenshtein';

export const TYPO_THRESHOLD = 0.85;
export const ALMOST_THRESHOLD = 0.6;

export interface WrittenSpec {
  answer: string;
  acceptedAnswers?: string[];
  confusableWith?: string[];
  orderInsensitive?: boolean;
}

export type Verdict = 'correct' | 'almost' | 'incorrect';

export interface GradeResult {
  verdict: Verdict;
  reason: 'exact' | 'typo' | 'reordered' | 'confusable' | 'partial' | 'close' | 'empty' | 'wrong';
  /** The accepted answer the input matched or came closest to. */
  matched?: string;
  /** Set when the input is a different, known term. */
  confusedWith?: string;
}

export interface GradeOptions {
  /** Every glossary term. Any that is not an accepted answer is treated as confusable. */
  knownTerms?: string[];
}

const PART_SPLIT = /\s*(?:,|;|\/|&|\band\b|\+)\s*/i;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => v.length > 0)));
}

function equalCanon(a: string, b: string): boolean {
  return a === b || compact(a) === compact(b);
}

/** Keeps duplicates so "a, a, b" does not pass for "a, b, c". */
function splitParts(raw: string): string[] {
  return raw
    .split(PART_SPLIT)
    .map(canonical)
    .filter((p) => p.length > 0);
}

/** Highest similarity between `s` and any candidate, plus which candidate. */
function best(s: string, candidates: string[]): { score: number; value?: string } {
  let score = 0;
  let value: string | undefined;
  for (const c of candidates) {
    const sim = Math.max(similarity(s, c), similarity(compact(s), compact(c)));
    if (sim > score) {
      score = sim;
      value = c;
    }
  }
  return { score, value };
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/** Every part of the input matches a distinct part of `target` (exactly or with a small typo). */
function partsMatch(inputParts: string[], targetParts: string[], confusables: string[]): boolean {
  if (inputParts.length !== targetParts.length || inputParts.length < 2) return false;
  const remaining = [...targetParts];
  for (const part of inputParts) {
    let idx = remaining.findIndex((t) => equalCanon(part, t));
    if (idx === -1) {
      const conf = best(part, confusables).score;
      idx = remaining.findIndex((t) => {
        const sim = similarity(part, t);
        return sim >= TYPO_THRESHOLD && sim > conf;
      });
    }
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

export function gradeWritten(input: string, spec: WrittenSpec, options: GradeOptions = {}): GradeResult {
  const s = canonical(input);
  if (!s) return { verdict: 'incorrect', reason: 'empty' };

  const rawAccepted = unique([spec.answer, ...(spec.acceptedAnswers ?? [])]);
  const accepted = unique(rawAccepted.map(canonical));
  const confusables = unique(
    [...(spec.confusableWith ?? []), ...(options.knownTerms ?? [])].map(canonical),
  ).filter((c) => !accepted.some((a) => equalCanon(a, c)));

  // 1. Exact match after normalization and abbreviation expansion.
  const exact = accepted.find((a) => equalCanon(s, a));
  if (exact) return { verdict: 'correct', reason: 'exact', matched: exact };

  // 2. The input is exactly a different known term: never accept.
  const exactConf = confusables.find((c) => equalCanon(s, c));
  if (exactConf) return { verdict: 'incorrect', reason: 'confusable', confusedWith: exactConf };

  // Numbers (years, percentages) must match exactly: 1956 is not a typo of 1950.
  if (accepted.every((a) => /^[\d ]+$/.test(a))) {
    return { verdict: 'incorrect', reason: 'wrong', matched: accepted[0] };
  }

  // 3. Multi-part answers in any order.
  if (spec.orderInsensitive) {
    const inputParts = splitParts(input);
    for (const raw of rawAccepted) {
      if (partsMatch(inputParts, splitParts(raw), confusables)) {
        return { verdict: 'correct', reason: 'reordered', matched: canonical(raw) };
      }
    }
  }

  // 4. Typo tolerance, blocked when the input is at least as close to a confusable term.
  // Multi-part answers get typo tolerance per part (step 3) only: on the whole string,
  // one missing or repeated part can look like a small typo.
  const acc = best(s, accepted);
  const conf = best(s, confusables);
  if (conf.value && conf.score >= TYPO_THRESHOLD && conf.score >= acc.score) {
    return { verdict: 'incorrect', reason: 'confusable', confusedWith: conf.value };
  }
  if (!spec.orderInsensitive && acc.score >= TYPO_THRESHOLD && acc.score > conf.score) {
    return { verdict: 'correct', reason: 'typo', matched: acc.value };
  }

  // 5. Close but not accepted: offer one more try. A negated answer is never "almost".
  const hasNegation = /\b(not|no|never|isnt|doesnt|dont|cannot|cant)\b/.test(s);
  if (hasNegation) return { verdict: 'incorrect', reason: 'wrong', matched: acc.value };
  const containsAccepted = accepted.find((a) => containsPhrase(s, a));
  const containsConfusable = confusables.some((c) => containsPhrase(s, c));
  if (containsAccepted && !containsConfusable) {
    return { verdict: 'almost', reason: 'partial', matched: containsAccepted };
  }
  if (acc.score >= ALMOST_THRESHOLD && acc.score > conf.score) {
    return { verdict: 'almost', reason: 'close', matched: acc.value };
  }
  return { verdict: 'incorrect', reason: 'wrong', matched: acc.value };
}

/** A gentle hint built from the answer: first letter plus letter counts per word. */
export function makeHint(answer: string): string {
  const words = answer.trim().split(/\s+/);
  const pattern = words
    .map((w) => (w.length <= 1 ? w : w[0] + '_'.repeat(w.length - 1)))
    .join(' ');
  const counts = words.map((w) => w.length).join(' + ');
  return words.length > 1 ? `${pattern} (${counts} letters)` : `${pattern} (${answer.trim().length} letters)`;
}
