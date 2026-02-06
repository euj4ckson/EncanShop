import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-2xl border border-sand-200/70 bg-white/80 px-3 py-2 text-sm text-ink-900 shadow-sm placeholder:text-ink-400 backdrop-blur transition focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
