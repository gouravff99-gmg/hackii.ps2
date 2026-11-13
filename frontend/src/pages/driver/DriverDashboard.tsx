import { useEffect, useMemo, useRef, useState } from "react";
import {
  DriverStatus,
  RideStatus,
  SOCKET_EVENTS,
  type DriverAdminView,
  type NotificationPayload,
  type Ride,
  type RideDetailView,
  type RideStatusPayload,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useToast } from "../../hooks/useToast";
import { useDriverOffer } from "../../hooks/useDriverOffer";
import { driverApi } from "../../services/driverApi";
import { rideApi } from "../../services/rideApi";
import { errorMessage } from "../../services/api";
import { clearOffer } from "../../features/driver/offerStore";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { StatCard } from "../../components/ui/StatCard";
import { Toggle } from "../../components/ui/Toggle";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState, EmptyState } from "../../components/ui/EmptyState";
import { MapCanvas, type MapMarker } from "../../components/map/MapCanvas";
import { DriverOpportunityMap } from "../../components/map/DriverOpportunityMap";
import { OfferCard } from "../../components/rides/OfferCard";
import { RideStatusStepper } from "../../components/rides/RideStatusStepper";
import {
  driverStatusLabel,
  driverStatusTone,
  formatCurrency,
  formatKm,
  formatMinutes,
  formatPercent,
} from "../../utils/format";

const COMMISSION_RATE = 0.2;

interface DriverDashboardData {
  driver: DriverAdminView;
  active: RideDetailView | null;
  history: Ride[];
}

