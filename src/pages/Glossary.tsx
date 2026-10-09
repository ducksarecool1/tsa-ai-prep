import { useMemo, useState } from 'react';
import { useApp } from '../state/AppContext';
import { termItemId } from '../lib/items';
import { LEVEL_LABELS } from '../lib/mastery';
import { normalize } from '../lib/normalize';

export function GlossaryPage() {
  const { content, progress } = useApp();
  const [query, setQuery] = useState('');
  const [unitId, setUnitId] = useState('all');
  const unitNames = useMemo(() => Object.fromEntries(content.units.map((u) => [u.id, `Unit ${u.number}`])), [content.units]);

  const terms = useMemo(() => {
    const q = normalize(query);
    return content.units
      .filter((u) => unitId === 'all' || u.id === unitId)
      .flatMap((u) => u.terms)
      .filter((t) => {
        if (!q) return true;
        const hay = normalize([t.term, t.definition, t.example, ...(t.acceptedAnswers ?? [])].join(' '));
        return hay.includes(q);
      })
      .sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }));
  }, [content.units, query, unitId]);

  return (
    <div className="space-y-6">
      <div>
        <h1>Glossary</h1>
        <p className="mt-1 muted">Every key term from every unit, with a definition and an example.</p>
      </div>
      <div className="card grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="glossary-search" className="label">
            Search terms
          </label>
          <input
            id="glossary-search"
            type="search"
            className="input"
            placeholder="Try &quot;token&quot; or &quot;bias&quot;"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="glossary-unit" className="label">
            Unit
          </label>
          <select id="glossary-unit" className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            <option value="all">All units</option>
            {content.units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.number}: {u.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm muted" role="status">
        {terms.length} {terms.length === 1 ? 'term' : 'terms'}
      </p>
      <dl className="grid gap-3 md:grid-cols-2">
        {terms.map((t) => {
          const level = progress.items[termItemId(t)]?.level;
          return (
            <div key={t.id} className="card">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-lg font-semibold">{t.term}</dt>
                <span className="flex gap-1">
                  <span className="chip">{unitNames[t.unitId]}</span>
                  {level && <span className="chip">{LEVEL_LABELS[level]}</span>}
                </span>
              </div>
              <dd className="mt-1">{t.definition}</dd>
              <dd className="mt-1 text-sm muted">Example: {t.example}</dd>
              {t.acceptedAnswers && t.acceptedAnswers.length > 0 && (
                <dd className="mt-1 text-xs muted">Also called: {t.acceptedAnswers.join(', ')}</dd>
              )}
            </div>
          );
        })}
      </dl>
    </div>
  );
}
