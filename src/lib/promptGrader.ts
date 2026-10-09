// Offline, rule-based prompt grader for the Prompt Engineering Lab.
// Each rubric criterion names a check; each check is a keyword or pattern test.
import type { CheckType, RubricCriterion } from '../types';

const NUMBER_WORD =
  '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty|hundred)';
const LENGTH_UNIT =
  '(?:words?|sentences?|paragraphs?|bullets?|bullet points?|items?|questions?|lines?|pages?|points?|examples?|steps?|tips?|ideas?|minutes?|slides?|characters?|options?|rows?|sections?|names?|facts?|reasons?|rules?|days?|weeks?|meals?|problems?|cards?|terms?|headlines?|titles?|activities?|stanzas?|verses?|arguments?|descriptions?)';

const ACTION_VERBS =
  /\b(write|create|explain|summari[sz]e|list|generate|draft|make|design|compare|describe|give|rewrite|translate|outline|plan|suggest|analy[sz]e|classify|review|answer|build|edit|check|identify|convert|brainstorm|produce|turn|help|find|fix|proofread|recommend|sort|extract|tell|teach|quiz|evaluate|grade|label|solve|calculate|guide)\b/;

const PATTERNS: Partial<Record<CheckType, RegExp[]>> = {
  audience: [
    /\b(audience|readers?|students?|beginners?|kids|children|teens?|teenagers?|adults|parents|teachers|classmates|judges|customers|grade(rs?)?|middle school(ers)?|high school(ers)?|elementary|year[- ]olds?|non-?experts?|novices?|newcomers?|freshm[ae]n|sophomores?|members|families|visitors|volunteers|coaches|players|users)\b/,
    /\b\d+(st|nd|rd|th)[- ]grade(rs?)?\b/,
  ],
  format: [
    /\b(bullet(ed)?|bullets|numbered|list|table|json|csv|outline|headings?|paragraphs?|essay|email|letter|poem|script|chart|columns?|format(ted)?|markdown|flashcards?|slides?|sections?|template|schedule|agenda|checklist|q\s*&\s*a|rows?)\b/,
  ],
  length: [
    new RegExp(`\\b${NUMBER_WORD}(?:\\s*(?:-|to)\\s*${NUMBER_WORD})?[- ]${LENGTH_UNIT}\\b`),
    new RegExp(`\\b${NUMBER_WORD}(?:\\s*(?:-|to)\\s*${NUMBER_WORD})?\\s+(?:\\w+\\s+){0,2}${LENGTH_UNIT}\\b`),
    /\b(under|no more than|at most|at least|maximum of|max|fewer than|less than|up to|exactly)\s+\d+/,
  ],
  role: [
    /\b(you are|you're|act as|acting as|pretend (to be|you are)|take on the role|in the role of|role:)\b/,
  ],
  context: [
    /\b(because|context|background|i am|i'm|we are|we're|my|our|the goal|goal is|purpose|so that|this is for|we have|i have|currently|situation|they are|they have|they already)\b/,
  ],
  examples: [
    /\b(for example|e\.g\.|examples?|for instance|sample|like this)\b/,
    /\b(input|output|q|a)\s*:/,
  ],
  constraints: [
    /\b(do not|don't|dont|avoid|only|must|without|never|no more than|at most|limit|exclude|keep it|make sure|should not|shouldn't|no jargon|no slang|stick to|focus on|only use)\b/,
  ],
  steps: [
    /\b(step by step|step-by-step|steps|first,?|then|next|finally|step 1|in order|stages?|phases?|break (it|this|the task|the problem) (down|into))\b/,
    /(^|\n)\s*1[.)]\s/,
  ],
  reasoning: [
    /(step by step|step-by-step|show (your|the|all) (work|reasoning|steps)|explain (your|the) reasoning|explain why|reasoning|think through|walk me through|justify|explain how you|show how you)/,
  ],
  verification: [
    /(if you('re| are) (not sure|unsure|uncertain)|if you don't know|if you do not know|say so|do not (make up|invent|guess)|don't (make up|invent|guess)|\bcite\b|\bsources?\b|verify|fact-?check|\bflag\b|uncertain|only (use|the) (facts|information|text)|based only on|according to the|label (anything|any)|double-check)/,
  ],
  tone: [
    /\b(tone|friendly|formal|informal|casual|encouraging|professional|playful|serious|warm|enthusiastic|respectful|neutral|polite|upbeat|fun|conversational|supportive|persuasive|calm|simple language|plain language|plain english|kind|balanced|objective|excited|exciting|funny|humorous|welcoming|patient)\b/,
  ],
  delimiters: [/("""|```|<[a-z_]+>|---|###|\[[^\]]+\]|"[^"]{20,}"|“[^”]{20,}”)/],
};

const PERSONAL_DATA: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email address
  /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, // phone number
  /\b\d{3}-\d{2}-\d{4}\b/, // US social security number pattern
  /\b\d{1,5}\s+\w+(\s+\w+)?\s+(street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|court|ct|way)\b/i, // street address
  /\b(password|passcode|student id|social security|date of birth|born on|home address|credit card|my address is|lives at)\b/i,
];

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function anyMatch(text: string, patterns: RegExp[] | undefined): boolean {
  return (patterns ?? []).some((re) => re.test(text));
}

function mentionsAny(text: string, keywords: string[] | undefined): boolean {
  if (!keywords || keywords.length === 0) return true;
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

export function checkCriterion(prompt: string, criterion: RubricCriterion): boolean {
  const text = prompt.toLowerCase();
  switch (criterion.check) {
    case 'task':
      return ACTION_VERBS.test(text) && mentionsAny(text, criterion.keywords);
    case 'context':
      return wordCount(prompt) >= 25 && anyMatch(text, PATTERNS.context);
    case 'noPersonalData':
      return !PERSONAL_DATA.some((re) => re.test(prompt));
    case 'keywords':
      return mentionsAny(text, criterion.keywords) && (criterion.keywords?.length ?? 0) > 0;
    case 'delimiters':
      return anyMatch(prompt, PATTERNS.delimiters);
    default:
      return anyMatch(text, PATTERNS[criterion.check]);
  }
}

export interface CriterionResult {
  criterion: RubricCriterion;
  met: boolean;
}

export interface PromptGrade {
  score: number;
  results: CriterionResult[];
}

export function gradePrompt(prompt: string, rubric: RubricCriterion[]): PromptGrade {
  const trimmed = prompt.trim();
  const results = rubric.map((criterion) => ({
    criterion,
    // An empty prompt cannot meet anything, including "no personal data".
    met: trimmed.length > 0 && checkCriterion(trimmed, criterion),
  }));
  const met = results.filter((r) => r.met).length;
  const score = rubric.length === 0 ? 0 : Math.round((met / rubric.length) * 100);
  return { score, results };
}
