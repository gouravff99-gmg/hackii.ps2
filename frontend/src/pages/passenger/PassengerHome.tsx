import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  RideStatus,
  SOCKET_EVENTS,
  type NotificationPayload,
  type NearbyDriver,
  type Ride,
  type RideStatusPayload,
} from "@ps02/shared";
import { useAuth } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { useNearbyDrivers } from "../../hooks/useNearbyDrivers";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useToast } from "../../hooks/useToast";
import { rideApi } from "../../services/rideApi";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState, EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import type { MapMarker } from "../../components/map/MapCanvas";
import { PassengerLocationMap } from "../../components/map/PassengerLocationMap";
import { RideStatusStepper } from "../../components/rides/RideStatusStepper";
import { formatCurrency, formatKm, formatMinutes, rideStatusLabel } from "../../utils/format";
import { Icon } from "../../components/ui/Icon";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";

const ACTIVE_STATUSES: RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.ACCEPTED,
  RideStatus.ARRIVING,
  RideStatus.ARRIVED,
  RideStatus.ONGOING,
  RideStatus.REASSIGNING,
];

export function PassengerHome() {
  const { user } = useAuth();
  const toast = useToast();
  const gps = useDeviceLocation();
  const point = gps.position?.point ?? null;
  const locationKey = point ? `${point.lat.toFixed(3)},${point.lng.toFixed(3)}` : "";

  const ridesState = useAsync(() => rideApi.history(), []);
  const nearbyState = useNearbyDrivers(point, locationKey);

  useSocketEvent<RideStatusPayload>(SOCKET_EVENTS.RIDE_STATUS, () => {
    void ridesState.reload();
  });

  useSocketEvent<NotificationPayload>(SOCKET_EVENTS.NOTIFICATION, (payload) => {
    toast.push(payload.kind, payload.title, payload.message, {
      durationMs: 3500,
      eventKey: `ride-notice:${payload.rideId ?? "general"}:${payload.title}:${payload.message}`,
    });
  });

  const rides = ridesState.data?.rides ?? [];
  const activeRide = useMemo(
    () => rides.find((ride) => ACTIVE_STATUSES.includes(ride.status)) ?? null,
    [rides],
  );

  const completed = rides.filter((ride) => ride.status === RideStatus.COMPLETED);
  const totalSpent = completed.reduce((sum, ride) => sum + (ride.fareFinal ?? ride.fareEstimate), 0);

  const markers: MapMarker[] = [
    ...nearbyState.drivers.map((driver) => ({
      id: driver.id,
      lat: driver.lat,
      lng: driver.lng,
      kind: "driver" as const,
      label: `${driver.name} · ${driver.vehicleType} · ${formatMinutes(driver.etaMin)}`,
    })),
    ...(activeRide
      ? [
          {
            id: `${activeRide.id}-pickup`,
            lat: activeRide.pickupLat,
            lng: activeRide.pickupLng,
            kind: "pickup" as const,
            label: "Pickup",
          },
          {
            id: `${activeRide.id}-drop`,
            lat: activeRide.dropLat,
            lng: activeRide.dropLng,
            kind: "drop" as const,
            label: "Destination",
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`Hello${user ? `, ${user.name.split(" ")[0]}` : ""}`}
        description="Your ride, your drivers and your recent trips at a glance."
        actions={
          <Link
            to="/passenger/book"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            <Icon name="plus" size={16} />
            Book a ride
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Trips completed"
          value={completed.length}
          hint="All time"
          icon="check"
          tone="success"
        />
        <StatCard
          label="Total spent"
          value={formatCurrency(totalSpent, 0)}
          hint="Final fares"
          icon="wallet"
          tone="brand"
        />
        <StatCard
          label="Drivers nearby"
          value={point ? nearbyState.drivers.length : "—"}
          hint="Within 10 km of your location"
          icon="car"
          tone="violet"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <PassengerLocationMap position={gps.position} status={gps.status} markers={markers} />

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title={activeRide ? "Your current ride" : "No ride in progress"}
              subtitle={
                activeRide
                  ? rideStatusLabel(activeRide.status)
                  : "Book a ride and track every stage here."
              }
            />
            <CardBody>
              {ridesState.loading ? (
                <div className="flex items-center justify-center py-8 text-ink-400">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : ridesState.error ? (
                <ErrorState message={ridesState.error} onRetry={() => void ridesState.reload()} />
              ) : activeRide ? (
                <div className="flex flex-col gap-4">
                  <RideStatusStepper status={activeRide.status} />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Distance</p>
                      <p className="mt-0.5 font-medium text-ink-900">
                        {formatKm(activeRide.distanceKm)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Fare estimate</p>
                      <p className="mt-0.5 font-medium text-ink-900">
                        {formatCurrency(activeRide.fareEstimate, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Surge</p>
                      <p className="mt-0.5 font-medium text-ink-900">
                        ×{activeRide.surgeMultiplier.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-ink-400">Promised ETA</p>
                      <p className="mt-0.5 font-medium text-ink-900">
                        {formatMinutes(activeRide.promisedEtaMin)}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/passenger/rides"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-ink-200 text-sm font-medium text-ink-800 transition hover:bg-ink-50"
                  >
                    Open live details
                    <Icon name="arrow-right" size={15} />
                  </Link>
                </div>
              ) : (
                <EmptyState
                  icon="car"
                  title="Ready when you are"
                  description="Pick a pickup and destination on the map to see fare and ETA before you book."
                  action={
                    <Link
                      to="/passenger/book"
                      className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700"
                    >
                      Book a ride
                    </Link>
                  }
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Nearby drivers" subtitle="Sorted by distance from your GPS location" />
            <CardBody className={nearbyState.drivers.length ? "divide-y divide-ink-100 py-0" : ""}>
              {nearbyState.error ? (
                <p role="status" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Nearby drivers could not be loaded: {nearbyState.error}
                </p>
              ) : null}
              {nearbyState.loading ? (
                <div className="flex items-center justify-center py-6 text-ink-400">
                  <Spinner className="h-5 w-5" />
                </div>
              ) : point && nearbyState.drivers.length > 0 ? (
                nearbyState.drivers.slice(0, 5).map((driver) => (
                  <div key={driver.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{driver.name}</p>
                      <p className="text-xs text-ink-500">
                        {driver.vehicleType} · {driver.distanceKm.toFixed(1)} km away
                      </p>
                    </div>
                    <Badge tone="info">{formatMinutes(driver.etaMin)}</Badge>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon="car"
                  title={point ? "No drivers available nearby" : "Location needed to find nearby drivers"}
                  description={point ? "Drivers appear here as soon as they go online near you." : "Allow location access to find drivers near your actual position."}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
