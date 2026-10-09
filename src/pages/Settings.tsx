import { useRef, useState, type ChangeEvent } from 'react';
import { useApp } from '../state/AppContext';
import type { ThemeSetting } from '../types';
import { DAILY_GOALS, DEFAULT_MODEL, DEFAULT_OLLAMA_URL, buildProgressExport, downloadJson, parseProgressImport } from '../lib/storage';
import { localDate } from '../lib/stats';
import { configureSound, playSound } from '../lib/sound';
import { listModels } from '../lib/ai';

export function SettingsPage() {
  const { settings, updateSettings, progress, flags, replaceProgress, replaceFlags, resetProgress } = useApp();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const exportProgress = () => {
    downloadJson(`ai-prep-progress-${localDate()}.json`, buildProgressExport(progress, flags));
    setStatus('Progress exported.');
    setError('');
  };

  const importProgress = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = parseProgressImport(await file.text());
      if (!window.confirm('Replace your current progress with the imported file?')) return;
      replaceProgress(data.progress);
      replaceFlags(data.flags);
      setStatus(`Imported progress for ${Object.keys(data.progress.items).length} items.`);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
      setStatus('');
    }
  };

  const reset = () => {
    if (window.confirm('Erase all of your progress on this device? Export a backup first if you might want it back.')) {
      resetProgress();
      setStatus('Progress reset.');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1>Settings</h1>

      <section className="card space-y-4" aria-labelledby="appearance">
        <h2 id="appearance">Appearance</h2>
        <fieldset>
          <legend className="label">Theme</legend>
          <div className="flex flex-wrap gap-4">
            {(['system', 'light', 'dark'] as ThemeSetting[]).map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input type="radio" name="theme" className="h-4 w-4 accent-brand-600" checked={settings.theme === t} onChange={() => updateSettings({ theme: t })} />
                {t === 'system' ? 'Match my device' : t === 'light' ? 'Light' : 'Dark'}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-sm muted">Learn Mode options (question types, session length, round size, shuffle) are on the Learn page and are remembered here.</p>
      </section>

      <section className="card space-y-4" aria-labelledby="progress-heading">
        <h2 id="progress-heading">Your progress</h2>
        <p className="text-sm muted">
          Progress is stored only in this browser. Export a backup to move it to another device or keep it safe, then import it there.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={exportProgress}>
            Export progress
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
            Import progress
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-hidden="true" tabIndex={-1} onChange={importProgress} />
          <button type="button" className="btn-danger" onClick={reset}>
            Reset progress
          </button>
        </div>
        {status && (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
            {status}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </section>

      <section className="card space-y-4" aria-labelledby="sound-heading">
        <h2 id="sound-heading">Sound and goals</h2>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={settings.sound}
            onChange={() => {
              updateSettings({ sound: !settings.sound });
              configureSound(!settings.sound, settings.volume);
              if (!settings.sound) playSound('correct');
            }}
          />
          Sound effects
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="volume" className="label mb-0 w-20">
            Volume
          </label>
          <input
            id="volume"
            type="range"
            min={0}
            max={100}
            step={5}
            disabled={!settings.sound}
            className="w-full accent-brand-600 sm:max-w-xs"
            value={Math.round(settings.volume * 100)}
            onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
            onPointerUp={() => playSound('correct')}
            onKeyUp={() => playSound('tap')}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!settings.sound}
            onClick={() => {
              configureSound(settings.sound, settings.volume);
              playSound('combo');
            }}
          >
            Test sound
          </button>
        </div>
        <div className="sm:max-w-xs">
          <label htmlFor="settings-goal" className="label">
            Daily XP goal
          </label>
          <select id="settings-goal" className="input" value={settings.dailyGoal} onChange={(e) => updateSettings({ dailyGoal: Number(e.target.value) })}>
            {DAILY_GOALS.map((g) => (
              <option key={g} value={g}>
                {g} XP a day
              </option>
            ))}
          </select>
        </div>
      </section>

      <OllamaSettings />

      <section className="card space-y-3" aria-labelledby="advisor-heading">
        <h2 id="advisor-heading">Advisor mode</h2>
        <p className="text-sm muted">
          For chapter advisors: add, edit and delete questions, import or export the question bank, and review answers students marked "I was
          right." This is a convenience switch, not a password.
        </p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={settings.advisorMode}
            onChange={() => updateSettings({ advisorMode: !settings.advisorMode })}
          />
          Turn on Advisor mode
        </label>
        {settings.advisorMode && <a href="#/advisor">Open Advisor tools →</a>}
      </section>
    </div>
  );
}

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-raised/60 py-1 pl-3 pr-1">
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap py-1 font-mono text-[13px]">{command}</code>
      <button
        type="button"
        className="btn-ghost min-h-[32px] shrink-0 px-2 text-xs"
        onClick={() => {
          void navigator.clipboard?.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

type Check = { state: 'idle' | 'checking' | 'ok' | 'error'; message?: string; models?: string[] };

/** Matches "llama3.2" with "llama3.2:latest". */
function sameModel(a: string, b: string): boolean {
  const norm = (m: string) => (m.includes(':') ? m : `${m}:latest`);
  return norm(a.trim()) === norm(b.trim());
}

function OllamaSettings() {
  const { settings, updateSettings } = useApp();
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const origin = window.location.origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
  const ai = settings.ai;
  const setAi = (patch: Partial<typeof ai>) => updateSettings((s) => ({ ai: { ...s.ai, ...patch } }));

  const runCheck = async () => {
    setCheck({ state: 'checking' });
    try {
      const models = await listModels(ai);
      if (models.length === 0) {
        setCheck({ state: 'error', message: `Connected, but no models are installed yet. Run: ollama pull ${DEFAULT_MODEL}` });
        return;
      }
      const installed = models.some((m) => sameModel(m, ai.model));
      if (!installed) setAi({ model: models[0] });
      setCheck({
        state: 'ok',
        models,
        message: installed
          ? `Connected. ${models.length} model${models.length === 1 ? '' : 's'} installed.`
          : `Connected. "${ai.model}" isn't installed, so "${models[0]}" was selected.`,
      });
      playSound('correct');
    } catch (err) {
      setCheck({ state: 'error', message: err instanceof Error ? err.message : 'Could not reach Ollama.' });
    }
  };

  return (
    <section className="card space-y-4" aria-labelledby="ai-heading">
      <h2 id="ai-heading">Local AI with Ollama (optional)</h2>
      <p className="text-sm">
        Everything in AI Prep works without AI. If you run{' '}
        <a href="https://ollama.com" target="_blank" rel="noreferrer">
          Ollama
        </a>{' '}
        on this computer, you also get an AI coach that runs and reviews your prompts, plus an "Ask the AI to check my answer" button in Learn.
        Ollama runs the model on your own computer: there is no account, no API key and no cost, and nothing you type is sent to an online
        service.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={ai.enabled} onChange={() => setAi({ enabled: !ai.enabled })} />
        Use my local Ollama model
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ollama-url" className="label">
            Ollama address
          </label>
          <input
            id="ollama-url"
            className="input font-mono text-sm"
            value={ai.baseUrl}
            placeholder={DEFAULT_OLLAMA_URL}
            spellCheck={false}
            onChange={(e) => setAi({ baseUrl: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="ollama-model" className="label">
            Model
          </label>
          {check.models && check.models.length > 0 ? (
            <select id="ollama-model" className="input font-mono text-sm" value={check.models.find((m) => sameModel(m, ai.model)) ?? ai.model} onChange={(e) => setAi({ model: e.target.value })}>
              {check.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input id="ollama-model" className="input font-mono text-sm" value={ai.model} placeholder={DEFAULT_MODEL} spellCheck={false} onChange={(e) => setAi({ model: e.target.value })} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={check.state === 'checking'} onClick={runCheck}>
          {check.state === 'checking' ? 'Checking…' : 'Check connection'}
        </button>
        {check.message && (
          <p role="status" className={`text-sm ${check.state === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
            {check.message}
          </p>
        )}
      </div>

      <details className="rounded-xl border border-line" open={!ai.enabled}>
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">How to set up Ollama</summary>
        <ol className="list-decimal space-y-3 border-t border-line px-4 py-4 pl-8 text-sm">
          <li>
            Install Ollama for Windows, Mac or Linux from{' '}
            <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
              ollama.com/download
            </a>
            . Most school Chromebooks can't run it; those devices use the offline checklist instead.
          </li>
          <li className="space-y-2">
            <p>Download a model (about 2 GB). Open a terminal and run:</p>
            <CopyCommand command={`ollama pull ${DEFAULT_MODEL}`} />
            <p className="text-ink-soft">Computers with 16 GB of memory or more can use a larger model for better reviews, such as qwen2.5:7b.</p>
          </li>
          {isLocal ? (
            <li>Make sure Ollama is running. It already allows apps on this computer (localhost) to connect.</li>
          ) : (
            <li className="space-y-2">
              <p>
                Allow this website to talk to Ollama, then quit Ollama completely (from the system tray or menu bar) and start it again.
              </p>
              <p className="font-medium">Windows (Command Prompt or PowerShell):</p>
              <CopyCommand command={`setx OLLAMA_ORIGINS "${origin}"`} />
              <p className="font-medium">Mac (Terminal):</p>
              <CopyCommand command={`launchctl setenv OLLAMA_ORIGINS "${origin}"`} />
              <p className="text-ink-soft">
                On Linux, add <code className="font-mono">Environment="OLLAMA_ORIGINS={origin}"</code> to the service with{' '}
                <code className="font-mono">sudo systemctl edit ollama</code>, then restart it. If your browser asks to let this site access devices
                on your local network, choose Allow.
              </p>
            </li>
          )}
          <li>Turn on "Use my local Ollama model" above, then select Check connection.</li>
        </ol>
      </details>
    </section>
  );
}
