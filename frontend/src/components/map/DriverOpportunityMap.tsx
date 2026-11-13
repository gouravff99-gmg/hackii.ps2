import { useMemo, useState } from "react";
import {
  DEMAND_TIME_WINDOWS,
  VehicleCategory,
  haversineKm,
  resolveTimeWindow,
  type DemandWindowId,
  type AreaDemandView,
  type LatLng,
} from "@ps02/shared";
import { useAreaDemand } from "../../hooks/useAreaDemand";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { EmptyState, ErrorState } from "../ui/EmptyState";
import { AreaHeatmap, type AreaHeatmapMode } from "./AreaHeatmap";
import { AreaHeatmapLegend } from "./AreaHeatmapLegend";

interface RankedArea {
  area: AreaDemandView;
  distanceKm: number;
  score: number;
}

export function DriverOpportunityMap({
  location,
  category = VehicleCategory.CAR,
}: {
  location: LatLng;
  category?: VehicleCategory;
}) {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [windowId, setWindowId] = useState<DemandWindowId>(
    () => resolveTimeWindow(new Date().getHours()).id,
  );
  const [mode, setMode] = useState<AreaHeatmapMode>("demand");
  const intelligence = useAreaDemand({ category, window: windowId, source: "auto" });
  const areas = intelligence.data?.areas ?? [];

  const rankedAreas = useMemo(
    () =>
      areas
        .map((area): RankedArea => {
          const distanceKm = haversineKm(location, area.center);
          const opportunity = area.categories[category].opportunityScore;
          return {
            area,
            distanceKm,
            score: Math.max(0, Math.round(opportunity - Math.min(30, distanceKm * 2.5))),
          };
        })
        .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm),
    [areas, category, location.lat, location.lng],
  );
  const selected = rankedAreas.find((entry) => entry.area.areaId === selectedAreaId) ?? null;
  const nearbyAreas = rankedAreas.filter((entry) => entry.distanceKm <= 10 && entry.score > 0);

  const navigateTo = (area: AreaDemandView) => {
    const url = `https://www.openstreetmap.org/?mlat=${area.center.lat}&mlon=${area.center.lng}#map=14/${area.center.lat}/${area.center.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader
        title="Ride opportunity zones"
        subtitle="Same Belagavi operational-area heatmap used by admin; opportunity is an estimate, not an earnings guarantee."
        action={
          <Badge tone={intelligence.data?.source === "LIVE" ? "success" : intelligence.data?.source === "BLENDED" ? "info" : "warning"}>
            {intelligence.data?.source ?? "LOADING"} DATA
          </Badge>
        }
      />
      <CardBody className="flex flex-col gap-4">
        {intelligence.error ? (
          intelligence.data ? (
            <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Refresh failed; showing the last successful snapshot. {intelligence.error}
            </p>
          ) : (
            <ErrorState message={intelligence.error} onRetry={() => void intelligence.refresh()} />
          )
        ) : null}
        {intelligence.loading && !intelligence.data ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <span className="text-sm text-ink-500">Loading area heatmap…</span>
          </div>
        ) : areas.length ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs font-medium text-ink-500">
                  Time
                  <select
                    value={windowId}
                    onChange={(event) => setWindowId(event.target.value as DemandWindowId)}
                    className="h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-800"
                  >
                    {DEMAND_TIME_WINDOWS.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-ink-500">
                  Heatmap
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as AreaHeatmapMode)}
                    className="h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-800"
                  >
                    <option value="demand">Demand</option>
                    <option value="availability">Availability</option>
                    <option value="opportunity">Opportunity</option>
                  </select>
                </label>
              </div>
              <AreaHeatmap
                areas={areas}
                category={category}
                mode={mode}
                selectedAreaId={selectedAreaId}
                onSelectArea={setSelectedAreaId}
                heightClassName="h-[360px] sm:h-[420px]"
              />
              <AreaHeatmapLegend mode={mode} />
            </div>
            <div className="flex flex-col gap-3">
              {selected ? (
                <div className="rounded-xl bg-ink-50 p-3 text-xs">
                  <p className="font-semibold text-ink-900">
                    {selected.area.name} · Opportunity {selected.score}/100
                  </p>
                  <p className="mt-1 text-ink-600">
                    {selected.area.categories[category].requests} requests ·{" "}
                    {selected.area.categories[category].availableDrivers} available drivers ·{" "}
                    {selected.distanceKm.toFixed(1)} km away
                  </p>
                  <p className="mt-1 text-ink-500">{selected.area.note}</p>
                </div>
              ) : (
                <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
                  Select an area on the map to inspect demand and available supply.
                </p>
              )}
              {nearbyAreas.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Recommended nearby</p>
                  {nearbyAreas.slice(0, 3).map((entry) => (
                    <div key={entry.area.areaId} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 p-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedAreaId(entry.area.areaId)}
                        className="min-w-0 text-left"
                      >
                        <span className="block truncate text-sm font-medium text-ink-900">
                          {entry.area.name} · {entry.score}/100
                        </span>
                        <span className="block text-xs text-ink-500">
                          ~{entry.distanceKm.toFixed(1)} km · {entry.area.categories[category].availableDrivers} available
                        </span>
                      </button>
                      <Button size="sm" variant="secondary" onClick={() => navigateTo(entry.area)}>
                        Navigate
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="layers"
                  title="No nearby area recommendation"
                  description="The operational areas are not close enough to your reported position."
                />
              )}
            </div>
          </div>
        ) : !intelligence.error ? (
          <EmptyState icon="layers" title="No area data" description="No operational-area heatmap data is available." />
        ) : null}
        <p className="text-[11px] text-ink-400">
          {intelligence.data?.disclaimer ?? "Operational-area boundaries are approximate; demo values are synthetic and clearly labelled."}
        </p>
      </CardBody>
    </Card>
  );
}
