import type { LatLng, MobilityZoneInsight } from "@ps02/shared";
import { useEffect } from "react";
import { AnimatedDriverMarker } from "./AnimatedDriverMarker";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { zoneHeatmapColor, zoneHeatmapLabel, zoneLayerValue } from "./zoneHeatmap";

export type MarkerKind = "driver" | "pickup" | "drop" | "active" | "idle";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  kind?: MarkerKind;
}

export type MapZoneLayer =
  | "availability"
  | "currentDemand"
  | "dropoffActivity"
  | "forecast"
  | "availableDrivers"
  | "busyDrivers"
  | "demandGap"
  | "coverage";

const MARKER_STYLE: Record<MarkerKind, { color: string; fill: string; radius: number }> = {
  driver: { color: "#2049e3", fill: "#3566f6", radius: 5 },
  idle: { color: "#64748b", fill: "#94a3b8", radius: 4 },
  pickup: { color: "#047857", fill: "#10b981", radius: 7 },
  drop: { color: "#b91c1c", fill: "#ef4444", radius: 7 },
  active: { color: "#6d28d9", fill: "#8b5cf6", radius: 7 },
};

function ClickCapture({ onClick }: { onClick: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function Recenter({ target }: { target: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([target.lat, target.lng], { animate: true });
  }, [map, target.lat, target.lng]);
  return null;
}

function SetViewport({ center, zoom }: { center: LatLng; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);
  return null;
}

function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  const first = points[0];
  const last = points[points.length - 1];
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 15, animate: true });
    }
  }, [map, first?.[0], first?.[1], last?.[0], last?.[1]]);
  return null;
}

export interface MapCanvasProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  route?: LatLng[];
  onMapClick?: (point: LatLng) => void;
  recenter?: LatLng | null;
  className?: string;
  showControls?: boolean;
  fitRoute?: boolean;
  zoneInsights?: MobilityZoneInsight[];
  selectedZoneId?: string | null;
  onZoneSelect?: (zone: MobilityZoneInsight) => void;
  zoneLayer?: MapZoneLayer;
  visibleZoneLayers?: MapZoneLayer[];
  zoneColorMode?: "availability" | "opportunity";
  opportunityScores?: Record<string, number | null>;
}

/** Shared Leaflet canvas used by every screen. Circle markers avoid icon assets. */
export function MapCanvas({
  center,
  zoom = 12,
  markers = [],
  route = [],
  onMapClick,
  recenter = null,
  className = "h-full w-full",
  showControls = true,
  fitRoute = false,
  zoneInsights = [],
  selectedZoneId = null,
  onZoneSelect,
  zoneLayer = "availability",
  visibleZoneLayers,
  zoneColorMode = "availability",
  opportunityScores = {},
}: MapCanvasProps) {
  const routePositions = route.map((point) => [point.lat, point.lng] as [number, number]);
  const layerMax = Math.max(1, ...zoneInsights.map((zone) => Math.abs(zoneLayerValue(zone, zoneLayer))));
  const visibleLayerMaxima = new Map(
    (visibleZoneLayers ?? []).map((layer) => [
      layer,
      Math.max(1, ...zoneInsights.map((zone) => Math.abs(zoneLayerValue(zone, layer)))),
    ]),
  );

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      zoomControl={showControls}
      attributionControl
      className={className}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <SetViewport center={center} zoom={zoom} />
      {fitRoute ? <FitRoute points={routePositions} /> : null}
      {onMapClick ? <ClickCapture onClick={onMapClick} /> : null}
      {recenter ? <Recenter target={recenter} /> : null}

      {visibleZoneLayers !== undefined
        ? visibleZoneLayers.length
        ? zoneInsights.map((zone) => visibleZoneLayers.map((layer, index) => {
            const value = zoneLayerValue(zone, layer);
            const color = zoneHeatmapColor(zone, layer, "availability", undefined, visibleLayerMaxima.get(layer) ?? layerMax);
            const zeroCountLayer =
              (layer === "currentDemand" || layer === "dropoffActivity" ||
                layer === "forecast" || layer === "availableDrivers" || layer === "busyDrivers") &&
              value === 0;
            const noDemandCoverage = layer === "coverage" &&
              zone.pendingRequests === 0 && zone.currentRequests15m === 0;
            const unavailable = layer === "availability"
              ? zone.availability === "INSUFFICIENT_DATA"
              : zeroCountLayer || noDemandCoverage;
            return (
              <CircleMarker
                key={`zone-${zone.zoneId}-${layer}`}
                center={[zone.center.lat, zone.center.lng]}
                radius={selectedZoneId === zone.zoneId ? 15 + index * 2 : 12 + index * 2}
                bubblingMouseEvents={false}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: unavailable ? 0.12 : selectedZoneId === zone.zoneId ? 0.48 : 0.34,
                  opacity: unavailable ? 0.24 : 0.88,
                  weight: selectedZoneId === zone.zoneId ? 2.5 : 1,
                }}
                eventHandlers={{ click: () => onZoneSelect?.(zone) }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                  {zone.zoneId} · {zoneHeatmapLabel(zone, layer, "availability", undefined)}
                </Tooltip>
              </CircleMarker>
            );
          }))
        : null
        : zoneInsights.map((zone) => {
        const color = zoneHeatmapColor(
          zone,
          zoneLayer,
          zoneColorMode,
          opportunityScores[zone.zoneId],
          layerMax,
        );
        const value = zoneLayerValue(zone, zoneLayer);
        const unavailable = zoneColorMode === "opportunity"
          ? opportunityScores[zone.zoneId] == null
          : zoneLayer === "availability"
            ? zone.availability === "INSUFFICIENT_DATA"
            : value === 0;
        return (
          <CircleMarker
            key={`zone-${zone.zoneId}`}
            center={[zone.center.lat, zone.center.lng]}
            radius={selectedZoneId === zone.zoneId ? 15 : 12}
            bubblingMouseEvents={false}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: unavailable ? 0.12 : selectedZoneId === zone.zoneId ? 0.48 : 0.34,
              opacity: unavailable ? 0.24 : 0.88,
              weight: selectedZoneId === zone.zoneId ? 2.5 : 1,
            }}
            eventHandlers={{
              click: () => onZoneSelect?.(zone),
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              {zone.zoneId} · {zoneHeatmapLabel(zone, zoneLayer, zoneColorMode, opportunityScores[zone.zoneId])} · {zone.availableDrivers} available
            </Tooltip>
          </CircleMarker>
        );
      })}

      {routePositions.length >= 2 ? (
        <>
          <Polyline positions={routePositions} pathOptions={{ color: "#2049e3", weight: 5, opacity: 0.85 }} />
          <Polyline positions={routePositions} pathOptions={{ color: "#ffffff", weight: 2, opacity: 0.5 }} />
        </>
      ) : null}

      {markers.map((marker) => {
        if (marker.kind === "driver") return <AnimatedDriverMarker key={marker.id} marker={marker} />;
        const style = MARKER_STYLE[marker.kind ?? "driver"];
        return (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={style.radius}
            pathOptions={{
              color: style.color,
              fillColor: style.fill,
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            {marker.label ? (
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                {marker.label}
              </Tooltip>
            ) : null}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
