import { useApp } from '../state/AppContext';
import { unitMastery } from '../lib/stats';
import { ProgressBar } from '../components/ProgressBar';
import { Diagram } from '../components/Diagram';

export function UnitsPage() {
  const { content, progress } = useApp();
  return (
    <div className="space-y-6">
      <div>
        <h1>Units</h1>
        <p className="mt-1 muted">Read a short lesson, then practice it in Learn Mode or with flashcards.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {content.units.map((u) => {
          const m = unitMastery(content, u, progress.items);
          return (
            <article key={u.id} className="card flex flex-col">
              <p className="text-sm font-semibold text-accent">Unit {u.number}</p>
              <h2 className="mt-1">{u.title}</h2>
              <p className="mt-2 flex-1 text-sm muted">{u.summary}</p>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs muted">
                  <span>
                    {u.questions.length} questions · {u.terms.length} terms
                  </span>
                  <span>{m.percent}% mastered</span>
                </div>
                <ProgressBar value={m.total ? m.mastered / m.total : 0} secondary={m.total ? m.familiar / m.total : 0} label={`Unit ${u.number} mastery`} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`#/units/${u.id}`} className="btn-primary">
                  Read lesson
                </a>
                <a href={`#/learn?unit=${u.id}`} className="btn-secondary">
                  Learn
                </a>
                <a href={`#/flashcards?unit=${u.id}`} className="btn-ghost">
                  Flashcards
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function LessonPage({ unitId }: { unitId: string }) {
  const { content } = useApp();
  const index = content.units.findIndex((u) => u.id === unitId);
  const unit = content.units[index];
  if (!unit) {
    return (
      <div className="card">
        <h1>Unit not found</h1>
        <p className="mt-2">
          <a href="#/units">Back to all units</a>
        </p>
      </div>
    );
  }
  const { lesson } = unit;
  const prev = content.units[index - 1];
  const next = content.units[index + 1];
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <a href="#/units" className="text-sm">
          ← All units
        </a>
        <p className="mt-3 text-sm font-semibold text-accent">
          Unit {unit.number}: {unit.title}
        </p>
        <h1 className="mt-1">{lesson.title}</h1>
      </div>

      {lesson.sections.map((s, i) => (
        <section key={s.heading} className="space-y-3">
          <h2>{s.heading}</h2>
          {s.paragraphs.map((p, j) => (
            <p key={j} className="leading-relaxed">
              {p}
            </p>
          ))}
          {s.bullets && (
            <ul className="list-disc space-y-2 pl-6 leading-relaxed">
              {s.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          )}
          {i === Math.min(lesson.diagramAfter ?? 0, lesson.sections.length - 1) && lesson.diagram && <Diagram diagram={lesson.diagram} />}
        </section>
      ))}

      {lesson.analogy && (
        <aside className="rounded-xl border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950">
          <h2 className="text-base">{lesson.analogy.title}</h2>
          <p className="mt-1 leading-relaxed">{lesson.analogy.text}</p>
        </aside>
      )}

      <section className="card">
        <h2>Key terms</h2>
        <dl className="mt-3 space-y-3">
          {unit.terms.map((t) => (
            <div key={t.id}>
              <dt className="font-semibold">{t.term}</dt>
              <dd className="text-sm">{t.definition}</dd>
              <dd className="text-sm muted">Example: {t.example}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2">
        <a href={`#/learn?unit=${unit.id}`} className="btn-primary">
          Learn this unit
        </a>
        <a href={`#/flashcards?unit=${unit.id}`} className="btn-secondary">
          Flashcards
        </a>
        <a href={`#/test?unit=${unit.id}`} className="btn-secondary">
          Practice test
        </a>
      </div>

      <nav aria-label="Lesson navigation" className="flex justify-between gap-4 border-t border-line pt-4 text-sm">
        {prev ? <a href={`#/units/${prev.id}`}>← Unit {prev.number}: {prev.title}</a> : <span />}
        {next ? <a href={`#/units/${next.id}`}>Unit {next.number}: {next.title} →</a> : <span />}
      </nav>
    </article>
  );
}
