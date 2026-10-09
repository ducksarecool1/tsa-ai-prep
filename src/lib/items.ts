// Turns questions, glossary terms and prompt practice into study items, and decides how
// each item is shown at each mastery level (recognition first, then recall).
import type {
  AnswerWith,
  Content,
  IncludeKey,
  MasteryLevel,
  MatchPair,
  PromptChallenge,
  Question,
  SpotProblem,
  Term,
  Unit,
} from '../types';
import { shuffle, type Rng } from './random';
import type { WrittenSpec } from './smartAnswer';

/** Prompt practice belongs to the Prompt Engineering unit unless the content says otherwise. */
export const PRACTICE_UNIT_ID = 'u7';

export interface StudyItem {
  id: string;
  unitId: string;
  kind: 'question' | 'term' | 'challenge' | 'spot';
  question?: Question;
  term?: Term;
  challenge?: PromptChallenge;
  spot?: SpotProblem;
}

export type Presentation =
  | { format: 'choice'; prompt: string; options: string[]; answer: string }
  | { format: 'tf'; prompt: string; answer: boolean }
  | { format: 'written'; prompt: string; spec: WrittenSpec; hint?: string }
  | { format: 'matching'; prompt: string; pairs: MatchPair[] }
  | { format: 'ordering'; prompt: string; steps: string[] }
  | { format: 'prompt'; prompt: string; challenge: PromptChallenge };

export interface StudyCard {
  itemId: string;
  unitId: string;
  presentation: Presentation;
  explanation: string;
  /** Human-readable correct answer for feedback. */
  displayAnswer: string;
  /** Short label such as "Scenario" or "Term". */
  label: string;
  /** Extra material shown with the question, such as a prompt and the AI output it produced. */
  context?: { label: string; text: string }[];
}

export const practiceUnitId = (x: { unitId?: string }) => x.unitId ?? PRACTICE_UNIT_ID;

export const termItemId = (term: Term) => `term:${term.id}`;

export function allTerms(units: Unit[]): Term[] {
  return units.flatMap((u) => u.terms);
}

/** Every glossary term and its aliases. Smart Answers never accepts one of these for a different item. */
export function knownTermNames(units: Unit[]): string[] {
  return allTerms(units).flatMap((t) => [t.term, ...(t.acceptedAnswers ?? [])]);
}

/** Whether a question can be asked as a typed (recall) answer. */
export function isWrittenCapable(q: Question): boolean {
  if (q.type === 'written') return true;
  if (q.type === 'mc' || q.type === 'scenario') return Array.isArray(q.acceptedAnswers);
  return false;
}

export function buildStudyItems(content: Content, unitIds: string[], include: Record<IncludeKey, boolean>): StudyItem[] {
  const items: StudyItem[] = [];
  for (const unit of content.units) {
    if (!unitIds.includes(unit.id)) continue;
    for (const q of unit.questions) {
      if (include[q.type]) items.push({ id: q.id, unitId: unit.id, kind: 'question', question: q });
    }
    if (include.term) {
      for (const t of unit.terms) items.push({ id: termItemId(t), unitId: unit.id, kind: 'term', term: t });
    }
    if (include.prompt) {
      for (const c of content.challenges) {
        if (practiceUnitId(c) === unit.id) items.push({ id: c.id, unitId: unit.id, kind: 'challenge', challenge: c });
      }
      for (const s of content.spotProblems) {
        if (practiceUnitId(s) === unit.id) items.push({ id: s.id, unitId: unit.id, kind: 'spot', spot: s });
      }
    }
  }
  return items;
}

/** Every item id that counts toward a unit's mastery, including prompt practice. */
export function unitItemIds(content: Content, unit: Unit): string[] {
  return [
    ...unit.questions.map((q) => q.id),
    ...unit.terms.map(termItemId),
    ...content.challenges.filter((c) => practiceUnitId(c) === unit.id).map((c) => c.id),
    ...content.spotProblems.filter((s) => practiceUnitId(s) === unit.id).map((s) => s.id),
  ];
}

export function displayAnswerFor(q: Question): string {
  switch (q.type) {
    case 'tf':
      return q.answer ? 'True' : 'False';
    case 'matching':
      return q.answer.map((p) => `${p.term} = ${p.definition}`).join('; ');
    case 'ordering':
      return q.answer.map((s, i) => `${i + 1}. ${s}`).join('  ');
    default:
      return q.answer;
  }
}

const LABELS: Record<Question['type'], string> = {
  mc: 'Multiple choice',
  tf: 'True or false',
  written: 'Written answer',
  matching: 'Matching',
  scenario: 'Scenario',
  ordering: 'Order the steps',
};

/** The question in its own native format (used by Practice Test and for recognition). */
export function nativePresentation(q: Question, rng: Rng, preferChoiceForWritten: boolean): Presentation {
  switch (q.type) {
    case 'mc':
    case 'scenario':
      return { format: 'choice', prompt: q.prompt, options: shuffle(q.options, rng), answer: q.answer };
    case 'tf':
      return { format: 'tf', prompt: q.prompt, answer: q.answer };
    case 'written':
      if (preferChoiceForWritten && q.options && q.options.length > 0) {
        return { format: 'choice', prompt: q.prompt, options: shuffle(q.options, rng), answer: q.answer };
      }
      return { format: 'written', prompt: q.prompt, spec: writtenSpec(q), hint: q.hint };
    case 'matching':
      return { format: 'matching', prompt: q.prompt, pairs: q.answer };
    case 'ordering':
      return { format: 'ordering', prompt: q.prompt, steps: q.answer };
  }
}

