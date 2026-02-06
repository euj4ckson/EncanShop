import { cn } from "@/lib/utils";

export function CartBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink-900 px-1 text-[11px] font-semibold text-sand-50 ring-2 ring-sand-50",
        className
      )}
      aria-label={`Carrinho com ${count} itens`}
    >
      {count}
    </span>
  );
}



