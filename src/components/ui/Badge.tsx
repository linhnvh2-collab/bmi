import type { ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
} from 'lucide-react';

export type BadgeTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const badgeStyles: Record<BadgeTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-fresh-600/30 bg-fresh-50 text-forest-900',
  warning: 'border-warm-500/40 bg-warm-50 text-warm-800',
  danger: 'border-red-200 bg-red-50 text-red-900',
  neutral: 'border-slate-200 bg-slate-100 text-slate-800',
};

const badgeIcons: Record<BadgeTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: ShieldAlert,
};

export function Badge({
  tone = 'neutral',
  children,
  className = '',
}: BadgeProps) {
  const Icon = badgeIcons[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap shrink-0 ${badgeStyles[tone]} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
