import { Link } from "react-router-dom";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { CITY, FARE, NUM_DRIVERS } from "@ps02/shared";
import HealthBadge from "../components/HealthBadge";

const ROLES = [
  { to: "/passenger", title: "Passenger", body: "Request a ride, watch it live." },
  { to: "/driver", title: "Driver", body: "Go online, accept offers." },
  { to: "/admin", title: "Admin", body: "Zones, simulator, evaluation." },
];

export default function Landing() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PS02 Ride Hailing</h1>
          <p className="text-sm text-slate-500">
            Intelligent ride matching and dynamic driver allocation
          </p>
        </div>
        <HealthBadge />
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {ROLES.map((c) => (
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
        <div className="rounded-lg bg-white p-3 shadow-sm">Simulator fleet: {NUM_DRIVERS} drivers</div>
        <div className="rounded-lg bg-white p-3 shadow-sm">
          Zones derived from a 20 km × 20 km box at 1 km cells
        </div>
      </section>
    </div>
  );
}
