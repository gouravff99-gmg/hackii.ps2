import { useMemo, useState } from "react";
import {
  DEMAND_TIME_WINDOWS,
  VehicleCategory,
  haversineKm,
  resolveTimeWindow,
  type AreaDemandView,
  type DemandWindowId,
  type LatLng,
} from "@ps02/shared";
import { useAreaDemand } from "../../hooks/useAreaDemand";
import { AreaHeatmap, type AreaHeatmapMode } from "../../components/map/AreaHeatmap";
import { AreaHeatmapLegend } from "../../components/map/AreaHeatmapLegend";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";

const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  [VehicleCategory.BIKE]: "Bike",
  [VehicleCategory.CAR]: "Car",
  [VehicleCategory.POOL]: "Pooling (shared car)",
};

const AVAILABILITY_TEXT = {
  GOOD: { label: "Good", tone: "success" as const, hint: "Drivers are usually available" },
  MODERATE: { label: "Moderate", tone: "warning" as const, hint: "Expect a short wait" },
  LIMITED: { label: "Limited", tone: "warning" as const, hint: "Few drivers nearby" },
  HIGH_PRESSURE: { label: "Very limited", tone: "danger" as const, hint: "High demand, longer wait" },
  INSUFFICIENT_DATA: { label: "Insufficient data", tone: "neutral" as const, hint: "Not enough recent activity" },
};

function friendlyDemand(area: AreaDemandView, category: VehicleCategory): string {
  const view = area.categories[category];
  if (view.demandLevel === "HIGH" || view.demandLevel === "VERY_HIGH" || view.demandLevel === "CRITICAL") {
    return category === VehicleCategory.POOL ? "Good pooling opportunity" : `High ${CATEGORY_LABEL[category].toLowerCase()} demand`;
  }
  if (view.requests > 0) return `${view.requests} requests this window`;
  return "Low activity";
}

export function PassengerAreaDemand({
  category,
  pickup,
}: {
  category: VehicleCategory;
  pickup: LatLng | null;
}) {
  const [windowId, setWindowId] = useState<DemandWindowId>(() => resolveTimeWindow(new Date().getHours()).id);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<AreaHeatmapMode>("demand");

  const state = useAreaDemand({ category, window: windowId, source: "auto" });

  const data = state.data;
  const areas = data?.areas ?? [];
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? areas.filter((area) => area.name.toLowerCase().includes(query)) : areas;
  }, [areas, search]);

  const selected =
    areas.find((area) => area.areaId === selectedId) ??
    (pickup
      ? [...areas].sort(
          (a, b) => haversineKm(pickup, a.center) - haversineKm(pickup, b.center),
        )[0]
      : undefined) ??
    areas[0] ??
    null;

  const view = selected?.categories[category];
  const availability = view ? AVAILABILITY_TEXT[view.availability] : AVAILABILITY_TEXT.INSUFFICIENT_DATA;

  return (
    <Card>
      <CardHeader
        title="Belagavi area demand heatmap"
        subtitle={`${CATEGORY_LABEL[category]} · same operational areas and heatmap as admin`}
        action={
          <Badge tone={data?.source === "LIVE" ? "success" : data?.source === "BLENDED" ? "info" : "warning"}>
            {data?.source ?? "LOADING"} DATA
          </Badge>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Time
            <select
              value={windowId}
              onChange={(event) => setWindowId(event.target.value as DemandWindowId)}
              className="h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm"
            >
              {DEMAND_TIME_WINDOWS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Heatmap
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as AreaHeatmapMode)}
              className="h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm"
            >
              <option value="demand">Demand</option>
              <option value="availability">Availability</option>
              <option value="opportunity">Opportunity</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Find area
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tilakwadi, Camp, Udyambag…"
              className="h-9 min-w-44 rounded-lg border border-ink-200 px-2.5 text-sm"
            />
          </label>
          <p className="ml-auto text-[11px] text-ink-400">
            Last updated {data ? new Date(data.generatedAt).toLocaleTimeString() : "—"}
          </p>
        </div>

        {state.loading && !data ? (
          <div className="flex min-h-[260px] items-center justify-center"><Spinner className="h-6 w-6" /></div>
        ) : state.error && !data ? (
          <ErrorState message={state.error} onRetry={() => void state.refresh()} />
        ) : areas.length === 0 ? (
          <EmptyState icon="layers" title="No area data" description="Try another time window." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <div className="flex flex-col gap-2">
              {state.error ? (
                <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Refresh failed; showing the last successful snapshot. {state.error}
                </p>
              ) : null}
              <AreaHeatmap
                areas={visible}
                category={category}
                mode={mode}
                selectedAreaId={selected?.areaId ?? null}
                onSelectArea={setSelectedId}
                heightClassName="h-[360px] sm:h-[420px]"
              />
              <AreaHeatmapLegend mode={mode} />
            </div>

            <div className="flex flex-col gap-3">
              {selected && view ? (
                <div className="rounded-xl border border-ink-100 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink-900">{selected.name}</p>
                    <Badge tone={availability.tone}>{availability.label}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{availability.hint}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                      <dt className="text-[10px] uppercase tracking-wide text-ink-400">Demand</dt>
                      <dd className="font-semibold text-ink-900">{friendlyDemand(selected, category)}</dd>
                    </div>
                    <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                      <dt className="text-[10px] uppercase tracking-wide text-ink-400">Drivers</dt>
                      <dd className="font-semibold text-ink-900">{view.availableDrivers} available</dd>
                    </div>
                    <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                      <dt className="text-[10px] uppercase tracking-wide text-ink-400">Estimated matching</dt>
                      <dd className="font-semibold text-ink-900">~{view.estimatedWaitMin} min</dd>
                    </div>
                    <div className="rounded-lg bg-ink-50 px-2.5 py-2">
                      <dt className="text-[10px] uppercase tracking-wide text-ink-400">
                        {category === VehicleCategory.POOL ? "Pool seats" : "Pending"}
                      </dt>
                      <dd className="font-semibold text-ink-900">
                        {category === VehicleCategory.POOL
                          ? view.pool?.availableSeats ?? 0
                          : view.pendingRequests}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[10px] text-ink-400">
                    Source: {view.source} · updated {new Date(data!.generatedAt).toLocaleTimeString()}
                  </p>
                </div>
              ) : null}

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Better areas for {CATEGORY_LABEL[category].toLowerCase()}
                </p>
                <div className="flex flex-col gap-1.5">
                  {[...areas]
                    .sort((a, b) => b.categories[category].opportunityScore - a.categories[category].opportunityScore)
                    .slice(0, 3)
                    .map((area) => (
                      <button
                        key={area.areaId}
                        type="button"
                        onClick={() => setSelectedId(area.areaId)}
                        className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 px-3 py-2 text-left text-xs hover:bg-ink-100"
                      >
                        <span className="font-medium text-ink-900">{area.name}</span>
                        <span className="text-ink-500">{friendlyDemand(area, category)}</span>
                      </button>
                    ))}
                </div>
              </div>
              <p className="text-[10px] leading-4 text-ink-400">
                Estimates only. High demand does not guarantee driver acceptance. Values never change your pickup automatically.
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
