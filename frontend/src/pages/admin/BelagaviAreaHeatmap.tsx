import { useMemo, useState } from "react";
import {
  DEMAND_LEVEL_LABEL,
  DEMAND_TIME_WINDOWS,
  DemoScenario,
  VehicleCategory,
  resolveTimeWindow,
  type AreaDemandView,
  type DemandWindowId,
} from "@ps02/shared";
import { useAreaDemand } from "../../hooks/useAreaDemand";
import { AreaHeatmap, areaLayerColor, type AreaHeatmapMode } from "../../components/map/AreaHeatmap";
import { AreaHeatmapLegend } from "../../components/map/AreaHeatmapLegend";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";

const SCENARIOS: { id: DemoScenario; label: string }[] = [
  { id: DemoScenario.NORMAL, label: "Normal weekday" },
  { id: DemoScenario.MORNING_PEAK, label: "Morning peak" },
  { id: DemoScenario.EVENING_PEAK, label: "Evening peak" },
  { id: DemoScenario.WEEKEND, label: "Weekend" },
  { id: DemoScenario.LOW_DEMAND, label: "Low demand" },
  { id: DemoScenario.HIGH_DEMAND_EVENT, label: "High-demand event" },
];

const CATEGORIES: { id: VehicleCategory; label: string }[] = [
  { id: VehicleCategory.BIKE, label: "Bike" },
  { id: VehicleCategory.CAR, label: "Car" },
  { id: VehicleCategory.POOL, label: "Pooling" },
];

const MODES: { id: AreaHeatmapMode; label: string }[] = [
  { id: "demand", label: "Demand" },
  { id: "availability", label: "Availability" },
  { id: "opportunity", label: "Opportunity" },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const selectClass =
  "h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-800 focus:border-brand-400 focus:outline-none";

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-ink-50 px-3 py-2">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  );
}

