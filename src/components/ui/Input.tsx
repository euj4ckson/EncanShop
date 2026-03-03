import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-2xl border border-sand-200/70 bg-white/85 px-4 text-[15px] leading-5 text-ink-900 shadow-sm placeholder:text-ink-400/90 backdrop-blur transition focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200 disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
