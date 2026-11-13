import type { LatLng, RouteResult } from "@ps02/shared";
import type { DeviceLocationStatus, DevicePosition } from "../../hooks/useDeviceLocation";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { MapCanvas, type MapMarker } from "../map/MapCanvas";

export function DriverPositionMap({
  position,
  status,
  socketConnected,
  isOnline,
  center,
  recenter,
  markers,
  route,
  routeError,
  onRecenter,
  onMapClick,
}: {
  position: DevicePosition | null;
  status: DeviceLocationStatus;
  socketConnected: boolean;
  isOnline: boolean;
  center: LatLng;
  recenter: LatLng | null;
  markers: MapMarker[];
  route: RouteResult["polyline"] | undefined;
  routeError: string | null;
  onRecenter: () => void;
  onMapClick: (point: LatLng) => void;
}) {
  const gpsLabel =
    status === "LOCATING" ? "Locating" :
      status === "LIVE" ? `GPS live ±${Math.round(position?.accuracy ?? 0)}m` :
        status === "WEAK" ? `Signal weak ±${Math.round(position?.accuracy ?? 0)}m` :
          status === "PERMISSION_DENIED" ? "Location denied" : "GPS unavailable";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Your position"
        subtitle="Your GPS updates this marker. Manual map location remains available as a fallback."
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge tone={status === "LIVE" ? "success" : status === "WEAK" ? "warning" : "neutral"} dot>
              {gpsLabel}
            </Badge>
            <Badge tone={socketConnected ? "success" : isOnline ? "warning" : "neutral"}>
              {isOnline ? socketConnected ? "Socket connected" : "REST fallback" : "Offline"}
            </Badge>
            <Button size="sm" variant="secondary" onClick={onRecenter}>Recenter</Button>
          </div>
        }
      />
      <div className="relative h-[300px] sm:h-[360px]">
        <MapCanvas
          center={center}
          recenter={recenter}
          zoom={14}
          markers={markers}
          route={route}
          onMapClick={position ? undefined : onMapClick}
        />
        {routeError ? (
          <p role="status" className="absolute bottom-3 left-3 right-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-amber-800 shadow">
            Route unavailable: {routeError}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
