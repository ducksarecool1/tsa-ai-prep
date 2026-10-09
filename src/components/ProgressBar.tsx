interface Props {
  /** 0 to 1 for the main fill. */
  value: number;
  /** Optional lighter fill (for example, Familiar items), also 0 to 1, drawn under `value`. */
  secondary?: number;
  label: string;
  className?: string;
}

export function ProgressBar({ value, secondary, label, className = '' }: Props) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const pct2 = secondary !== undefined ? Math.round(Math.max(0, Math.min(1, secondary)) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`relative h-3 w-full overflow-hidden rounded-full bg-line ${className}`}
    >
      {secondary !== undefined && (
        <div className="absolute inset-y-0 left-0 bg-amber-400 dark:bg-amber-500" style={{ width: `${Math.min(100, pct + pct2)}%` }} />
      )}
      <div className="absolute inset-y-0 left-0 bg-emerald-600 dark:bg-emerald-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
