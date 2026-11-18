import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  unitLabel?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { hasError = false, unitLabel, className = '', ...props },
  ref
) {
  return (
    <div className="relative flex items-center">
      <input
        ref={ref}
        className={`w-full h-11 rounded-lg border bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-100 disabled:text-slate-500 ${
          unitLabel ? 'pr-14' : ''
        } ${
          hasError
            ? 'border-red-500 focus:border-red-600 focus:ring-red-200'
            : 'border-slate-300 focus:border-forest-700 focus:ring-forest-200'
        } ${className}`}
        {...props}
      />
      {unitLabel && (
        <span className="pointer-events-none absolute right-3.5 text-xs font-mono font-medium text-slate-500">
          {unitLabel}
        </span>
      )}
    </div>
  );
});
