import { useEffect, useState } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { CITY, FARE, NUM_DRIVERS } from "@ps02/shared";

interface Health {
  ok: boolean;
  service: string;
  city: string;
  simSpeed: number;
  time: string;
}

function HealthBadge() {
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
        API offline ({error})
      </span>
    );
  }
  if (!health) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
        Checking API…
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
      API online · {health.city} · sim ×{health.simSpeed}
    </span>
  );
}

function Landing() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PS02 Ride Hailing</h1>
          <p className="text-sm text-slate-500">
            Intelligent ride matching and dynamic driver allocation · Phase 0 scaffold
          </p>
        </div>
        <HealthBadge />
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { to: "/passenger", title: "Passenger", body: "Request a ride, watch it live." },
          { to: "/driver", title: "Driver", body: "Go online, accept offers." },
          { to: "/admin", title: "Admin", body: "Zones, simulator, evaluation." },
        ].map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-400 hover:shadow"
          >
            <h2 className="font-semibold text-slate-900">{c.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{c.body}</p>
          </Link>
        ))}
      </section>

      <section className="h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <MapContainer center={[CITY.center.lat, CITY.center.lng]} zoom={12} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker
            center={[CITY.center.lat, CITY.center.lng]}
            radius={10}
            pathOptions={{ color: "#186bf5", fillColor: "#186bf5", fillOpacity: 0.5 }}
          >
            <Tooltip permanent direction="top">
              {CITY.name} centre
            </Tooltip>
          </CircleMarker>
        </MapContainer>
      </section>

      <section className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
        <div className="rounded-lg bg-white p-3 shadow-sm">
          Base fare ₹{FARE.base} · ₹{FARE.perKm}/km · ₹{FARE.perMin}/min
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          Simulator fleet: {NUM_DRIVERS} drivers
        </div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          Zones derived from a 20 km × 20 km box at 1 km cells
        </div>
      </section>
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
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

export default function App() {
  return (
    <div className="min-h-full bg-slate-50">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/passenger" element={<Placeholder title="Passenger" />} />
        <Route path="/driver" element={<Placeholder title="Driver" />} />
        <Route path="/admin" element={<Placeholder title="Admin" />} />
        <Route path="*" element={<Placeholder title="Not found" />} />
      </Routes>
    </div>
  );
}
