import { useEffect, useRef, useState } from "react";
import {
  SOCKET_EVENTS,
  haversineKm,
  type LatLng,
  type RideDetailView,
  type RouteResult,
} from "@ps02/shared";
import { useDeviceLocation } from "./useDeviceLocation";
import { useToast } from "./useToast";
import { driverApi } from "../services/driverApi";
import { rideApi } from "../services/rideApi";
import { errorMessage } from "../services/api";
import { connectSocket } from "../services/socket";

export function useDriverLiveTracking({
  driverId,
  fallbackPosition,
  activeRide,
  isOnline,
  toast,
}: {
  driverId: string | undefined;
  fallbackPosition: LatLng | null;
  activeRide: Pick<RideDetailView, "id" | "status"> | null;
  isOnline: boolean;
  toast: ReturnType<typeof useToast>;
}) {
  const gps = useDeviceLocation();
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const lastGpsSent = useRef<{ at: number; lat: number; lng: number } | null>(null);
  const latestPosition = useRef<LatLng | null>(null);
  latestPosition.current = gps.position?.point ?? fallbackPosition;

  useEffect(() => {
    if (!driverId) return;
    const socket = connectSocket();
    if (!socket) return;
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setSocketConnected(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      setSocketConnected(false);
    };
  }, [driverId]);

  useEffect(() => {
    if (!activeRide) {
      setActiveRoute(null);
      setRouteError(null);
      return;
    }

    let active = true;
    let inFlight = false;
    let lastOrigin: LatLng | null = null;
    let lastAt = 0;
    let controller: AbortController | null = null;
    setActiveRoute(null);
    setRouteError(null);
    const refreshRoute = async (force = false) => {
      const origin = latestPosition.current;
      if (!origin || inFlight) return;
      const now = Date.now();
      const movedEnough = !lastOrigin || haversineKm(lastOrigin, origin) >= 0.2;
      if (!force && !movedEnough && now - lastAt < 60_000) return;
      inFlight = true;
      lastOrigin = origin;
      lastAt = now;
      controller = new AbortController();
      try {
        const result = await rideApi.trackingRoute(activeRide.id, origin, controller.signal);
        if (active) {
          setActiveRoute(result);
          setRouteError(null);
        }
      } catch (cause) {
        if (active && !controller.signal.aborted) setRouteError(errorMessage(cause));
      } finally {
        inFlight = false;
      }
    };

    void refreshRoute(true);
    const timer = window.setInterval(() => void refreshRoute(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      controller?.abort();
    };
  }, [activeRide?.id, activeRide?.status]);

  useEffect(() => {
    const point = gps.position?.point;
    if (!driverId || !isOnline || !point) return;
    const now = Date.now();
    const previous = lastGpsSent.current;
    const movedMeters = previous
      ? Math.hypot(
          (point.lat - previous.lat) * 111_320,
          (point.lng - previous.lng) * 111_320 * Math.cos((point.lat * Math.PI) / 180),
        )
      : Number.POSITIVE_INFINITY;
    if (previous && now - previous.at < 5_000 && movedMeters < 25) return;

    lastGpsSent.current = { at: now, ...point };
    const socket = connectSocket();
    if (socket?.connected) {
      socket.emit(SOCKET_EVENTS.DRIVER_UPDATE_LOCATION, point);
      return;
    }
    void driverApi.updateLocation(point.lat, point.lng).catch((cause: unknown) => {
      toast.push("error", "Live location update failed", errorMessage(cause), {
        eventKey: "driver-gps-update-error",
      });
    });
  }, [driverId, gps.position?.timestamp, isOnline, toast]);

  return { gps, socketConnected, activeRoute, routeError };
}
