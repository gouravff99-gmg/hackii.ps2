import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RideStatus,
  SOCKET_EVENTS,
  type LatLng,
  type RideDetailView,
  type RideDriverLocationPayload,
  type RouteResult,
} from "@ps02/shared";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { useToast } from "../../hooks/useToast";
import { connectSocket } from "../../services/socket";
import { errorMessage } from "../../services/api";
import { rideApi } from "../../services/rideApi";
import type { MapMarker } from "../map/MapCanvas";
import { RideAssignmentOverlay } from "./RideAssignmentOverlay";
import { RideCompletionModal } from "./RideCompletionModal";
import { RideTrackingMap } from "./RideTrackingMap";
import { RideTrackingPanel } from "./RideTrackingPanel";
import { distanceKm, gpsTimestamp, LIVE_STATUSES, storageHas, storageMark, validGps } from "./rideTrackingUtils";

export function LiveRideTracking({
  ride,
  onRefresh,
  onCancel,
  cancelling,
  demoMode,
  assignmentEventDriverId,
}: {
  ride: RideDetailView;
  onRefresh: () => void;
  onCancel: () => void;
  cancelling: boolean;
  demoMode: boolean;
  assignmentEventDriverId: string | null;
}) {
  const toast = useToast();
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const [driverPoint, setDriverPoint] = useState<LatLng | null>(
    ride.driver ? { lat: ride.driver.lat, lng: ride.driver.lng } : null,
  );
  const [gpsAt, setGpsAt] = useState<number | null>(
    gpsTimestamp(ride.driver?.locationUpdatedAt),
  );
  const [clock, setClock] = useState(Date.now());
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeRetry, setRouteRetry] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [assignmentAnimationPhase, setAssignmentAnimationPhase] = useState<
    "hidden" | "visible" | "exiting"
  >("hidden");
  const [completionDismissed, setCompletionDismissed] = useState(() =>
    storageHas(`ride-completed-dismissed:${ride.id}`),
  );
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);

  const destination =
    ride.status === RideStatus.ONGOING
      ? { lat: ride.dropLat, lng: ride.dropLng }
      : { lat: ride.pickupLat, lng: ride.pickupLng };
  const driverPointRef = useRef(driverPoint);
  driverPointRef.current = driverPoint;
  const gpsAtRef = useRef(gpsAt);
  gpsAtRef.current = gpsAt;

  useSocketEvent<RideDriverLocationPayload>(SOCKET_EVENTS.RIDE_DRIVER_LOCATION, (payload) => {
    if (payload.rideId !== ride.id || payload.driverId !== ride.driver?.id) return;
    const point = { lat: payload.lat, lng: payload.lng };
    if (!validGps(point)) {
      toast.push("warning", "Invalid GPS update", "Waiting for a valid driver location.");
      return;
    }
    setDriverPoint(point);
    setGpsAt(Date.parse(payload.at) || Date.now());
  }, LIVE_STATUSES.includes(ride.status));

  useEffect(() => {
    if (!LIVE_STATUSES.includes(ride.status)) {
      setSocketConnected(false);
      return;
    }
    const socket = connectSocket();
    if (!socket) return;
    const recover = () => refreshRef.current();
    const connected = () => setSocketConnected(true);
    const disconnected = () => setSocketConnected(false);
    socket.on("connect", recover);
    socket.on("connect", connected);
    socket.on("disconnect", disconnected);
    setSocketConnected(socket.connected);
    if (socket.connected) recover();
    return () => {
      socket.off("connect", recover);
      socket.off("connect", connected);
      socket.off("disconnect", disconnected);
    };
  }, [ride.id, ride.status]);

  useEffect(() => {
    if (!ride.driver) return;
    const serverPoint = { lat: ride.driver.lat, lng: ride.driver.lng };
    if (!validGps(serverPoint)) return;
    setDriverPoint(serverPoint);
    setGpsAt(gpsTimestamp(ride.driver?.locationUpdatedAt));
  }, [ride.driver?.id, ride.driver?.lat, ride.driver?.lng, ride.driver?.locationUpdatedAt]);

  useEffect(() => {
    if (!LIVE_STATUSES.includes(ride.status)) return;
    const timer = window.setInterval(() => setClock(Date.now()), 3000);
    return () => window.clearInterval(timer);
  }, [ride.status]);

  useEffect(() => {
    if (!ride.driver || !LIVE_STATUSES.includes(ride.status)) {
      setRoute(null);
      setRouteLoading(false);
      return;
    }
    let active = true;
    let inFlight = false;
    let lastRouteOrigin: LatLng | null = null;
    let lastRouteAt = 0;
    const fetchRoute = async (force = false) => {
      if (inFlight) return;
      const origin = driverPointRef.current ?? { lat: ride.driver!.lat, lng: ride.driver!.lng };
      const now = Date.now();
      const movedEnough = !lastRouteOrigin || distanceKm(lastRouteOrigin, origin) >= 0.2;
      const gpsIsFresh = gpsAtRef.current !== null && now - gpsAtRef.current <= 30_000;
      if (!force && !movedEnough && now - lastRouteAt < 60_000) return;
      if (!force && !gpsIsFresh) return;
      inFlight = true;
      lastRouteOrigin = origin;
      lastRouteAt = now;
      setRouteLoading(true);
      try {
        const result = await rideApi.trackingRoute(ride.id, origin);
        if (active) {
          setRoute(result);
          setRouteError(null);
        }
      } catch (error) {
        if (active) setRouteError(errorMessage(error));
      } finally {
        inFlight = false;
        if (active) setRouteLoading(false);
      }
    };
    void fetchRoute(true);
    const timer = window.setInterval(() => void fetchRoute(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [ride.id, ride.status, ride.driver?.id, routeRetry]);

  useEffect(() => {
    if (
      !assignmentEventDriverId ||
      ride.status !== RideStatus.ACCEPTED ||
      ride.driver?.id !== assignmentEventDriverId
    ) return;
    const key = `ride-assigned:${ride.id}:${ride.driver.id}`;
    if (storageHas(key)) return;
    storageMark(key);
    setAssignmentAnimationPhase("visible");
  }, [ride.id, ride.driver?.id, ride.status, assignmentEventDriverId]);

  useEffect(() => {
    if (assignmentAnimationPhase === "visible") {
      const timer = window.setTimeout(() => setAssignmentAnimationPhase("exiting"), 3000);
      return () => window.clearTimeout(timer);
    }
    if (assignmentAnimationPhase === "exiting") {
      const timer = window.setTimeout(() => setAssignmentAnimationPhase("hidden"), 400);
      return () => window.clearTimeout(timer);
    }
  }, [assignmentAnimationPhase]);

  useEffect(() => {
    if (ride.status === RideStatus.CANCELLED && assignmentAnimationPhase !== "hidden") {
      setAssignmentAnimationPhase("hidden");
    }
  }, [ride.status, assignmentAnimationPhase]);

  const markers = useMemo(() => {
    const items: MapMarker[] = [
      { id: "pickup", lat: ride.pickupLat, lng: ride.pickupLng, kind: "pickup", label: "Pickup" },
      { id: "drop", lat: ride.dropLat, lng: ride.dropLng, kind: "drop", label: "Destination" },
    ];
    if (ride.driver && driverPoint) {
      items.push({
        id: "driver",
        lat: driverPoint.lat,
        lng: driverPoint.lng,
        kind: "driver",
        label: `${ride.driver.user.name} · live GPS`,
      });
    }
    return items;
  }, [ride.pickupLat, ride.pickupLng, ride.dropLat, ride.dropLng, ride.driver, driverPoint]);

  const submitRating = async () => {
    if (!rating || ratingBusy) return;
    setRatingBusy(true);
    setRatingError(null);
    try {
      await rideApi.rate(ride.id, rating, feedback);
      toast.push("success", "Thanks for your feedback", "Your ride rating was saved.");
      onRefresh();
    } catch (error) {
      setRatingError(errorMessage(error));
    } finally {
      setRatingBusy(false);
    }
  };

  const gpsAge = gpsAt === null ? null : Math.max(0, Math.round((clock - gpsAt) / 1000));
  const gpsStale = gpsAge === null || gpsAge > 30;
  const activeRoute = route?.polyline ?? [];
  const remainingDistance = route?.distanceKm ?? null;
  const remainingEta = route?.durationMin ?? null;
  const dismissCompletion = () => {
    storageMark(`ride-completed-dismissed:${ride.id}`);
    setCompletionDismissed(true);
  };

  return (
    <div className="relative grid gap-4 pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0">
      <RideTrackingMap
        ride={ride}
        destination={destination}
        markers={markers}
        route={activeRoute}
        gpsStale={gpsStale}
        gpsAge={gpsAge}
        socketConnected={socketConnected}
      />

      <RideTrackingPanel
        ride={ride}
        demoMode={demoMode}
        gpsAge={gpsAge}
        routeLoading={routeLoading}
        routeError={routeError}
        onRetryRoute={() => setRouteRetry((retry) => retry + 1)}
        remainingDistance={remainingDistance}
        remainingEta={remainingEta}
        sheetExpanded={sheetExpanded}
        onToggleSheet={() => setSheetExpanded((expanded) => !expanded)}
        cancelling={cancelling}
        onCancel={onCancel}
      />

      {assignmentAnimationPhase !== "hidden" ? (
        <RideAssignmentOverlay
          driverName={ride.driver?.user.name}
          exiting={assignmentAnimationPhase === "exiting"}
        />
      ) : null}
      {ride.status === RideStatus.COMPLETED && !completionDismissed ? (
        <RideCompletionModal
          ride={ride}
          onDismiss={dismissCompletion}
          rating={rating}
          onRatingChange={setRating}
          feedback={feedback}
          onFeedbackChange={setFeedback}
          ratingBusy={ratingBusy}
          ratingError={ratingError}
          onSubmitRating={() => void submitRating()}
        />
      ) : null}
    </div>
  );
}
