// Renders any study card format and reports the student's answer.
// Remount (change `key`) for each new card so internal state resets.
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { MatchPair, PromptChallenge } from '../types';
import type { Presentation } from '../lib/items';
import { isMatchingCorrect, isOrderingCorrect } from '../lib/items';
import { gradeWritten, makeHint, type WrittenSpec } from '../lib/smartAnswer';
import { shuffle } from '../lib/random';
import { PASS_SCORE, reviewPrompt, type PromptReview } from '../lib/promptReview';
import { aiEnabled, type ReviewStep } from '../lib/ai';
import { useApp } from '../state/AppContext';
import { Icon } from './Icon';
import { Thinking } from './Chat';

export interface AnswerResult {
  correct: boolean;
  /** What the student answered, as readable text. */
  response: string;
  confusedWith?: string;
  /** Prompt practice only: the coach's review. */
  review?: PromptReview;
}

/** Formats that are answered in the composer at the bottom of a conversation. */
export const COMPOSER_FORMATS: Presentation['format'][] = ['written', 'prompt'];

interface Props {
  presentation: Presentation;
  locked: boolean;
  onAnswer: (result: AnswerResult) => void;
  knownTerms: string[];
  /** Give one more try after an "Almost" written answer (Learn Mode). */
  allowRetry?: boolean;
  /** Show right/wrong styling on the options after answering. */
  revealResult?: boolean;
}

