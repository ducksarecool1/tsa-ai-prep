// localStorage persistence. Every read and write is wrapped so the app still works
// in private windows or when storage is blocked (progress just won't be saved).
import type { Flag, ItemProgress, ProgressState, Question, Settings } from '../types';
import { QUESTION_TYPES } from '../types';

export const STORAGE_KEYS = {
  progress: 'aiprep.progress.v1',
  settings: 'aiprep.settings.v1',
  flags: 'aiprep.flags.v1',
  bank: 'aiprep.bank.v1',
} as const;

export const DEFAULT_OLLAMA_URL = 'http://localhost:11434';
export const DEFAULT_MODEL = 'llama3.2';
export const DAILY_GOALS = [20, 50, 100, 150] as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  shuffle: true,
  roundSize: 7,
  sessionLength: 20,
  includeTypes: { mc: true, tf: true, written: true, matching: true, scenario: true, ordering: true, term: true, prompt: true },
  answerWith: 'term',
  advisorMode: false,
  ai: { enabled: false, baseUrl: DEFAULT_OLLAMA_URL, model: DEFAULT_MODEL },
  sound: true,
  volume: 0.6,
  dailyGoal: 50,
};

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep working in memory.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

export function emptyProgressState(): ProgressState {
  return {
    version: 1,
    items: {},
    studyDays: [],
    lastUnitIds: [],
    prompts: {},
    spot: {},
    tests: [],
    xp: { total: 0, byDay: {} },
    goalDays: [],
    achievements: {},
    stats: { sessionsCompleted: 0, bestCombo: 0, perfectRounds: 0 },
  };
}

/** Fill in any settings missing from older saved data. */
export function mergeSettings(raw: Partial<Settings> | null | undefined): Settings {
  const s = raw ?? {};
  const roundSize = Number(s.roundSize);
  const volume = Number(s.volume);
  // Settings saved by the earlier cloud-AI version had { apiKey, model }; only keep fields that still apply.
  const oldAi = (s.ai ?? {}) as Partial<Settings['ai']> & { apiKey?: string };
  const model = typeof oldAi.model === 'string' && oldAi.model && !oldAi.model.startsWith('claude-') ? oldAi.model : DEFAULT_MODEL;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    roundSize: roundSize >= 7 && roundSize <= 10 ? roundSize : DEFAULT_SETTINGS.roundSize,
    includeTypes: { ...DEFAULT_SETTINGS.includeTypes, ...(s.includeTypes ?? {}) },
    ai: {
      enabled: typeof oldAi.enabled === 'boolean' ? oldAi.enabled : false,
      baseUrl: typeof oldAi.baseUrl === 'string' && oldAi.baseUrl ? oldAi.baseUrl : DEFAULT_OLLAMA_URL,
      model,
    },
    sound: typeof s.sound === 'boolean' ? s.sound : DEFAULT_SETTINGS.sound,
    volume: volume >= 0 && volume <= 1 ? volume : DEFAULT_SETTINGS.volume,
    dailyGoal: (DAILY_GOALS as readonly number[]).includes(Number(s.dailyGoal)) ? Number(s.dailyGoal) : DEFAULT_SETTINGS.dailyGoal,
  };
}

function isItemProgress(v: unknown): v is ItemProgress {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.itemId === 'string' &&
    ['new', 'familiar', 'mastered'].includes(p.level as string) &&
    typeof p.attempts === 'number' &&
    typeof p.correct === 'number'
  );
}

/** Validates and normalizes progress loaded from storage or an imported file. */
export function sanitizeProgress(raw: unknown): ProgressState {
  const base = emptyProgressState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<ProgressState>;
  const items: Record<string, ItemProgress> = {};
  for (const [id, p] of Object.entries(r.items ?? {})) {
    if (isItemProgress(p)) {
      items[id] = {
        ...p,
        misses: typeof p.misses === 'number' ? p.misses : p.attempts - p.correct,
        streak: typeof p.streak === 'number' ? p.streak : 0,
        lastSeen: typeof p.lastSeen === 'number' ? p.lastSeen : null,
        nextDue: typeof p.nextDue === 'number' ? p.nextDue : null,
        box: typeof p.box === 'number' ? p.box : 0,
        lastResult: p.lastResult === 'correct' || p.lastResult === 'incorrect' ? p.lastResult : null,
      };
    }
  }
  return {
    version: 1,
    items,
    studyDays: Array.isArray(r.studyDays) ? r.studyDays.filter((d) => typeof d === 'string') : [],
    lastUnitIds: Array.isArray(r.lastUnitIds) ? r.lastUnitIds.filter((d) => typeof d === 'string') : [],
    prompts: r.prompts && typeof r.prompts === 'object' ? r.prompts : {},
    spot: r.spot && typeof r.spot === 'object' ? r.spot : {},
    tests: Array.isArray(r.tests) ? r.tests : [],
    xp: {
      total: typeof r.xp?.total === 'number' ? r.xp.total : 0,
      byDay: r.xp?.byDay && typeof r.xp.byDay === 'object' ? r.xp.byDay : {},
    },
    goalDays: Array.isArray(r.goalDays) ? r.goalDays.filter((d) => typeof d === 'string') : [],
    achievements: r.achievements && typeof r.achievements === 'object' ? r.achievements : {},
    stats: {
      sessionsCompleted: typeof r.stats?.sessionsCompleted === 'number' ? r.stats.sessionsCompleted : 0,
      bestCombo: typeof r.stats?.bestCombo === 'number' ? r.stats.bestCombo : 0,
      perfectRounds: typeof r.stats?.perfectRounds === 'number' ? r.stats.perfectRounds : 0,
    },
  };
}

export interface ProgressExport {
  app: 'ai-prep';
  version: 1;
  exportedAt: string;
  progress: ProgressState;
  flags: Flag[];
}

export function buildProgressExport(progress: ProgressState, flags: Flag[]): ProgressExport {
  return { app: 'ai-prep', version: 1, exportedAt: new Date().toISOString(), progress, flags };
}

export function parseProgressImport(text: string): { progress: ProgressState; flags: Flag[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const d = data as Partial<ProgressExport>;
  if (!d || d.app !== 'ai-prep' || !d.progress) {
    throw new Error('That file is not an AI Prep progress export.');
  }
  return {
    progress: sanitizeProgress(d.progress),
    flags: Array.isArray(d.flags) ? d.flags : [],
  };
}

export interface BankExport {
  app: 'ai-prep-bank';
  version: 1;
  exportedAt: string;
  questions: Question[];
}

export function parseBankImport(text: string): Question[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const list = Array.isArray(data) ? data : (data as Partial<BankExport>)?.questions;
  if (!Array.isArray(list)) throw new Error('Expected a list of questions or an AI Prep question bank export.');
  for (const q of list) {
    if (!q || typeof q !== 'object' || typeof q.id !== 'string' || !QUESTION_TYPES.includes(q.type)) {
      throw new Error('Every question needs an id and a valid type.');
    }
  }
  return list as Question[];
}

/** Triggers a browser download of a JSON file. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
