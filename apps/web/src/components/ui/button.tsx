import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border-2 bg-card hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // The main action of a clickable card: outlined at rest, then teal spreads from the bottom centre
        // while the card (any `group` parent, e.g. an interactive Card) or the button is hovered or focused.
        action:
          'relative isolate overflow-hidden border-2 border-primary text-primary transition-colors duration-300 before:absolute before:top-full before:left-1/2 before:-z-10 before:aspect-square before:w-[170%] before:-translate-x-1/2 before:-translate-y-1/2 before:scale-0 before:rounded-full before:bg-primary before:transition-transform before:duration-500 before:ease-out-expo group-hover:text-primary-foreground group-hover:before:scale-100 group-focus-visible:text-primary-foreground group-focus-visible:before:scale-100 hover:text-primary-foreground hover:before:scale-100 focus-visible:text-primary-foreground focus-visible:before:scale-100 motion-reduce:before:transition-none',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3',
        lg: 'h-11 px-6',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
