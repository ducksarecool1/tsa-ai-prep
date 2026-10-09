// Conversation building blocks: the tutor's messages on the left, the student's on the right.
import type { ReactNode } from 'react';
import { AppMark } from './Icon';

export function TutorMessage({ children, label = 'AI Prep' }: { children: ReactNode; label?: string }) {
  return (
    <div className="flex gap-3 sm:gap-4">
      <div className="shrink-0 pt-0.5">
        <AppMark className="h-7 w-7" />
      </div>
      <div className="min-w-0 flex-1 space-y-3 text-[15px] leading-relaxed">
        <p className="sr-only">{label}:</p>
        {children}
      </div>
    </div>
  );
}

export function StudentMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <p className="sr-only">You:</p>
      <div className="bubble-user">{children}</div>
    </div>
  );
}

/** Animated "thinking" indicator with a text label for screen readers. */
export function Thinking({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm text-ink-soft">
      <span aria-hidden="true" className="flex gap-1">
        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-current" />
        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-current [animation-delay:0.2s]" />
        <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-current [animation-delay:0.4s]" />
      </span>
      {label}
    </p>
  );
}
