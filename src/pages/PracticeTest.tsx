import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import type { Question } from '../types';
import { displayAnswerFor, nativePresentation, type Presentation } from '../lib/items';
import { shuffle } from '../lib/random';
import { AnswerInput, type AnswerResult } from '../components/AnswerInput';
import { ProgressBar } from '../components/ProgressBar';
import { UnitPicker } from '../components/UnitPicker';

interface TestItem {
  question: Question;
  presentation: Presentation;
}

interface TestRun {
  items: TestItem[];
  unitIds: string[];
  startedAt: number;
  /** Seconds, or null when untimed. */
  limit: number | null;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PracticeTestPage({ params }: { params: URLSearchParams }) {
  const { content, recordItem, recordTest, knownTerms } = useApp();
  const allUnitIds = content.units.map((u) => u.id);
  const [unitIds, setUnitIds] = useState<string[]>(() => {
    const u = params.get('unit');
    return u && allUnitIds.includes(u) ? [u] : allUnitIds;
  });
  const [count, setCount] = useState(20);
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(20);
  const [run, setRun] = useState<TestRun | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerResult>>({});
  const [finished, setFinished] = useState(false);
  const [now, setNow] = useState(Date.now());
  const finishedRef = useRef(false);

  const pool = content.units.filter((u) => unitIds.includes(u.id)).flatMap((u) => u.questions);

  const start = (questions: Question[] = pool) => {
    const picked = shuffle(questions).slice(0, Math.min(count, questions.length));
    setRun({
      items: picked.map((q) => ({ question: q, presentation: nativePresentation(q, Math.random, false) })),
      unitIds,
      startedAt: Date.now(),
      limit: timed ? minutes * 60 : null,
    });
    setIndex(0);
    setAnswers({});
    setFinished(false);
    finishedRef.current = false;
    setNow(Date.now());
  };

  const finish = () => {
    if (!run || finishedRef.current) return;
    finishedRef.current = true;
    const t = Date.now();
    let score = 0;
    for (const item of run.items) {
      const a = answers[item.question.id];
      if (!a) continue;
      if (a.correct) score++;
      recordItem(item.question.id, a.correct);
    }
    recordTest(run.unitIds, score, run.items.length);
    setNow(t);
    setFinished(true);
  };

  const remaining = run?.limit != null ? run.limit - (now - run.startedAt) / 1000 : null;

  useEffect(() => {
    if (!run || finished || run.limit == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [run, finished]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !finished) finish();
  });

  if (!run) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Practice Test</h1>
          <p className="mt-1 muted">Answer every question, then see your score and a review of each miss. No hints and no retries.</p>
        </div>
        <div className="card space-y-6">
          <UnitPicker units={content.units} selected={unitIds} onChange={setUnitIds} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="test-count" className="label">
                Number of questions
              </label>
              <select id="test-count" className="input" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={timed} onChange={() => setTimed((t) => !t)} />
              Timed test
            </label>
            {timed && (
              <div>
                <label htmlFor="test-minutes" className="label">
                  Time limit (minutes)
                </label>
                <input
                  id="test-minutes"
                  type="number"
                  min={1}
                  max={180}
                  className="input"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                />
              </div>
            )}
          </div>
          <button type="button" className="btn-primary" disabled={pool.length === 0} onClick={() => start()}>
            Start test ({Math.min(count, pool.length)} questions)
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const score = run.items.filter((i) => answers[i.question.id]?.correct).length;
    const pct = Math.round((score / run.items.length) * 100);
    const missed = run.items.filter((i) => !answers[i.question.id]?.correct);
    const used = (now - run.startedAt) / 1000;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="card text-center">
          <h1>Your score: {pct}%</h1>
          <p className="mt-2">
            {score} of {run.items.length} correct · Time: {formatTime(used)}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => start(run.items.map((i) => i.question))}>
              Retake these questions
            </button>
            <button type="button" className="btn-secondary" onClick={() => setRun(null)}>
              New test
            </button>
            <a href="#/learn?start=mistakes" className="btn-secondary">
              Review My Mistakes
            </a>
          </div>
        </div>
        {missed.length > 0 && (
          <section className="space-y-3">
            <h2>Review: {missed.length} missed</h2>
            {missed.map((item) => {
              const a = answers[item.question.id];
              return (
                <article key={item.question.id} className="card space-y-2">
                  <p className="font-semibold">{item.question.prompt}</p>
                  <p className="text-sm">
                    <span className="font-medium">Your answer: </span>
                    {a ? a.response || '(no answer)' : '(not answered)'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Correct answer: </span>
                    <strong>{displayAnswerFor(item.question)}</strong>
                  </p>
                  <p className="text-sm muted">{item.question.explanation}</p>
                </article>
              );
            })}
          </section>
        )}
      </div>
    );
  }

  const item = run.items[index];
  const answered = answers[item.question.id];
  const isLast = index === run.items.length - 1;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl">
          Question {index + 1} of {run.items.length}
        </h1>
        {remaining !== null && (
          <span className={`chip text-sm ${remaining < 60 ? 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100' : ''}`} aria-label={`Time remaining ${formatTime(remaining)}`}>
            ⏱ {formatTime(remaining)}
          </span>
        )}
      </div>
      <ProgressBar value={answeredCount / run.items.length} label={`${answeredCount} of ${run.items.length} answered`} />
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold leading-snug sm:text-xl">{item.question.prompt}</h2>
        <AnswerInput
          key={item.question.id}
          presentation={item.presentation}
          locked={!!answered}
          revealResult={false}
          onAnswer={(r) => setAnswers((a) => ({ ...a, [item.question.id]: r }))}
          knownTerms={knownTerms}
        />
        {answered && item.presentation.format === 'written' && (
          <p className="mt-3 rounded-xl bg-raised px-4 py-2.5">{answered.response || "I don't know"}</p>
        )}
        {answered && <p className="mt-3 text-sm muted" role="status">Answer saved.</p>}
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" className="btn-ghost" onClick={finish}>
          Finish test now
        </button>
        {isLast ? (
          <button type="button" className="btn-primary" onClick={finish}>
            Finish and see score
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => setIndex((i) => i + 1)}>
            {answered ? 'Next question' : 'Skip'}
          </button>
        )}
      </div>
    </div>
  );
}
