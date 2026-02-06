import * as React from "react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-sand-200/70 bg-white/80 px-3 py-2 text-sm text-ink-900 shadow-sm backdrop-blur transition focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";



