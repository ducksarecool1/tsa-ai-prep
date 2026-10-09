// Content validation shared by `npm run validate-content`, the test suite and Advisor mode.
import type { Content, PromptChallenge, Question, SpotProblem, Term, Unit } from '../types';
import { QUESTION_TYPES } from '../types';
import { gradeWritten } from './smartAnswer';
import { gradePrompt } from './promptGrader';
import { isWrittenCapable, knownTermNames, practiceUnitId } from './items';

export const MIN_QUESTIONS_PER_UNIT = 25;
export const MIN_CHALLENGES = 15;
export const LESSON_MIN_WORDS = 300;
export const LESSON_MAX_WORDS = 600;

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  stats: {
    units: number;
    questions: number;
    terms: number;
    challenges: number;
    spotProblems: number;
    questionsPerUnit: Record<string, number>;
    lessonWords: Record<string, number>;
  };
}

const PLACEHOLDER = /\b(lorem|ipsum|todo|tbd|fixme|xxx)\b/i;

function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countSentences(text: string): number {
  const cleaned = text
    .replace(/\b(e\.g|i\.e|vs|etc|approx|Dr|Mr|Ms|Mrs|St)\./gi, '$1')
    .replace(/\bU\.S\./g, 'US')
    .trim();
  if (!cleaned) return 0;
  const ends = cleaned.match(/[.!?]+["')\]]*(\s|$)/g);
  return Math.max(ends ? ends.length : 0, 1);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function hasDuplicates(values: string[]): string | null {
  const seen = new Set<string>();
  for (const v of values) {
    const k = v.trim().toLowerCase();
    if (seen.has(k)) return v;
    seen.add(k);
  }
  return null;
}

export function lessonWordCount(unit: Unit): number {
  const l = unit.lesson;
  let total = 0;
  for (const s of l.sections ?? []) {
    for (const p of s.paragraphs ?? []) total += words(p);
    for (const b of s.bullets ?? []) total += words(b);
  }
  if (l.analogy) total += words(l.analogy.text);
  return total;
}

/** Validates one question; returns error messages (empty when valid). */
export function validateQuestion(q: Question, knownTerms: string[] = []): string[] {
  const errs: string[] = [];
  const where = `Question ${q.id ?? '(no id)'}`;
  if (!isNonEmptyString(q.id)) errs.push(`${where}: missing id`);
  if (!QUESTION_TYPES.includes(q.type)) errs.push(`${where}: unknown type "${q.type}"`);
  if (!isNonEmptyString(q.prompt)) errs.push(`${where}: missing prompt`);
  if (!isNonEmptyString(q.explanation)) errs.push(`${where}: missing explanation`);
  else {
    const n = countSentences(q.explanation);
    if (n > 3) errs.push(`${where}: explanation has ${n} sentences (max 3)`);
  }
  if (![1, 2, 3].includes(q.difficulty)) errs.push(`${where}: difficulty must be 1, 2 or 3`);
  if (!Array.isArray(q.tags)) errs.push(`${where}: tags must be an array`);
  for (const text of [q.prompt, q.explanation]) {
    if (typeof text === 'string' && PLACEHOLDER.test(text)) errs.push(`${where}: contains placeholder text`);
  }

  switch (q.type) {
    case 'mc':
    case 'scenario': {
      if (!isNonEmptyString(q.answer)) errs.push(`${where}: missing answer`);
      if (!Array.isArray(q.options) || q.options.length !== 4) errs.push(`${where}: needs exactly 4 options`);
      else {
        if (!q.options.includes(q.answer)) errs.push(`${where}: options do not contain the answer`);
        const dup = hasDuplicates(q.options);
        if (dup) errs.push(`${where}: duplicate option "${dup}"`);
        if (q.options.some((o) => !isNonEmptyString(o))) errs.push(`${where}: empty option`);
      }
      break;
    }
    case 'tf':
      if (typeof q.answer !== 'boolean') errs.push(`${where}: true/false answer must be a boolean`);
      break;
    case 'written': {
      if (!isNonEmptyString(q.answer)) errs.push(`${where}: missing answer`);
      if (!Array.isArray(q.acceptedAnswers)) errs.push(`${where}: written questions need acceptedAnswers`);
      if (q.options !== undefined) {
        if (q.options.length !== 4) errs.push(`${where}: optional options must have exactly 4 entries`);
        else if (!q.options.includes(q.answer)) errs.push(`${where}: options do not contain the answer`);
        const dup = hasDuplicates(q.options ?? []);
        if (dup) errs.push(`${where}: duplicate option "${dup}"`);
      }
      break;
    }
    case 'matching': {
      if (!Array.isArray(q.answer) || q.answer.length < 3) errs.push(`${where}: matching needs at least 3 pairs`);
      else {
        if (q.answer.some((p) => !isNonEmptyString(p.term) || !isNonEmptyString(p.definition)))
          errs.push(`${where}: every pair needs a term and a definition`);
        const dupT = hasDuplicates(q.answer.map((p) => p.term));
        const dupD = hasDuplicates(q.answer.map((p) => p.definition));
        if (dupT || dupD) errs.push(`${where}: duplicate matching entry "${dupT ?? dupD}"`);
      }
      break;
    }
    case 'ordering': {
      if (!Array.isArray(q.answer) || q.answer.length < 3) errs.push(`${where}: ordering needs at least 3 steps`);
      else {
        const dup = hasDuplicates(q.answer);
        if (dup) errs.push(`${where}: duplicate step "${dup}"`);
      }
      break;
    }
  }

  // Smart Answers self-check: the key must grade as correct, and confusables must not.
  if (errs.length === 0 && isWrittenCapable(q) && typeof q.answer === 'string') {
    errs.push(...selfCheckWritten(where, q.answer, q.acceptedAnswers ?? [], q.confusableWith ?? [], knownTerms));
  }
  return errs;
}

function selfCheckWritten(
  where: string,
  answer: string,
  accepted: string[],
  confusable: string[],
  knownTerms: string[],
): string[] {
  const errs: string[] = [];
  const spec = { answer, acceptedAnswers: accepted, confusableWith: confusable };
  for (const a of [answer, ...accepted]) {
    const r = gradeWritten(a, spec, { knownTerms });
    if (r.verdict !== 'correct') errs.push(`${where}: accepted answer "${a}" is not graded correct (${r.reason})`);
  }
  for (const c of confusable) {
    const r = gradeWritten(c, spec, { knownTerms });
    if (r.verdict === 'correct') errs.push(`${where}: confusable "${c}" is graded correct`);
  }
  return errs;
}

function validateTerm(t: Term, knownTerms: string[]): string[] {
  const errs: string[] = [];
  const where = `Term ${t.id ?? '(no id)'}`;
  if (!isNonEmptyString(t.term)) errs.push(`${where}: missing term`);
  if (!isNonEmptyString(t.definition)) errs.push(`${where}: missing definition`);
  if (!isNonEmptyString(t.example)) errs.push(`${where}: missing example`);
  if (errs.length === 0) {
    errs.push(...selfCheckWritten(where, t.term, t.acceptedAnswers ?? [], t.confusableWith ?? [], knownTerms));
  }
  return errs;
}

function validateChallenge(c: PromptChallenge): string[] {
  const errs: string[] = [];
  const where = `Prompt challenge ${c.id ?? '(no id)'}`;
  if (!isNonEmptyString(c.title)) errs.push(`${where}: missing title`);
  if (!isNonEmptyString(c.scenario)) errs.push(`${where}: missing scenario`);
  if (!isNonEmptyString(c.strongExample)) errs.push(`${where}: missing strong example`);
  if (![1, 2, 3].includes(c.difficulty)) errs.push(`${where}: difficulty must be 1, 2 or 3`);
  if (!Array.isArray(c.rubric) || c.rubric.length < 4 || c.rubric.length > 6)
    errs.push(`${where}: rubric needs 4 to 6 criteria`);
  else {
    const dup = hasDuplicates(c.rubric.map((r) => r.id));
    if (dup) errs.push(`${where}: duplicate criterion id "${dup}"`);
    for (const r of c.rubric) {
      if (!isNonEmptyString(r.suggestion)) errs.push(`${where}: criterion ${r.id} needs a suggestion`);
      if (r.check === 'keywords' && !r.keywords?.length)
        errs.push(`${where}: criterion ${r.id} uses keywords but lists none`);
    }
    const strong = gradePrompt(c.strongExample, c.rubric);
    const missed = strong.results.filter((r) => !r.met).map((r) => r.criterion.id);
    if (missed.length) errs.push(`${where}: strong example fails its own rubric (${missed.join(', ')})`);
    if (c.weakPrompt) {
      const weak = gradePrompt(c.weakPrompt, c.rubric);
      if (weak.score === 100) errs.push(`${where}: weak prompt already scores 100`);
    }
  }
  return errs;
}

function validateSpot(s: SpotProblem): string[] {
  const errs: string[] = [];
  const where = `Spot-the-problem ${s.id ?? '(no id)'}`;
  if (!isNonEmptyString(s.prompt) || !isNonEmptyString(s.output)) errs.push(`${where}: needs a prompt and an output`);
  if (!Array.isArray(s.options) || s.options.length !== 4) errs.push(`${where}: needs exactly 4 options`);
  else if (!s.options.includes(s.answer)) errs.push(`${where}: options do not contain the answer`);
  if (!isNonEmptyString(s.explanation)) errs.push(`${where}: missing explanation`);
  return errs;
}

export function validateContent(content: Content): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const questionsPerUnit: Record<string, number> = {};
  const lessonWords: Record<string, number> = {};
  const termNames = content.units.flatMap((u) => u.terms.map((t) => t.term));
  const knownTerms = knownTermNames(content.units);

  const allIds = [
    ...content.units.map((u) => u.id),
    ...content.units.flatMap((u) => u.questions.map((q) => q.id)),
    ...content.units.flatMap((u) => u.terms.map((t) => t.id)),
    ...content.challenges.map((c) => c.id),
    ...content.spotProblems.map((s) => s.id),
  ];
  const seen = new Set<string>();
  for (const id of allIds) {
    if (seen.has(id)) errors.push(`Duplicate id "${id}"`);
    seen.add(id);
  }
  const dupTerm = hasDuplicates(termNames);
  if (dupTerm) errors.push(`Glossary term "${dupTerm}" is defined more than once`);

  for (const unit of content.units) {
    const where = `Unit ${unit.id}`;
    questionsPerUnit[unit.id] = unit.questions.length;
    if (unit.questions.length < MIN_QUESTIONS_PER_UNIT)
      errors.push(`${where}: has ${unit.questions.length} questions (minimum ${MIN_QUESTIONS_PER_UNIT})`);
    const wc = lessonWordCount(unit);
    lessonWords[unit.id] = wc;
    if (wc < LESSON_MIN_WORDS || wc > LESSON_MAX_WORDS)
      errors.push(`${where}: lesson has ${wc} words (must be ${LESSON_MIN_WORDS} to ${LESSON_MAX_WORDS})`);
    if (!unit.lesson.diagram && !unit.lesson.analogy) errors.push(`${where}: lesson needs a diagram or an analogy`);
    const lessonText = JSON.stringify(unit.lesson);
    if (PLACEHOLDER.test(lessonText)) errors.push(`${where}: lesson contains placeholder text`);

    const types = new Set(unit.questions.map((q) => q.type));
    if (types.size < 4) warnings.push(`${where}: only ${types.size} question types used`);

    for (const q of unit.questions) {
      if (q.unitId !== unit.id) errors.push(`Question ${q.id}: unitId "${q.unitId}" does not match ${unit.id}`);
      errors.push(...validateQuestion(q, knownTerms));
    }
    for (const t of unit.terms) {
      if (t.unitId !== unit.id) errors.push(`Term ${t.id}: unitId "${t.unitId}" does not match ${unit.id}`);
      errors.push(...validateTerm(t, knownTerms));
    }
  }

  if (content.challenges.length < MIN_CHALLENGES)
    errors.push(`Only ${content.challenges.length} prompt challenges (minimum ${MIN_CHALLENGES})`);
  for (const c of content.challenges) errors.push(...validateChallenge(c));
  for (const s of content.spotProblems) errors.push(...validateSpot(s));
  const unitIdSet = new Set(content.units.map((u) => u.id));
  for (const p of [...content.challenges, ...content.spotProblems]) {
    const unitId = practiceUnitId(p);
    if (!unitIdSet.has(unitId)) errors.push(`Practice item ${p.id}: unit "${unitId}" does not exist`);
  }

  return {
    errors,
    warnings,
    stats: {
      units: content.units.length,
      questions: content.units.reduce((n, u) => n + u.questions.length, 0),
      terms: termNames.length,
      challenges: content.challenges.length,
      spotProblems: content.spotProblems.length,
      questionsPerUnit,
      lessonWords,
    },
  };
}
