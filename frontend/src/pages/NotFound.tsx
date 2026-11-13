import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";

export function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <Icon name="map-pin" size={24} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-900">Page not found</h1>
      <p className="mt-2 text-sm text-ink-500">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-5 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Back to home
        <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  );
}
