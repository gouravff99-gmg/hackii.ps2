import { useMemo, useState } from "react";
import {
  ChaosAction,
  DriverStatus,
  SOCKET_EVENTS,
  type DriverAdminView,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useToast } from "../../hooks/useToast";
import { adminApi } from "../../services/adminApi";
import { errorMessage } from "../../services/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import {
  driverStatusLabel,
  driverStatusTone,
  formatPercent,
  formatRelative,
} from "../../utils/format";
import { Icon } from "../../components/ui/Icon";

type StatusFilter = "ALL" | DriverStatus;

export function DriverManagement() {
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [onlySimulated, setOnlySimulated] = useState(false);
  const [target, setTarget] = useState<DriverAdminView | null>(null);
  const [working, setWorking] = useState(false);

  const driversState = useAsync(() => adminApi.drivers(), []);
  const drivers = driversState.data?.drivers ?? [];

  useSocketEvent(SOCKET_EVENTS.DRIVER_LOCATION, () => void driversState.reload());

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return drivers.filter((driver) => {
      if (status !== "ALL" && driver.status !== status) return false;
      if (onlySimulated && !driver.isSimulated) return false;
      if (!term) return true;
      return (
        driver.name.toLowerCase().includes(term) ||
        driver.email.toLowerCase().includes(term) ||
        driver.vehicleType.toLowerCase().includes(term)
      );
    });
  }, [drivers, status, search, onlySimulated]);

  const available = drivers.filter((driver) => driver.status === DriverStatus.AVAILABLE).length;
  const busy = drivers.filter((driver) => driver.status === DriverStatus.BUSY).length;
  const simulated = drivers.filter((driver) => driver.isSimulated).length;

  const forceOffline = async () => {
    if (!target) return;
    setWorking(true);
    try {
      const result = await adminApi.chaos({
        action: ChaosAction.KILL_DRIVER,
        driverId: target.id,
      });
      toast.push("warning", "Driver taken offline", result.detail);
      setTarget(null);
      await driversState.reload();
    } catch (err) {
      toast.push("error", "Could not update the driver", errorMessage(err));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Driver management"
        description="Fleet roster, availability and performance. Force a driver offline to exercise the reassignment path."
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={driversState.loading}
            onClick={() => void driversState.reload()}
          >
            <Icon name="refresh" size={15} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Drivers" value={drivers.length} hint="All accounts" icon="users" tone="brand" />
        <StatCard label="Available" value={available} icon="check" tone="success" />
        <StatCard label="On a trip" value={busy} icon="navigation" tone="warning" />
        <StatCard label="Simulated" value={simulated} hint="Created by the simulator" icon="layers" tone="violet" />
      </div>

      <Card>
        <CardHeader
          title="Roster"
          subtitle={`${visible.length} shown of ${drivers.length}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Search drivers"
                placeholder="Search name, email or vehicle"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="!h-9 w-56"
              />
              <label className="flex h-9 items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={onlySimulated}
                  onChange={(event) => setOnlySimulated(event.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-600"
                />
                Simulated only
              </label>
              <select
                aria-label="Filter by driver status"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className="h-9 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800"
              >
                <option value="ALL">All statuses</option>
                {Object.values(DriverStatus).map((value) => (
                  <option key={value} value={value}>
                    {driverStatusLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {driversState.loading ? (
          <div className="flex items-center justify-center py-16 text-ink-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : driversState.error ? (
          <ErrorState message={driversState.error} onRetry={() => void driversState.reload()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="users"
            title="No drivers match this view"
            description="Seeded and simulated drivers appear here once they exist."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Vehicle</th>
                  <th className="px-5 py-3 font-medium">Acceptance</th>
                  <th className="px-5 py-3 font-medium">Trips today</th>
                  <th className="px-5 py-3 font-medium">Busy minutes</th>
                  <th className="px-5 py-3 font-medium">Idle since</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {visible.map((driver) => (
                  <tr key={driver.id} className="transition hover:bg-ink-50/60">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink-900">{driver.name}</p>
                      <p className="text-xs text-ink-400">
                        {driver.isSimulated ? "Simulated" : "Live"} · {driver.email}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={driverStatusTone(driver.status)} dot>
                        {driverStatusLabel(driver.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{driver.vehicleType}</td>
                    <td className="px-5 py-3 text-ink-600">{formatPercent(driver.acceptanceRate)}</td>
                    <td className="px-5 py-3 text-ink-600">{driver.completedToday}</td>
                    <td className="px-5 py-3 text-ink-600">{Math.round(driver.busyMinutesToday)}</td>
                    <td className="px-5 py-3 text-ink-600">{formatRelative(driver.lastIdleSince)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={driver.status === DriverStatus.OFFLINE}
                        onClick={() => setTarget(driver)}
                      >
                        Force offline
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CardBody className="border-t border-ink-100 py-3">
          <p className="text-xs text-ink-400">
            Forcing a driver offline routes any active ride through the normal reassignment flow.
            Positions update live while the fleet is moving.
          </p>
        </CardBody>
      </Card>

      <Modal
        open={Boolean(target)}
        title="Force driver offline"
        onClose={() => (working ? undefined : setTarget(null))}
        footer={
          <>
            <Button variant="secondary" disabled={working} onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={working} onClick={() => void forceOffline()}>
              Take offline
            </Button>
          </>
        }
      >
        {target ? (
          <p>
            <span className="font-medium text-ink-900">{target.name}</span> will be set to offline
            immediately. If they are carrying a ride, the passenger is reassigned automatically.
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
