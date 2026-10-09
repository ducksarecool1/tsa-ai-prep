// Core data model for AI Prep. Content JSON files in src/content/ must match these types;
// `npm run validate-content` enforces the rules that TypeScript alone cannot.

export type Difficulty = 1 | 2 | 3;

export type QuestionType = 'mc' | 'tf' | 'written' | 'matching' | 'scenario' | 'ordering';

export const QUESTION_TYPES: QuestionType[] = ['mc', 'tf', 'written', 'matching', 'scenario', 'ordering'];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mc: 'Multiple choice',
  tf: 'True / False',
  written: 'Written answer',
  matching: 'Matching',
  scenario: 'Scenario',
  ordering: 'Order the steps',
};

export interface MatchPair {
  term: string;
  definition: string;
}

interface QuestionBase {
  id: string;
  unitId: string;
  type: QuestionType;
  prompt: string;
  /** 1 to 3 sentences explaining why the answer is right. */
  explanation: string;
  difficulty: Difficulty;
  tags: string[];
  /** Other typed answers that count as correct (synonyms, abbreviations). Enables written recall. */
  acceptedAnswers?: string[];
  /** Real terms that look similar but are wrong. Never accepted, even with typo tolerance. */
  confusableWith?: string[];
  /** Multi-part written answers whose parts may come in any order. */
  orderInsensitive?: boolean;
  /** Shown after an "Almost" written answer. */
  hint?: string;
}

/** Multiple choice and scenario questions: 4 options, one correct. */
export interface ChoiceQuestion extends QuestionBase {
  type: 'mc' | 'scenario';
  options: string[];
  answer: string;
}

export interface TrueFalseQuestion extends QuestionBase {
  type: 'tf';
  answer: boolean;
}

/** Typed answer. Optional `options` let Learn Mode show it as multiple choice first. */
export interface WrittenQuestion extends QuestionBase {
  type: 'written';
  answer: string;
  acceptedAnswers: string[];
  options?: string[];
}

export interface MatchingQuestion extends QuestionBase {
  type: 'matching';
  answer: MatchPair[];
}

/** `answer` lists the steps in the correct order. */
export interface OrderingQuestion extends QuestionBase {
  type: 'ordering';
  answer: string[];
}

export type Question =
  | ChoiceQuestion
  | TrueFalseQuestion
  | WrittenQuestion
  | MatchingQuestion
  | OrderingQuestion;

export interface Term {
  id: string;
  unitId: string;
  term: string;
  definition: string;
  example: string;
  acceptedAnswers?: string[];
  confusableWith?: string[];
}

export interface LessonSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export type Diagram =
  | { type: 'nested'; caption: string; labels: string[] }
  | { type: 'flow'; caption: string; steps: string[] }
  | { type: 'network'; caption: string; layers: { label: string; nodes: number }[] }
  | { type: 'matrix'; caption: string; rowLabels: string[]; colLabels: string[]; cells: string[][] }
  | { type: 'timeline'; caption: string; events: { year: string; label: string }[] };

export interface Lesson {
  title: string;
  sections: LessonSection[];
  diagram?: Diagram;
  /** Index of the section the diagram follows (default 0, the first section). */
  diagramAfter?: number;
  analogy?: { title: string; text: string };
}

export interface Unit {
  id: string;
  number: number;
  title: string;
  summary: string;
  lesson: Lesson;
  terms: Term[];
  questions: Question[];
}

export type CheckType =
  | 'task'
  | 'audience'
  | 'format'
  | 'length'
  | 'role'
  | 'context'
  | 'examples'
  | 'constraints'
  | 'steps'
  | 'reasoning'
  | 'verification'
  | 'tone'
  | 'noPersonalData'
  | 'delimiters'
  | 'keywords';

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  check: CheckType;
  /** For `keywords` and `task`: the prompt must mention at least one of these. */
  keywords?: string[];
  /** Concrete advice shown when the criterion is missed. */
  suggestion: string;
}

export interface PromptChallenge {
  id: string;
  /** Unit this practice belongs to in Learn Mode (default "u7", Prompt Engineering). */
  unitId?: string;
  title: string;
  difficulty: Difficulty;
  scenario: string;
  weakPrompt?: string;
  rubric: RubricCriterion[];
  strongExample: string;
}

export interface SpotProblem {
  id: string;
  /** Unit this practice belongs to in Learn Mode (default "u7", Prompt Engineering). */
  unitId?: string;
  title: string;
  prompt: string;
  output: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface Content {
  units: Unit[];
  challenges: PromptChallenge[];
  spotProblems: SpotProblem[];
}

// ---------- Progress ----------

export type MasteryLevel = 'new' | 'familiar' | 'mastered';

export interface ItemProgress {
  itemId: string;
  level: MasteryLevel;
  attempts: number;
  correct: number;
  misses: number;
  /** Consecutive correct answers. */
  streak: number;
  /** Epoch ms, or null if never seen. */
  lastSeen: number | null;
  /** Epoch ms when the item is next due for spaced review. */
  nextDue: number | null;
  /** Leitner box, 0 = never answered, 1 to 5 after that. */
  box: number;
  lastResult: 'correct' | 'incorrect' | null;
}

export interface ProgressState {
  version: 1;
  items: Record<string, ItemProgress>;
  /** Local dates (YYYY-MM-DD) with at least one answer. */
  studyDays: string[];
  lastUnitIds: string[];
  prompts: Record<string, { bestScore: number; attempts: number }>;
  spot: Record<string, { attempts: number; correct: number }>;
  tests: { date: string; unitIds: string[]; score: number; total: number }[];
  /** Experience points: lifetime total and per local day (recent days only). */
  xp: { total: number; byDay: Record<string, number> };
  /** Local dates on which the daily XP goal was reached. */
  goalDays: string[];
  /** Achievement id -> epoch ms when unlocked. */
  achievements: Record<string, number>;
  stats: GameStats;
}

export interface GameStats {
  sessionsCompleted: number;
  bestCombo: number;
  perfectRounds: number;
}

export interface Flag {
  id: string;
  itemId: string;
  prompt: string;
  studentAnswer: string;
  expected: string;
  timestamp: number;
  source: 'override' | 'ai';
}

export type ThemeSetting = 'system' | 'light' | 'dark';
export type AnswerWith = 'term' | 'definition' | 'both';
/** `prompt` covers interactive prompt practice: Prompt Lab challenges and Spot the Problem. */
export type IncludeKey = QuestionType | 'term' | 'prompt';

export interface Settings {
  theme: ThemeSetting;
  shuffle: boolean;
  roundSize: number;
  /** Items per Learn session; 0 means all selected items. */
  sessionLength: number;
  includeTypes: Record<IncludeKey, boolean>;
  answerWith: AnswerWith;
  advisorMode: boolean;
  /** Optional local AI through Ollama (https://ollama.com). */
  ai: { enabled: boolean; baseUrl: string; model: string };
  sound: boolean;
  /** 0 to 1. */
  volume: number;
  /** XP needed each day to reach the daily goal. */
  dailyGoal: number;
}
