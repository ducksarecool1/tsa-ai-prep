import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useApp, type BankOverride } from '../state/AppContext';
import type { Difficulty, Question, QuestionType } from '../types';
import { QUESTION_TYPES, QUESTION_TYPE_LABELS } from '../types';
import { validateContent, validateQuestion } from '../lib/validateContent';
import { downloadJson, parseBankImport } from '../lib/storage';
import { displayAnswerFor } from '../lib/items';
import { localDate } from '../lib/stats';

const lines = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

interface FormState {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  answerText: string;
  answerBool: boolean;
  accepted: string;
  confusable: string;
  writtenOptions: string;
  orderInsensitive: boolean;
  hint: string;
  pairs: string;
  steps: string;
  explanation: string;
  difficulty: Difficulty;
  tags: string;
}

function toForm(q: Question): FormState {
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.type === 'mc' || q.type === 'scenario' ? [...q.options, '', '', '', ''].slice(0, 4) : ['', '', '', ''],
    answerText: typeof q.answer === 'string' ? q.answer : '',
    answerBool: q.type === 'tf' ? q.answer : true,
    accepted: (q.acceptedAnswers ?? []).join('\n'),
    confusable: (q.confusableWith ?? []).join('\n'),
    writtenOptions: q.type === 'written' ? (q.options ?? []).join('\n') : '',
    orderInsensitive: q.orderInsensitive ?? false,
    hint: q.hint ?? '',
    pairs: q.type === 'matching' ? q.answer.map((p) => `${p.term} | ${p.definition}`).join('\n') : '',
    steps: q.type === 'ordering' ? q.answer.join('\n') : '',
    explanation: q.explanation,
    difficulty: q.difficulty,
    tags: q.tags.join(', '),
  };
}

function emptyForm(id: string): FormState {
  return {
    id,
    type: 'mc',
    prompt: '',
    options: ['', '', '', ''],
    answerText: '',
    answerBool: true,
    accepted: '',
    confusable: '',
    writtenOptions: '',
    orderInsensitive: false,
    hint: '',
    pairs: '',
    steps: '',
    explanation: '',
    difficulty: 1,
    tags: '',
  };
}

function fromForm(f: FormState, unitId: string): Question {
  const base = {
    id: f.id.trim(),
    unitId,
    prompt: f.prompt.trim(),
    explanation: f.explanation.trim(),
    difficulty: f.difficulty,
    tags: f.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };
  const optional = {
    ...(lines(f.accepted).length ? { acceptedAnswers: lines(f.accepted) } : {}),
    ...(lines(f.confusable).length ? { confusableWith: lines(f.confusable) } : {}),
    ...(f.hint.trim() ? { hint: f.hint.trim() } : {}),
  };
  switch (f.type) {
    case 'mc':
    case 'scenario':
      return { ...base, ...optional, type: f.type, options: f.options.map((o) => o.trim()), answer: f.answerText.trim() };
    case 'tf':
      return { ...base, type: 'tf', answer: f.answerBool };
    case 'written':
      return {
        ...base,
        ...optional,
        type: 'written',
        answer: f.answerText.trim(),
        acceptedAnswers: lines(f.accepted),
        ...(lines(f.writtenOptions).length ? { options: lines(f.writtenOptions) } : {}),
        ...(f.orderInsensitive ? { orderInsensitive: true } : {}),
      };
    case 'matching':
      return {
        ...base,
        type: 'matching',
        answer: lines(f.pairs).map((l) => {
          const [term, ...rest] = l.split('|');
          return { term: term.trim(), definition: rest.join('|').trim() };
        }),
      };
    case 'ordering':
      return { ...base, type: 'ordering', answer: lines(f.steps) };
  }
}

