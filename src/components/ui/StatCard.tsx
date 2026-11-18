import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  caption?: string;
  badge?: ReactNode;
}

export function StatCard({
  label,
  value,
  unit,
  caption,
  badge,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        {badge}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-xs font-medium text-slate-500">{unit}</span>
        )}
      </div>
      {caption && (
        <p className="text-xs leading-relaxed text-slate-500">{caption}</p>
      )}
    </div>
  );
}
