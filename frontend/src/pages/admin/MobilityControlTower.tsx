import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CITY,
  SOCKET_EVENTS,
  type AdminOverviewMetrics,
} from "@ps02/shared";
import type { MapZoneLayer } from "../../components/map/MapCanvas";
import { MapCanvas } from "../../components/map/MapCanvas";
import { HeatmapLegend } from "../../components/map/HeatmapLegend";
import { useAsync } from "../../hooks/useAsync";
import { useMobilityIntelligence } from "../../hooks/useMobilityIntelligence";
import { useSocketEvent } from "../../hooks/useSocketEvent";
import { adminApi } from "../../services/adminApi";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Spinner } from "../../components/ui/Spinner";
import { StatCard } from "../../components/ui/StatCard";
import { formatWait } from "../../utils/format";
import { MobilityZoneDetails } from "./MobilityZoneDetails";

const LAYER_OPTIONS: { id: MapZoneLayer; label: string; description: string }[] = [
  { id: "currentDemand", label: "Current demand", description: "Requests from the last 15 minutes" },
  { id: "dropoffActivity", label: "Requested dropoffs", description: "Ride destinations from the last 15 minutes" },
  { id: "forecast", label: "Predicted demand", description: "Model forecast for the selected hour" },
  { id: "availableDrivers", label: "Available drivers", description: "Fresh, eligible drivers ready for rides" },
  { id: "busyDrivers", label: "Busy drivers", description: "Fresh, eligible drivers on rides" },
  { id: "demandGap", label: "Demand-supply gap", description: "Pending requests minus available drivers" },
  { id: "coverage", label: "Service coverage", description: "Available drivers relative to recent demand" },
];

const FORECAST_HOURS = [
  { label: "Now", hour: new Date().getHours() },
  { label: "Morning", hour: 9 },
  { label: "Afternoon", hour: 14 },
  { label: "Evening", hour: 18 },
  { label: "Night", hour: 22 },
];

