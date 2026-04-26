import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded font-semibold tracking-tight transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:shadow-focus',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-bg hover:opacity-90 hover:-translate-y-px disabled:translate-y-0',
        secondary: 'bg-surface text-ink border border-border hover:border-ink hover:bg-bg',
        ghost: 'text-muted hover:text-ink hover:bg-border-soft',
        accent: 'bg-accent text-bg hover:opacity-90',
        outline: 'border border-ink text-ink bg-transparent hover:bg-ink hover:text-bg',
      },
      size: {
        sm: 'px-3 py-1.5 text-[13px]',
        md: 'px-5 py-2.5 text-[14px]',
        lg: 'px-6 py-3 text-[14.5px]',
        xl: 'px-8 py-3.5 text-[15px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
