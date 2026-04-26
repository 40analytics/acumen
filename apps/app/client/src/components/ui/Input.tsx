import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'w-full px-4 py-3 rounded text-[14.5px] bg-surface border border-border',
        'text-ink transition-colors outline-none',
        'focus:border-ink focus:shadow-focus',
        'placeholder:text-faint',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-[12px] font-semibold text-ink tracking-tight mb-1.5', className)}
      {...props}
    />
  )
);
Label.displayName = 'Label';
