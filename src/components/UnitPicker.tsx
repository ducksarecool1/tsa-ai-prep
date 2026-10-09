import type { Unit } from '../types';

interface Props {
  units: Unit[];
  selected: string[];
  onChange: (ids: string[]) => void;
  legend?: string;
}

export function UnitPicker({ units, selected, onChange, legend = 'Units' }: Props) {
  const all = selected.length === units.length;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : units.map((u) => u.id).filter((u) => u === id || selected.includes(u)));
  return (
    <fieldset>
      <div className="mb-2 flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold">{legend}</legend>
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300" onClick={() => onChange(all ? [] : units.map((u) => u.id))}>
          {all ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {units.map((u) => (
          <label
            key={u.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 hover:bg-raised"
          >
            <input type="checkbox" className="mt-1 h-4 w-4 accent-brand-600" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
            <span className="text-sm">
              <span className="font-semibold">
                Unit {u.number}: {u.title}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
