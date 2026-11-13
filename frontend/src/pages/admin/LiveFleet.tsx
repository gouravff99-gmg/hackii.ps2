import { useEffect, useMemo, useState } from "react";
import {
  DriverStatus,
  RideStatus,
  SOCKET_EVENTS,
  type AdminRideView,
  type DriverAdminView,
  type DriverLocationPayload,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { adminApi } from "../../services/adminApi";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState } from "../../components/ui/EmptyState";
import { MapCanvas, type MapMarker } from "../../components/map/MapCanvas";
import {
  driverStatusLabel,
  driverStatusTone,
  formatPercent,
  formatWait,
} from "../../utils/format";

const ACTIVE_RIDE_STATUSES: RideStatus[] = [
  RideStatus.ACCEPTED,
  RideStatus.ARRIVING,
  RideStatus.ARRIVED,
  RideStatus.ONGOING,
];

type StatusFilter = "ALL" | DriverStatus;

interface FleetData {
  drivers: DriverAdminView[];
  rides: AdminRideView[];
}

export function LiveFleet() {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [positions, setPositions] = useState<Record<string, { lat: number; lng: number }>>({});

  const { data, loading, error, reload } = useAsync<FleetData>(async () => {
    const [drivers, rides] = await Promise.all([adminApi.drivers(), adminApi.rides(50)]);
    return { drivers: drivers.drivers, rides: rides.rides };
  }, []);

  // Merge live socket positions into local state instead of refetching the list.
  useSocketEvent<DriverLocationPayload>(SOCKET_EVENTS.DRIVER_LOCATION, (payload) => {
    setPositions((current) => ({
      ...current,
      [payload.driverId]: { lat: payload.lat, lng: payload.lng },
    }));
  });

  useEffect(() => {
    if (!data) return;
    setPositions((current) => {
      const next = { ...current };
      for (const driver of data.drivers) {
        if (!next[driver.id]) next[driver.id] = { lat: driver.lat, lng: driver.lng };
      }
      return next;
    });
  }, [data]);

  const activeByDriver = useMemo(() => {
    const map = new Map<string, AdminRideView>();
    for (const ride of data?.rides ?? []) {
      if (ride.driverId && ACTIVE_RIDE_STATUSES.includes(ride.status)) {
        map.set(ride.driverId, ride);
      }
    }
    return map;
  }, [data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.drivers ?? []).filter((driver) => {
      if (filter !== "ALL" && driver.status !== filter) return false;
      if (!term) return true;
      return (
        driver.name.toLowerCase().includes(term) ||
        driver.email.toLowerCase().includes(term) ||
        driver.vehicleType.toLowerCase().includes(term)
      );
    });
  }, [data, filter, search]);

  const markers: MapMarker[] = (data?.drivers ?? [])
    .filter((driver) => driver.status !== DriverStatus.OFFLINE)
    .map((driver) => {
      const position = positions[driver.id] ?? { lat: driver.lat, lng: driver.lng };
      return {
        id: driver.id,
        lat: position.lat,
        lng: position.lng,
        kind: driver.status === DriverStatus.BUSY ? "active" : "driver",
        label: `${driver.name} · ${driverStatusLabel(driver.status)}`,
      };
    });

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Could not load the fleet"} onRetry={() => void reload()} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Live fleet"
        description="Every driver, their status and the ride they are currently carrying."
        actions={
          <Badge tone="success" dot>
            {markers.length} visible
          </Badge>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader title="Fleet map" subtitle="Positions update live over Socket.IO" />
        <div className="h-[380px] sm:h-[480px]">
          <MapCanvas center={{ lat: 12.9716, lng: 77.5946 }} zoom={12} markers={markers} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Drivers"
          subtitle={`${visible.length} shown of ${data.drivers.length}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Search drivers"
                placeholder="Search name or vehicle"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="!h-9 w-48"
              />
              <select
                aria-label="Filter by status"
                value={filter}
                onChange={(event) => setFilter(event.target.value as StatusFilter)}
                className="h-9 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800"
              >
                <option value="ALL">All statuses</option>
                {Object.values(DriverStatus).map((status) => (
                  <option key={status} value={status}>
                    {driverStatusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          }
        />
        <CardBody className="py-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="py-3 pr-4 font-medium">Driver</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Vehicle</th>
                  <th className="py-3 pr-4 font-medium">Acceptance</th>
                  <th className="py-3 pr-4 font-medium">Trips today</th>
                  <th className="py-3 font-medium">Active ride</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {visible.map((driver) => {
                  const ride = activeByDriver.get(driver.id);
                  return (
                    <tr key={driver.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-ink-900">{driver.name}</p>
                        <p className="text-xs text-ink-400">
                          {driver.isSimulated ? "Simulated" : "Live"} · {driver.email}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={driverStatusTone(driver.status)} dot>
                          {driverStatusLabel(driver.status)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-ink-600">{driver.vehicleType}</td>
                      <td className="py-3 pr-4 text-ink-600">{formatPercent(driver.acceptanceRate)}</td>
                      <td className="py-3 pr-4 text-ink-600">{driver.completedToday}</td>
                      <td className="py-3 text-ink-600">
                        {ride ? (
                          <span>
                            {ride.passengerName} · {ride.status.toLowerCase()}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-500">No drivers match this filter.</p>
          ) : null}
          <p className="border-t border-ink-100 py-3 text-xs text-ink-400">
            Average wait across today's accepted rides is tracked on the overview page.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
