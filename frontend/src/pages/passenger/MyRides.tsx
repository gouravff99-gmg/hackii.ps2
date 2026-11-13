import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  RideStatus,
  SOCKET_EVENTS,
  type Ride,
  type RideDetailView,
  type RideStatusPayload,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useToast } from "../../hooks/useToast";
import { rideApi } from "../../services/rideApi";
import { errorMessage } from "../../services/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { MapCanvas, type MapMarker } from "../../components/map/MapCanvas";
import { RideCard } from "../../components/rides/RideCard";
import { RideStatusStepper } from "../../components/rides/RideStatusStepper";
import {
  formatCurrency,
  formatDateTime,
  formatKm,
  formatMinutes,
  rideStatusLabel,
  rideStatusTone,
} from "../../utils/format";

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

export function MyRides() {
  const location = useLocation();
  const toast = useToast();
  const initialRideId = (location.state as { rideId?: string } | null)?.rideId;

  const history = useAsync<{ rides: Ride[] }>(() => rideApi.history(), []);
  const [selectedId, setSelectedId] = useState<string | null>(initialRideId ?? null);
  const [detail, setDetail] = useState<RideDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const rides = history.data?.rides ?? [];
  const isDemoRide = detail?.events.some((event) => event.type === "DEMO_MODE") ?? false;

  useEffect(() => {
    if (selectedId) return;
    const active = rides.find((ride) => ACTIVE.includes(ride.status));
    if (active) setSelectedId(active.id);
    else if (rides[0]) setSelectedId(rides[0].id);
  }, [rides, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setDetailError(null);
    rideApi
      .get(selectedId)
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

  const refresh = () => {
    void history.reload();
    if (selectedId) {
      rideApi
        .get(selectedId)
        .then((response) => setDetail(response.ride))
        .catch(() => undefined);
    }
  };

  useSocketEvent<RideStatusPayload>(SOCKET_EVENTS.RIDE_STATUS, (payload) => {
    if (!selectedId || payload.rideId === selectedId) refresh();
  });

  const cancelRide = async () => {
    if (!detail) return;
    setCancelling(true);
    try {
      const response = await rideApi.cancel(detail.id);
      setDetail(response.ride);
      toast.push("info", "Ride cancelled", "Your ride has been cancelled.");
      void history.reload();
    } catch (err) {
      toast.push("error", "Could not cancel the ride", errorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const markers = useMemo(() => {
    if (!detail) return [];
    const list: MapMarker[] = [
      { id: "pickup", lat: detail.pickupLat, lng: detail.pickupLng, kind: "pickup" as const, label: "Pickup" },
      { id: "drop", lat: detail.dropLat, lng: detail.dropLng, kind: "drop" as const, label: "Destination" },
    ];
    if (detail.driver) {
      list.push({
        id: "driver",
        lat: detail.driver.lat,
        lng: detail.driver.lng,
        kind: "driver" as const,
        label: isDemoRide
          ? `${detail.driver.user.name} · last reported GPS`
          : detail.driver.user.name,
      });
    }
    return list;
  }, [detail, isDemoRide]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="My rides"
        description="Live status for the current ride and the full history of your trips."
        actions={
          <Link
            to="/passenger/book"
            className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Book a ride
          </Link>
        }
      />

      {history.loading ? (
        <Card>
          <div className="flex items-center justify-center py-16 text-ink-400">
            <Spinner className="h-6 w-6" />
          </div>
        </Card>
      ) : history.error ? (
        <Card>
          <ErrorState message={history.error} onRetry={() => void history.reload()} />
        </Card>
      ) : rides.length === 0 ? (
        <Card>
          <EmptyState
            icon="car"
            title="No rides yet"
            description="Your trips will appear here as soon as you book your first ride."
            action={
              <Link
                to="/passenger/book"
                className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Book a ride
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Card className="overflow-hidden">
            <CardHeader title="Trip history" subtitle={`${rides.length} rides`} />
            <CardBody className="flex max-h-[560px] flex-col gap-2 overflow-y-auto">
              {rides.map((ride) => (
                <div
                  key={ride.id}
                  className={
                    ride.id === selectedId
                      ? "rounded-xl ring-2 ring-brand-300"
                      : "rounded-xl"
                  }
                >
                  <RideCard ride={ride} onSelect={() => setSelectedId(ride.id)} />
                </div>
              ))}
            </CardBody>
          </Card>

          <Card className="flex flex-col overflow-hidden">
            <CardHeader
              title="Ride detail"
              subtitle={detail ? `Requested ${formatDateTime(detail.requestedAt)}` : "Select a ride"}
              action={
                detail ? (
                  <Badge tone={rideStatusTone(detail.status)} dot>
                    {rideStatusLabel(detail.status)}
                  </Badge>
                ) : null
              }
            />
            {detailLoading ? (
              <div className="flex items-center justify-center py-16 text-ink-400">
                <Spinner className="h-6 w-6" />
              </div>
            ) : detailError ? (
              <ErrorState message={detailError} onRetry={() => setSelectedId(selectedId)} />
            ) : detail ? (
              <>
                <div className="h-[240px]">
                  <MapCanvas
                    center={{ lat: detail.pickupLat, lng: detail.pickupLng }}
                    zoom={13}
                    markers={markers}
                    showControls={false}
                  />
                </div>
                <CardBody className="flex flex-col gap-4">
                  <RideStatusStepper status={detail.status} />

                  {isDemoRide ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="warning">DEMO MODE</Badge>
                        <p className="text-sm font-medium text-amber-900">
                          Simulated driver assignment
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-amber-800">
                        Pickup distance is ignored and the pickup ETA is simulated. The map shows
                        the driver&apos;s last reported GPS position, not a claim that they are at
                        your pickup.
                      </p>
                    </div>
                  ) : null}

                  {detail.driver ? (
                    <div className="flex items-center justify-between rounded-xl border border-ink-200 px-4 py-3">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-ink-400">Driver</p>
                        <p className="mt-0.5 text-sm font-medium text-ink-900">
                          {detail.driver.user.name}
                        </p>
                        <p className="text-xs text-ink-500">
                          {detail.driver.vehicleType} · {detail.driver.completedToday} trips today
                        </p>
                      </div>
                      <Badge tone={isDemoRide ? "warning" : "info"}>
                        {isDemoRide ? "Simulated ETA " : "ETA "}
                        {formatMinutes(detail.promisedEtaMin)}
                      </Badge>
                    </div>
                  ) : null}

                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-ink-400">Distance</dt>
                      <dd className="mt-0.5 font-medium text-ink-900">{formatKm(detail.distanceKm)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-400">Duration</dt>
                      <dd className="mt-0.5 font-medium text-ink-900">{formatMinutes(detail.etaMin)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-400">Surge</dt>
                      <dd className="mt-0.5 font-medium text-ink-900">
                        ×{detail.surgeMultiplier.toFixed(2)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-400">{detail.fareFinal ? "Final fare" : "Estimate"}</dt>
                      <dd className="mt-0.5 font-medium text-ink-900">
                        {formatCurrency(detail.fareFinal ?? detail.fareEstimate, 0)}
                      </dd>
                    </div>
                  </dl>

                  {CANCELLABLE.includes(detail.status) ? (
                    <Button variant="secondary" onClick={() => void cancelRide()} loading={cancelling}>
                      Cancel ride
                    </Button>
                  ) : null}

                  <details className="rounded-xl border border-ink-200 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-ink-700">
                      Event timeline ({detail.events.length})
                    </summary>
                    <ol className="mt-3 space-y-2">
                      {detail.events.map((event) => (
                        <li key={event.id} className="flex gap-3 text-xs">
                          <span className="w-28 shrink-0 text-ink-400">
                            {formatDateTime(event.createdAt)}
                          </span>
                          <span className="text-ink-700">{event.message}</span>
                        </li>
                      ))}
                    </ol>
                  </details>
                </CardBody>
              </>
            ) : (
              <EmptyState title="Select a ride" description="Choose a trip from the list to see details." />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
