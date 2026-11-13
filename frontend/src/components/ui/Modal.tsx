import { useEffect, type ReactNode } from "react";
import { Icon } from "./Icon";

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[900] flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-sm animate-fade-in sm:items-center sm:p-6">
      <div
        className="w-full max-w-md rounded-t-2xl border border-ink-200 bg-white p-5 shadow-raised animate-slide-up sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="mt-3 text-sm text-ink-600">{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
