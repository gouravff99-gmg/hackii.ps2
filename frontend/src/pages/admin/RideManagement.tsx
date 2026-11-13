import { useEffect, useMemo, useState } from "react";
import {
  RideStatus,
  SOCKET_EVENTS,
  type AdminRideView,
  type RideDetailView,
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
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { MapCanvas } from "../../components/map/MapCanvas";
import {
  formatCurrency,
  formatDateTime,
  formatKm,
  formatRelative,
  rideStatusLabel,
  rideStatusTone,
} from "../../utils/format";
import { Icon } from "../../components/ui/Icon";

const CANCELLABLE: RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.ACCEPTED,
  RideStatus.ARRIVING,
  RideStatus.REASSIGNING,
];

const ACTIVE: RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.ACCEPTED,
  RideStatus.ARRIVING,
  RideStatus.ONGOING,
  RideStatus.REASSIGNING,
];

type StatusFilter = "ALL" | RideStatus;

export function RideManagement() {
  const toast = useToast();
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RideDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const ridesState = useAsync(() => adminApi.rides(100), []);
  const rides = ridesState.data?.rides ?? [];

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setDetailError(null);
    adminApi
      .rideDetail(selectedId)
      .then((response) => {
        if (alive) setDetail(response.ride);
      })
      .catch((err) => {
        if (alive) {
          setDetail(null);
          setDetailError(errorMessage(err));
        }
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedId]);

  useSocketEvent(SOCKET_EVENTS.RIDE_STATUS, () => void ridesState.reload());

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rides.filter((ride) => {
      if (status !== "ALL" && ride.status !== status) return false;
      if (!term) return true;
      return (
        ride.id.toLowerCase().includes(term) ||
        ride.passengerName.toLowerCase().includes(term) ||
        (ride.driverName ?? "").toLowerCase().includes(term)
      );
    });
  }, [rides, status, search]);

  const activeCount = rides.filter((ride) => ACTIVE.includes(ride.status)).length;
  const completedCount = rides.filter((ride) => ride.status === RideStatus.COMPLETED).length;
  const cancelledCount = rides.filter((ride) => ride.status === RideStatus.CANCELLED).length;

  const cancelRide = async () => {
    if (!detail) return;
    setCancelling(true);
    try {
      const response = await adminApi.cancelRide(detail.id);
      setDetail(response.ride);
      toast.push("info", "Ride cancelled", "The passenger and driver have been notified.");
      await ridesState.reload();
    } catch (err) {
      toast.push("error", "Could not cancel the ride", errorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const refreshDetail = () => {
    if (!selectedId) return;
    adminApi
      .rideDetail(selectedId)
      .then((response) => setDetail(response.ride))
      .catch((err) => setDetailError(errorMessage(err)));
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Ride management"
        description="Every ride on the platform, with live status, assignment and full event history."
        actions={
          <Button
            variant="secondary"
            size="sm"
            loading={ridesState.loading}
            onClick={() => void ridesState.reload()}
          >
            <Icon name="refresh" size={15} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Rides loaded" value={rides.length} hint="Most recent first" icon="route" tone="brand" />
        <StatCard label="Active" value={activeCount} icon="activity" tone="warning" />
        <StatCard label="Completed" value={completedCount} icon="check" tone="success" />
        <StatCard label="Cancelled" value={cancelledCount} icon="close" tone="neutral" />
      </div>

      <Card>
        <CardHeader
          title="Rides"
          subtitle={`${visible.length} shown of ${rides.length}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label="Search rides"
                placeholder="Search passenger, driver or id"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="!h-9 w-56"
              />
              <select
                aria-label="Filter by ride status"
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className="h-9 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800"
              >
                <option value="ALL">All statuses</option>
                {Object.values(RideStatus).map((value) => (
                  <option key={value} value={value}>
                    {rideStatusLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {ridesState.loading ? (
          <div className="flex items-center justify-center py-16 text-ink-400">
            <Spinner className="h-6 w-6" />
          </div>
        ) : ridesState.error ? (
          <ErrorState message={ridesState.error} onRetry={() => void ridesState.reload()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="route"
            title="No rides match this view"
            description="Rides appear here as soon as passengers request them."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3 font-medium">Requested</th>
                  <th className="px-5 py-3 font-medium">Passenger</th>
                  <th className="px-5 py-3 font-medium">Driver</th>
                  <th className="px-5 py-3 font-medium">Trip</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Fare</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {visible.map((ride) => (
                  <RideRow
                    key={ride.id}
                    ride={ride}
                    selected={ride.id === selectedId}
                    onSelect={() => setSelectedId(ride.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedId ? (
        <Card>
          <CardHeader
            title="Ride detail"
            subtitle={detail ? `Requested ${formatDateTime(detail.requestedAt)}` : "Loading ride"}
            action={
              <div className="flex items-center gap-2">
                {detail ? (
                  <Badge tone={rideStatusTone(detail.status)} dot>
                    {rideStatusLabel(detail.status)}
                  </Badge>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
                  <Icon name="close" size={15} />
                  Close
                </Button>
              </div>
            }
          />
          {detailLoading ? (
            <div className="flex items-center justify-center py-16 text-ink-400">
              <Spinner className="h-6 w-6" />
            </div>
          ) : detailError ? (
            <ErrorState message={detailError} onRetry={refreshDetail} />
          ) : detail ? (
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="overflow-hidden rounded-xl border border-ink-200">
                <div className="h-[260px]">
                  <MapCanvas
                    center={{ lat: detail.pickupLat, lng: detail.pickupLng }}
                    zoom={13}
                    showControls={false}
                    markers={[
                      { id: "pickup", lat: detail.pickupLat, lng: detail.pickupLng, kind: "pickup", label: "Pickup" },
                      { id: "drop", lat: detail.dropLat, lng: detail.dropLng, kind: "drop", label: "Destination" },
                      ...(detail.driver
                        ? [
                            {
                              id: "driver",
                              lat: detail.driver.lat,
                              lng: detail.driver.lng,
                              kind: "driver" as const,
                              label: detail.driver.user.name,
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-400">Passenger</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">{detail.passenger.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Driver</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {detail.driver?.user.name ?? "Not assigned"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Distance</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">{formatKm(detail.distanceKm)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Surge</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">×{detail.surgeMultiplier.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Fare estimate</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {formatCurrency(detail.fareEstimate, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-400">Final fare</dt>
                    <dd className="mt-0.5 font-medium text-ink-900">
                      {detail.fareFinal ? formatCurrency(detail.fareFinal, 0) : "—"}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-ink-400">Ride id</dt>
                    <dd className="mt-0.5 font-mono text-xs text-ink-600">{detail.id}</dd>
                  </div>
                </dl>

                {CANCELLABLE.includes(detail.status) ? (
                  <Button variant="danger" loading={cancelling} onClick={() => void cancelRide()}>
                    <Icon name="close" size={15} />
                    Cancel this ride
                  </Button>
                ) : (
                  <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">
                    This ride is {rideStatusLabel(detail.status).toLowerCase()} and can no longer be
                    cancelled from the console.
                  </p>
                )}

                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
                    Event timeline
                  </p>
                  <ol className="mt-2 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                    {detail.events.map((event) => (
                      <li key={event.id} className="flex gap-3 text-xs">
                        <span className="w-24 shrink-0 text-ink-400">
                          {formatRelative(event.createdAt)}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-ink-700">{event.type}</span>
                          <span className="text-ink-500"> · {event.message}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function RideRow({
  ride,
  selected,
  onSelect,
}: {
  ride: AdminRideView;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr className={selected ? "bg-brand-50/60" : "transition hover:bg-ink-50/60"}>
      <td className="px-5 py-3 text-ink-600">{formatDateTime(ride.requestedAt)}</td>
      <td className="px-5 py-3 text-ink-900">{ride.passengerName}</td>
      <td className="px-5 py-3 text-ink-600">{ride.driverName ?? "—"}</td>
      <td className="px-5 py-3 text-ink-600">
        {formatKm(ride.distanceKm)} · {ride.pickup.lat.toFixed(3)}, {ride.pickup.lng.toFixed(3)}
      </td>
      <td className="px-5 py-3">
        <Badge tone={rideStatusTone(ride.status)}>{rideStatusLabel(ride.status)}</Badge>
      </td>
      <td className="px-5 py-3 text-right text-ink-900">
        {formatCurrency(ride.fareFinal ?? ride.fareEstimate, 0)}
      </td>
      <td className="px-5 py-3 text-right">
        <button
          type="button"
          onClick={onSelect}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Inspect
        </button>
      </td>
    </tr>
  );
}
