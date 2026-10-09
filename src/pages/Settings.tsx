import { useRef, useState, type ChangeEvent } from 'react';
import { useApp } from '../state/AppContext';
import type { ThemeSetting } from '../types';
import { DEFAULT_MODEL, buildProgressExport, downloadJson, parseProgressImport } from '../lib/storage';
import { localDate } from '../lib/stats';

export function SettingsPage() {
  const { settings, updateSettings, progress, flags, replaceProgress, replaceFlags, resetProgress } = useApp();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
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

      <section className="card space-y-4" aria-labelledby="ai-heading">
        <h2 id="ai-heading">Optional AI features</h2>
        <p className="text-sm">
          Everything in AI Prep works offline. If you add an Anthropic API key, you also get AI grading in the Prompt Lab, a "Run my prompt"
          button that shows what the AI actually writes, and an "Ask AI to check my answer" button in Learn Mode.
        </p>
        <div className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950">
          <p className="font-semibold">About your API key</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>The key is saved only in this browser's local storage. It is never written into the app's code or sent anywhere except the AI service.</li>
            <li>Anyone who uses this browser profile can use the key. Do not save it on a shared or school computer unless your advisor says to.</li>
            <li>API usage may cost money. Ask your advisor before adding a key, and use the Clear button when you are done.</li>
            <li>Prompts and answers you send to the AI are processed by the AI service, so keep personal information out.</li>
          </ul>
        </div>
        <div>
          <label htmlFor="api-key" className="label">
            Anthropic API key
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="api-key"
              type={showKey ? 'text' : 'password'}
              className="input font-mono"
              autoComplete="off"
              spellCheck={false}
              value={settings.ai.apiKey}
              onChange={(e) => updateSettings({ ai: { ...settings.ai, apiKey: e.target.value } })}
              placeholder="Paste your key here"
            />
            <button type="button" className="btn-secondary shrink-0" onClick={() => setShowKey((s) => !s)} aria-pressed={showKey}>
              {showKey ? 'Hide' : 'Show'}
            </button>
            <button
              type="button"
              className="btn-danger shrink-0"
              disabled={!settings.ai.apiKey}
              onClick={() => updateSettings({ ai: { ...settings.ai, apiKey: '' } })}
            >
              Clear
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="ai-model" className="label">
            Model
          </label>
          <input
            id="ai-model"
            className="input font-mono"
            value={settings.ai.model}
            onChange={(e) => updateSettings({ ai: { ...settings.ai, model: e.target.value } })}
            placeholder={DEFAULT_MODEL}
          />
          <p className="mt-1 text-xs muted">Default: {DEFAULT_MODEL}. Change this only if your advisor tells you to.</p>
        </div>
      </section>

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
