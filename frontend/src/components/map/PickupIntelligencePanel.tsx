import { useEffect, useState } from "react";
import type { LatLng, MobilityZoneInsight } from "@ps02/shared";
import { Card, CardBody } from "../ui/Card";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { HeatmapLegend } from "./HeatmapLegend";

const AVAILABILITY_LABEL: Record<MobilityZoneInsight["availability"], string> = {
  GOOD: "Good expected availability",
  MODERATE: "Moderate expected availability",
  LIMITED: "Limited nearby supply",
  HIGH_PRESSURE: "High demand relative to available drivers",
  INSUFFICIENT_DATA: "Insufficient live data",
};

const CONFIDENCE_LABEL: Record<MobilityZoneInsight["confidence"], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

function distanceKm(from: LatLng, to: LatLng): number {
  const radians = Math.PI / 180;
  const dLat = (to.lat - from.lat) * radians;
  const dLng = (to.lng - from.lng) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.lat * radians) * Math.cos(to.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function availabilityRank(zone: MobilityZoneInsight): number {
  if (!zone.dataSources.includes("LIVE")) return -1;
  return {
    GOOD: 3,
    MODERATE: 2,
    LIMITED: 1,
    HIGH_PRESSURE: 0,
    INSUFFICIENT_DATA: -1,
  }[zone.availability];
}

export function PickupIntelligencePanel({
  zones,
  selectedZone,
  pickupZone,
  pickup,
  loading,
  error,
  generatedAt,
  city,
  onUseSuggestion,
}: {
  zones: MobilityZoneInsight[];
  selectedZone: MobilityZoneInsight | null;
  pickupZone: MobilityZoneInsight | null;
  pickup: LatLng | null;
  loading: boolean;
  error: string | null;
  generatedAt?: string;
  city: string;
  onUseSuggestion: (point: LatLng) => void;
}) {
  const [suggestionIgnored, setSuggestionIgnored] = useState(false);
  const suggestion =
    pickup && pickupZone && availabilityRank(pickupZone) >= 0
      ? zones
          .filter((zone) =>
            availabilityRank(zone) > availabilityRank(pickupZone) &&
            zone.availableDrivers > 0 &&
            distanceKm(pickup, zone.center) <= 0.8,
          )
          .sort((a, b) => distanceKm(pickup, a.center) - distanceKm(pickup, b.center))[0]
      : undefined;

  useEffect(() => {
    setSuggestionIgnored(false);
  }, [pickup?.lat, pickup?.lng]);

  return (
    <Card className="mt-3 border-brand-100">
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-900">Pickup intelligence · {city}</h3>
            <p className="mt-1 text-xs text-ink-500">
              Aggregated zone supply and recent requests; not a ride-acceptance guarantee.
            </p>
          </div>
          {loading && !generatedAt ? <Spinner className="h-4 w-4" /> : null}
        </div>

        {error ? (
          <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Live intelligence unavailable: {error}
          </p>
        ) : null}

        <HeatmapLegend mode="availability" />

        {selectedZone ? (
          <div className="rounded-lg bg-ink-50 p-3 text-xs">
            <p className="font-semibold text-ink-900">
              {selectedZone.zoneId} · {AVAILABILITY_LABEL[selectedZone.availability]}
            </p>
            <p className="mt-1 text-ink-600">
              {selectedZone.availableDrivers} nearby available · {selectedZone.currentRequests15m} requests in the last 15 min
            </p>
            <p className="mt-1 text-ink-500">
              Confidence: {CONFIDENCE_LABEL[selectedZone.confidence]} ·{" "}
              {selectedZone.dataSources.length
                ? `Sources: ${selectedZone.dataSources.join(", ").toLowerCase()}`
                : "No live or forecast data"}
            </p>
          </div>
        ) : (
          <p className="text-xs text-ink-500">
            Tap a zone on the map to inspect aggregated availability.
          </p>
        )}

        {suggestion && !suggestionIgnored ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-100 p-3">
            <p className="min-w-[180px] flex-1 text-xs text-ink-700">
              A pickup point about {Math.round(distanceKm(pickup!, suggestion.center) * 1000)} m away
              has healthier observed supply relative to recent requests. Choosing it is optional.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSuggestionIgnored(true)}
                className="text-xs font-medium text-ink-500 hover:text-ink-700"
              >
                Keep my pickup
              </button>
              <Button size="sm" variant="secondary" onClick={() => onUseSuggestion(suggestion.center)}>
                Use suggested point
              </Button>
            </div>
          </div>
        ) : null}

        <p className="text-[11px] text-ink-400">
          {generatedAt ? `Updated ${new Date(generatedAt).toLocaleTimeString()}` : "Waiting for zone data"}
        </p>
      </CardBody>
    </Card>
  );
}
