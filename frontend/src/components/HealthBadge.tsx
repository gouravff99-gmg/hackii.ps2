import { useEffect, useState } from "react";

interface Health {
  ok: boolean;
  service: string;
  city: string;
  simSpeed: number;
  time: string;
}

/** Small pill showing whether the backend is reachable. */
export default function HealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Health>;
      })
      .then((h) => !cancelled && setHealth(h))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "unreachable"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
        Backend offline ({error})
      </span>
    );
  }
  if (!health) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
        Checking backend…
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
      Backend online · {health.city} · sim ×{health.simSpeed}
    </span>
  );
}
