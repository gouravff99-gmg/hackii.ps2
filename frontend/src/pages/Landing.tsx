import { Link } from "react-router-dom";
import { CITY, FARE, POOL, SIM } from "@ps02/shared";
import { MapCanvas } from "../components/map/MapCanvas";
import HealthBadge from "../components/HealthBadge";
import { Icon, type IconName } from "../components/ui/Icon";
import { useAuth } from "../hooks/useAuth";
import { homeForRole } from "../utils/roles";

const HIGHLIGHTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "zap",
    title: "Explainable matching",
    body: "Every assignment is scored on pickup ETA, workload, acceptance rate and idle time — and the ranking is shown, not hidden.",
  },
  {
    icon: "layers",
    title: "Demand intelligence",
    body: "Zone-level demand is blended with a trained forecast so surge pricing and driver repositioning follow real pressure.",
  },
  {
    icon: "users",
    title: "Pooling built in",
    body: `Riders heading the same way share a car when detours stay under ${Math.round(POOL.maxDetour * 100)}% and pay ${Math.round(POOL.fareDiscount * 100)}% of the solo fare.`,
  },
  {
    icon: "shield",
    title: "Automatic recovery",
    body: "Rejections, timeouts, cancellations and delays trigger reassignment to the next best driver without the passenger lifting a finger.",
  },
];

export function Landing() {
  const { user } = useAuth();

  return (
    <div>
      <section className="relative overflow-hidden border-b border-ink-100 bg-gradient-to-b from-white to-ink-50">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="animate-slide-up">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {CITY.name} pilot · 20 km × 20 km service area
              </span>
              <HealthBadge />
            </div>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-5xl">
              Rides that arrive
              <span className="text-brand-600"> before you wonder</span> where they are.
            </h1>

            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-500">
              RideOps pairs passengers with the right driver using live demand, zone pressure and an
              explainable allocation score. Book a ride, follow it in real time, or open the
              operations console and watch the fleet think.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {user ? (
                <Link
                  to={homeForRole(user.role)}
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
                >
                  Open your dashboard
                  <Icon name="arrow-right" size={16} />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
                  >
                    Create an account
                    <Icon name="arrow-right" size={16} />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex h-12 items-center rounded-xl border border-ink-200 bg-white px-6 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>

            <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-ink-200 pt-6 text-left">
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Base fare</dt>
                <dd className="mt-1 text-lg font-semibold text-ink-900">₹{FARE.base}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Per km</dt>
                <dd className="mt-1 text-lg font-semibold text-ink-900">₹{FARE.perKm}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-ink-400">Sim fleet</dt>
                <dd className="mt-1 text-lg font-semibold text-ink-900">{SIM.numDrivers} cars</dd>
              </div>
            </dl>
          </div>

          <div className="relative">
            <div className="h-[360px] overflow-hidden rounded-xl2 border border-ink-200 shadow-raised sm:h-[420px]">
              <MapCanvas
                center={CITY.center}
                zoom={12}
                showControls={false}
                markers={[
                  {
                    id: "center",
                    lat: CITY.center.lat,
                    lng: CITY.center.lng,
                    kind: "active",
                    label: CITY.name,
                  },
                ]}
              />
            </div>
            <div className="absolute -bottom-4 left-4 right-4 rounded-xl border border-ink-200 bg-white/95 px-4 py-3 shadow-card backdrop-blur sm:left-6 sm:right-auto sm:max-w-xs">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Live zone signal
              </p>
              <p className="mt-1 text-sm text-ink-700">
                Surge is computed per 1 km zone from observed demand and available supply.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="rounded-xl2 border border-ink-200/80 bg-white p-5 shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon name={item.icon} size={19} />
              </span>
              <h2 className="mt-3 text-sm font-semibold text-ink-900">{item.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-ink-100 bg-ink-900">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Three workspaces, one engine.</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              Passengers, drivers and operators see exactly what they need — nothing else. Advanced
              intelligence stays inside the operations console.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
            {[
              { title: "Passenger", body: "Book on a map, track every stage, see the fare breakdown." },
              { title: "Driver", body: "Go online, answer offers, progress trips, track earnings." },
              { title: "Operator", body: "Fleet, demand, allocation, simulation and evaluation." },
            ].map((role) => (
              <div key={role.title} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">{role.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-300">{role.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default Landing;
