import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import type { AnswerWith, IncludeKey, MasteryLevel } from '../types';
import { QUESTION_TYPE_LABELS } from '../types';
import { buildStudyItems, cardForItem, itemLabel, type StudyCard, type StudyItem } from '../lib/items';
import { mistakeItems, selectSessionItems } from '../lib/selection';
import {
  answerCurrent,
  createLearnSession,
  currentItemId,
  sessionCounts,
  sessionProgress,
  startNextRound,
} from '../lib/learnSession';
import { LEVEL_LABELS } from '../lib/mastery';
import { aiEnabled, checkAnswerWithAI } from '../lib/ai';
import { AnswerInput, COMPOSER_FORMATS, type AnswerResult } from '../components/AnswerInput';
import { Feedback } from '../components/Feedback';
import { ProgressBar } from '../components/ProgressBar';
import { StudentMessage, TutorMessage } from '../components/Chat';
import { ChallengeBrief, PromptReviewView } from '../components/PromptPractice';
import { Icon } from '../components/Icon';

const INCLUDE_KEYS: IncludeKey[] = ['mc', 'tf', 'written', 'matching', 'scenario', 'ordering', 'term', 'prompt'];
const INCLUDE_LABELS: Record<IncludeKey, string> = { ...QUESTION_TYPE_LABELS, term: 'Glossary terms', prompt: 'Prompt practice' };
const ALL_TYPES: Record<IncludeKey, boolean> = {
  mc: true,
  tf: true,
  written: true,
  matching: true,
  scenario: true,
  ordering: true,
  term: true,
  prompt: true,
};

