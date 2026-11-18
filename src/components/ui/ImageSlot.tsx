import type { ReactNode } from 'react';
import { Utensils } from 'lucide-react';

interface ImageSlotProps {
  title: string;
  subtitle: string;
  aspectClass?: string;
  icon?: ReactNode;
}

export function ImageSlot({
  title,
  subtitle,
  aspectClass = 'aspect-[4/3]',
  icon,
}: ImageSlotProps) {
  return (
    <div
      className={`${aspectClass} flex flex-col items-center justify-center rounded-xl border border-dashed border-forest-200 bg-forest-50/45 p-5 text-center`}
    >
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-lg border border-forest-200 bg-white text-forest-700">
        {icon ?? <Utensils className="h-5 w-5" aria-hidden="true" />}
      </div>
      <p className="text-xs font-semibold text-forest-900">{title}</p>
      <p className="mt-1 max-w-[24ch] text-[11px] leading-relaxed text-slate-600">
        {subtitle}
      </p>
    </div>
  );
}
