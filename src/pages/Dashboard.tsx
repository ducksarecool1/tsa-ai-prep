import { useApp } from '../state/AppContext';
import { buildStudyItems } from '../lib/items';
import { mistakeItems } from '../lib/selection';
import { computeStreak, dueCount, overallMastery, unitMastery, weakestTerms } from '../lib/stats';
import { ProgressBar } from '../components/ProgressBar';
import { AppMark, Icon, type IconName } from '../components/Icon';
import type { IncludeKey } from '../types';

const ALL_TYPES: Record<IncludeKey, boolean> = { mc: true, tf: true, written: true, matching: true, scenario: true, ordering: true, term: true, prompt: true };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function QuickStart({ href, icon, title, text, disabled }: { href: string; icon: IconName; title: string; text: string; disabled?: boolean }) {
  return (
    <a
      href={href}
      aria-disabled={disabled}
      className={`group flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-ink no-underline transition-colors hover:border-ink/25 hover:bg-raised hover:no-underline ${
        disabled ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <Icon name={icon} className="h-5 w-5 text-ink-soft group-hover:text-ink" />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs leading-relaxed text-ink-soft">{text}</span>
    </a>
  );
}

function Stat({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Icon name={icon} className="h-4 w-4" />
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>
    </div>
  );
}

export function Dashboard() {
  const { content, progress, settings } = useApp();
  const overall = overallMastery(content, progress.items);
  const streak = computeStreak(progress.studyDays);
  const due = dueCount(content, progress.items);
  const weak = weakestTerms(content.units, progress.items, 10);
  const allIds = buildStudyItems(content, content.units.map((u) => u.id), ALL_TYPES).map((i) => i.id);
  const mistakes = mistakeItems(allIds, progress.items).length;
  const started = Object.keys(progress.items).length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div className="flex flex-col items-center pt-4 text-center sm:pt-10">
        <AppMark className="mb-5 h-10 w-10" />
        <h1 className="font-display text-3xl font-normal sm:text-4xl">{started ? `${greeting()}. Ready to keep going?` : 'Learn how AI really works.'}</h1>
        <p className="mt-3 max-w-xl text-ink-soft">
          {started
            ? 'Your next session focuses on what you have missed and what is due for review.'
            : 'Short lessons, adaptive practice and hands-on prompt writing, built for TSA members and anyone curious about AI.'}
        </p>
        <a href="#/learn?start=continue" className="btn-primary mt-6 px-6">
          {started ? 'Continue learning' : 'Start learning'}
          <Icon name="arrowRight" className="h-4 w-4" />
        </a>
      </div>

      <section aria-label="Quick start" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickStart href="#/learn?start=mistakes" icon="target" title="Review mistakes" text={mistakes ? `${mistakes} items you missed, most-missed first` : 'Nothing missed yet'} disabled={mistakes === 0} />
        <QuickStart
          href="#/learn?unit=u7"
          icon="wand"
          title="Practice prompts"
          text={settings.ai.apiKey ? 'Write prompts and get AI coach reviews' : 'Write prompts and get scored feedback'}
        />
        <QuickStart href="#/test" icon="clock" title="Practice test" text="Timed or untimed, with a full review" />
        <QuickStart href="#/units" icon="book" title="Read a lesson" text={`${content.units.length} short lessons with diagrams`} />
      </section>

      <section aria-label="Your progress" className="grid gap-3 sm:grid-cols-3">
        <Stat icon="spark" label="Mastery" value={`${overall.percent}%`} sub={`${overall.mastered} of ${overall.total} items mastered`} />
        <Stat icon="flame" label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} sub={streak ? 'Study today to keep it going' : 'Answer a question to start one'} />
        <Stat icon="clock" label="Due for review" value={String(due)} sub="Scheduled by spaced repetition" />
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3" aria-labelledby="unit-mastery">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="unit-mastery">Units</h2>
            <span className="flex gap-3 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-600" /> Mastered
              </span>
              <span className="inline-flex items-center gap-1">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" /> Familiar
              </span>
            </span>
          </div>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {content.units.map((u) => {
              const m = unitMastery(content, u, progress.items);
              return (
                <li key={u.id} className="px-4 py-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                    <a href={`#/units/${u.id}`} className="font-medium text-ink">
                      {u.number}. {u.title}
                    </a>
                    <span className="shrink-0 tabular-nums text-ink-soft">{m.percent}%</span>
                  </div>
                  <ProgressBar className="h-1.5" value={m.total ? m.mastered / m.total : 0} secondary={m.total ? m.familiar / m.total : 0} label={`Unit ${u.number} mastery ${m.percent}%`} />
                </li>
              );
            })}
          </ul>
        </section>

        <section className="lg:col-span-2" aria-labelledby="weakest">
          <h2 id="weakest" className="mb-3">
            Weakest terms
          </h2>
          <div className="rounded-2xl border border-line bg-surface p-4">
            {weak.length === 0 ? (
              <p className="text-sm text-ink-soft">No missed terms yet. Terms you miss in Learn or Flashcards will show up here.</p>
            ) : (
              <ol className="space-y-2">
                {weak.map((w) => (
                  <li key={w.term.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{w.term.term}</span>
                    <span className="chip shrink-0">{Math.round(w.accuracy * 100)}%</span>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="#/flashcards" className="btn-secondary">
                Flashcards
              </a>
              <a href="#/glossary" className="btn-ghost">
                Glossary
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
