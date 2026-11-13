import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon = "info",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink-100 text-ink-500">
        <Icon name={icon} size={20} />
      </span>
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500">
        <Icon name="alert" size={20} />
      </span>
      <p className="text-sm font-semibold text-ink-800">Could not load this data</p>
      <p className="max-w-sm text-sm text-ink-500">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-ink-50"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
