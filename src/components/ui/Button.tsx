import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition duration-200 focus-ring disabled:opacity-50 disabled:pointer-events-none active:translate-y-px";

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-ink-900 text-sand-50 shadow-soft hover:bg-ink-800 hover:shadow-card",
  secondary: "bg-gold-500 text-ink-900 shadow-soft hover:bg-gold-300",
  outline: "border border-ink-300 bg-white/70 text-ink-900 hover:border-ink-500 hover:bg-white",
  ghost: "text-ink-700 hover:bg-sand-100/80"
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base"
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", asChild, ...props }, ref) => {
    const classes = cn(base, variants[variant], sizes[size], className);

    if (asChild) {
      const child = React.Children.only(props.children) as React.ReactElement;
      return React.cloneElement(child, {
        className: cn(classes, (child.props as { className?: string }).className)
      });
    }

    return <button ref={ref} className={classes} {...props} />;
  }
);

Button.displayName = "Button";
