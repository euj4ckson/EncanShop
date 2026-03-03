import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-[110px] w-full rounded-2xl border border-sand-200/70 bg-white/85 px-4 py-3 text-[15px] leading-6 text-ink-900 shadow-sm placeholder:text-ink-400/90 backdrop-blur transition focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200 disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
