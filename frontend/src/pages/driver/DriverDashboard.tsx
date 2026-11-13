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
import { useDriverLiveTracking } from "../../hooks/useDriverLiveTracking";
import { driverApi } from "../../services/driverApi";
import { rideApi } from "../../services/rideApi";
import { errorMessage } from "../../services/api";
import { clearOffer } from "../../features/driver/offerStore";
import { PageHeader } from "../../components/ui/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { ErrorState } from "../../components/ui/EmptyState";
import type { MapMarker } from "../../components/map/MapCanvas";
import { DriverOpportunityMap } from "../../components/map/DriverOpportunityMap";
import { OfferCard } from "../../components/rides/OfferCard";
import {
  DriverAvailabilityCard,
  DriverCurrentRideCard,
  DriverStatsCards,
} from "../../components/driver/DriverDashboardCards";
import { DriverPositionMap } from "../../components/driver/DriverPositionMap";
import {
  driverStatusLabel,
  driverStatusTone,
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
  return date.toDateString() === new Date().toDateString();
}

export function DriverDashboard() {
  const toast = useToast();
  const offer = useDriverOffer();
  const [busy, setBusy] = useState(false);
  const [responding, setResponding] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [recenterPoint, setRecenterPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 12.9716, lng: 77.5946 });

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
  const live = useDriverLiveTracking({
    driverId: driver?.id,
    fallbackPosition: driver ? { lat: driver.lat, lng: driver.lng } : null,
    activeRide: data?.active ?? null,
    isOnline,
    toast,
  });
  const { gps, socketConnected, activeRoute, routeError } = live;
  const centeredOnGps = useRef(false);

  useEffect(() => {
    const point = gps.position?.point;
    if (!point || centeredOnGps.current) return;
    centeredOnGps.current = true;
    setMapCenter(point);
  }, [gps.position?.point.lat, gps.position?.point.lng]);

  useEffect(() => {
    if (driver && !centeredOnGps.current) {
      setMapCenter({ lat: driver.lat, lng: driver.lng });
    }
  }, [driver?.id, driver?.lat, driver?.lng]);

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
    if (gps.position) {
      setRecenterPoint({ ...gps.position.point });
      return;
    }
    if (!navigator.geolocation) {
      toast.push("warning", "Location unavailable", "Tap the map to set a fallback position.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        setMapCenter(point);
        setRecenterPoint(point);
      },
      () => toast.push("warning", "Could not read your location", "Tap the map to set a fallback position."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const markers = useMemo(() => {
    if (!driver) return [];
    const list: MapMarker[] = [
      {
        id: "me",
        lat: gps.position?.point.lat ?? driver.lat,
        lng: gps.position?.point.lng ?? driver.lng,
        kind: "driver" as const,
        label: `${driver.name} · ${gps.position ? `GPS ±${Math.round(gps.position.accuracy)}m` : driverStatusLabel(driver.status)}`,
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
  }, [driver, data?.active, gps.position?.point.lat, gps.position?.point.lng, gps.position?.accuracy]);

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

      <DriverStatsCards driver={driver} todayEarnings={todayEarnings} commissionRate={COMMISSION_RATE} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <DriverAvailabilityCard
          driver={driver}
          isOnline={isOnline}
          isBusy={Boolean(isBusy)}
          busy={busy}
          hasActiveRide={Boolean(data?.active)}
          onToggleOnline={(next) => void toggleOnline(next)}
          onCancelRide={() => {
            if (!data?.active) return;
            void rideApi.driverCancel(data.active.id)
              .then(() => reload())
              .catch((err: unknown) => toast.push("error", "Could not cancel", errorMessage(err)));
          }}
        />
        <DriverPositionMap
          position={gps.position}
          status={gps.status}
          socketConnected={socketConnected}
          isOnline={isOnline}
          center={mapCenter}
          recenter={recenterPoint}
          markers={markers}
          route={activeRoute?.polyline}
          routeError={routeError}
          onRecenter={useCurrentLocation}
          onMapClick={(point) => void setLocation(point.lat, point.lng)}
        />
      </div>

      <DriverOpportunityMap
        location={{ lat: driver.lat, lng: driver.lng }}
        category={driver.vehicleCategory}
      />

      <DriverCurrentRideCard
        ride={data?.active ?? null}
        isOnline={isOnline}
        advancing={advancing}
        onAdvance={(next) => void advance(next)}
      />
    </div>
  );
}
