import { useEffect, useMemo, useState } from "react";
import {
  CITY,
  INDIA_CENTER,
  type LatLng,
  type MobilityZoneInsight,
  type NearbyDriver,
  type RouteResult,
} from "@ps02/shared";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { MapCanvas, type MapMarker } from "./MapCanvas";
import { PickupIntelligencePanel } from "./PickupIntelligencePanel";
import type { useRideLocations } from "../../hooks/useRideLocations";
import { useMobilityIntelligence } from "../../hooks/useMobilityIntelligence";
import { formatMinutes } from "../../utils/format";
import { useDeviceLocation } from "../../hooks/useDeviceLocation";

export function PassengerPickupMap({
  locations,
  nearby,
  route = [],
  disabled = false,
}: {
  locations: ReturnType<typeof useRideLocations>;
  nearby: NearbyDriver[];
  route?: RouteResult["polyline"];
  disabled?: boolean;
}) {
  const intelligence = useMobilityIntelligence();
  const gps = useDeviceLocation();
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [viewingIntelligenceArea, setViewingIntelligenceArea] = useState(false);
  const [gpsFocus, setGpsFocus] = useState<LatLng | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const zones = intelligence.data?.zones ?? [];
  const selectedZone = zones.find((zone) => zone.zoneId === selectedZoneId) ?? null;
  const inConfiguredCity = locations.pickup
    ? isInConfiguredCity(locations.pickup)
    : false;
  const pickupZone = useMemo(
    () => (locations.pickup ? closestZone(zones, locations.pickup) : null),
    [locations.pickup?.lat, locations.pickup?.lng, zones],
  );

  useEffect(() => {
    setSelectedZoneId(pickupZone?.zoneId ?? null);
  }, [pickupZone?.zoneId]);

  const markers: MapMarker[] = useMemo(() => {
    const list: MapMarker[] = nearby.map((driver) => ({
      id: driver.id,
      lat: driver.lat,
      lng: driver.lng,
      kind: "driver",
      label: `${driver.name} · ${formatMinutes(driver.etaMin)}`,
    }));
    if (gps.position) {
      list.push({
        id: "passenger-current-location",
        lat: gps.position.point.lat,
        lng: gps.position.point.lng,
        kind: "passenger",
        accuracyMeters: gps.position.accuracy,
        heading: gps.position.heading,
        label: `Your location · ±${Math.round(gps.position.accuracy)} m`,
      });
    }
    if (locations.pickup) {
      list.push({
        id: "pickup",
        lat: locations.pickup.lat,
        lng: locations.pickup.lng,
        kind: "pickup",
        label: locations.pickupAddress || "Pickup",
      });
    }
    if (locations.drop) {
      list.push({
        id: "drop",
        lat: locations.drop.lat,
        lng: locations.drop.lng,
        kind: "drop",
        label: locations.dropAddress || "Destination",
      });
    }
    return list;
  }, [nearby, locations.pickup, locations.drop, locations.pickupAddress, locations.dropAddress, gps.position]);

  const useSuggestion = (point: LatLng) => {
    locations.setLocationPoint("pickup", point);
    setViewingIntelligenceArea(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={`Tap the map to set ${locations.activeField === "pickup" ? "pickup" : "destination"}`}
        subtitle="India-wide map · choose pickup or destination"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!gps.position}
            onClick={() => {
              if (!gps.position) return;
              setGpsFocus({ ...gps.position.point });
              setViewingIntelligenceArea(false);
            }}
          >
            {gps.position ? `My location · ${gps.status === "WEAK" ? "Weak GPS" : "GPS live"}` : "Locating"}
          </Button>
          <button
              type="button"
              disabled={disabled}
              onClick={() => setHeatmapEnabled((enabled) => !enabled)}
              aria-pressed={heatmapEnabled}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                heatmapEnabled ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"
              }`}
            >
              {heatmapEnabled ? "Hide pickup zones" : "Show pickup zones"}
            </button>
            <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
              {(["pickup", "drop"] as const).map((field) => (
                <button
                  key={field}
                  type="button"
                  disabled={disabled}
                  onClick={() => locations.setActiveField(field)}
                  aria-pressed={locations.activeField === field}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    locations.activeField === field
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-500"
                  }`}
                >
                  {field === "pickup" ? "Pickup" : "Destination"}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="h-[340px] sm:h-[480px]">
        <MapCanvas
          center={viewingIntelligenceArea ? CITY.center : gpsFocus ?? locations.pickup ?? INDIA_CENTER}
          zoom={viewingIntelligenceArea ? 12 : gpsFocus ? 14 : locations.pickup ? 13 : 4}
          markers={markers}
          route={route}
          onMapClick={disabled ? undefined : (point) => {
            setGpsFocus(null);
            setViewingIntelligenceArea(false);
            locations.handleMapClick(point);
          }}
          recenter={gpsFocus ?? locations.mapRecenter}
          zoneInsights={heatmapEnabled ? zones : []}
          selectedZoneId={selectedZoneId}
          onZoneSelect={(zone) => setSelectedZoneId(zone.zoneId)}
        />
      </div>
      {heatmapEnabled ? (
        <div className="px-4">
          {!viewingIntelligenceArea && !inConfiguredCity ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setViewingIntelligenceArea(true)}
            >
              View configured zone area
            </Button>
          ) : null}
          <PickupIntelligencePanel
            zones={zones}
            selectedZone={selectedZone}
            pickupZone={pickupZone}
            pickup={locations.pickup}
            loading={intelligence.loading}
            error={intelligence.error}
            generatedAt={intelligence.data?.generatedAt}
            city={intelligence.data?.city ?? CITY.name}
            onUseSuggestion={useSuggestion}
            disabled={disabled}
          />
        </div>
      ) : null}
    </Card>
  );
}

function isInConfiguredCity(point: LatLng): boolean {
  return (
    point.lat <= CITY.bounds.north &&
    point.lat >= CITY.bounds.south &&
    point.lng <= CITY.bounds.east &&
    point.lng >= CITY.bounds.west
  );
}

function closestZone(zones: MobilityZoneInsight[], point: LatLng): MobilityZoneInsight | null {
  if (!isInConfiguredCity(point)) return null;
  return zones.reduce<MobilityZoneInsight | null>((best, zone) => {
    if (!best) return zone;
    const distance = (candidate: MobilityZoneInsight) =>
      Math.hypot(
        (candidate.center.lat - point.lat) * 111,
        (candidate.center.lng - point.lng) * 111 * Math.cos((point.lat * Math.PI) / 180),
      );
    return distance(zone) < distance(best) ? zone : best;
  }, null);
}
