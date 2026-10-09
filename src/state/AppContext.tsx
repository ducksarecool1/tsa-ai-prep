import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Content, Flag, MasteryLevel, ProgressState, Question, Settings, Term } from '../types';
import { bundledContent } from '../content';
import {
  STORAGE_KEYS,
  emptyProgressState,
  loadJson,
  mergeSettings,
  removeKey,
  sanitizeProgress,
  saveJson,
} from '../lib/storage';
import { recordAnswer } from '../lib/mastery';
import { allTerms, knownTermNames } from '../lib/items';
import { localDate } from '../lib/stats';
import { randomId } from '../lib/random';

/** Advisor edits: the full question list for each unit that was changed. */
export type BankOverride = Record<string, Question[]>;

interface AppState {
  content: Content;
  bundled: Content;
  bankOverride: BankOverride | null;
  setBankOverride: (next: BankOverride | null) => void;
  progress: ProgressState;
  recordItem: (itemId: string, correct: boolean, level?: MasteryLevel) => void;
  recordPrompt: (challengeId: string, score: number) => void;
  recordSpot: (id: string, correct: boolean) => void;
  recordTest: (unitIds: string[], score: number, total: number) => void;
  setLastUnits: (unitIds: string[]) => void;
  replaceProgress: (progress: ProgressState) => void;
  resetProgress: () => void;
  settings: Settings;
  /** Accepts a patch, or a function of the latest settings (safe for rapid toggles). */
  updateSettings: (patch: Partial<Settings> | ((current: Settings) => Partial<Settings>)) => void;
  flags: Flag[];
  addFlag: (flag: Omit<Flag, 'id' | 'timestamp'>) => void;
  removeFlag: (id: string) => void;
  replaceFlags: (flags: Flag[]) => void;
  knownTerms: string[];
  termPool: Term[];
}

const AppContext = createContext<AppState | null>(null);

function applyOverride(base: Content, override: BankOverride | null): Content {
  if (!override) return base;
  return {
    ...base,
    units: base.units.map((u) => (override[u.id] ? { ...u, questions: override[u.id] } : u)),
  };
}

function markStudied(p: ProgressState): string[] {
  const today = localDate();
  return p.studyDays.includes(today) ? p.studyDays : [...p.studyDays, today];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(() =>
    sanitizeProgress(loadJson<unknown>(STORAGE_KEYS.progress, emptyProgressState())),
  );
  const [settings, setSettings] = useState<Settings>(() => mergeSettings(loadJson(STORAGE_KEYS.settings, null)));
  const [flags, setFlags] = useState<Flag[]>(() => loadJson<Flag[]>(STORAGE_KEYS.flags, []));
  const [bankOverride, setBankOverrideState] = useState<BankOverride | null>(() =>
    loadJson<BankOverride | null>(STORAGE_KEYS.bank, null),
  );

  useEffect(() => saveJson(STORAGE_KEYS.progress, progress), [progress]);
  useEffect(() => saveJson(STORAGE_KEYS.settings, settings), [settings]);
  useEffect(() => saveJson(STORAGE_KEYS.flags, flags), [flags]);

  // Theme: apply the "dark" class, following the system setting when theme is "system".
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = settings.theme === 'dark' || (settings.theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  const setBankOverride = useCallback((next: BankOverride | null) => {
    setBankOverrideState(next);
    if (next) saveJson(STORAGE_KEYS.bank, next);
    else removeKey(STORAGE_KEYS.bank);
  }, []);

  const recordItem = useCallback((itemId: string, correct: boolean, level?: MasteryLevel) => {
    setProgress((p) => ({
      ...p,
      items: { ...p.items, [itemId]: recordAnswer(p.items[itemId], itemId, correct, Date.now(), level) },
      studyDays: markStudied(p),
    }));
  }, []);

  const recordPrompt = useCallback((challengeId: string, score: number) => {
    setProgress((p) => {
      const prev = p.prompts[challengeId];
      return {
        ...p,
        prompts: {
          ...p.prompts,
          [challengeId]: { bestScore: Math.max(prev?.bestScore ?? 0, score), attempts: (prev?.attempts ?? 0) + 1 },
        },
        studyDays: markStudied(p),
      };
    });
  }, []);

  const recordSpot = useCallback((id: string, correct: boolean) => {
    setProgress((p) => {
      const prev = p.spot[id] ?? { attempts: 0, correct: 0 };
      return {
        ...p,
        spot: { ...p.spot, [id]: { attempts: prev.attempts + 1, correct: prev.correct + (correct ? 1 : 0) } },
        studyDays: markStudied(p),
      };
    });
  }, []);

  const recordTest = useCallback((unitIds: string[], score: number, total: number) => {
    setProgress((p) => ({
      ...p,
      tests: [...p.tests, { date: new Date().toISOString(), unitIds, score, total }].slice(-50),
      studyDays: markStudied(p),
    }));
  }, []);

  const setLastUnits = useCallback((unitIds: string[]) => {
    setProgress((p) => ({ ...p, lastUnitIds: unitIds }));
  }, []);

  const replaceProgress = useCallback((next: ProgressState) => setProgress(sanitizeProgress(next)), []);
  const resetProgress = useCallback(() => setProgress(emptyProgressState()), []);

  const updateSettings = useCallback((patch: Partial<Settings> | ((current: Settings) => Partial<Settings>)) => {
    setSettings((s) => mergeSettings({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));
  }, []);

  const addFlag = useCallback((flag: Omit<Flag, 'id' | 'timestamp'>) => {
    setFlags((f) => [...f, { ...flag, id: randomId('flag'), timestamp: Date.now() }]);
  }, []);
  const removeFlag = useCallback((id: string) => setFlags((f) => f.filter((x) => x.id !== id)), []);
  const replaceFlags = useCallback((next: Flag[]) => setFlags(next), []);

  const content = useMemo(() => applyOverride(bundledContent, bankOverride), [bankOverride]);
  const knownTerms = useMemo(() => knownTermNames(content.units), [content]);
  const termPool = useMemo(() => allTerms(content.units), [content]);

  const value: AppState = {
    content,
    bundled: bundledContent,
    bankOverride,
    setBankOverride,
    progress,
    recordItem,
    recordPrompt,
    recordSpot,
    recordTest,
    setLastUnits,
    replaceProgress,
    resetProgress,
    settings,
    updateSettings,
    flags,
    addFlag,
    removeFlag,
    replaceFlags,
    knownTerms,
    termPool,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
