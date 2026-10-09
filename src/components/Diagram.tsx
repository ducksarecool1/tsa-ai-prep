import type { Diagram as DiagramData } from '../types';

const NEST_COLORS = [
  'border-brand-200 bg-brand-50/60 dark:border-brand-800 dark:bg-brand-950/30',
  'border-brand-300 bg-brand-100/70 dark:border-brand-700 dark:bg-brand-900/30',
  'border-brand-400 bg-brand-200/70 dark:border-brand-600 dark:bg-brand-800/40',
  'border-brand-500 bg-brand-300/70 dark:border-brand-500 dark:bg-brand-700/50',
];

function Nested({ labels }: { labels: string[] }) {
  const render = (i: number): JSX.Element => (
    <div className={`rounded-2xl border-2 p-3 pt-2 sm:p-4 sm:pt-2 ${NEST_COLORS[i % NEST_COLORS.length]}`}>
      <p className="mb-2 text-sm font-semibold text-ink">{labels[i]}</p>
      {i + 1 < labels.length && render(i + 1)}
    </div>
  );
  return render(0);
}

function Flow({ steps }: { steps: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium">
            <span className="sr-only">Step {i + 1}: </span>
            {s}
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="text-lg font-bold text-brand-600 dark:text-brand-300">
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Network({ layers, caption }: { layers: { label: string; nodes: number }[]; caption: string }) {
  const width = 420;
  const height = 230;
  const top = 20;
  const bottom = 190;
  const colX = (i: number) => 50 + (i * (width - 100)) / Math.max(1, layers.length - 1);
  const nodeY = (n: number, j: number) => top + ((j + 1) * (bottom - top)) / (n + 1);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={caption} className="h-auto w-full max-w-lg">
      {layers.slice(0, -1).map((layer, i) =>
        Array.from({ length: layer.nodes }).flatMap((_, a) =>
          Array.from({ length: layers[i + 1].nodes }).map((__, b) => (
            <line
              key={`${i}-${a}-${b}`}
              x1={colX(i)}
              y1={nodeY(layer.nodes, a)}
              x2={colX(i + 1)}
              y2={nodeY(layers[i + 1].nodes, b)}
              className="stroke-ink-soft/50"
              strokeWidth={1}
            />
          )),
        ),
      )}
      {layers.map((layer, i) => (
        <g key={i}>
          {Array.from({ length: layer.nodes }).map((_, j) => (
            <circle
              key={j}
              cx={colX(i)}
              cy={nodeY(layer.nodes, j)}
              r={11}
              className={
                i === 0
                  ? 'fill-brand-200 stroke-brand-700 dark:fill-brand-800 dark:stroke-brand-300'
                  : i === layers.length - 1
                    ? 'fill-emerald-200 stroke-emerald-700 dark:fill-emerald-800 dark:stroke-emerald-300'
                    : 'fill-amber-100 stroke-amber-600 dark:fill-amber-800 dark:stroke-amber-300'
              }
              strokeWidth={2}
            />
          ))}
          <text x={colX(i)} y={height - 10} textAnchor="middle" className="fill-ink-soft text-[11px]">
            {layer.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Matrix({ rowLabels, colLabels, cells }: { rowLabels: string[]; colLabels: string[]; cells: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <td className="p-2" />
            {colLabels.map((c) => (
              <th key={c} scope="col" className="border border-line bg-raised p-2 text-left">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="border border-line bg-raised p-2 text-left">
                {r}
              </th>
              {cells[i].map((c, j) => (
                <td key={j} className="border border-line p-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Timeline({ events }: { events: { year: string; label: string }[] }) {
  return (
    <ol className="space-y-2 border-l-2 border-brand-500 pl-4">
      {events.map((e) => (
        <li key={e.year + e.label}>
          <span className="font-bold">{e.year}</span>: {e.label}
        </li>
      ))}
    </ol>
  );
}

export function Diagram({ diagram }: { diagram: DiagramData }) {
  let body: JSX.Element;
  switch (diagram.type) {
    case 'nested':
      body = <Nested labels={diagram.labels} />;
      break;
    case 'flow':
      body = <Flow steps={diagram.steps} />;
      break;
    case 'network':
      body = <Network layers={diagram.layers} caption={diagram.caption} />;
      break;
    case 'matrix':
      body = <Matrix rowLabels={diagram.rowLabels} colLabels={diagram.colLabels} cells={diagram.cells} />;
      break;
    case 'timeline':
      body = <Timeline events={diagram.events} />;
      break;
  }
  return (
    <figure className="card my-6">
      {body}
      <figcaption className="mt-3 text-sm muted">{diagram.caption}</figcaption>
    </figure>
  );
}
