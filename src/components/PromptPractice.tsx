// Shared pieces for prompt practice in Learn Mode and the Prompt Lab.
import type { PromptChallenge } from '../types';
import { PASS_SCORE, type PromptReview } from '../lib/promptReview';
import { Icon } from './Icon';

export function ChallengeBrief({ challenge }: { challenge: PromptChallenge }) {
  return (
    <div className="space-y-3">
      <p>{challenge.scenario}</p>
      {challenge.weakPrompt && (
        <div>
          <p className="mb-1 text-sm font-medium text-ink-soft">Weak prompt to improve</p>
          <pre className="prose-block">{challenge.weakPrompt}</pre>
        </div>
      )}
      <details className="group rounded-xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium">
          What the coach looks for ({challenge.rubric.length})
          <Icon name="arrowRight" className="h-4 w-4 transition-transform group-open:rotate-90" />
        </summary>
        <ul className="space-y-1.5 border-t border-line px-4 py-3 text-sm">
          {challenge.rubric.map((r) => (
            <li key={r.id}>
              <span className="font-medium">{r.name}:</span> <span className="text-ink-soft">{r.description}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const color = score >= PASS_SCORE ? 'stroke-emerald-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-red-500';
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`Score ${score} out of 100`}>
      <svg viewBox="0 0 52 52" className="h-14 w-14 -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={r} className="fill-none stroke-line" strokeWidth="5" />
        <circle cx="26" cy="26" r={r} className={`fill-none ${color}`} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {score}
      </span>
    </div>
  );
}

export function PromptReviewView({ review, strongExample }: { review: PromptReview; strongExample: string }) {
  const passed = review.score >= PASS_SCORE;
  return (
    <div className="space-y-4" aria-live="polite">
      <div className="flex items-center gap-4">
        <ScoreRing score={review.score} />
        <div>
          <p className="font-semibold">
            {passed ? 'Nice work. This prompt passes.' : `Not there yet. ${PASS_SCORE} or higher passes.`}
          </p>
          <p className="text-sm text-ink-soft">{review.source === 'ai' ? 'Reviewed by the AI coach' : 'Checked with the offline checklist'}</p>
        </div>
      </div>
      {review.notice && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">{review.notice}</p>}
      <p>{review.summary}</p>
      <ul className="space-y-2">
        {review.criteria.map((c, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                c.met ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}
            >
              <Icon name={c.met ? 'check' : 'x'} className="h-3.5 w-3.5" />
            </span>
            <div className="text-sm">
              <p className="font-medium">
                <span className="sr-only">{c.met ? 'Met: ' : 'Missed: '}</span>
                {c.name}
              </p>
              <p className="text-ink-soft">{c.feedback}</p>
            </div>
          </li>
        ))}
      </ul>
      {review.output && (
        <details className="rounded-xl border border-line">
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">What the AI produced from your prompt</summary>
          <div className="whitespace-pre-wrap border-t border-line px-4 py-3 text-sm leading-relaxed">{review.output}</div>
        </details>
      )}
      {review.improvedPrompt && (
        <div>
          <p className="mb-1 text-sm font-medium text-ink-soft">The coach's revision of your prompt</p>
          <pre className="prose-block">{review.improvedPrompt}</pre>
        </div>
      )}
      <details className="rounded-xl border border-line">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">See an example strong prompt</summary>
        <pre className="m-3 prose-block">{strongExample}</pre>
      </details>
    </div>
  );
}
