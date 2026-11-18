import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { VERIFICATION_STATUS_METADATA } from '@/src/lib/nutrition';
import type { VerificationStatus } from '@/src/types/food';

interface VerificationBadgeProps {
  status: VerificationStatus;
  showFullLabel?: boolean;
}

const styles: Record<VerificationStatus, string> = {
  verified: 'border-fresh-600/30 bg-fresh-50 text-forest-900',
  estimated: 'border-warm-500/40 bg-warm-50 text-warm-800',
  unverified: 'border-slate-200 bg-slate-100 text-slate-700',
};

const icons: Record<VerificationStatus, typeof CheckCircle2> = {
  verified: CheckCircle2,
  estimated: AlertTriangle,
  unverified: HelpCircle,
};

export function VerificationBadge({
  status,
  showFullLabel = false,
}: VerificationBadgeProps) {
  const meta = VERIFICATION_STATUS_METADATA[status];
  const Icon = icons[status];

  return (
    <span
      title={meta.explanationVi}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${styles[status]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{showFullLabel ? meta.labelVi : meta.shortBadgeVi}</span>
    </span>
  );
}
