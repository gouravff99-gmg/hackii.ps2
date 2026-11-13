import {
  AREA_DEMAND_COLORS,
  AREA_OPPORTUNITY_COLORS,
  DemandLevel,
  HEATMAP_COLORS,
} from "@ps02/shared";
import type { AreaHeatmapMode } from "./AreaHeatmap";

const DEMAND_ITEMS: { level: DemandLevel; label: string }[] = [
  { level: DemandLevel.VERY_LOW, label: "Very low" },
  { level: DemandLevel.LOW, label: "Low" },
  { level: DemandLevel.MODERATE, label: "Moderate" },
  { level: DemandLevel.HIGH, label: "High" },
  { level: DemandLevel.VERY_HIGH, label: "Very high" },
  { level: DemandLevel.CRITICAL, label: "Critical" },
];

const AVAILABILITY_ITEMS = [
  { color: HEATMAP_COLORS.availability.GOOD, label: "Good" },
  { color: HEATMAP_COLORS.availability.MODERATE, label: "Moderate" },
  { color: HEATMAP_COLORS.availability.LIMITED, label: "Limited" },
  { color: HEATMAP_COLORS.availability.HIGH_PRESSURE, label: "Very limited" },
  { color: HEATMAP_COLORS.availability.INSUFFICIENT_DATA, label: "Insufficient data" },
];

const OPPORTUNITY_ITEMS = [
  { color: AREA_OPPORTUNITY_COLORS[0], label: "Low" },
  { color: AREA_OPPORTUNITY_COLORS[1], label: "Moderate" },
  { color: AREA_OPPORTUNITY_COLORS[2], label: "Good" },
  { color: AREA_OPPORTUNITY_COLORS[3], label: "High" },
  { color: AREA_OPPORTUNITY_COLORS[4], label: "Very high" },
];

const ITEMS: Record<AreaHeatmapMode, { color: string; label: string }[]> = {
  demand: DEMAND_ITEMS.map((item) => ({
    color: AREA_DEMAND_COLORS[item.level],
    label: item.label,
  })),
  availability: AVAILABILITY_ITEMS,
  opportunity: OPPORTUNITY_ITEMS,
};

const TITLE: Record<AreaHeatmapMode, string> = {
  demand: "Demand",
  availability: "Passenger availability",
  opportunity: "Driver opportunity",
};

export function AreaHeatmapLegend({ mode }: { mode: AreaHeatmapMode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-ink-600">
      <span className="font-medium text-ink-700">{TITLE[mode]}:</span>
      {ITEMS[mode].map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm border border-black/10"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
