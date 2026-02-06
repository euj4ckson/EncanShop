import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-sand-200 bg-sand-100/80 px-2.5 py-1 text-xs font-semibold text-ink-700",
        className
      )}
      {...props}
    />
  );
}
