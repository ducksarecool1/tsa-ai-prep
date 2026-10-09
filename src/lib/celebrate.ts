// Tiny event bus for celebrations (toasts and confetti), so any page can trigger them
// and the layout renders them in one place.
import type { IconName } from '../components/Icon';

export interface Toast {
  title: string;
  body?: string;
  icon?: IconName;
  tone?: 'gold' | 'accent' | 'green' | 'orange';
}

type CelebrationEvent = { type: 'toast'; toast: Toast } | { type: 'confetti' };
type Listener = (e: CelebrationEvent) => void;

const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function showToast(toast: Toast): void {
  for (const fn of listeners) fn({ type: 'toast', toast });
}

export function fireConfetti(): void {
  for (const fn of listeners) fn({ type: 'confetti' });
}