function writtenSpec(q: Question): WrittenSpec {
  const answer = typeof q.answer === 'string' ? q.answer : '';
  return {
    answer,
    acceptedAnswers: q.acceptedAnswers ?? [],
    confusableWith: q.confusableWith ?? [],
    orderInsensitive: q.orderInsensitive ?? false,
  };
}

export function questionCard(q: Question, level: MasteryLevel, rng: Rng): StudyCard {
  const recall = level !== 'new';
  let presentation: Presentation;
  if (recall && isWrittenCapable(q)) {
    presentation = { format: 'written', prompt: q.prompt, spec: writtenSpec(q), hint: q.hint };
  } else {
    presentation = nativePresentation(q, rng, true);
  }
  return {
    itemId: q.id,
    unitId: q.unitId,
    presentation,
    explanation: q.explanation,
    displayAnswer: displayAnswerFor(q),
    label:
      presentation.format === 'written' && q.type !== 'written'
        ? 'Recall'
        : presentation.format === 'choice' && q.type === 'written'
          ? LABELS.mc
          : LABELS[q.type],
  };
}

function pickDistractors(correct: Term, pool: Term[], key: 'term' | 'definition', rng: Rng): string[] {
  const sameUnit = pool.filter((t) => t.unitId === correct.unitId && t.id !== correct.id);
  const others = pool.filter((t) => t.unitId !== correct.unitId);
  const ordered = [...shuffle(sameUnit, rng), ...shuffle(others, rng)];
  const seen = new Set([correct[key].toLowerCase()]);
  const out: string[] = [];
  for (const t of ordered) {
    const v = t[key];
    if (seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length === 3) break;
  }
  return out;
}

export function termCard(
  term: Term,
  level: MasteryLevel,
  answerWith: AnswerWith,
  pool: Term[],
  rng: Rng,
): StudyCard {
  const mode = answerWith === 'both' ? (rng() < 0.5 ? 'term' : 'definition') : answerWith;
  const recall = level !== 'new';
  const explanation = `${term.term}: ${term.definition} Example: ${term.example}`;
  let presentation: Presentation;
  if (mode === 'term' && recall) {
    presentation = {
      format: 'written',
      prompt: `Type the term for this definition: ${term.definition}`,
      spec: {
        answer: term.term,
        acceptedAnswers: term.acceptedAnswers ?? [],
        confusableWith: term.confusableWith ?? [],
      },
    };
  } else if (mode === 'term') {
    presentation = {
      format: 'choice',
      prompt: `Which term matches this definition? ${term.definition}`,
      options: shuffle([term.term, ...pickDistractors(term, pool, 'term', rng)], rng),
      answer: term.term,
    };
  } else {
    // Definitions are too long to grade as typed answers, so this mode stays multiple choice.
    presentation = {
      format: 'choice',
      prompt: `What does "${term.term}" mean?`,
      options: shuffle([term.definition, ...pickDistractors(term, pool, 'definition', rng)], rng),
      answer: term.definition,
    };
  }
  return {
    itemId: termItemId(term),
    unitId: term.unitId,
    presentation,
    explanation,
    displayAnswer: mode === 'term' ? term.term : term.definition,
    label: 'Term',
  };
}

/** A prompt-writing challenge. It is the same task at every level; mastering it takes two passing reviews. */
export function challengeCard(c: PromptChallenge): StudyCard {
  return {
    itemId: c.id,
    unitId: practiceUnitId(c),
    presentation: { format: 'prompt', prompt: c.scenario, challenge: c },
    explanation: 'A strong prompt meets every item on the checklist. There are many good answers; here is one.',
    displayAnswer: c.strongExample,
    label: 'Prompt practice',
  };
}

/** Spot the Problem: read a prompt and its flawed output, then pick what went wrong. */
export function spotCard(s: SpotProblem, rng: Rng): StudyCard {
  return {
    itemId: s.id,
    unitId: practiceUnitId(s),
    presentation: { format: 'choice', prompt: `Spot the problem: ${s.title}. What went wrong?`, options: shuffle(s.options, rng), answer: s.answer },
    explanation: s.explanation,
    displayAnswer: s.answer,
    label: 'Spot the problem',
    context: [
      { label: 'The prompt', text: s.prompt },
      { label: "The AI's output", text: s.output },
    ],
  };
}

export function cardForItem(
  item: StudyItem,
  level: MasteryLevel,
  answerWith: AnswerWith,
  pool: Term[],
  rng: Rng,
): StudyCard {
  if (item.kind === 'term' && item.term) return termCard(item.term, level, answerWith, pool, rng);
  if (item.kind === 'challenge' && item.challenge) return challengeCard(item.challenge);
  if (item.kind === 'spot' && item.spot) return spotCard(item.spot, rng);
  if (item.question) return questionCard(item.question, level, rng);
  throw new Error(`Study item ${item.id} has no content`);
}

/** Short text describing an item, for round summaries and lists. */
export function itemLabel(item: StudyItem | undefined): string {
  if (!item) return '';
  if (item.term) return item.term.term;
  if (item.challenge) return `Prompt practice: ${item.challenge.title}`;
  if (item.spot) return `Spot the problem: ${item.spot.title}`;
  return item.question?.prompt ?? '';
}

export function isMatchingCorrect(pairs: MatchPair[], chosen: Record<string, string>): boolean {
  return pairs.every((p) => chosen[p.term] === p.definition);
}

export function isOrderingCorrect(steps: string[], chosen: string[]): boolean {
  return steps.length === chosen.length && steps.every((s, i) => chosen[i] === s);
}
