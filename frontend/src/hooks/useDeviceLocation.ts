import { useEffect, useState } from "react";
import type { LatLng } from "@ps02/shared";

export type DeviceLocationStatus =
  | "LOCATING"
  | "LIVE"
  | "WEAK"
  | "PERMISSION_DENIED"
  | "UNAVAILABLE";

export interface DevicePosition {
  point: LatLng;
  accuracy: number;
  heading: number | null;
  timestamp: number;
}

function distanceMeters(from: LatLng, to: LatLng): number {
  const lat = (to.lat - from.lat) * 111_320;
  const lng =
    (to.lng - from.lng) *
    111_320 *
    Math.cos((from.lat * Math.PI) / 180);
  return Math.hypot(lat, lng);
}

export function useDeviceLocation(enabled = true) {
  const [position, setPosition] = useState<DevicePosition | null>(null);
  const [status, setStatus] = useState<DeviceLocationStatus>("LOCATING");

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      setStatus("UNAVAILABLE");
      return;
    }

    let active = true;
    setStatus((current) => (current === "LIVE" || current === "WEAK" ? current : "LOCATING"));
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        if (!active) return;
        const { latitude: lat, longitude: lng, accuracy, heading } = result.coords;
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180 ||
          !Number.isFinite(accuracy)
        ) {
          setStatus("UNAVAILABLE");
          return;
        }

        const next: DevicePosition = {
          point: { lat, lng },
          accuracy,
          heading: heading !== null && Number.isFinite(heading) ? heading : null,
          timestamp: result.timestamp,
        };
        setPosition((previous) => {
          if (
            previous &&
            distanceMeters(previous.point, next.point) < 8 &&
            next.timestamp - previous.timestamp < 10_000
          ) {
            const accuracyChanged = Math.abs(previous.accuracy - next.accuracy) >= 10;
            const headingChanged = previous.heading !== next.heading;
            return accuracyChanged || headingChanged ? { ...previous, accuracy: next.accuracy, heading: next.heading } : previous;
          }
          return next;
        });
        setStatus(accuracy > 100 ? "WEAK" : "LIVE");
      },
      (error) => {
        if (!active) return;
        setPosition(null);
        setStatus(error.code === error.PERMISSION_DENIED ? "PERMISSION_DENIED" : "UNAVAILABLE");
      },
      { enableHighAccuracy: true, maximumAge: 3_000, timeout: 15_000 },
    );

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return { position, status };
}
