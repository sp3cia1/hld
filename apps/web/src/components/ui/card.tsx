import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const cardVariants = cva('rounded-xl border-2 bg-card text-card-foreground', {
  variants: {
    // A card the customer can act on lifts onto the hard poster shadow when hovered or focused.
    // It is also a `group`, so an `action` Button inside fills at the same moment.
    interactive: {
      true: 'group block outline-none transition-[translate,box-shadow] duration-150 ease-out hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-lift focus-visible:-translate-x-0.5 focus-visible:-translate-y-0.5 focus-visible:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
      false: '',
    },
  },
  defaultVariants: { interactive: false },
});

type CardProps = React.ComponentProps<'div'> &
  VariantProps<typeof cardVariants> & { asChild?: boolean };

/** Use `asChild` to make the card itself the link: `<Card asChild interactive><Link …>…</Link></Card>`. */
export function Card({ className, interactive, asChild = false, ...props }: CardProps) {
  const Comp = asChild ? Slot.Root : 'div';
  return <Comp className={cn(cardVariants({ interactive }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 p-6 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('leading-tight', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-6', className)} {...props} />;
}
