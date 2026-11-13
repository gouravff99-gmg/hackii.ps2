import {
  SOCKET_EVENTS,
  type AdminOverviewMetrics,
  type DriverAdminView,
  type RideEventLogItem,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { adminApi } from "../../services/adminApi";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { StatCard } from "../../components/ui/StatCard";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState } from "../../components/ui/EmptyState";
import {
  formatPercent,
  formatRelative,
  formatWait,
} from "../../utils/format";
import { Link } from "react-router-dom";
import { Icon } from "../../components/ui/Icon";

interface OverviewData {
  metrics: AdminOverviewMetrics;
  drivers: DriverAdminView[];
  events: RideEventLogItem[];
}

export function Overview() {
  const { data, loading, error, reload } = useAsync<OverviewData>(async () => {
    const [metrics, drivers, events] = await Promise.all([
      adminApi.overview(),
      adminApi.drivers(),
      adminApi.events(15),
    ]);
    return { metrics, drivers: drivers.drivers, events: events.events };
  }, []);

  // Ride status changes are infrequent; fleet positions are handled on the Live
  // Fleet page so the overview does not reload on every location tick.
  useSocketEvent(SOCKET_EVENTS.RIDE_STATUS, () => void reload());

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Could not load the overview"} onRetry={() => void reload()} />;
  }

  const { metrics, drivers, events } = data;
  const simulated = drivers.filter((driver) => driver.isSimulated).length;
  const online = drivers.filter((driver) => driver.status !== "OFFLINE").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Operations overview"
        description="Fleet health, ride throughput and the latest events across the platform."
        actions={
          <Link
            to="/admin/simulation"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-900 px-4 text-sm font-medium text-white transition hover:bg-ink-800"
          >
            <Icon name="play" size={15} />
            Open simulator
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Drivers online"
          value={`${online}/${metrics.totalDrivers}`}
          hint={`${metrics.availableDrivers} available · ${metrics.busyDrivers} busy`}
          icon="car"
          tone="brand"
        />
        <StatCard
          label="Active rides"
          value={metrics.activeRides}
          hint={`${metrics.completedRidesToday} completed today`}
          icon="route"
          tone="violet"
        />
        <StatCard
          label="Avg passenger wait"
          value={formatWait(metrics.averagePassengerWaitSec)}
          hint="Time from request to acceptance"
          icon="clock"
          tone="warning"
        />
        <StatCard
          label="Driver utilization"
          value={formatPercent(metrics.driverUtilization)}
          hint="Busy minutes / capacity today"
          icon="activity"
          tone="success"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total passengers" value={metrics.totalPassengers} icon="users" />
        <StatCard label="Available drivers" value={metrics.availableDrivers} icon="check" tone="success" />
        <StatCard label="Busy drivers" value={metrics.busyDrivers} icon="navigation" tone="warning" />
        <StatCard
          label="Simulated fleet"
          value={simulated}
          hint="Accounts flagged isSimulated"
          icon="layers"
          tone="violet"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Live event log"
            subtitle="Most recent ride events across the platform"
            action={
              <Link to="/admin/rides" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View rides
              </Link>
            }
          />
          <CardBody className="py-0">
            {events.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-500">No events recorded yet.</p>
            ) : (
              <ul className="divide-y divide-ink-100">
                {events.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink-800">{event.message}</p>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {event.type} · ride {event.rideId.slice(-6)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-400">
                      {formatRelative(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Driver availability"
            subtitle="Snapshot of the current fleet"
            action={
              <Link to="/admin/drivers" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                Manage
              </Link>
            }
          />
          <CardBody className="flex flex-col gap-3">
            {[
              { label: "Available", tone: "success" as const, value: metrics.availableDrivers },
              { label: "Busy", tone: "info" as const, value: metrics.busyDrivers },
              { label: "Offline", tone: "neutral" as const, value: metrics.offlineDrivers },
            ].map((row) => {
              const ratio = metrics.totalDrivers > 0 ? row.value / metrics.totalDrivers : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-700">
                      <Badge tone={row.tone} dot>
                        {row.label}
                      </Badge>
                    </span>
                    <span className="font-medium text-ink-900">{row.value}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={
                        row.tone === "success"
                          ? "h-full bg-emerald-500"
                          : row.tone === "info"
                            ? "h-full bg-brand-500"
                            : "h-full bg-ink-300"
                      }
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="mt-1 text-xs text-ink-400">
              Utilization is computed from busy minutes accumulated since midnight.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
