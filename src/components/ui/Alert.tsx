import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

const toneStyles: Record<
  AlertTone,
  { container: string; iconColor: string; titleColor: string }
> = {
  info: {
    container: 'border-sky-200 bg-sky-50/70 text-slate-800',
    iconColor: 'text-sky-700',
    titleColor: 'text-sky-950',
  },
  success: {
    container: 'border-fresh-500/30 bg-fresh-50 text-slate-800',
    iconColor: 'text-fresh-700',
    titleColor: 'text-forest-900',
  },
  warning: {
    container: 'border-warm-500/40 bg-warm-50 text-slate-800',
    iconColor: 'text-warm-700',
    titleColor: 'text-warm-800',
  },
  danger: {
    container: 'border-red-200 bg-red-50/80 text-slate-800',
    iconColor: 'text-red-700',
    titleColor: 'text-red-950',
  },
};

const icons: Record<AlertTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export function Alert({
  tone = 'info',
  title,
  children,
  className = '',
}: AlertProps) {
  const Icon = icons[tone];
  const style = toneStyles[tone];

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed ${style.container} ${className}`}
    >
      <Icon
        className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconColor}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 space-y-1">
        {title && (
          <p className={`font-semibold ${style.titleColor}`}>{title}</p>
        )}
        <div className="text-slate-700">{children}</div>
      </div>
    </div>
  );
}