function AreaTable({
  areas,
  category,
  selectedId,
  onSelect,
}: {
  areas: AreaDemandView[];
  category: VehicleCategory;
  selectedId: string | null;
  onSelect: (areaId: string) => void;
}) {
  const rows = useMemo(
    () =>
      [...areas].sort(
        (a, b) => b.categories[category].requests - a.categories[category].requests,
      ),
    [areas, category],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-[11px] uppercase tracking-wide text-ink-400">
            <th className="py-2 pr-3 font-medium">Area</th>
            <th className="py-2 pr-3 font-medium">Bike</th>
            <th className="py-2 pr-3 font-medium">Car</th>
            <th className="py-2 pr-3 font-medium">Pooling</th>
            <th className="py-2 pr-3 font-medium">Seats</th>
            <th className="py-2 font-medium">Peak</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((area) => (
            <tr
              key={area.areaId}
              onClick={() => onSelect(area.areaId)}
              className={`cursor-pointer transition ${
                area.areaId === selectedId ? "bg-brand-50" : "hover:bg-ink-50"
              }`}
            >
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-2 font-medium text-ink-900">
                  <span
                    className="h-2.5 w-2.5 rounded-sm border border-black/10"
                    style={{ backgroundColor: areaLayerColor(area.categories[category], "demand") }}
                  />
                  {area.name}
                </span>
              </td>
              {CATEGORIES.map((option) => {
                const view = area.categories[option.id];
                return (
                  <td key={option.id} className="py-2.5 pr-3 text-ink-700">
                    <span className="font-medium">{DEMAND_LEVEL_LABEL[view.demandLevel]}</span>
                    <span className="ml-1 text-xs text-ink-400">({view.requests})</span>
                  </td>
                );
              })}
              <td className="py-2.5 pr-3 text-ink-700">
                {area.categories[VehicleCategory.POOL].pool?.availableSeats ?? 0}
              </td>
              <td className="py-2.5 text-ink-600">{area.peakWindowLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BelagaviAreaHeatmap() {
  const [scenario, setScenario] = useState<DemoScenario>(DemoScenario.NORMAL);
  const [windowId, setWindowId] = useState<DemandWindowId>(
    () => resolveTimeWindow(new Date().getHours()).id,
  );
  const [day, setDay] = useState(() => new Date().getDay());
  const [category, setCategory] = useState<VehicleCategory>(VehicleCategory.BIKE);
  const [source, setSource] = useState<"auto" | "demo" | "live">("auto");
  const [mode, setMode] = useState<AreaHeatmapMode>("demand");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const state = useAreaDemand({
    scenario,
    window: windowId,
    day,
    category,
    source,
  });

  const data = state.data;
  const areas = data?.areas ?? [];
  const selected = areas.find((area) => area.areaId === selectedId) ?? null;
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return areas;
    return areas.filter(
      (area) =>
        area.name.toLowerCase().includes(query) ||
        area.kind.toLowerCase().includes(query),
    );
  }, [areas, search]);

  return (
    <Card>
      <CardHeader
        title="Belagavi area demand heatmap"
        subtitle="Operational zones · Bike / Car / Pooling · time-of-day and scenario filters"
        action={
          <Badge tone={data?.source === "LIVE" ? "success" : "warning"}>
            {data?.source ?? "DEMO"} DATA
          </Badge>
        }
      />
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Scenario
            <select
              className={selectClass}
              value={scenario}
              onChange={(event) => setScenario(event.target.value as DemoScenario)}
            >
              {SCENARIOS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Time window
            <select
              className={selectClass}
              value={windowId}
              onChange={(event) => setWindowId(event.target.value as DemandWindowId)}
            >
              {DEMAND_TIME_WINDOWS.map((option) => (
                <option key={option.id} value={option.id}>{option.label} ({option.shortLabel})</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Day
            <select
              className={selectClass}
              value={day}
              onChange={(event) => setDay(Number(event.target.value))}
            >
              {DAYS.map((label, index) => (
                <option key={label} value={index}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Category
            <select
              className={selectClass}
              value={category}
              onChange={(event) => setCategory(event.target.value as VehicleCategory)}
            >
              {CATEGORIES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Source
            <select
              className={selectClass}
              value={source}
              onChange={(event) => setSource(event.target.value as "auto" | "demo" | "live")}
            >
              <option value="auto">Auto (demo + live)</option>
              <option value="demo">Demo only</option>
              <option value="live">Live only</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-medium text-ink-500">
            Find area
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tilakwadi, hub, industrial…"
              className={`${selectClass} min-w-44`}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setMode(option.id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  mode === option.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-ink-600">
            <span><strong className="text-ink-900">{data?.windowLabel ?? "—"}</strong></span>
            <span>{data?.totals.requests ?? 0} requests</span>
            <span>{data?.totals.availableDrivers ?? 0} available</span>
            <span>{data?.totals.poolAvailableSeats ?? 0} pool seats</span>
          </div>
        </div>

        {state.loading && !data ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={() => void state.refresh()} />
        ) : areas.length === 0 ? (
          <EmptyState
            icon="layers"
            title="No area data"
            description="Change the filters or live source to load operational-zone demand."
          />
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
              <div className="flex flex-col gap-2">
                <AreaHeatmap
                  areas={visible}
                  category={category}
                  mode={mode}
                  selectedAreaId={selectedId}
                  onSelectArea={setSelectedId}
                />
                <AreaHeatmapLegend mode={mode} />
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Bike requests" value={data!.totals.bikeRequests} />
                  <Metric label="Car requests" value={data!.totals.carRequests} />
                  <Metric label="Pool requests" value={data!.totals.poolRequests} />
                  <Metric label="Pool cars" value={data!.totals.poolActiveVehicles} />
                </div>
                {selected ? (
                  <div className="rounded-xl border border-ink-100 p-3">
                    <p className="text-sm font-semibold text-ink-900">{selected.name}</p>
                    <p className="mt-0.5 text-xs text-ink-500">{selected.note}</p>
                    <p className="mt-1 text-[11px] text-ink-400">
                      {selected.district} district · {selected.taluk} taluk · {selected.kind.replace("_", " ").toLowerCase()}
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {CATEGORIES.map((option) => {
                        const view = selected.categories[option.id];
                        return (
                          <div key={option.id} className="rounded-lg bg-ink-50 p-2">
                            <p className="text-[10px] uppercase tracking-wide text-ink-400">{option.label}</p>
                            <p className="text-sm font-semibold text-ink-900">
                              {DEMAND_LEVEL_LABEL[view.demandLevel]}
                            </p>
                            <p className="text-[10px] text-ink-500">{view.requests} req · {view.availableDrivers} drivers</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-ink-400">
                      Sources: {selected.sources.join(", ")} · confidence {selected.dataConfidence}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
                    Click an operational zone on the map or a row in the table for details.
                  </div>
                )}
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">
                  {data!.disclaimer}
                </p>
              </div>
            </div>

            <AreaTable
              areas={visible}
              category={category}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </>
        )}
      </CardBody>
    </Card>
  );
}
