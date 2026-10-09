import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { AppMark, Icon, type IconName } from './Icon';
import { computeStreak } from '../lib/stats';

interface NavItem {
  href: string;
  label: string;
  match: string;
  icon: IconName;
}

export function Layout({ current, children }: { current: string; children: ReactNode }) {
  const { settings, updateSettings, content, progress } = useApp();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    { href: '#/', label: 'Home', match: '', icon: 'home' },
    { href: '#/learn', label: 'Learn', match: 'learn', icon: 'spark' },
    { href: '#/units', label: 'Lessons', match: 'units', icon: 'book' },
    { href: '#/flashcards', label: 'Flashcards', match: 'flashcards', icon: 'cards' },
    { href: '#/test', label: 'Practice test', match: 'test', icon: 'test' },
    { href: '#/prompt-lab', label: 'Prompt Lab', match: 'prompt-lab', icon: 'wand' },
    { href: '#/glossary', label: 'Glossary', match: 'glossary', icon: 'search' },
  ];
  if (settings.advisorMode) items.push({ href: '#/advisor', label: 'Advisor', match: 'advisor', icon: 'shield' });

  useEffect(() => setOpen(false), [current]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const dark =
    settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const streak = computeStreak(progress.studyDays);

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <a href="#/" className="flex items-center gap-2 text-[15px] font-semibold text-ink no-underline hover:no-underline">
          <AppMark />
          AI Prep
        </a>
        <button type="button" className="btn-ghost min-h-[36px] px-2 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)}>
          <Icon name="close" />
        </button>
      </div>
      <a href="#/learn" className="btn-secondary mb-3 justify-start rounded-xl shadow-soft">
        <Icon name="plus" className="h-4 w-4" />
        New study session
      </a>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = current === item.match;
          return (
            <a key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`nav-item ${active ? 'nav-item-active' : ''}`}>
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="mt-5 px-3 text-xs font-medium uppercase tracking-wide text-ink-soft">Units</div>
      <ul className="mt-1 flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {content.units.map((u) => (
          <li key={u.id}>
            <a href={`#/units/${u.id}`} className="nav-item truncate py-1.5">
              <span className="w-4 shrink-0 text-xs tabular-nums text-ink-soft">{u.number}</span>
              <span className="truncate">{u.title}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
        {streak > 0 && (
          <p className="flex items-center gap-2 px-3 py-1 text-sm text-ink-soft">
            <Icon name="flame" className="h-4 w-4 text-orange-500" />
            {streak}-day streak
          </p>
        )}
        <button
          type="button"
          className="nav-item w-full text-left"
          onClick={() => updateSettings({ theme: dark ? 'light' : 'dark' })}
        >
          <Icon name={dark ? 'sun' : 'moon'} className="h-[18px] w-[18px]" />
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
        <a href="#/settings" aria-current={current === 'settings' ? 'page' : undefined} className={`nav-item ${current === 'settings' ? 'nav-item-active' : ''}`}>
          <Icon name="gear" className="h-[18px] w-[18px]" />
          Settings
        </a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-sidebar lg:block">{sidebar}</aside>

      {/* Mobile top bar and drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/90 px-3 py-2 backdrop-blur lg:hidden">
        <button type="button" className="btn-ghost min-h-[40px] px-2" aria-label="Open menu" aria-expanded={open} aria-controls="mobile-drawer" onClick={() => setOpen(true)}>
          <Icon name="menu" />
        </button>
        <a href="#/" className="flex items-center gap-2 font-semibold text-ink no-underline hover:no-underline">
          <AppMark className="h-6 w-6" />
          AI Prep
        </a>
        <a href="#/learn" className="btn-ghost min-h-[40px] px-2" aria-label="New study session">
          <Icon name="plus" />
        </a>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside id="mobile-drawer" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-sidebar shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 focus:outline-none sm:px-6 sm:py-10">
          {children}
        </main>
        <footer className="px-4 pb-4 text-center text-xs text-ink-soft">
          Progress is saved only in this browser. Export a backup in Settings.
        </footer>
      </div>
    </div>
  );
}
