import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface AllergenBadgeProps {
  label: string;
  isMatchedUserAllergen?: boolean;
}

export function AllergenBadge({
  label,
  isMatchedUserAllergen = false,
}: AllergenBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        isMatchedUserAllergen
          ? 'border-red-300 bg-red-50 text-red-900 font-semibold'
          : 'border-slate-200 bg-slate-50 text-slate-700'
      }`}
    >
      {isMatchedUserAllergen && (
        <ShieldAlert className="h-3 w-3 shrink-0 text-red-700" aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}

export function AllergenUnreviewedTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-warm-500/40 bg-warm-50 px-2 py-0.5 text-[11px] font-medium text-warm-800 whitespace-nowrap">
      <AlertTriangle className="h-3 w-3 shrink-0 text-warm-700" aria-hidden="true" />
      <span>Chưa rà soát dị ứng</span>
    </span>
  );
}
