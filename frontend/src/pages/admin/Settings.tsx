import { useNavigate } from "react-router-dom";
import {
  ALLOC_WEIGHTS,
  CITY,
  FARE,
  MATCHING,
  POOL,
  SIM,
  SURGE,
  TIMEOUTS,
  ZONE_SIZE_KM,
  type HealthResponse,
} from "@ps02/shared";
import { useAuth } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { Icon } from "../../components/ui/Icon";
import { initials, roleLabel } from "../../utils/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

export function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const healthState = useAsync<HealthResponse>(() => api.get<HealthResponse>("/health"), []);

  if (!user) return null;

  const health = healthState.data;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Settings"
        description="Account details, service health and the tuning parameters this deployment runs with."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" subtitle="Signed in on this browser" />
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-base font-semibold text-violet-700">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink-900">{user.name}</p>
                <p className="truncate text-sm text-ink-500">{user.email}</p>
                <Badge tone="accent">{roleLabel(user.role)}</Badge>
              </div>
            </div>
            <div className="rounded-xl border border-ink-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">Sign out</p>
                  <p className="text-xs text-ink-500">Clears the session token from this browser.</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    logout();
                    navigate("/", { replace: true });
                  }}
                >
                  <Icon name="logout" size={16} />
                  Sign out
                </Button>
              </div>
            </div>
            <p className="text-xs text-ink-400">
              Account editing (name, email, password) is not exposed by this build's API.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Service health"
            subtitle="Liveness and database reachability"
            action={
              <Button
                variant="ghost"
                size="sm"
                loading={healthState.loading}
                onClick={() => void healthState.reload()}
              >
                <Icon name="refresh" size={15} />
                Check
              </Button>
            }
          />
          <CardBody>
            {healthState.loading && !health ? (
              <div className="flex items-center justify-center py-10 text-ink-400">
                <Spinner className="h-5 w-5" />
              </div>
            ) : healthState.error ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {healthState.error}
              </p>
            ) : health ? (
              <dl className="divide-y divide-ink-100">
                <Row label="API" value={health.ok ? "Reachable" : "Unhealthy"} />
                <Row label="Database" value={health.database ? "Connected" : "Unavailable"} />
                {health.databaseError ? (
                  <div className="py-2.5">
                    <dt className="text-sm text-ink-500">Database error</dt>
                    <dd className="mt-1 break-words rounded-lg bg-ink-50 px-3 py-2 font-mono text-xs text-ink-600">
                      {health.databaseError}
                    </dd>
                  </div>
                ) : null}
                <Row label="City" value={health.city} />
                <Row label="Sim speed" value={`${health.simSpeed}×`} />
                <Row label="Server time" value={new Date(health.time).toLocaleString()} />
              </dl>
            ) : null}
            {health && !health.database ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                The API is running but the database is unreachable. Start PostgreSQL (see
                docker-compose.yml) and set DATABASE_URL, then run the Prisma migrations and seed.
              </p>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pricing & zones" subtitle="From shared/src/config.ts" />
          <CardBody>
            <dl className="divide-y divide-ink-100">
              <Row label="Base fare" value={`₹${FARE.base}`} />
              <Row label="Per km" value={`₹${FARE.perKm}`} />
              <Row label="Per minute" value={`₹${FARE.perMin}`} />
              <Row label="Minimum fare" value={`₹${FARE.minFare}`} />
              <Row label="Zone size" value={`${ZONE_SIZE_KM} km`} />
              <Row
                label="Service area"
                value={`${CITY.bounds.south.toFixed(3)}–${CITY.bounds.north.toFixed(3)} lat, ${CITY.bounds.west.toFixed(3)}–${CITY.bounds.east.toFixed(3)} lng`}
              />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Allocation & matching" subtitle="Weights and thresholds" />
          <CardBody>
            <dl className="divide-y divide-ink-100">
              <Row label="ETA weight" value={ALLOC_WEIGHTS.eta.toFixed(2)} />
              <Row label="Workload weight" value={ALLOC_WEIGHTS.workload.toFixed(2)} />
              <Row label="Acceptance weight" value={ALLOC_WEIGHTS.acceptance.toFixed(2)} />
              <Row label="Idle weight" value={ALLOC_WEIGHTS.idle.toFixed(2)} />
              <Row label="Candidate radius" value={`${MATCHING.candidateRadiusKm} km`} />
              <Row label="Offer timeout" value={`${Math.round(TIMEOUTS.driverResponseMs / 1000)} s`} />
              <Row label="Delay threshold" value={`${Math.round(TIMEOUTS.delayThreshold * 100)}% over promise`} />
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pooling" subtitle="Shared ride constraints" />
          <CardBody>
            <dl className="divide-y divide-ink-100">
              <Row label="Pickup radius" value={`${POOL.pickupRadiusKm} km`} />
              <Row label="Drop radius" value={`${POOL.dropRadiusKm} km`} />
              <Row label="Max detour" value={`${Math.round(POOL.maxDetour * 100)}%`} />
              <Row label="Max riders" value={String(POOL.maxRiders)} />
              <Row label="Scan interval" value={`${Math.round(POOL.scanIntervalMs / 1000)} s`} />
              <Row label="Pooled fare" value={`${Math.round(POOL.fareDiscount * 100)}% of solo`} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Simulation & surge" subtitle="Runtime parameters" />
          <CardBody>
            <dl className="divide-y divide-ink-100">
              <Row label="Default drivers" value={String(SIM.numDrivers)} />
              <Row label="Sim speed" value={`${SIM.speed}×`} />
              <Row label="Location emit" value={`${SIM.locationEmitMs / 1000} s`} />
              <Row
                label="Proactive dispatch"
                value={`every ${Math.round(SIM.proactiveDispatchIntervalMs / 60_000)} simulated min`}
              />
              <Row
                label="Surge formula"
                value={`clamp(1 + ${SURGE.factor} × (demand/supply − 1), ${SURGE.min}, ${SURGE.max})`}
              />
              <Row label="Supply floor" value={String(SURGE.supplyFloor)} />
            </dl>
            <p className="mt-3 text-xs text-ink-400">
              These values are compiled from the shared config. Changing them requires a rebuild.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
