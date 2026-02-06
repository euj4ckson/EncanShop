import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function QuantityControl({
  value,
  onChange
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Diminuir quantidade"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="min-w-[32px] rounded-full bg-sand-100 px-2 py-1 text-center text-sm font-semibold text-ink-900">
        {value}
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange(value + 1)}
        aria-label="Aumentar quantidade"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}



