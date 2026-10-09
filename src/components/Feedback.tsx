import type { ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  correct: boolean;
  displayAnswer: string;
  explanation: string;
  response?: string;
  confusedWith?: string;
  note?: string;
  /** Hide the "Correct answer" line (for example, when a review shows its own details). */
  hideAnswer?: boolean;
  children?: ReactNode;
}

export function Feedback({ correct, displayAnswer, explanation, response, confusedWith, note, hideAnswer, children }: Props) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <p
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
          correct
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
            : 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200'
        }`}
      >
        <Icon name={correct ? 'check' : 'x'} className="h-4 w-4" />
        {correct ? 'Correct' : 'Not quite'}
      </p>
      {!correct && !hideAnswer && (
        <p>
          The answer is <strong className="font-semibold">{displayAnswer}</strong>.
          {response ? <span className="text-ink-soft"> You answered "{response}".</span> : null}
        </p>
      )}
      {confusedWith && <p className="text-sm text-ink-soft">"{confusedWith}" is a real term, but it means something different.</p>}
      {note && <p className="text-sm text-ink-soft">{note}</p>}
      {explanation && <p>{explanation}</p>}
      {children && <div className="flex flex-wrap gap-2 pt-2">{children}</div>}
    </div>
  );
}
