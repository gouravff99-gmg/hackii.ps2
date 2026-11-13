import {
  availabilityColor,
  busyColor,
  coverageColor,
  gapColor,
  HEATMAP_COLORS,
  intensityColor,
  opportunityColor,
  supplyColor,
  type MobilityZoneInsight,
} from "@ps02/shared";
import type { MapZoneLayer } from "./MapCanvas";

export function zoneLayerValue(zone: MobilityZoneInsight, layer: MapZoneLayer): number {
  switch (layer) {
    case "currentDemand": return zone.currentRequests15m;
    case "dropoffActivity": return zone.requestedDropoffs15m;
    case "forecast": return zone.predictedDemand ?? 0;
    case "availableDrivers": return zone.availableDrivers;
    case "busyDrivers": return zone.busyDrivers;
    case "demandGap": return zone.demandSupplyGap;
    case "coverage":
      return zone.availableDrivers / Math.max(zone.pendingRequests, zone.currentRequests15m, 1);
    case "availability": return 0;
  }
}

export function zoneLayerColor(zone: MobilityZoneInsight, layer: MapZoneLayer, peak: number): string {
  const value = zoneLayerValue(zone, layer);
  if (layer === "availability") return availabilityColor(zone.availability);
  if (layer === "currentDemand" || layer === "dropoffActivity" || layer === "forecast") {
    return intensityColor(value, peak);
  }
  if (layer === "availableDrivers") return supplyColor(value, peak);
  if (layer === "busyDrivers") return busyColor(value, peak);
  if (layer === "demandGap") return gapColor(value, peak);
  if (layer === "coverage") {
    return coverageColor(value, zone.pendingRequests > 0 || zone.currentRequests15m > 0);
  }
  return HEATMAP_COLORS.noData;
}

export function zoneHeatmapColor(
  zone: MobilityZoneInsight,
  layer: MapZoneLayer,
  mode: "availability" | "opportunity",
  score: number | null | undefined,
  peak: number,
): string {
  return mode === "opportunity" ? opportunityColor(score) : zoneLayerColor(zone, layer, peak);
}

export function zoneHeatmapLabel(
  zone: MobilityZoneInsight,
  layer: MapZoneLayer,
  mode: "availability" | "opportunity",
  score: number | null | undefined,
): string {
  if (mode === "opportunity") return `Opportunity score: ${score ?? "Insufficient data"}/100`;
  if (layer === "availability") return zone.availability.replace(/_/g, " ");
  const labels: Record<MapZoneLayer, string> = {
    availability: "Availability",
    currentDemand: "Requests · 15m",
    dropoffActivity: "Requested dropoffs · 15m",
    forecast: "Hourly predicted demand",
    availableDrivers: "Available drivers",
    busyDrivers: "Busy drivers",
    demandGap: "Pending − available",
    coverage: "Supply coverage",
  };
  const value = zoneLayerValue(zone, layer);
  return `${labels[layer]}: ${value.toFixed(layer === "coverage" ? 2 : 1)}`;
}