export function AdvisorPage() {
  const { content, bundled, bankOverride, setBankOverride, flags, removeFlag, replaceFlags, knownTerms, settings } = useApp();
  const [unitId, setUnitId] = useState(content.units[0]?.id ?? '');
  const [form, setForm] = useState<FormState | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const unit = content.units.find((u) => u.id === unitId);
  const report = useMemo(() => validateContent(content), [content]);
  const allIds = useMemo(
    () => new Set(content.units.flatMap((u) => [...u.questions.map((q) => q.id), ...u.terms.map((t) => t.id)])),
    [content.units],
  );

  if (!settings.advisorMode) {
    return (
      <div className="card">
        <h1>Advisor tools</h1>
        <p className="mt-2">
          Turn on Advisor mode in <a href="#/settings">Settings</a> to use these tools.
        </p>
      </div>
    );
  }
  if (!unit) return null;

  const saveUnitQuestions = (questions: Question[]) => {
    const next: BankOverride = { ...(bankOverride ?? {}), [unit.id]: questions };
    setBankOverride(next);
  };

  const startNew = () => {
    let n = unit.questions.length + 1;
    let id = `${unit.id}-q${String(n).padStart(2, '0')}`;
    while (allIds.has(id)) id = `${unit.id}-q${String(++n).padStart(2, '0')}`;
    setForm(emptyForm(id));
    setIsNew(true);
    setErrors([]);
  };

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const q = fromForm(form, unit.id);
    const errs = validateQuestion(q, knownTerms);
    if (isNew && allIds.has(q.id)) errs.unshift(`The id "${q.id}" is already used.`);
    if (errs.length) {
      setErrors(errs);
      return;
    }
    const questions = isNew ? [...unit.questions, q] : unit.questions.map((x) => (x.id === q.id ? q : x));
    saveUnitQuestions(questions);
    setForm(null);
    setErrors([]);
    setStatus(`Saved ${q.id}.`);
  };

  const remove = (id: string) => {
    if (!window.confirm(`Delete question ${id}? You can undo this with "Reset to built-in questions" (which also undoes other edits).`)) return;
    saveUnitQuestions(unit.questions.filter((q) => q.id !== id));
    setStatus(`Deleted ${id}.`);
  };

  const exportBank = () =>
    downloadJson(`ai-prep-question-bank-${localDate()}.json`, {
      app: 'ai-prep-bank',
      version: 1,
      exportedAt: new Date().toISOString(),
      questions: content.units.flatMap((u) => u.questions),
    });

  const importBank = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const questions = parseBankImport(await file.text());
      const byUnit: BankOverride = {};
      const unitIds = new Set(content.units.map((u) => u.id));
      const errs: string[] = [];
      for (const q of questions) {
        if (!unitIds.has(q.unitId)) errs.push(`Question ${q.id}: unknown unitId "${q.unitId}"`);
        else (byUnit[q.unitId] ??= []).push(q);
        errs.push(...validateQuestion(q, knownTerms));
      }
      if (errs.length) {
        setErrors(errs.slice(0, 30));
        setStatus('');
        return;
      }
      if (!window.confirm(`Replace the questions in ${Object.keys(byUnit).length} unit(s) with ${questions.length} imported questions?`)) return;
      setBankOverride({ ...(bankOverride ?? {}), ...byUnit });
      setErrors([]);
      setStatus(`Imported ${questions.length} questions.`);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Import failed.']);
    }
  };

  const resetBank = () => {
    if (window.confirm('Discard all question edits made in this browser and go back to the built-in questions?')) {
      setBankOverride(null);
      setStatus('Restored the built-in question bank.');
    }
  };

  const f = form;
  const set = (patch: Partial<FormState>) => setForm((cur) => (cur ? { ...cur, ...patch } : cur));

  return (
    <div className="space-y-6">
      <div>
        <h1>Advisor tools</h1>
        <p className="mt-1 muted">
          Edits are saved in this browser. To share them with your chapter, export the question bank or download a unit file and replace the
          matching file in <code>src/content/units/</code> (see README).
        </p>
      </div>

      <section className="card space-y-3" aria-labelledby="bank-heading">
        <h2 id="bank-heading">Question bank</h2>
        <p className="text-sm">
          {content.units.reduce((n, u) => n + u.questions.length, 0)} questions ·{' '}
          {bankOverride ? `edited (${Object.keys(bankOverride).length} unit(s) changed)` : 'built-in, unedited'} ·{' '}
          {report.errors.length === 0 ? (
            <span className="text-emerald-700 dark:text-emerald-300">all validation checks pass</span>
          ) : (
            <span className="text-red-700 dark:text-red-300">{report.errors.length} validation problem(s)</span>
          )}
        </p>
        {report.errors.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-red-700 dark:text-red-300">
            {report.errors.slice(0, 10).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={exportBank}>
            Export question bank
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            Import question bank
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-hidden="true" tabIndex={-1} onChange={importBank} />
          <button type="button" className="btn-danger" disabled={!bankOverride} onClick={resetBank}>
            Reset to built-in questions
          </button>
        </div>
      </section>

      <section className="card space-y-4" aria-labelledby="questions-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="questions-heading">Questions</h2>
            <label htmlFor="advisor-unit" className="label mt-2">
              Unit
            </label>
            <select id="advisor-unit" className="input" value={unitId} onChange={(e) => { setUnitId(e.target.value); setForm(null); }}>
              {content.units.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.number}: {u.title} ({u.questions.length})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={startNew}>
              Add question
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => downloadJson(`${unit.id}.json`, unit)}
              title="Download this unit as a JSON content file"
            >
              Download unit file
            </button>
          </div>
        </div>

        {status && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
            {status}
          </p>
        )}
        {errors.length > 0 && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            <p className="font-semibold">Please fix these problems:</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {f && (
          <form onSubmit={save} className="space-y-4 rounded-xl border-2 border-brand-400 p-4">
            <h3>{isNew ? 'New question' : `Edit ${f.id}`}</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="q-id" className="label">ID</label>
                <input id="q-id" className="input" value={f.id} disabled={!isNew} onChange={(e) => set({ id: e.target.value })} />
              </div>
              <div>
                <label htmlFor="q-type" className="label">Type</label>
                <select id="q-type" className="input" value={f.type} onChange={(e) => set({ type: e.target.value as QuestionType })}>
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="q-diff" className="label">Difficulty</label>
                <select id="q-diff" className="input" value={f.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) as Difficulty })}>
                  <option value={1}>1 (easy)</option>
                  <option value={2}>2 (medium)</option>
                  <option value={3}>3 (hard)</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="q-prompt" className="label">Question</label>
              <textarea id="q-prompt" className="input min-h-[80px]" value={f.prompt} onChange={(e) => set({ prompt: e.target.value })} />
            </div>

            {(f.type === 'mc' || f.type === 'scenario') && (
              <fieldset className="space-y-2">
                <legend className="label">Options (select the correct one)</legend>
                {f.options.map((o, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-option"
                      aria-label={`Option ${i + 1} is correct`}
                      className="h-4 w-4 accent-brand-600"
                      checked={!!o && f.answerText === o}
                      onChange={() => set({ answerText: o })}
                    />
                    <input
                      className="input"
                      aria-label={`Option ${i + 1}`}
                      value={o}
                      onChange={(e) => {
                        const options = [...f.options];
                        const wasAnswer = f.answerText === options[i];
                        options[i] = e.target.value;
                        set({ options, ...(wasAnswer ? { answerText: e.target.value } : {}) });
                      }}
                    />
                  </div>
                ))}
              </fieldset>
            )}

            {f.type === 'tf' && (
              <fieldset>
                <legend className="label">Correct answer</legend>
                <div className="flex gap-4">
                  {[true, false].map((v) => (
                    <label key={String(v)} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="tf" className="h-4 w-4 accent-brand-600" checked={f.answerBool === v} onChange={() => set({ answerBool: v })} />
                      {v ? 'True' : 'False'}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {f.type === 'written' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="q-answer" className="label">Answer</label>
                  <input id="q-answer" className="input" value={f.answerText} onChange={(e) => set({ answerText: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="q-hint" className="label">Hint after "Almost" (optional)</label>
                  <input id="q-hint" className="input" value={f.hint} onChange={(e) => set({ hint: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="q-mc-options" className="label">Multiple-choice options for first exposure (optional, 4 lines, include the answer)</label>
                  <textarea id="q-mc-options" className="input min-h-[96px]" value={f.writtenOptions} onChange={(e) => set({ writtenOptions: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 self-start text-sm">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={f.orderInsensitive} onChange={() => set({ orderInsensitive: !f.orderInsensitive })} />
                  Parts may be typed in any order (separate parts with commas)
                </label>
              </div>
            )}

            {(f.type === 'written' || f.type === 'mc' || f.type === 'scenario') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="q-accepted" className="label">
                    Also accept (one per line){f.type !== 'written' ? ', which enables typed recall in Learn Mode' : ''}
                  </label>
                  <textarea id="q-accepted" className="input min-h-[96px]" value={f.accepted} onChange={(e) => set({ accepted: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="q-confusable" className="label">Never accept (similar but wrong terms, one per line)</label>
                  <textarea id="q-confusable" className="input min-h-[96px]" value={f.confusable} onChange={(e) => set({ confusable: e.target.value })} />
                </div>
              </div>
            )}

            {f.type === 'matching' && (
              <div>
                <label htmlFor="q-pairs" className="label">Pairs, one per line, as: term | definition</label>
                <textarea id="q-pairs" className="input min-h-[120px] font-mono text-sm" value={f.pairs} onChange={(e) => set({ pairs: e.target.value })} />
              </div>
            )}

            {f.type === 'ordering' && (
              <div>
                <label htmlFor="q-steps" className="label">Steps in the correct order, one per line</label>
                <textarea id="q-steps" className="input min-h-[120px]" value={f.steps} onChange={(e) => set({ steps: e.target.value })} />
              </div>
            )}

            <div>
              <label htmlFor="q-expl" className="label">Explanation (1 to 3 sentences)</label>
              <textarea id="q-expl" className="input min-h-[72px]" value={f.explanation} onChange={(e) => set({ explanation: e.target.value })} />
            </div>
            <div>
              <label htmlFor="q-tags" className="label">Tags (comma separated)</label>
              <input id="q-tags" className="input" value={f.tags} onChange={(e) => set({ tags: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary">Save question</button>
              <button type="button" className="btn-ghost" onClick={() => { setForm(null); setErrors([]); }}>Cancel</button>
            </div>
          </form>
        )}

        <ul className="divide-y divide-line">
          {unit.questions.map((q) => (
            <li key={q.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs muted">
                  {q.id} · {QUESTION_TYPE_LABELS[q.type]} · difficulty {q.difficulty}
                </p>
                <p className="font-medium">{q.prompt}</p>
                <p className="truncate text-sm muted">Answer: {displayAnswerFor(q)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="btn-secondary" onClick={() => { setForm(toForm(q)); setIsNew(false); setErrors([]); window.scrollTo({ top: 0 }); }}>
                  Edit
                </button>
                <button type="button" className="btn-danger" onClick={() => remove(q.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {bundled.units.find((u) => u.id === unit.id)?.questions.length !== unit.questions.length && (
          <p className="text-xs muted">This unit has been edited in this browser.</p>
        )}
      </section>

      <section className="card space-y-3" aria-labelledby="flags-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="flags-heading">"I was right" flags ({flags.length})</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={flags.length === 0} onClick={() => downloadJson(`ai-prep-flags-${localDate()}.json`, flags)}>
              Export flags
            </button>
            <button type="button" className="btn-danger" disabled={flags.length === 0} onClick={() => window.confirm('Clear all flags?') && replaceFlags([])}>
              Clear all
            </button>
          </div>
        </div>
        <p className="text-sm muted">
          Answers students counted as correct with "I was right" (or that the AI accepted). Review them to find answer-key gaps, then add good
          ones to "Also accept." Flags are stored in each student's browser and included in their progress export.
        </p>
        {flags.length === 0 ? (
          <p className="text-sm">No flags yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="p-2">Question</th>
                  <th scope="col" className="p-2">Student answer</th>
                  <th scope="col" className="p-2">Expected</th>
                  <th scope="col" className="p-2">Source</th>
                  <th scope="col" className="p-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {[...flags].reverse().map((fl) => (
                  <tr key={fl.id} className="border-b border-line align-top">
                    <td className="p-2">
                      <span className="block text-xs muted">{fl.itemId} · {new Date(fl.timestamp).toLocaleDateString()}</span>
                      {fl.prompt}
                    </td>
                    <td className="p-2 font-medium">{fl.studentAnswer}</td>
                    <td className="p-2">{fl.expected}</td>
                    <td className="p-2">{fl.source === 'ai' ? 'AI check' : 'Student'}</td>
                    <td className="p-2">
                      <button type="button" className="btn-ghost min-h-[36px]" onClick={() => removeFlag(fl.id)} aria-label={`Dismiss flag for ${fl.itemId}`}>
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