export function MobilityControlTower() {
  const [hour, setHour] = useState(() => new Date().getHours());
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapZoneLayer>("currentDemand");
  const intelligence = useMobilityIntelligence(30_000, hour);
  const overview = useAsync<AdminOverviewMetrics>(() => adminApi.overview(), []);
  const zones = intelligence.data?.zones ?? [];
  const selectedZone = zones.find((zone) => zone.zoneId === selectedZoneId) ?? null;

  const refresh = () => {
    intelligence.refresh();
    void overview.reload();
  };
  const refreshOverview = useCallback(() => {
    void overview.reload();
  }, [overview.reload]);
  useSocketEvent(SOCKET_EVENTS.ZONES_UPDATE, refreshOverview);

  useEffect(() => {
    const timer = window.setInterval(refreshOverview, 30_000);
    return () => window.clearInterval(timer);
  }, [refreshOverview]);

  const metrics = useMemo(() => ({
    available: zones.reduce((sum, zone) => sum + zone.availableDrivers, 0),
    busy: zones.reduce((sum, zone) => sum + zone.busyDrivers, 0),
    pending: zones.reduce((sum, zone) => sum + zone.pendingRequests, 0),
    highPressure: zones.filter((zone) => zone.availability === "HIGH_PRESSURE").length,
    coveredZones: zones.filter((zone) => zone.availableDrivers > 0).length,
  }), [zones]);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="mobility-tower-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="mobility-tower-title" className="text-xl font-semibold text-ink-900">
            Mobility operations control tower
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            {intelligence.data?.city ?? CITY.name} configured grid · aggregated operational data
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="forecast-hour" className="text-xs font-medium text-ink-500">
            Forecast hour
          </label>
          <select
            id="forecast-hour"
            value={hour}
            onChange={(event) => setHour(Number(event.target.value))}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-800"
          >
            {FORECAST_HOURS.map((preset) => (
              <option key={preset.label} value={preset.hour}>
                {preset.label} · {String(preset.hour).padStart(2, "0")}:00
              </option>
            ))}
            <option value={hour}>Custom · {String(hour).padStart(2, "0")}:00</option>
          </select>
          <Button size="sm" variant="secondary" loading={intelligence.loading || overview.loading} onClick={refresh}>
            Refresh
          </Button>
        </div>
      </div>

      {intelligence.error ? (
        <Card><ErrorState message={intelligence.error} onRetry={refresh} /></Card>
      ) : null}
      {overview.error ? (
        <Card><ErrorState message={`Operational KPIs unavailable: ${overview.error}`} onRetry={() => void overview.reload()} /></Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active rides"
          value={overview.data?.activeRides ?? "—"}
          hint="Backend ride states in progress"
          icon="car"
          tone="brand"
        />
        <StatCard
          label="Online drivers"
          value={overview.data ? overview.data.availableDrivers + overview.data.busyDrivers : "—"}
          hint="Status counts; includes stale positions"
          icon="users"
          tone="success"
        />
        <StatCard
          label="Pending requests"
          value={intelligence.data ? metrics.pending : "—"}
          hint="Unmatched requests in configured city zones"
          icon="activity"
          tone="warning"
        />
        <StatCard
          label="Average assignment wait"
          value={!overview.data || overview.data.averagePassengerWaitSec === null
            ? "—"
            : formatWait(overview.data.averagePassengerWaitSec)}
          hint={overview.data
            ? `${overview.data.acceptedRidesToday} accepted rides with wait data · city-wide`
            : "Today's accepted rides · city-wide"}
          icon="clock"
          tone="violet"
        />
        <StatCard
          label="Fresh available supply"
          value={intelligence.data ? metrics.available : "—"}
          hint={`Fresh ≤${intelligence.data?.staleLocationThresholdSeconds ?? 120}s · eligible drivers`}
          icon="navigation"
          tone="success"
        />
        <StatCard
          label="Busy in configured zones"
          value={intelligence.data ? metrics.busy : "—"}
          hint="Eligible drivers with fresh location"
          icon="activity"
          tone="warning"
        />
        <StatCard
          label="High-pressure zones"
          value={intelligence.data ? metrics.highPressure : "—"}
          hint="Recent request pressure vs available supply"
          icon="layers"
          tone="warning"
        />
        <StatCard
          label="Zones with available supply"
          value={intelligence.data ? `${metrics.coveredZones}/${zones.length}` : "—"}
          hint="Configured 1 km cells with fresh supply"
          icon="map-pin"
          tone="brand"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title="Aggregated zone map"
            subtitle={`Current counts use trailing ${intelligence.data?.windowMinutes ?? 15} minutes. Forecast layer uses the selected hourly model output.`}
          />
          <CardBody className="flex flex-col gap-3">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Choose one map layer
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {LAYER_OPTIONS.map((layer) => (
                  <label
                    key={layer.id}
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition ${
                      activeLayer === layer.id
                        ? "border-brand-300 bg-brand-50"
                        : "border-ink-100 bg-white hover:bg-ink-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="admin-zone-layer"
                      checked={activeLayer === layer.id}
                      onChange={() => setActiveLayer(layer.id)}
                      className="mt-0.5 accent-brand-600"
                    />
                    <span>
                      <span className="block text-xs font-semibold text-ink-800">{layer.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-4 text-ink-500">{layer.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="h-[420px] overflow-hidden rounded-xl border border-ink-100">
              {intelligence.loading && !zones.length ? (
                <div className="flex h-full items-center justify-center"><Spinner className="h-6 w-6" /></div>
              ) : zones.length ? (
                <MapCanvas
                  center={CITY.center}
                  zoom={12}
                  zoneInsights={zones}
                  selectedZoneId={selectedZoneId}
                  onZoneSelect={(zone) => setSelectedZoneId(zone.zoneId)}
                  visibleZoneLayers={[activeLayer]}
                />
              ) : (
                <EmptyState icon="map-pin" title="No zone data" description="No configured zone snapshot is available." />
              )}
            </div>
            <HeatmapLegend mode="layer" layer={activeLayer} />
            <p className="text-xs text-ink-500">
              Colors explain the selected layer only. Exact passenger and driver positions are not plotted.
              {intelligence.data?.generatedAt
                ? ` Updated ${new Date(intelligence.data.generatedAt).toLocaleTimeString()}.`
                : ""}
            </p>
          </CardBody>
        </Card>

        <MobilityZoneDetails
          zones={zones}
          selectedZone={selectedZone}
          onSelect={setSelectedZoneId}
        />
      </div>
    </section>
  );
}
