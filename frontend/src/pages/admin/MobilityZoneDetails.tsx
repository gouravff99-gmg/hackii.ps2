import type { MobilityZoneInsight } from "@ps02/shared";
import { Badge } from "../../components/ui/Badge";
import { Card, CardBody, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

export function MobilityZoneDetails({
  zones,
  selectedZone,
  onSelect,
}: {
  zones: MobilityZoneInsight[];
  selectedZone: MobilityZoneInsight | null;
  onSelect: (zoneId: string) => void;
}) {
  const attentionZones = [...zones]
    .filter((zone) => zone.availability === "HIGH_PRESSURE" || zone.pendingRequests > 0)
    .sort((a, b) => b.demandSupplyGap - a.demandSupplyGap || b.ratio - a.ratio)
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Selected zone" subtitle="Select a colored zone on the map." />
        <CardBody>
          {selectedZone ? (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-ink-900">{selectedZone.zoneId}</h3>
                <Badge tone={selectedZone.availability === "HIGH_PRESSURE" ? "warning" : "neutral"}>
                  {selectedZone.availability.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="text-xs text-ink-500">
                Source: {sourceLabel(selectedZone)} · {selectedZone.confidence.toLowerCase()} confidence
              </p>
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-ink-50 p-3 text-xs">
                <Value label="Current requests · 15m" value={selectedZone.currentRequests15m} />
                <Value label="Requested dropoffs · 15m" value={selectedZone.requestedDropoffs15m} />
                <Value label="Hourly forecast" value={selectedZone.predictedDemand?.toFixed(1) ?? "Unavailable"} />
                <Value label="Available drivers" value={selectedZone.availableDrivers} />
                <Value label="Busy drivers" value={selectedZone.busyDrivers} />
                <Value label="Pending requests" value={selectedZone.pendingRequests} />
                <Value label="Demand / supply" value={selectedZone.ratio.toFixed(2)} />
                <Value label="Pending supply gap" value={selectedZone.demandSupplyGap} />
                <Value
                  label="Avg assign wait · 7d"
                  value={selectedZone.averageAssignmentWaitSeconds === null
                    ? "Insufficient history"
                    : `${selectedZone.averageAssignmentWaitSeconds}s (${selectedZone.assignmentSamples7d})`}
                />
                <Value
                  label="Coverage"
                  value={`${Math.round(selectedZone.availableDrivers /
                    Math.max(1, selectedZone.pendingRequests, selectedZone.currentRequests15m) * 100)}%`}
                />
              </dl>
              <p className="text-xs text-ink-500">
                Zone-level assignment time and measured historical peak trend are unavailable from current records.
              </p>
            </div>
          ) : (
            <EmptyState icon="map-pin" title="Select a zone" description="Zone detail cards use only aggregated counts." />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Operational attention" subtitle="Pending demand and high-pressure zones; no automatic repositioning." />
        <CardBody className="flex flex-col gap-2">
          {attentionZones.length ? attentionZones.map((zone) => (
            <button
              key={zone.zoneId}
              type="button"
              onClick={() => onSelect(zone.zoneId)}
              className="flex items-center justify-between gap-3 rounded-lg border border-ink-100 p-3 text-left hover:bg-ink-50"
            >
              <span>
                <span className="block text-sm font-medium text-ink-900">{zone.zoneId}</span>
                <span className="block text-xs text-ink-500">
                  {zone.pendingRequests} pending · {zone.availableDrivers} available · ratio {zone.ratio.toFixed(2)}
                </span>
              </span>
              <Badge tone={zone.availability === "HIGH_PRESSURE" ? "warning" : "neutral"}>
                gap {zone.demandSupplyGap}
              </Badge>
            </button>
          )) : (
            <EmptyState icon="check" title="No current hotspots" description="No pending or high-pressure zones were reported in the configured area." />
          )}
          <p className="pt-1 text-[11px] text-ink-400">
            This view has no historical driver-destination tracking or manual dispatch controls. Forecasting is hourly; 15/30/60-minute forecasts are not available.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

function sourceLabel(zone: MobilityZoneInsight): string {
  return zone.dataSources.length
    ? zone.dataSources.map((source) => source.toLowerCase()).join(", ")
    : "none";
}

function Value({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-ink-500">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink-900">{value}</dd>
    </div>
  );
}
