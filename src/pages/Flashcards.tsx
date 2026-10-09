import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import type { Term } from '../types';
import { termItemId } from '../lib/items';
import { nextLevel } from '../lib/mastery';
import { shuffle } from '../lib/random';
import { UnitPicker } from '../components/UnitPicker';
import { ProgressBar } from '../components/ProgressBar';

export function FlashcardsPage({ params }: { params: URLSearchParams }) {
  const { content, progress, recordItem } = useApp();
  const allUnitIds = content.units.map((u) => u.id);
  const [unitIds, setUnitIds] = useState<string[]>(() => {
    const u = params.get('unit');
    return u && allUnitIds.includes(u) ? [u] : allUnitIds;
  });
  const [front, setFront] = useState<'term' | 'definition'>('term');
  const [deck, setDeck] = useState<Term[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});

  const available = content.units.filter((u) => unitIds.includes(u.id)).flatMap((u) => u.terms);

  const start = (terms: Term[]) => {
    setDeck(shuffle(terms));
    setIndex(0);
    setFlipped(false);
    setKnown({});
  };

  const card = deck?.[index];
  const done = deck !== null && index >= deck.length;

  const mark = (knowIt: boolean) => {
    if (!card) return;
    const id = termItemId(card);
    const current = progress.items[id]?.level ?? 'new';
    // Self-rating can move a card from New to Familiar, but only Learn Mode can master it.
    const level = knowIt ? (current === 'new' ? 'familiar' : current) : nextLevel(current, false);
    recordItem(id, knowIt, level);
    setKnown((k) => ({ ...k, [card.id]: knowIt }));
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        if (el?.tagName === 'BUTTON' && el.dataset.card !== 'true') return;
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === '1') mark(false);
      else if (e.key === '2') mark(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!deck) {
    return (
      <div className="space-y-6">
        <div>
          <h1>Flashcards</h1>
          <p className="mt-1 muted">Flip through glossary terms. Your ratings feed into Learn Mode and the dashboard.</p>
        </div>
        <div className="card space-y-6">
          <UnitPicker units={content.units} selected={unitIds} onChange={setUnitIds} />
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Show first</legend>
            <div className="flex gap-4">
              {(['term', 'definition'] as const).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="front" className="h-4 w-4 accent-brand-600" checked={front === f} onChange={() => setFront(f)} />
                  {f === 'term' ? 'Term' : 'Definition'}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-primary" disabled={available.length === 0} onClick={() => start(available)}>
              Start ({available.length} cards)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    const knowCount = Object.values(known).filter(Boolean).length;
    const learning = deck.filter((t) => known[t.id] === false);
    return (
      <div className="card mx-auto max-w-xl space-y-4 text-center">
        <h1>Deck finished</h1>
        <p>
          Know it: <strong>{knowCount}</strong> · Still learning: <strong>{learning.length}</strong>
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {learning.length > 0 && (
            <button type="button" className="btn-primary" onClick={() => start(learning)}>
              Study the {learning.length} "still learning" cards
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={() => setDeck(null)}>
            New deck
          </button>
          <a href="#/learn" className="btn-secondary">
            Go to Learn Mode
          </a>
        </div>
      </div>
    );
  }

  if (!card) return null;
  const showTerm = (front === 'term') !== flipped;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl">Flashcards</h1>
        <button type="button" className="btn-ghost" onClick={() => setDeck(null)}>
          End
        </button>
      </div>
      <ProgressBar value={index / deck.length} label={`Card ${index + 1} of ${deck.length}`} />
      <p className="text-sm muted">
        Card {index + 1} of {deck.length}
      </p>
      <button
        type="button"
        data-card="true"
        onClick={() => setFlipped((f) => !f)}
        aria-label={`${flipped ? 'Back' : 'Front'} of card. Select to flip.`}
        className="card flex min-h-[260px] w-full flex-col items-center justify-center gap-3 text-center hover:border-brand-400"
      >
        <span className="chip">{showTerm ? 'Term' : 'Definition'}</span>
        <span aria-live="polite" className={showTerm ? 'text-3xl font-bold' : 'text-lg leading-relaxed'}>
          {showTerm ? card.term : card.definition}
        </span>
        {!showTerm && <span className="text-sm muted">Example: {card.example}</span>}
        <span className="mt-2 text-xs muted">Select the card or press Space to flip</span>
      </button>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn-secondary" onClick={() => mark(false)}>
          <span className="kbd" aria-hidden="true">
            1
          </span>
          Still learning
        </button>
        <button type="button" className="btn-primary" onClick={() => mark(true)}>
          <span className="kbd" aria-hidden="true">
            2
          </span>
          Know it
        </button>
      </div>
    </div>
  );
}
