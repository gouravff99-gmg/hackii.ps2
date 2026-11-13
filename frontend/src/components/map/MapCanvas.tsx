import type { LatLng } from "@ps02/shared";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

export type MarkerKind = "driver" | "pickup" | "drop" | "active" | "idle";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  kind?: MarkerKind;
}

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

export interface MapCanvasProps {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  route?: LatLng[];
  onMapClick?: (point: LatLng) => void;
  recenter?: LatLng | null;
  className?: string;
  showControls?: boolean;
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
}: MapCanvasProps) {
  const routePositions = route.map((point) => [point.lat, point.lng] as [number, number]);

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
      {onMapClick ? <ClickCapture onClick={onMapClick} /> : null}
      {recenter ? <Recenter target={recenter} /> : null}

      {routePositions.length >= 2 ? (
        <>
          <Polyline positions={routePositions} pathOptions={{ color: "#2049e3", weight: 5, opacity: 0.85 }} />
          <Polyline positions={routePositions} pathOptions={{ color: "#ffffff", weight: 2, opacity: 0.5 }} />
        </>
      ) : null}

      {markers.map((marker) => {
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
