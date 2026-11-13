import { Link } from "react-router-dom";

/** Temporary page for screens that are built in later phases. */
export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/" className="text-sm text-brand-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-1 text-slate-500">This screen is built in a later phase.</p>
    </div>
  );
}
