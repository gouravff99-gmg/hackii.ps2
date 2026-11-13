import { useMemo, useState } from "react";
import {
  CITY,
  type LatLng,
  type MobilityZoneInsight,
  scoreDriverOpportunity,
} from "@ps02/shared";
import { useMobilityIntelligence } from "../../hooks/useMobilityIntelligence";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { EmptyState, ErrorState } from "../ui/EmptyState";
import { MapCanvas, type MapMarker } from "./MapCanvas";
import { HeatmapLegend } from "./HeatmapLegend";

function distanceKm(from: LatLng, to: LatLng): number {
  const radians = Math.PI / 180;
  const dLat = (to.lat - from.lat) * radians;
  const dLng = (to.lng - from.lng) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function DriverOpportunityMap({ location }: { location: LatLng }) {
  const intelligence = useMobilityIntelligence();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const zones = intelligence.data?.zones ?? [];
  const maxObserved = Math.max(0, ...zones.map((zone) =>
    zone.measuredRequests15m + zone.simulatedRequests15m,
  ));
  const maxForecast = Math.max(0, ...zones.map((zone) => zone.predictedDemand ?? 0));
  const scored = useMemo(
    () => zones.map((zone) => ({
      zone,
      distanceKm: distanceKm(location, zone.center),
      ...scoreDriverOpportunity(zone, distanceKm(location, zone.center), maxObserved, maxForecast),
    })),
    [zones, location.lat, location.lng, maxObserved, maxForecast],
  );
  const opportunityScores = useMemo(
    () => scored.reduce<Record<string, number | null>>((scores, entry) => {
      scores[entry.zone.zoneId] = entry.score;
      return scores;
    }, {}),
    [scored],
  );
  const localZones = scored
    .filter((entry) => entry.distanceKm <= 10 && entry.score !== null)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.distanceKm - b.distanceKm);
  const selected = scored.find((entry) => entry.zone.zoneId === selectedZoneId) ?? null;
  const markers: MapMarker[] = [
    { id: "driver-location", ...location, kind: "driver", label: "Your reported location" },
    ...(selected ? [{
      id: "opportunity-zone",
      ...selected.zone.center,
      kind: "active" as const,
      label: `${selected.zone.zoneId} · opportunity ${selected.score ?? "—"}/100`,
    }] : []),
  ];

  const navigateTo = (zone: MobilityZoneInsight) => {
    const url = `https://www.openstreetmap.org/?mlat=${zone.center.lat}&mlon=${zone.center.lng}#map=14/${zone.center.lat}/${zone.center.lng}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card>
      <CardHeader
        title="Ride opportunity zones"
        subtitle="A transparent demand-and-access baseline, not a booking or earnings guarantee."
        action={
          <Badge tone={intelligence.error ? "warning" : "neutral"}>
            {intelligence.data?.city ?? CITY.name} · live updates
          </Badge>
        }
      />
      <CardBody className="flex flex-col gap-4">
        {intelligence.error ? (
          <ErrorState message={`Zone intelligence unavailable: ${intelligence.error}`} onRetry={intelligence.refresh} />
        ) : null}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
          <div className="h-[320px] overflow-hidden rounded-xl border border-ink-100">
            <MapCanvas
              center={location}
              zoom={12}
              markers={markers}
              zoneInsights={zones}
              zoneColorMode="opportunity"
              opportunityScores={opportunityScores}
              selectedZoneId={selectedZoneId}
              onZoneSelect={(zone) => setSelectedZoneId(zone.zoneId)}
            />
          </div>
          <div className="flex flex-col gap-3">
            <HeatmapLegend mode="opportunity" />
            {selected ? (
              <div className="rounded-xl bg-ink-50 p-3 text-xs">
                <p className="font-semibold text-ink-900">
                  {selected.zone.zoneId} · Opportunity {selected.score ?? "—"}/100
                </p>
                <p className="mt-1 text-ink-600">
                  {selected.zone.measuredRequests15m} measured and {selected.zone.simulatedRequests15m} simulated requests / 15m ·{" "}
                  {selected.zone.availableDrivers} available drivers · {selected.distanceKm.toFixed(1)} km away
                </p>
                <p className="mt-1 text-ink-500">{selected.basis}</p>
              </div>
            ) : null}
            {localZones.length ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Recommended nearby</p>
                {localZones.slice(0, 3).map((entry) => (
                  <div key={entry.zone.zoneId} className="flex items-center justify-between gap-2 rounded-lg border border-ink-100 p-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedZoneId(entry.zone.zoneId)}
                      className="min-w-0 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-ink-900">
                        {entry.zone.zoneId} · {entry.score}/100
                      </span>
                      <span className="block text-xs text-ink-500">
                        ~{entry.distanceKm.toFixed(1)} km · {entry.zone.availableDrivers} available
                      </span>
                    </button>
                    <Button size="sm" variant="secondary" onClick={() => navigateTo(entry.zone)}>
                      Navigate
                    </Button>
                  </div>
                ))}
              </div>
            ) : !intelligence.loading && !intelligence.error ? (
              <EmptyState
                icon="layers"
                title="Not enough nearby demand data"
                description="No measured activity, pending demand or forecast currently supports a nearby opportunity recommendation."
              />
            ) : null}
          </div>
        </div>
        <p className="text-[11px] text-ink-400">
          Score weights: observed pressure 40%, forecast 30%, recent requests 20%, accessibility 10%; unavailable inputs are excluded. Forecasts and simulator activity are labelled separately. No earnings estimate is available.
        </p>
        {intelligence.data?.generatedAt ? (
          <p className="text-[11px] text-ink-400">
            Updated {new Date(intelligence.data.generatedAt).toLocaleTimeString()}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
