import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ToastPayload = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
};

type ToastItem = ToastPayload & { id: string };

type ToastContextValue = {
  toast: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const variantStyles: Record<NonNullable<ToastPayload["variant"]>, string> = {
  default: "border-sand-200/70 bg-white/80",
  success: "border-sage-300 bg-sage-100/80",
  error: "border-red-200 bg-red-50/90"
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const toast = useCallback((payload: ToastPayload) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { ...payload, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 space-y-3">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "min-w-[240px] max-w-[340px] rounded-2xl border px-4 py-3 text-sm text-ink-800 shadow-glow backdrop-blur",
              variantStyles[item.variant ?? "default"]
            )}
            role="status"
          >
            <p className="font-semibold">{item.title}</p>
            {item.description ? <p className="text-ink-600">{item.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}



