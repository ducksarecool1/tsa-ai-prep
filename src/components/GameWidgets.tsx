// Small gamification widgets: XP pills, combo badge, daily goal ring, level badge, sound toggle.
import { useApp } from '../state/AppContext';
import { levelInfo, xpToday } from '../lib/gamification';
import { configureSound, playSound } from '../lib/sound';
import { Icon } from './Icon';

export function XpPill({ amount, label }: { amount: number; label?: string }) {
  if (amount <= 0) return null;
  return (
    <span className="inline-flex animate-xp-rise items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
      <Icon name="bolt" className="h-3.5 w-3.5" />+{amount} XP{label ? <span className="font-medium"> {label}</span> : null}
    </span>
  );
}

export function ComboBadge({ combo }: { combo: number }) {
  if (combo < 2) return null;
  return (
    <span
      key={combo}
      className="inline-flex animate-pop items-center gap-1 rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/60 dark:text-orange-200"
      aria-label={`${combo} correct in a row`}
    >
      <Icon name="flame" className={`h-3.5 w-3.5 ${combo >= 5 ? 'animate-flicker' : ''}`} />
      {combo} in a row
    </span>
  );
}

/** Ring showing today's XP against the daily goal. */
export function DailyGoalRing({ size = 44 }: { size?: number }) {
  const { progress, settings } = useApp();
  const today = xpToday(progress);
  const pct = Math.min(1, today / settings.dailyGoal);
  const r = 18;
  const c = 2 * Math.PI * r;
  const done = pct >= 1;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Daily goal: ${today} of ${settings.dailyGoal} XP`}>
      <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r={r} className="fill-none stroke-line" strokeWidth="5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          className={`fill-none transition-all duration-700 ${done ? 'stroke-emerald-500' : 'stroke-amber-500'}`}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
        <Icon name={done ? 'check' : 'bolt'} className="h-4 w-4" />
      </span>
    </div>
  );
}

export function LevelBadge({ compact = false }: { compact?: boolean }) {
  const { progress } = useApp();
  const info = levelInfo(progress.xp.total);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-semibold">Level {info.level}</span>
        <span className="text-xs tabular-nums text-ink-soft">{compact ? `${progress.xp.total} XP` : `${info.into} / ${info.span} XP`}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={`Level ${info.level} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(info.progress * 100)}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-teal-500 transition-all duration-700" style={{ width: `${info.progress * 100}%` }} />
      </div>
    </div>
  );
}

export function SoundToggle({ className = '' }: { className?: string }) {
  const { settings, updateSettings } = useApp();
  return (
    <button
      type="button"
      className={`btn-ghost min-h-[32px] px-2 ${className}`}
      aria-pressed={settings.sound}
      aria-label={settings.sound ? 'Sound effects on. Select to mute.' : 'Sound effects off. Select to turn on.'}
      title={settings.sound ? 'Mute sound effects' : 'Turn on sound effects'}
      onClick={() => {
        const on = !settings.sound;
        updateSettings({ sound: on });
        configureSound(on, settings.volume);
        if (on) playSound('tap');
      }}
    >
      <Icon name={settings.sound ? 'volume' : 'mute'} className="h-[18px] w-[18px]" />
    </button>
  );
}
