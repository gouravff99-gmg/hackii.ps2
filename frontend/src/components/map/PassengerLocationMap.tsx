import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@ps02/shared";
import type { DeviceLocationStatus, DevicePosition } from "../../hooks/useDeviceLocation";
import { errorMessage } from "../../services/api";
import { geocodingApi } from "../../services/geocodingApi";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { MapCanvas, type MapMarker } from "./MapCanvas";

const INITIAL_CENTER: LatLng = { lat: 12.9716, lng: 77.5946 };

function statusLabel(status: DeviceLocationStatus): string {
  switch (status) {
    case "LOCATING": return "Locating";
    case "LIVE": return "GPS live";
    case "WEAK": return "GPS signal weak";
    case "PERMISSION_DENIED": return "Location denied";
    case "UNAVAILABLE": return "GPS unavailable";
  }
}

export function PassengerLocationMap({
  position,
  status,
  markers,
}: {
  position: DevicePosition | null;
  status: DeviceLocationStatus;
  markers: MapMarker[];
}) {
  const point = position?.point ?? null;
  const [mapCenter, setMapCenter] = useState<LatLng>(INITIAL_CENTER);
  const [recenterPoint, setRecenterPoint] = useState<LatLng | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const centeredOnGps = useRef(false);
  const locationKey = point ? `${point.lat.toFixed(3)},${point.lng.toFixed(3)}` : "";

  useEffect(() => {
    if (point && !centeredOnGps.current) {
      centeredOnGps.current = true;
      setMapCenter(point);
    }
  }, [point?.lat, point?.lng]);

  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAddress(`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`);
      geocodingApi
        .reverse(point, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setAddress(result.displayName);
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            setAddress(`Address unavailable · ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · ${errorMessage(cause)}`);
          }
        });
    }, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locationKey]);

  const locationMarkers: MapMarker[] = [
    ...markers,
    ...(position
      ? [{
          id: "passenger-current-location",
          lat: position.point.lat,
          lng: position.point.lng,
          kind: "passenger" as const,
          accuracyMeters: position.accuracy,
          heading: position.heading,
          label: `Your location · ±${Math.round(position.accuracy)} m`,
        }]
      : []),
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Around you"
        subtitle={address ?? (point ? `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` : "Allow location to show your position")}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={status === "LIVE" ? "success" : status === "WEAK" ? "warning" : "neutral"} dot>
              {statusLabel(status)}
            </Badge>
            {point ? (
              <Button size="sm" variant="secondary" onClick={() => setRecenterPoint({ ...point })}>
                Recenter
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="relative h-[340px] sm:h-[440px]">
        <MapCanvas
          center={mapCenter}
          zoom={point ? 14 : 12}
          recenter={recenterPoint}
          markers={locationMarkers}
        />
        {status === "PERMISSION_DENIED" || status === "UNAVAILABLE" ? (
          <p role="status" className="absolute bottom-3 left-3 right-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-ink-700 shadow">
            {status === "PERMISSION_DENIED"
              ? "Location permission is off. You can still browse the map and set a pickup manually."
              : "Your device location is unavailable. You can still browse the map and set a pickup manually."}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
