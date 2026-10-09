// Renders toasts and confetti triggered from anywhere through lib/celebrate.
import { useEffect, useState } from 'react';
import { subscribe, type Toast } from '../lib/celebrate';
import { Icon } from './Icon';

const TONES: Record<NonNullable<Toast['tone']>, string> = {
  gold: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200',
  accent: 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-200',
};

const CONFETTI_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#ec4899', '#3b82f6'];

interface Piece {
  id: number;
  left: number;
  color: string;
  size: number;
  round: boolean;
  style: Record<string, string>;
}

function makePieces(seed: number): Piece[] {
  return Array.from({ length: 70 }, (_, i) => ({
    id: seed * 1000 + i,
    left: Math.random() * 100,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 6,
    round: Math.random() < 0.3,
    style: {
      '--drift': `${(Math.random() - 0.5) * 30}vw`,
      '--spin': `${(Math.random() - 0.5) * 1440}deg`,
      '--dur': `${1.8 + Math.random() * 1.4}s`,
      '--delay': `${Math.random() * 0.35}s`,
    },
  }));
}

export function Celebrations() {
  const [toasts, setToasts] = useState<(Toast & { id: number })[]>([]);
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    let n = 0;
    return subscribe((e) => {
      n++;
      if (e.type === 'toast') {
        const id = n;
        setToasts((t) => [...t.slice(-2), { ...e.toast, id }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
      } else {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const seed = n;
        setPieces(makePieces(seed));
        setTimeout(() => setPieces((p) => (p[0]?.id === seed * 1000 ? [] : p)), 3600);
      }
    });
  }, []);

  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-2xl border border-line bg-surface p-3 pr-4 shadow-composer"
          >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[t.tone ?? 'accent']}`}>
              <Icon name={t.icon ?? 'star'} className="h-5 w-5" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="text-ink-soft">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
      {pieces.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
          {pieces.map((p) => (
            <span
              key={p.id}
              className="absolute top-0 block animate-confetti-fall"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.round ? p.size : p.size * 0.45,
                background: p.color,
                borderRadius: p.round ? '9999px' : '2px',
                ...p.style,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
