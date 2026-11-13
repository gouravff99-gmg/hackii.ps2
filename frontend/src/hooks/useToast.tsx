import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "info" | "success" | "warning" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastOptions {
  durationMs?: number;
  eventKey?: string;
}

interface ToastContextValue {
  push: (kind: ToastKind, title: string, message?: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const KIND_STYLES: Record<ToastKind, string> = {
  info: "border-brand-200 bg-white text-ink-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  error: "border-red-200 bg-red-50 text-red-900",
};

const KIND_DOT: Record<ToastKind, string> = {
  info: "bg-brand-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const recentEvents = useRef(new Map<string, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, message?: string, options?: ToastOptions) => {
      const now = Date.now();
      for (const [key, expiresAt] of recentEvents.current) {
        if (expiresAt <= now) recentEvents.current.delete(key);
      }
      if (options?.eventKey && recentEvents.current.has(options.eventKey)) return;
      if (options?.eventKey) recentEvents.current.set(options.eventKey, now + 60_000);

      const id = nextId.current;
      nextId.current += 1;
      const toast: Toast = { id, kind, title, message };
      setToasts((current) => {
        const next = [...current, toast];
        const removed = next.slice(0, Math.max(0, next.length - 4));
        for (const previous of removed) {
          const timer = timers.current.get(previous.id);
          if (timer !== undefined) window.clearTimeout(timer);
          timers.current.delete(previous.id);
        }
        return next.slice(-4);
      });
      const duration = Math.max(0, options?.durationMs ?? 5000);
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[1000] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-raised animate-slide-in ${KIND_STYLES[toast.kind]}`}
            role="status"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[toast.kind]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{toast.title}</p>
              {toast.message ? <p className="mt-0.5 text-sm opacity-80">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-md px-1 text-lg leading-none opacity-50 transition hover:opacity-100"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
