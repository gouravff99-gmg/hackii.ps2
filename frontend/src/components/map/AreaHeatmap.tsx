import {
  areaDemandColor,
  areaOpportunityColor,
  availabilityColor,
  type AreaCategoryView,
  type AreaDemandView,
  type VehicleCategory,
} from "@ps02/shared";
import { useEffect, useMemo } from "react";
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";

export type AreaHeatmapMode = "demand" | "availability" | "opportunity";

const BELAGAVI_CENTER = { lat: 15.842, lng: 74.508 };
const BELAGAVI_ZOOM = 13;

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container);
    map.invalidateSize({ pan: false });
    return () => observer.disconnect();
  }, [map]);

  return null;
}

export function areaLayerColor(
  view: AreaCategoryView,
  mode: AreaHeatmapMode,
): string {
  if (mode === "availability") return availabilityColor(view.availability);
  if (mode === "opportunity") return areaOpportunityColor(view.opportunityScore);
  return areaDemandColor(view.demandLevel);
}

export function areaLayerValue(view: AreaCategoryView, mode: AreaHeatmapMode): string {
  if (mode === "availability") return view.availability.replace("_", " ").toLowerCase();
  if (mode === "opportunity") return `${view.opportunityScore}/100 opportunity`;
  return `${view.requests} requests`;
}

interface AreaHeatmapProps {
  areas: AreaDemandView[];
  category: VehicleCategory;
  mode?: AreaHeatmapMode;
  selectedAreaId?: string | null;
  onSelectArea?: (areaId: string) => void;
  heightClassName?: string;
  showLabels?: boolean;
}

export function AreaHeatmap({
  areas,
  category,
  mode = "demand",
  selectedAreaId,
  onSelectArea,
  heightClassName = "h-[420px]",
  showLabels = true,
}: AreaHeatmapProps) {
  const polygonPositions = useMemo(
    () =>
      new Map(
        areas.map((area) => [
          area.areaId,
          area.polygon.map((point) => [point.lat, point.lng] as [number, number]),
        ]),
      ),
    [areas],
  );

  return (
    <div className={`${heightClassName} overflow-hidden rounded-xl border border-ink-200`}>
      <MapContainer
        center={[BELAGAVI_CENTER.lat, BELAGAVI_CENTER.lng]}
        zoom={BELAGAVI_ZOOM}
        minZoom={11}
        maxZoom={16}
        scrollWheelZoom
        className="h-full w-full"
      >
        <ResizeMap />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {areas.map((area) => {
          const view = area.categories[category];
          const selected = area.areaId === selectedAreaId;
          const color = areaLayerColor(view, mode);
          return (
            <Polygon
              key={area.areaId}
              positions={polygonPositions.get(area.areaId) ?? []}
              pathOptions={{
                color: selected ? "#0f172a" : "#ffffff",
                weight: selected ? 3 : 1.5,
                fillColor: color,
                fillOpacity: selected ? 0.82 : 0.62,
              }}
              eventHandlers={{ click: () => onSelectArea?.(area.areaId) }}
            >
              <Tooltip direction="center" permanent={showLabels} opacity={0.92}>
                <span className="text-[11px] font-semibold">{area.name}</span>
                <br />
                <span className="text-[10px]">
                  {category} · {areaLayerValue(view, mode)}
                </span>
              </Tooltip>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}
