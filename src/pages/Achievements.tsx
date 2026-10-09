import { useApp } from '../state/AppContext';
import { ACHIEVEMENTS, levelInfo, xpForLevel, xpToday } from '../lib/gamification';
import { computeStreak } from '../lib/stats';
import { DAILY_GOALS } from '../lib/storage';
import { DailyGoalRing, LevelBadge } from '../components/GameWidgets';
import { Icon } from '../components/Icon';
import { playSound } from '../lib/sound';

export function AchievementsPage() {
  const { progress, content, settings, updateSettings } = useApp();
  const info = levelInfo(progress.xp.total);
  const today = xpToday(progress);
  const streak = computeStreak(progress.studyDays);
  const unlocked = ACHIEVEMENTS.filter((a) => progress.achievements[a.id]).length;
  const ctx = { progress, content };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="pt-4 text-center sm:pt-8">
        <h1 className="font-display text-3xl font-normal sm:text-4xl">Your progress</h1>
        <p className="mt-3 text-ink-soft">Earn XP for every correct answer, keep your streak alive, and unlock badges as you go.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2" aria-label="Level and daily goal">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Icon name="star" className="h-4 w-4" />
            Level
          </p>
          <p className="mt-1 text-3xl font-bold">{info.level}</p>
          <div className="mt-3">
            <LevelBadge />
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            {progress.xp.total} XP total · {xpForLevel(info.level + 1) - progress.xp.total} XP to level {info.level + 1}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <Icon name="target" className="h-4 w-4" />
            Daily goal
          </p>
          <div className="mt-2 flex items-center gap-4">
            <DailyGoalRing size={64} />
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {today} <span className="text-base font-medium text-ink-soft">/ {settings.dailyGoal} XP</span>
              </p>
              <p className="flex items-center gap-1 text-sm text-ink-soft">
                <Icon name="flame" className="h-4 w-4 text-orange-500" />
                {streak}-day streak · best combo {progress.stats.bestCombo}
              </p>
            </div>
          </div>
          <label htmlFor="daily-goal" className="label mt-4">
            Daily XP goal
          </label>
          <select
            id="daily-goal"
            className="input"
            value={settings.dailyGoal}
            onChange={(e) => {
              updateSettings({ dailyGoal: Number(e.target.value) });
              playSound('tap');
            }}
          >
            {DAILY_GOALS.map((g) => (
              <option key={g} value={g}>
                {g} XP a day ({g === 20 ? 'casual' : g === 50 ? 'regular' : g === 100 ? 'serious' : 'intense'})
              </option>
            ))}
          </select>
        </div>
      </section>

      <section aria-labelledby="badges">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="badges">Achievements</h2>
          <span className="text-sm text-ink-soft">
            {unlocked} of {ACHIEVEMENTS.length} unlocked
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACHIEVEMENTS.map((a) => {
            const when = progress.achievements[a.id];
            return (
              <li
                key={a.id}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${
                  when ? 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30' : 'border-line bg-surface'
                }`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    when ? 'bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-soft' : 'bg-raised text-ink-soft/60'
                  }`}
                >
                  <Icon name={a.icon} className="h-6 w-6" />
                </span>
                <p className={`text-sm font-semibold ${when ? '' : 'text-ink-soft'}`}>{a.title}</p>
                <p className="text-xs text-ink-soft">{a.description}</p>
                <p className="text-xs font-medium text-ink-soft">
                  {when ? <span className="text-amber-700 dark:text-amber-300">Unlocked {new Date(when).toLocaleDateString()}</span> : a.progressText ? a.progressText(ctx) : 'Locked'}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
