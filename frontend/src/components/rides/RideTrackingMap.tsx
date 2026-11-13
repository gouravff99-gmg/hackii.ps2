import type { LatLng, RideDetailView } from "@ps02/shared";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { MapCanvas, type MapMarker } from "../map/MapCanvas";
import { rideStatusLabel, rideStatusTone } from "../../utils/format";

interface RideTrackingMapProps {
  ride: RideDetailView;
  destination: LatLng;
  markers: MapMarker[];
  route: LatLng[];
  gpsStale: boolean;
  gpsAge: number | null;
  socketConnected: boolean;
}

export function RideTrackingMap({
  ride,
  destination,
  markers,
  route,
  gpsStale,
  gpsAge,
  socketConnected,
}: RideTrackingMapProps) {
  return (
    <Card className="relative overflow-hidden">
      <div className="h-[calc(100dvh-12rem)] min-h-[420px] lg:h-[78vh]">
        <MapCanvas center={destination} zoom={13} markers={markers} route={route} fitRoute />
      </div>
      <div className="absolute left-3 top-3 z-[500] flex flex-wrap gap-2">
        <Badge tone={rideStatusTone(ride.status)} dot>{rideStatusLabel(ride.status)}</Badge>
        {ride.driver ? (
          <Badge tone={gpsStale || !socketConnected ? "warning" : "success"}>
            {!socketConnected
              ? "Reconnecting"
              : gpsAge === null
                ? "Waiting for GPS"
                : gpsStale
                  ? "GPS signal delayed"
                  : "Live driver location"}
          </Badge>
        ) : null}
      </div>
    </Card>
  );
}