export function AnswerInput(props: Props) {
  const { presentation: p } = props;
  switch (p.format) {
    case 'choice':
      return <ChoiceInput {...props} options={p.options} answer={p.answer} />;
    case 'tf':
      return <ChoiceInput {...props} options={['True', 'False']} answer={p.answer ? 'True' : 'False'} trueFalse />;
    case 'written':
      return <WrittenInput {...props} spec={p.spec} hint={p.hint} />;
    case 'matching':
      return <MatchingInput {...props} pairs={p.pairs} />;
    case 'ordering':
      return <OrderingInput {...props} steps={p.steps} />;
    case 'prompt':
      return <PromptComposer {...props} challenge={p.challenge} />;
  }
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

// ---------- Multiple choice and true/false ----------

function ChoiceInput({
  options,
  answer,
  locked,
  onAnswer,
  revealResult = true,
  trueFalse = false,
}: Props & { options: string[]; answer: string; trueFalse?: boolean }) {
  const [chosen, setChosen] = useState<string | null>(null);

  const choose = (opt: string) => {
    if (locked || chosen !== null) return;
    setChosen(opt);
    onAnswer({ correct: opt === answer, response: opt });
  };

  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) choose(options[n - 1]);
      if (trueFalse && (e.key === 't' || e.key === 'T')) choose('True');
      if (trueFalse && (e.key === 'f' || e.key === 'F')) choose('False');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div role="group" aria-label="Answer choices" className={trueFalse ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>
      {options.map((opt, i) => {
        const state =
          locked && revealResult ? (opt === answer ? 'option-correct' : opt === chosen ? 'option-wrong' : '') : '';
        return (
          <button
            key={opt}
            type="button"
            className={`option ${state} ${!locked && chosen === opt ? 'border-brand-500' : ''}`}
            disabled={locked}
            aria-pressed={chosen === opt}
            onClick={() => choose(opt)}
          >
            <span className="kbd shrink-0" aria-hidden="true">
              {i + 1}
            </span>
            <span>{opt}</span>
            {locked && revealResult && opt === answer && <span className="sr-only">(correct answer)</span>}
            {locked && revealResult && opt === chosen && opt !== answer && <span className="sr-only">(your answer)</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Written answer with Smart Answers ----------

function WrittenInput({
  spec,
  hint,
  locked,
  onAnswer,
  knownTerms,
  allowRetry = false,
}: Props & { spec: WrittenSpec; hint?: string }) {
  const [value, setValue] = useState('');
  const [almost, setAlmost] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [locked, almost]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked || !value.trim()) return;
    const result = gradeWritten(value, spec, { knownTerms });
    if (result.verdict === 'almost' && allowRetry && !almost) {
      setAlmost(true);
      return;
    }
    onAnswer({ correct: result.verdict === 'correct', response: value.trim(), confusedWith: result.confusedWith });
  };

  if (locked) return null;
  return (
    <form onSubmit={submit} className="space-y-2">
      {almost && (
        <p id="almost-hint" role="status" className="rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">
          <strong>Almost!</strong> You're close. Try once more. Hint: {hint ?? makeHint(spec.answer)}
        </p>
      )}
      <div className="composer flex items-center gap-2 py-1.5 pl-5 pr-1.5">
        <label htmlFor="written-answer" className="sr-only">
          Type your answer
        </label>
        <input
          id="written-answer"
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink placeholder-ink-soft/70 focus:outline-none"
          placeholder={almost ? 'Try again…' : 'Type your answer…'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={almost ? 'almost-hint' : undefined}
        />
        <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-opacity disabled:opacity-25" disabled={!value.trim()} aria-label="Submit answer">
          <Icon name="send" className="h-5 w-5" />
        </button>
      </div>
      <div className="flex justify-between px-2 text-xs text-ink-soft">
        <span>Press Enter to submit. Small typos are OK.</span>
        <button type="button" className="font-medium underline-offset-2 hover:text-ink hover:underline" onClick={() => onAnswer({ correct: false, response: '' })}>
          I don't know
        </button>
      </div>
    </form>
  );
}

// ---------- Prompt practice: write a prompt, get it reviewed ----------

function PromptComposer({ challenge, locked, onAnswer }: Props & { challenge: PromptChallenge }) {
  const { settings } = useApp();
  const [text, setText] = useState('');
  const [step, setStep] = useState<ReviewStep | 'offline' | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const useAI = aiEnabled(settings.ai);

  useEffect(() => {
    if (!locked) areaRef.current?.focus();
  }, [locked]);

  // Grow the box with its content, up to a limit.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (locked || step || !text.trim()) return;
    setStep(useAI ? 'running' : 'offline');
    const review = await reviewPrompt(settings.ai, challenge, text.trim(), setStep);
    setStep(null);
    onAnswer({ correct: review.score >= PASS_SCORE, response: text.trim(), review });
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void submit();
    }
  };

  if (locked) return null;
  if (step) {
    const label =
      step === 'running' ? 'The AI coach is running your prompt to see what it produces…' : step === 'reviewing' ? 'The AI coach is reviewing your prompt and its output…' : 'Checking your prompt…';
    return (
      <div className="composer px-5 py-4">
        <Thinking label={label} />
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      {challenge.weakPrompt && !text && (
        <button type="button" className="chip hover:bg-raised hover:text-ink" onClick={() => setText(challenge.weakPrompt ?? '')}>
          Start from the weak prompt
        </button>
      )}
      <div className="composer flex items-end gap-2 py-2 pl-5 pr-2">
        <label htmlFor="prompt-answer" className="sr-only">
          Write your prompt
        </label>
        <textarea
          id="prompt-answer"
          ref={areaRef}
          rows={3}
          className="min-w-0 flex-1 resize-none bg-transparent py-2 text-base leading-relaxed text-ink placeholder-ink-soft/70 focus:outline-none"
          placeholder="Write your prompt…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-opacity disabled:opacity-25" disabled={!text.trim()} aria-label={useAI ? 'Send to the AI coach' : 'Check my prompt'}>
          <Icon name="send" className="h-5 w-5" />
        </button>
      </div>
      <p className="px-2 text-xs text-ink-soft">
        {useAI ? 'The AI coach will run your prompt, then review it.' : 'Checked offline against the checklist. Add an API key in Settings for AI coach reviews.'}{' '}
        Ctrl+Enter to send. Never include real names, addresses or phone numbers.
      </p>
    </form>
  );
}

// ---------- Matching (tap to pair, or drag a definition onto a term) ----------

function MatchingInput({ pairs, locked, onAnswer, revealResult = true }: Props & { pairs: MatchPair[] }) {
  const terms = useMemo(() => shuffle(pairs.map((p) => p.term)), [pairs]);
  const definitions = useMemo(() => shuffle(pairs.map((p) => p.definition)), [pairs]);
  const correctFor = useMemo(() => Object.fromEntries(pairs.map((p) => [p.term, p.definition])), [pairs]);
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [activeTerm, setActiveTerm] = useState<string | null>(null);
  const [activeDef, setActiveDef] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const submitted = checked && revealResult;

  const usedDefs = new Set(Object.values(assigned));
  const complete = terms.every((t) => assigned[t]);

  const pair = (term: string, def: string) => {
    setAssigned((a) => {
      const next: Record<string, string> = {};
      for (const [t, d] of Object.entries(a)) if (d !== def && t !== term) next[t] = d;
      next[term] = def;
      return next;
    });
    setActiveTerm(null);
    setActiveDef(null);
  };

  const clickTerm = (t: string) => {
    if (locked) return;
    if (activeDef) pair(t, activeDef);
    else setActiveTerm(activeTerm === t ? null : t);
  };
  const clickDef = (d: string) => {
    if (locked) return;
    if (activeTerm) pair(activeTerm, d);
    else setActiveDef(activeDef === d ? null : d);
  };
  const unpair = (t: string) =>
    setAssigned((a) => {
      const next = { ...a };
      delete next[t];
      return next;
    });

  const submit = () => {
    setChecked(true);
    onAnswer({
      correct: isMatchingCorrect(pairs, assigned),
      response: terms.map((t) => `${t} = ${assigned[t] ?? '(none)'}`).join('; '),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm muted">
        Select a term, then select its definition. On a computer you can also drag a definition onto a term.
      </p>
      <ul className="space-y-2">
        {terms.map((t) => {
          const def = assigned[t];
          const right = submitted && def === correctFor[t];
          const wrong = submitted && def !== correctFor[t];
          return (
            <li
              key={t}
              onDragOver={(e) => !locked && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const d = e.dataTransfer.getData('text/plain');
                if (d && !locked) pair(t, d);
              }}
              className={[
                'rounded-lg border-2 p-3',
                right ? 'border-emerald-600 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950' : '',
                wrong ? 'border-red-600 bg-red-50 dark:border-red-500 dark:bg-red-950' : '',
                !submitted ? (activeTerm === t ? 'border-brand-500' : 'border-line') : '',
              ].join(' ')}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="text-left font-semibold"
                  aria-pressed={activeTerm === t}
                  disabled={locked}
                  onClick={() => clickTerm(t)}
                >
                  {t}
                  {right && <span className="sr-only"> (correct)</span>}
                  {wrong && <span className="sr-only"> (incorrect)</span>}
                </button>
                {def ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span>{def}</span>
                    {!locked && (
                      <button type="button" className="kbd" aria-label={`Remove match for ${t}`} onClick={() => unpair(t)}>
                        ×
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="text-sm muted">{activeTerm === t ? 'Now choose a definition below' : 'No match yet'}</span>
                )}
              </div>
              {wrong && <p className="mt-1 text-sm">Correct: {correctFor[t]}</p>}
            </li>
          );
        })}
      </ul>
      {!locked && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Definitions</h3>
          <div className="grid gap-2">
            {definitions
              .filter((d) => !usedDefs.has(d))
              .map((d) => (
                <button
                  key={d}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', d)}
                  className={`option text-sm ${activeDef === d ? 'border-brand-500' : ''}`}
                  aria-pressed={activeDef === d}
                  onClick={() => clickDef(d)}
                >
                  {d}
                </button>
              ))}
          </div>
        </div>
      )}
      {!locked && (
        <button type="button" className="btn-primary" disabled={!complete} onClick={submit}>
          Check matches
        </button>
      )}
    </div>
  );
}

// ---------- Ordering (move buttons, or drag and drop) ----------

function scrambled(steps: string[]): string[] {
  for (let i = 0; i < 10; i++) {
    const s = shuffle(steps);
    if (s.some((x, j) => x !== steps[j])) return s;
  }
  return [...steps].reverse();
}

function OrderingInput({ steps, locked, onAnswer, revealResult = true }: Props & { steps: string[] }) {
  const [order, setOrder] = useState(() => scrambled(steps));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const submitted = checked && revealResult;
  const [announce, setAnnounce] = useState('');

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || locked) return;
    setOrder((o) => {
      const next = [...o];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
    setAnnounce(`Moved "${order[from]}" to position ${to + 1}.`);
  };

  const submit = () => {
    setChecked(true);
    onAnswer({ correct: isOrderingCorrect(steps, order), response: order.map((s, i) => `${i + 1}. ${s}`).join('  ') });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm muted">Use the arrow buttons (or drag on a computer) to put the steps in order, first at the top.</p>
      <ol className="space-y-2">
        {order.map((s, i) => {
          const right = submitted && steps[i] === s;
          const wrong = submitted && steps[i] !== s;
          return (
            <li
              key={s}
              draggable={!locked}
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => !locked && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              className={[
                'flex items-center gap-3 rounded-lg border bg-surface p-3',
                right ? 'border-emerald-600 dark:border-emerald-500' : '',
                wrong ? 'border-red-600 dark:border-red-500' : '',
                !submitted ? 'border-line' : '',
                !locked ? 'cursor-grab' : '',
              ].join(' ')}
            >
              <span className="kbd shrink-0">{i + 1}</span>
              <span className="flex-1">
                {s}
                {right && <span className="sr-only"> (correct position)</span>}
                {wrong && <span className="sr-only"> (wrong position)</span>}
              </span>
              {!locked && (
                <span className="flex shrink-0 gap-1">
                  <button type="button" className="btn-ghost min-h-[36px] px-2" aria-label={`Move "${s}" up`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-ghost min-h-[36px] px-2"
                    aria-label={`Move "${s}" down`}
                    disabled={i === order.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    ↓
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {!locked && (
        <button type="button" className="btn-primary" onClick={submit}>
          Check order
        </button>
      )}
    </div>
  );
}
