import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CITY,
  ZONE_SIZE_KM,
  type ForecastCell,
  type ZoneSnapshot,
} from "@ps02/shared";
import { useAsync } from "../../hooks/useAsync";
import { adminApi } from "../../services/adminApi";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { Badge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { Icon } from "../../components/ui/Icon";

type HeatMode = "predicted" | "actual" | "difference";

const MODE_LABEL: Record<HeatMode, string> = {
  predicted: "Predicted",
  actual: "Actual",
  difference: "Difference",
};

function parseZone(zoneId: string): { row: number; col: number } | null {
  const match = /^r(\d+)c(\d+)$/.exec(zoneId);
  if (!match) return null;
  return { row: Number(match[1]), col: Number(match[2]) };
}

function cellValue(cell: ForecastCell, mode: HeatMode): number {
  if (mode === "predicted") return cell.predictedDemand;
  if (mode === "actual") return cell.actualDemand ?? 0;
  return cell.difference ?? 0;
}

function heatColor(value: number, max: number, mode: HeatMode): string {
  if (mode === "difference") {
    if (Math.abs(value) < 0.05) return "rgba(102,112,133,0.10)";
    const alpha = Math.min(0.92, 0.18 + (Math.abs(value) / Math.max(max, 0.0001)) * 0.74);
    return value > 0 ? `rgba(239,68,68,${alpha})` : `rgba(59,130,246,${alpha})`;
  }
  if (value <= 0) return "rgba(102,112,133,0.08)";
  const alpha = Math.min(0.94, 0.16 + (value / Math.max(max, 0.0001)) * 0.78);
  return mode === "predicted" ? `rgba(53,102,246,${alpha})` : `rgba(16,185,129,${alpha})`;
}

function Heatmap({
  cells,
  mode,
  label,
}: {
  cells: ForecastCell[];
  mode: HeatMode;
  label: string;
}) {
  const positioned = cells
    .map((cell) => ({ cell, position: parseZone(cell.zoneId) }))
    .filter((entry): entry is { cell: ForecastCell; position: { row: number; col: number } } =>
      Boolean(entry.position),
    );

  const rows = Math.max(...positioned.map((entry) => entry.position.row)) + 1;
  const cols = Math.max(...positioned.map((entry) => entry.position.col)) + 1;
  const max = Math.max(...positioned.map((entry) => Math.abs(cellValue(entry.cell, mode))), 1);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`${label} demand heatmap`}
      >
        {Array.from({ length: rows * cols }, (_, index) => {
          const row = Math.floor(index / cols);
          const col = index % cols;
          const entry = positioned.find(
            (candidate) => candidate.position.row === row && candidate.position.col === col,
          );
          if (!entry) {
            return <span key={`${row}-${col}`} className="aspect-square rounded-[3px] bg-ink-100/60" />;
          }
          const value = cellValue(entry.cell, mode);
          return (
            <span
              key={entry.cell.zoneId}
              title={`${entry.cell.zoneId} · ${MODE_LABEL[mode]} ${value.toFixed(1)}`}
              className="aspect-square rounded-[3px] transition hover:ring-2 hover:ring-ink-900/30"
              style={{ backgroundColor: heatColor(value, max, mode) }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-ink-400">
        <span>{CITY.name} · {ZONE_SIZE_KM} km zones · row 0 = north</span>
        <span className="flex items-center gap-2">
          <span>{mode === "difference" ? `-${max.toFixed(0)}` : "0"}</span>
          <span className="h-2 w-24 rounded-full bg-gradient-to-r from-brand-100 via-brand-400 to-brand-700" />
          <span>{max.toFixed(0)}</span>
        </span>
      </div>
    </div>
  );
}

function ZoneTable({ zones }: { zones: ZoneSnapshot[] }) {
  const ranked = useMemo(
    () => [...zones].sort((a, b) => b.surge - a.surge).slice(0, 10),
    [zones],
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
            <th className="py-2.5 pr-3 font-medium">Zone</th>
            <th className="py-2.5 pr-3 font-medium">Demand</th>
            <th className="py-2.5 pr-3 font-medium">Supply</th>
            <th className="py-2.5 pr-3 font-medium">Ratio</th>
            <th className="py-2.5 font-medium">Surge</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {ranked.map((zone) => (
            <tr key={zone.zoneId}>
              <td className="py-2.5 pr-3 font-medium text-ink-900">{zone.zoneId}</td>
              <td className="py-2.5 pr-3 text-ink-600">{zone.demand.toFixed(1)}</td>
              <td className="py-2.5 pr-3 text-ink-600">{zone.supply}</td>
              <td className="py-2.5 pr-3 text-ink-600">{zone.ratio.toFixed(2)}</td>
              <td className="py-2.5">
                <Badge tone={zone.surge > 1.5 ? "danger" : zone.surge > 1.05 ? "warning" : "success"}>
                  ×{zone.surge.toFixed(2)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DemandIntelligence() {
  const [hour, setHour] = useState(() => new Date().getHours());
  const [mode, setMode] = useState<HeatMode>("predicted");

  const zonesState = useAsync(() => adminApi.zones(hour), [hour]);
  const forecastState = useAsync(() => adminApi.forecast(hour), [hour]);

  const zones = zonesState.data?.zones ?? [];
  const recommendations = zonesState.data?.recommendations ?? [];
  const forecastCells = forecastState.data?.cells ?? [];
  const totals = forecastState.data?.totals;

  const availableSupply = zones.reduce((sum, zone) => sum + zone.supply, 0);
  const totalDemand = zones.reduce((sum, zone) => sum + zone.demand, 0);
  const averageSurge = zones.length
    ? zones.reduce((sum, zone) => sum + zone.surge, 0) / zones.length
    : 1;

  const topZones = useMemo(
    () =>
      forecastCells.slice(0, 10).map((cell) => ({
        zone: cell.zoneId,
        predicted: cell.predictedDemand,
        actual: cell.actualDemand ?? 0,
      })),
    [forecastCells],
  );

  const loading = zonesState.loading || forecastState.loading;
  const error = zonesState.error ?? forecastState.error;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Demand intelligence"
        description="Forecast demand against observed demand, see zone pressure, and act on repositioning suggestions."
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
            <Icon name="clock" size={15} className="text-ink-400" />
            <input
              type="range"
              min={0}
              max={23}
              value={hour}
              onChange={(event) => setHour(Number(event.target.value))}
              aria-label="Hour of day"
              className="h-1 w-32 cursor-pointer accent-brand-600"
            />
            <span className="w-12 text-sm font-medium text-ink-900">
              {String(hour).padStart(2, "0")}:00
            </span>
            <button
              type="button"
              onClick={() => setHour(new Date().getHours())}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Now
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center text-ink-400">
          <Spinner className="h-6 w-6" />
        </div>
      ) : error ? (
        <Card>
          <ErrorState
            message={error}
            onRetry={() => {
              void zonesState.reload();
              void forecastState.reload();
            }}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Predicted demand"
              value={totals ? totals.predicted.toFixed(0) : "—"}
              hint={`Hour ${String(hour).padStart(2, "0")}:00 · all zones`}
              icon="chart"
              tone="brand"
            />
            <StatCard
              label="Actual demand"
              value={totals ? totals.actual.toFixed(0) : "—"}
              hint="Mean observed history for this hour"
              icon="activity"
              tone="success"
            />
            <StatCard
              label="Forecast gap"
              value={totals ? totals.difference.toFixed(0) : "—"}
              hint="Predicted minus actual"
              icon="alert"
              tone="warning"
            />
            <StatCard
              label="Live supply"
              value={availableSupply}
              hint={`Avg surge ×${averageSurge.toFixed(2)} · ${totalDemand.toFixed(0)} live demand`}
              icon="car"
              tone="violet"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Demand heatmap"
                subtitle={`${forecastCells.length} forecast cells · ${String(hour).padStart(2, "0")}:00`}
                action={
                  forecastCells.length > 0 ? (
                    <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
                      {(Object.keys(MODE_LABEL) as HeatMode[]).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setMode(option)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                            mode === option ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"
                          }`}
                        >
                          {MODE_LABEL[option]}
                        </button>
                      ))}
                    </div>
                  ) : null
                }
              />
              <CardBody>
                {forecastCells.length > 0 ? (
                  <Heatmap cells={forecastCells} mode={mode} label={MODE_LABEL[mode]} />
                ) : zones.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      No ML forecast rows for this hour yet. Showing live observed demand from the
                      last 15 minutes. Run <span className="font-mono">ml/train.py</span> to populate
                      forecasts.
                    </p>
                    <Heatmap
                      cells={zones.map((zone) => ({
                        zoneId: zone.zoneId,
                        hourOfDay: hour,
                        predictedDemand: zone.demand,
                      }))}
                      mode="predicted"
                      label="Live demand"
                    />
                  </div>
                ) : (
                  <EmptyState
                    icon="layers"
                    title="No zone data yet"
                    description="Zone demand appears once rides are requested or forecasts are loaded."
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Repositioning recommendations"
                subtitle="Idle supply moved from surplus to deficit zones"
                action={<Badge tone="info">{recommendations.length}</Badge>}
              />
              <CardBody className={recommendations.length ? "divide-y divide-ink-100 py-0" : ""}>
                {recommendations.length > 0 ? (
                  recommendations.map((recommendation, index) => (
                    <div key={`${recommendation.fromZone}-${recommendation.toZone}-${index}`} className="py-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-ink-900">
                        <span>{recommendation.fromZone}</span>
                        <Icon name="arrow-right" size={14} className="text-ink-400" />
                        <span>{recommendation.toZone}</span>
                        <Badge tone="warning">{recommendation.driversToMove} drivers</Badge>
                      </div>
                      <p className="mt-1 text-xs text-ink-500">{recommendation.reason}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon="navigation"
                    title="No moves needed"
                    description="Supply and demand are balanced for this hour. Recommendations appear when a zone is under-supplied."
                  />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Predicted vs actual by zone"
                subtitle="Top 10 zones by predicted demand"
              />
              <CardBody>
                {topZones.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topZones} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                        <XAxis dataKey="zone" tick={{ fontSize: 11, fill: "#8d97a8" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#8d97a8" }} />
                        <ChartTooltip
                          formatter={(value) => Number(value).toFixed(1)}
                          contentStyle={{ borderRadius: 12, borderColor: "#dfe3ea", fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="predicted" name="Predicted" fill="#3566f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="Actual" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    icon="chart"
                    title="Forecast comparison unavailable"
                    description="Load demand forecasts to compare predicted demand with observed history."
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Zone pressure" subtitle="Highest surge first" />
              <CardBody>
                {zones.length > 0 ? (
                  <ZoneTable zones={zones} />
                ) : (
                  <EmptyState icon="layers" title="No zones" description="Zone data is not available." />
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