interface ActiveSession {
  items: StudyItem[];
  title: string;
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        on ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-ink-soft hover:border-ink/30 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

export function LearnPage({ params }: { params: URLSearchParams }) {
  const { content, settings, updateSettings, progress, setLastUnits } = useApp();
  const allUnitIds = content.units.map((u) => u.id);
  const [unitIds, setUnitIds] = useState<string[]>(() => {
    const u = params.get('unit');
    if (u && allUnitIds.includes(u)) return [u];
    return progress.lastUnitIds.length ? progress.lastUnitIds.filter((id) => allUnitIds.includes(id)) : allUnitIds;
  });
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [message, setMessage] = useState('');

  const items = useMemo(() => buildStudyItems(content, unitIds, settings.includeTypes), [content, unitIds, settings.includeTypes]);

  const startNormal = (ids: string[] = unitIds) => {
    const pool = buildStudyItems(content, ids, settings.includeTypes);
    if (pool.length === 0) {
      setMessage('Nothing matches your choices. Pick at least one unit and one kind of practice.');
      return;
    }
    const chosen = selectSessionItems(
      pool.map((i) => i.id),
      progress.items,
      settings.sessionLength,
      Date.now(),
    );
    const byId = new Map(pool.map((i) => [i.id, i]));
    setLastUnits(ids);
    setMessage('');
    setActive({ items: chosen.map((id) => byId.get(id)!), title: 'Learn' });
  };

  const startMistakes = (ids: string[] = allUnitIds) => {
    const pool = buildStudyItems(content, ids, ALL_TYPES);
    const missed = mistakeItems(
      pool.map((i) => i.id),
      progress.items,
    );
    if (missed.length === 0) {
      setMessage("You haven't missed anything yet. Start a regular session first.");
      return;
    }
    const limited = settings.sessionLength > 0 ? missed.slice(0, settings.sessionLength) : missed;
    const byId = new Map(pool.map((i) => [i.id, i]));
    setMessage('');
    setActive({ items: limited.map((id) => byId.get(id)!), title: 'Review my mistakes' });
  };

  // Deep links from the home page: #/learn?start=continue or #/learn?start=mistakes
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current) return;
    const start = params.get('start');
    if (start === 'continue') {
      autoStarted.current = true;
      startNormal(progress.lastUnitIds.length ? progress.lastUnitIds : allUnitIds);
    } else if (start === 'mistakes') {
      autoStarted.current = true;
      startMistakes();
    }
    // Runs once, on the first render of this page.
  }, []);

  if (active) {
    return (
      <LearnSessionView
        key={active.title + active.items.map((i) => i.id).join()}
        session={active}
        onExit={() => setActive(null)}
        onReviewMistakes={() => startMistakes()}
      />
    );
  }

  const mistakesCount = mistakeItems(
    buildStudyItems(content, allUnitIds, ALL_TYPES).map((i) => i.id),
    progress.items,
  ).length;
  const toggleUnit = (id: string) =>
    setUnitIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : allUnitIds.filter((u) => u === id || cur.includes(u))));
  const toggleType = (k: IncludeKey) => updateSettings((s) => ({ includeTypes: { ...s.includeTypes, [k]: !s.includeTypes[k] } }));
  const practiceSelected = settings.includeTypes.prompt && unitIds.some((id) => items.some((i) => i.unitId === id && (i.kind === 'challenge' || i.kind === 'spot')));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="pt-4 text-center sm:pt-10">
        <h1 className="font-display text-3xl font-normal sm:text-4xl">What would you like to study?</h1>
        <p className="mt-3 text-ink-soft">
          Adaptive practice in short rounds. Items start as multiple choice, come back as typed answers, and anything you miss returns a few
          questions later.
        </p>
      </div>

      <section aria-labelledby="units-label" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="units-label" className="text-sm font-medium text-ink-soft">
            Units
          </h2>
          <button type="button" className="text-sm text-accent hover:underline" onClick={() => setUnitIds(unitIds.length === allUnitIds.length ? [] : allUnitIds)}>
            {unitIds.length === allUnitIds.length ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {content.units.map((u) => (
            <Pill key={u.id} on={unitIds.includes(u.id)} onClick={() => toggleUnit(u.id)}>
              {u.number}. {u.title}
            </Pill>
          ))}
        </div>
      </section>

      <section aria-labelledby="types-label" className="space-y-3">
        <h2 id="types-label" className="text-sm font-medium text-ink-soft">
          Kinds of practice
        </h2>
        <div className="flex flex-wrap gap-2">
          {INCLUDE_KEYS.map((k) => (
            <Pill key={k} on={settings.includeTypes[k]} onClick={() => toggleType(k)}>
              {k === 'prompt' && <Icon name="wand" className="mr-1 inline h-4 w-4 align-[-3px]" />}
              {INCLUDE_LABELS[k]}
            </Pill>
          ))}
        </div>
        {practiceSelected && (
          <p className="text-sm text-ink-soft">
            Prompt practice (from Unit 7) asks you to write real prompts.{' '}
            {aiEnabled(settings.ai) ? (
              'The AI coach will run each prompt and review it.'
            ) : (
              <>
                They are checked offline; <a href="#/settings">add an API key</a> to have the AI coach run and review them.
              </>
            )}
          </p>
        )}
      </section>

      <details className="card group p-0 sm:p-0">
        <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-medium">
          Session options
          <Icon name="arrowRight" className="h-4 w-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-2">
          <div>
            <label htmlFor="answer-with" className="label">
              Glossary terms: answer with
            </label>
            <select id="answer-with" className="input" value={settings.answerWith} onChange={(e) => updateSettings({ answerWith: e.target.value as AnswerWith })}>
              <option value="term">Term</option>
              <option value="definition">Definition (multiple choice)</option>
              <option value="both">Both (mixed)</option>
            </select>
          </div>
          <div>
            <label htmlFor="session-length" className="label">
              Session length
            </label>
            <select id="session-length" className="input" value={settings.sessionLength} onChange={(e) => updateSettings({ sessionLength: Number(e.target.value) })}>
              {[10, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n} items
                </option>
              ))}
              <option value={0}>All selected items</option>
            </select>
          </div>
          <div>
            <label htmlFor="round-size" className="label">
              Questions per round
            </label>
            <select id="round-size" className="input" value={settings.roundSize} onChange={(e) => updateSettings({ roundSize: Number(e.target.value) })}>
              {[7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={settings.shuffle} onChange={() => updateSettings({ shuffle: !settings.shuffle })} />
            Shuffle question order
          </label>
        </div>
      </details>

      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary px-6" disabled={items.length === 0} onClick={() => startNormal()}>
            Start session
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
          <button type="button" className="btn-secondary" disabled={mistakesCount === 0} onClick={() => startMistakes()}>
            Review my mistakes ({mistakesCount})
          </button>
        </div>
        <p className="text-sm text-ink-soft">{items.length} items available</p>
        {message && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-300">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

interface Pending extends AnswerResult {
  note?: string;
}

interface HistoryEntry {
  card: StudyCard;
  result: Pending;
}

function responseText(r: Pending): string {
  return r.response ? r.response : "I don't know";
}

/** A finished exchange from earlier in this round, shown compactly. */
function PastExchange({ entry }: { entry: HistoryEntry }) {
  const { card, result } = entry;
  return (
    <div className="space-y-4 opacity-80">
      <TutorMessage>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{card.label}</p>
        <p>{card.presentation.format === 'prompt' ? card.presentation.challenge.title : card.presentation.prompt}</p>
      </TutorMessage>
      <StudentMessage>{responseText(result)}</StudentMessage>
      <TutorMessage>
        <p className={`text-sm font-semibold ${result.correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
          {result.review
            ? `Score ${result.review.score}. ${result.correct ? 'Passed.' : 'Not passed yet.'}`
            : result.correct
              ? 'Correct.'
              : `Not quite. The answer is ${card.displayAnswer}.`}
        </p>
      </TutorMessage>
    </div>
  );
}

function LearnSessionView({
  session,
  onExit,
  onReviewMistakes,
}: {
  session: ActiveSession;
  onExit: () => void;
  onReviewMistakes: () => void;
}) {
  const { progress, settings, recordItem, recordPrompt, addFlag, knownTerms, termPool } = useApp();
  const itemMap = useMemo(() => new Map(session.items.map((i) => [i.id, i])), [session.items]);
  const [state, setState] = useState(() => {
    const levels: Record<string, MasteryLevel> = {};
    for (const i of session.items) levels[i.id] = progress.items[i.id]?.level ?? 'new';
    return createLearnSession(
      session.items.map((i) => i.id),
      levels,
      settings.roundSize,
      { shuffle: settings.shuffle },
    );
  });
  const [pending, setPending] = useState<Pending | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [aiError, setAiError] = useState('');
  const continueRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const currentId = currentItemId(state);
  const level = currentId ? state.levels[currentId] : 'new';
  // A fresh card each time an item comes up (answeredTotal changes), so options reshuffle.
  const card = useMemo(
    () => (currentId ? cardForItem(itemMap.get(currentId)!, level, settings.answerWith, termPool, Math.random) : null),
    [currentId, level, state.answeredTotal, itemMap, settings.answerWith, termPool],
  );

  useEffect(() => {
    if (pending) continueRef.current?.focus({ preventScroll: true });
  }, [pending]);

  // Keep the newest message in view, like a chat.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [pending, state.answeredTotal, state.roundComplete]);

  const commit = () => {
    if (!pending || !currentId || !card) return;
    const next = answerCurrent(state, pending.correct);
    recordItem(currentId, pending.correct, next.levels[currentId]);
    if (pending.review) recordPrompt(currentId, pending.review.score);
    setHistory((h) => [...h, { card, result: pending }]);
    setPending(null);
    setAiStatus('idle');
    setAiError('');
    setState(next);
  };

  const nextRound = () => {
    setHistory([]);
    setState(startNextRound(state));
  };

  const override = () => {
    if (!pending || !card || !currentId) return;
    addFlag({ itemId: currentId, prompt: card.presentation.prompt, studentAnswer: pending.response, expected: card.displayAnswer, source: 'override' });
    setPending({ ...pending, correct: true, note: 'Counted as correct. Your answer was logged for your advisor to review.' });
  };

  const askAI = async () => {
    if (!pending || !card || card.presentation.format !== 'written' || !currentId) return;
    setAiStatus('loading');
    try {
      const spec = card.presentation.spec;
      const result = await checkAnswerWithAI(settings.ai, card.presentation.prompt, spec.answer, spec.acceptedAnswers ?? [], pending.response);
      if (result.correct) {
        addFlag({ itemId: currentId, prompt: card.presentation.prompt, studentAnswer: pending.response, expected: card.displayAnswer, source: 'ai' });
      }
      setPending({ ...pending, correct: result.correct, note: `AI check: ${result.feedback}` });
      setAiStatus('idle');
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : 'The AI check failed.');
    }
  };

  const counts = sessionCounts(state);
  const total = state.itemIds.length;

  const header = (
    <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-canvas/90 px-4 pb-3 pt-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {session.title} <span className="text-ink-soft">· Round {state.round}</span>
        </p>
        <button type="button" className="btn-ghost min-h-[32px] px-3 text-xs" onClick={onExit}>
          End session
        </button>
      </div>
      <ProgressBar
        className="mt-2 h-1.5"
        value={counts.mastered / total}
        secondary={counts.familiar / total}
        label={`Session progress ${Math.round(sessionProgress(state) * 100)}%`}
      />
      <p className="mt-1.5 text-xs text-ink-soft">
        {counts.mastered} mastered · {counts.familiar} familiar · {counts.new} new
      </p>
    </div>
  );

  if (state.finished && !pending) {
    const accuracy = state.answeredTotal ? Math.round((state.correctTotal / state.answeredTotal) * 100) : 0;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <TutorMessage>
          <h1 className="font-display text-2xl font-normal">Session complete. Nicely done.</h1>
          <p>
            You mastered all {total} items in {state.answeredTotal} answers, with {accuracy}% correct along the way.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={onExit}>
              New session
            </button>
            <button type="button" className="btn-secondary" onClick={onReviewMistakes}>
              Review my mistakes
            </button>
            <a href="#/" className="btn-ghost">
              Home
            </a>
          </div>
        </TutorMessage>
      </div>
    );
  }

  if (state.roundComplete && !pending) {
    const correct = state.roundAnswers.filter((a) => a.correct).length;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        {header}
        <TutorMessage>
          <h2>Round {state.round} done</h2>
          <p>
            You got {correct} of {state.roundAnswers.length} right this round. Here's where each item stands:
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {state.roundAnswers.map((a, i) => (
              <li key={i} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex gap-2">
                  <Icon name={a.correct ? 'check' : 'x'} className={`mt-0.5 h-4 w-4 shrink-0 ${a.correct ? 'text-emerald-600' : 'text-red-600'}`} />
                  <span className="sr-only">{a.correct ? 'Correct:' : 'Incorrect:'}</span>
                  <span>{itemLabel(itemMap.get(a.itemId))}</span>
                </span>
                <span className="chip shrink-0">{LEVEL_LABELS[state.levels[a.itemId]]}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary" autoFocus onClick={nextRound}>
            Continue to round {state.round + 1}
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </TutorMessage>
        <div ref={endRef} />
      </div>
    );
  }

  if (!card) return null;
  const p = card.presentation;
  const inComposer = COMPOSER_FORMATS.includes(p.format);
  const canAskAI = pending && !pending.correct && pending.response && p.format === 'written' && aiEnabled(settings.ai);

  const input = (
    <AnswerInput
      key={`${currentId}-${state.answeredTotal}`}
      presentation={p}
      locked={pending !== null}
      onAnswer={(r) => setPending(r)}
      knownTerms={knownTerms}
      allowRetry
    />
  );

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col">
      {header}
      <div className="flex-1 space-y-6 pb-6 pt-6">
        {history.map((h, i) => (
          <PastExchange key={i} entry={h} />
        ))}

        <TutorMessage>
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{card.label}</span>
            <span className="chip">{level === 'mastered' ? 'Review' : LEVEL_LABELS[level]}</span>
          </div>
          {p.format === 'prompt' ? (
            <>
              <h2 className="text-lg">{p.challenge.title}</h2>
              <ChallengeBrief challenge={p.challenge} />
            </>
          ) : (
            <h2 className="text-lg font-medium leading-snug">{p.prompt}</h2>
          )}
          {card.context?.map((c) => (
            <div key={c.label}>
              <p className="mb-1 text-sm font-medium text-ink-soft">{c.label}</p>
              <pre className="prose-block">{c.text}</pre>
            </div>
          ))}
          {!inComposer && <div className="pt-1">{input}</div>}
        </TutorMessage>

        {pending && (
          <>
            {(inComposer || p.format === 'matching' || p.format === 'ordering') && <StudentMessage>{responseText(pending)}</StudentMessage>}
            <TutorMessage>
              {pending.review && p.format === 'prompt' ? (
                <PromptReviewView review={pending.review} strongExample={p.challenge.strongExample} />
              ) : (
                <Feedback
                  correct={pending.correct}
                  displayAnswer={card.displayAnswer}
                  explanation={card.explanation}
                  response={inComposer ? undefined : pending.response}
                  confusedWith={pending.confusedWith}
                  note={pending.note}
                />
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button ref={continueRef} type="button" className="btn-primary" onClick={commit}>
                  Continue
                  <Icon name="arrowRight" className="h-4 w-4" />
                </button>
                {!pending.correct && pending.response && !pending.review && (
                  <button type="button" className="btn-secondary" onClick={override}>
                    I was right
                  </button>
                )}
                {canAskAI && (
                  <button type="button" className="btn-secondary" disabled={aiStatus === 'loading'} onClick={askAI}>
                    {aiStatus === 'loading' ? 'Asking the AI…' : 'Ask the AI to check my answer'}
                  </button>
                )}
              </div>
              {aiStatus === 'error' && (
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                  {aiError} Your answer was graded offline.
                </p>
              )}
            </TutorMessage>
          </>
        )}
        <div ref={endRef} />
      </div>

      {inComposer && !pending && <div className="sticky bottom-0 z-10 -mx-1 bg-gradient-to-t from-canvas via-canvas to-canvas/0 px-1 pb-4 pt-6">{input}</div>}
      {!inComposer && !pending && (
        <p className="pb-2 text-center text-xs text-ink-soft">
          Tip: press <span className="kbd">1</span>–<span className="kbd">4</span> to choose and <span className="kbd">Enter</span> to continue.
        </p>
      )}
    </div>
  );
}