function isToday(iso?: string | null): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function DriverDashboard() {
  const toast = useToast();
  const offer = useDriverOffer();
  const [busy, setBusy] = useState(false);
  const [responding, setResponding] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const { data, loading, error, reload } = useAsync<DriverDashboardData>(async () => {
    const [profile, active, history] = await Promise.all([
      driverApi.me(),
      rideApi.driverActive(),
      rideApi.driverHistory(),
    ]);
    return { driver: profile.driver, active: active.ride, history: history.rides };
  }, []);

  useSocketEvent<RideStatusPayload>(SOCKET_EVENTS.RIDE_STATUS, () => {
    void reload();
  });

  useSocketEvent<NotificationPayload>(SOCKET_EVENTS.NOTIFICATION, (payload) => {
    toast.push(payload.kind, payload.title, payload.message);
  });

  const driver = data?.driver ?? null;
  const isOnline = driver ? driver.status !== DriverStatus.OFFLINE : false;
  const isBusy = driver?.status === DriverStatus.BUSY;
  const lastGpsSent = useRef<{ at: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isOnline || !navigator.geolocation) return;
    let active = true;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!active) return;
        const { latitude: lat, longitude: lng } = position.coords;
        const previous = lastGpsSent.current;
        const movedKm = previous
          ? Math.hypot(
              (lat - previous.lat) * 110.574,
              (lng - previous.lng) * 111.32 * Math.cos((lat * Math.PI) / 180),
            )
          : Number.POSITIVE_INFINITY;
        if (previous && Date.now() - previous.at < 5000 && movedKm < 0.05) return;
        lastGpsSent.current = { at: Date.now(), lat, lng };
        void driverApi.updateLocation(lat, lng).catch((error: unknown) => {
          toast.push("error", "Live location update failed", errorMessage(error));
        });
      },
      () =>
        toast.push(
          "warning",
          "GPS unavailable",
          "Enable location access to share your live position during rides.",
        ),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      lastGpsSent.current = null;
    };
  }, [isOnline, toast]);

  const todayCompleted = (data?.history ?? []).filter(
    (ride) => ride.status === RideStatus.COMPLETED && isToday(ride.completedAt),
  );
  const todayEarnings = todayCompleted.reduce(
    (sum, ride) => sum + (ride.fareFinal ?? ride.fareEstimate) * (1 - COMMISSION_RATE),
    0,
  );

  const toggleOnline = async (next: boolean) => {
    if (!driver) return;
    setBusy(true);
    try {
      await driverApi.setStatus(next ? DriverStatus.AVAILABLE : DriverStatus.OFFLINE);
      toast.push(
        "success",
        next ? "You are online" : "You are offline",
        next ? "Ride offers will arrive here." : "You will not receive new offers.",
      );
      await reload();
    } catch (err) {
      toast.push("error", "Could not change availability", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const respond = async (accept: boolean) => {
    if (!offer) return;
    setResponding(true);
    try {
      await rideApi.respond(offer.rideId, accept);
      clearOffer();
      toast.push(
        accept ? "success" : "info",
        accept ? "Ride accepted" : "Ride declined",
        accept ? "Head to the pickup point." : "The ride will be offered to another driver.",
      );
      await reload();
    } catch (err) {
      toast.push("error", "Could not respond", errorMessage(err));
    } finally {
      setResponding(false);
    }
  };

  const advance = async (next: "ARRIVING" | "ARRIVED" | "ONGOING" | "COMPLETED") => {
    if (!data?.active) return;
    setAdvancing(true);
    try {
      await rideApi.advance(data.active.id, next);
      toast.push(
        "success",
        next === "COMPLETED" ? "Trip completed" : "Ride updated",
        next === "COMPLETED" ? "Fare has been recorded." : "Passenger has been notified.",
      );
      await reload();
    } catch (err) {
      toast.push("error", "Could not update the ride", errorMessage(err));
    } finally {
      setAdvancing(false);
    }
  };

  const setLocation = async (lat: number, lng: number) => {
    try {
      await driverApi.updateLocation(lat, lng);
      await reload();
    } catch (err) {
      toast.push("error", "Could not update your location", errorMessage(err));
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.push("warning", "Location unavailable", "Tap the map to set your position instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => void setLocation(position.coords.latitude, position.coords.longitude),
      () => toast.push("warning", "Could not read your location", "Tap the map to set your position."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const markers = useMemo(() => {
    if (!driver) return [];
    const list: MapMarker[] = [
      {
        id: "me",
        lat: driver.lat,
        lng: driver.lng,
        kind: "driver" as const,
        label: `${driver.name} · ${driverStatusLabel(driver.status)}`,
      },
    ];
    if (data?.active) {
      list.push(
        {
          id: "pickup",
          lat: data.active.pickupLat,
          lng: data.active.pickupLng,
          kind: "pickup" as const,
          label: "Pickup",
        },
        {
          id: "drop",
          lat: data.active.dropLat,
          lng: data.active.dropLng,
          kind: "drop" as const,
          label: "Destination",
        },
      );
    }
    return list;
  }, [driver, data?.active]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-ink-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (error || !driver) {
    return <ErrorState message={error ?? "Driver profile unavailable"} onRetry={() => void reload()} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Driver dashboard"
        description="Go online, respond to offers and move your trips through each stage."
        actions={
          <Badge tone={driverStatusTone(driver.status)} dot>
            {driverStatusLabel(driver.status)}
          </Badge>
        }
      />

      {offer ? <OfferCard offer={offer} onRespond={respond} busy={responding} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Trips today"
          value={driver.completedToday}
          hint="Completed rides"
          icon="check"
          tone="success"
        />
        <StatCard
          label="Earnings today"
          value={formatCurrency(todayEarnings, 0)}
          hint={`After ${Math.round(COMMISSION_RATE * 100)}% commission`}
          icon="wallet"
          tone="brand"
        />
        <StatCard
          label="Acceptance"
          value={formatPercent(driver.acceptanceRate)}
          hint="Rolling acceptance rate"
          icon="activity"
          tone="violet"
        />
        <StatCard
          label="Busy minutes"
          value={Math.round(driver.busyMinutesToday)}
          hint="Today"
          icon="clock"
          tone="warning"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader title="Availability" subtitle="Only available drivers receive offers." />
          <CardBody className="flex flex-col gap-4">
            <Toggle
              checked={isOnline}
              onChange={(next) => void toggleOnline(next)}
              label="Online"
              description={
                isBusy
                  ? "Finish the current ride before going offline."
                  : isOnline
                    ? "You are visible to passengers nearby."
                    : "Go online to start receiving ride offers."
              }
              disabled={busy || isBusy}
            />
            <div className="rounded-xl bg-ink-50 px-4 py-3 text-xs text-ink-500">
              Vehicle: <span className="font-medium text-ink-700">{driver.vehicleType}</span> · Acceptance
              rate adjusts automatically as you accept or reject offers.
            </div>
            {data?.active ? (
              <div className="flex gap-2">
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => void rideApi.driverCancel(data.active!.id).then(reload).catch((err) => toast.push("error", "Could not cancel", errorMessage(err)))}
                >
                  Cancel current ride
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader
            title="Your position"
            subtitle="Tap the map to update, or use your device location."
            action={
              <Button size="sm" variant="secondary" onClick={useCurrentLocation}>
                Use my location
              </Button>
            }
          />
          <div className="h-[280px]">
            <MapCanvas
              center={{ lat: driver.lat, lng: driver.lng }}
              zoom={13}
              markers={markers}
              onMapClick={(point) => void setLocation(point.lat, point.lng)}
            />
          </div>
        </Card>
      </div>

      <DriverOpportunityMap location={{ lat: driver.lat, lng: driver.lng }} />

      <Card>
        <CardHeader
          title="Current ride"
          subtitle={data?.active ? "Passenger details and trip stages" : "No ride assigned"}
        />
        <CardBody>
          {data?.active ? (
            <div className="flex flex-col gap-4">
              <RideStatusStepper status={data.active.status} />
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-400">Passenger</p>
                  <p className="mt-0.5 font-medium text-ink-900">{data.active.passenger.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-400">Distance</p>
                  <p className="mt-0.5 font-medium text-ink-900">{formatKm(data.active.distanceKm)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-400">Fare estimate</p>
                  <p className="mt-0.5 font-medium text-ink-900">
                    {formatCurrency(data.active.fareEstimate, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-400">Pickup</p>
                  <p className="mt-0.5 font-medium text-ink-900">
                    {data.active.pickupLat.toFixed(4)}, {data.active.pickupLng.toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-400">Destination</p>
                  <p className="mt-0.5 font-medium text-ink-900">
                    {data.active.dropLat.toFixed(4)}, {data.active.dropLng.toFixed(4)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-ink-400">Promised ETA</p>
                  <p className="mt-0.5 font-medium text-ink-900">
                    {formatMinutes(data.active.promisedEtaMin)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {data.active.status === RideStatus.ACCEPTED ? (
                  <Button loading={advancing} onClick={() => void advance("ARRIVING")}>
                    Start driving to pickup
                  </Button>
                ) : null}
                {data.active.status === RideStatus.ARRIVING ? (
                  <Button loading={advancing} onClick={() => void advance("ARRIVED")}>
                    I have arrived
                  </Button>
                ) : null}
                {data.active.status === RideStatus.ARRIVED ? (
                  <Button loading={advancing} onClick={() => void advance("ONGOING")}>
                    Start trip
                  </Button>
                ) : null}
                {data.active.status === RideStatus.ONGOING ? (
                  <Button loading={advancing} onClick={() => void advance("COMPLETED")}>
                    Complete trip
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <EmptyState
              icon="car"
              title="Waiting for a ride"
              description={
                isOnline
                  ? "Stay online. Incoming offers appear here and on the Ride requests page."
                  : "Go online to start receiving ride offers."
              }
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
