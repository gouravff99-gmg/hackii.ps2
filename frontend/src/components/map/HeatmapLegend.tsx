import {
  HEATMAP_COLORS,
  HEATMAP_THRESHOLDS,
  type ZoneAvailability,
} from "@ps02/shared";
import type { MapZoneLayer } from "./MapCanvas";

type LegendMode = "availability" | "opportunity" | "layer" | "demoDemand";

interface LegendItem {
  color: string;
  label: string;
  range?: string;
}

const AVAILABILITY_ITEMS: { value: ZoneAvailability; label: string }[] = [
  { value: "GOOD", label: "Better supply" },
  { value: "MODERATE", label: "Moderate" },
  { value: "LIMITED", label: "Limited" },
  { value: "HIGH_PRESSURE", label: "Low supply / high pressure" },
  { value: "INSUFFICIENT_DATA", label: "Insufficient data" },
];

const OPPORTUNITY_RANGES = [
  { label: "Low", range: "0–19" },
  { label: "Some", range: "20–39" },
  { label: "Moderate", range: "40–59" },
  { label: "Good", range: "60–79" },
  { label: "High", range: "80–89" },
  { label: "Very high", range: "90–100" },
];

const RELATIVE_RANGES = [
  { label: "Very low", upper: HEATMAP_THRESHOLDS.intensity[0] },
  { label: "Low", upper: HEATMAP_THRESHOLDS.intensity[1] },
  { label: "Moderate", upper: HEATMAP_THRESHOLDS.intensity[2] },
  { label: "High", upper: HEATMAP_THRESHOLDS.intensity[3] },
  { label: "Very high", upper: HEATMAP_THRESHOLDS.intensity[4] },
  { label: "Critical", upper: 1 },
];

function layerLegend(layer: MapZoneLayer): { title: string; items: LegendItem[] } {
  if (layer === "coverage") {
    const labels = ["<25%", "25–49%", "50–99%", "100–199%", "≥200%"];
    const items: LegendItem[] = HEATMAP_COLORS.coverage.map((color, index) => ({
      color,
      label: ["Critical gap", "Limited", "Partial", "Covered", "Strong coverage"][index],
      range: labels[index],
    }));
    items.push({ color: HEATMAP_COLORS.noData, label: "No recent demand" });
    return {
      title: "Available drivers relative to recent demand",
      items,
    };
  }
  if (layer === "demandGap") {
    return {
      title: "Pending requests − available drivers",
      items: [
        { color: HEATMAP_COLORS.surplus[2], label: "Driver surplus", range: "negative gap" },
        { color: HEATMAP_COLORS.neutral, label: "Balanced", range: "0" },
        { color: HEATMAP_COLORS.shortage[0], label: "Small shortage", range: "positive gap" },
        { color: HEATMAP_COLORS.shortage[1], label: "Large shortage", range: "relative" },
        { color: HEATMAP_COLORS.shortage[2], label: "Critical shortage", range: "peak gap" },
      ],
    };
  }
  if (layer === "availableDrivers" || layer === "busyDrivers") {
    const colors = layer === "availableDrivers" ? HEATMAP_COLORS.supply : HEATMAP_COLORS.busy;
    const items: LegendItem[] = colors.map((color, index) => ({
      color,
      label: ["Very low", "Low", "Moderate", "High"][index],
      range: index === 0 ? "≤25% peak" : index === 1 ? "26–50% peak" : index === 2 ? "51–75% peak" : ">75% peak",
    }));
    items.unshift({
      color: HEATMAP_COLORS.noData,
      label: layer === "availableDrivers" ? "No drivers / unavailable" : "No busy drivers / unavailable",
    });
    return {
      title: `${layer === "availableDrivers" ? "Available" : "Busy"} drivers · relative to map peak`,
      items,
    };
  }
  const items: LegendItem[] = RELATIVE_RANGES.map(({ label, upper }, index) => ({
    color: HEATMAP_COLORS.intensity[index],
    label,
    range: `≤${Math.round(upper * 100)}% peak`,
  }));
  items.push({ color: HEATMAP_COLORS.noData, label: "No activity / unavailable" });
  return {
    title: "Relative activity · normalized to highest zone",
    items,
  };
}

function getLegend(mode: LegendMode, layer?: MapZoneLayer): { title: string; items: LegendItem[] } {
  if (mode === "demoDemand") {
    return {
      title: "Simulated district demand score · 0–100",
      items: [
        { color: HEATMAP_COLORS.intensity[0], label: "Very low", range: "1–20" },
        { color: HEATMAP_COLORS.intensity[1], label: "Low", range: "21–40" },
        { color: HEATMAP_COLORS.intensity[2], label: "Moderate", range: "41–60" },
        { color: HEATMAP_COLORS.intensity[3], label: "High", range: "61–80" },
        { color: HEATMAP_COLORS.intensity[4], label: "Very high", range: "81–90" },
        { color: HEATMAP_COLORS.intensity[5], label: "Critical", range: "91–100" },
      ],
    };
  }
  if (mode === "availability") {
    return {
      title: "Expected pickup availability",
      items: AVAILABILITY_ITEMS.map(({ value, label }) => ({
        color: HEATMAP_COLORS.availability[value],
        label,
      })),
    };
  }
  if (mode === "opportunity") {
    const items: LegendItem[] = OPPORTUNITY_RANGES.map((entry, index) => ({
      color: HEATMAP_COLORS.opportunity[index],
      label: entry.label,
      range: entry.range,
    }));
    items.push({ color: HEATMAP_COLORS.noData, label: "Insufficient data" });
    return {
      title: "Opportunity score · not a booking guarantee",
      items,
    };
  }
  return layerLegend(layer ?? "currentDemand");
}

export function HeatmapLegend({
  mode,
  layer,
  className = "",
}: {
  mode: LegendMode;
  layer?: MapZoneLayer;
  className?: string;
}) {
  const legend = getLegend(mode, layer);
  return (
    <div
      className={`rounded-xl border border-ink-100 bg-white/95 p-3 ${className}`}
      aria-label={`Map legend: ${legend.title}`}
    >
      <p className="text-xs font-semibold text-ink-800">{legend.title}</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {legend.items.map((item) => (
          <li key={`${item.label}-${item.range ?? ""}`} className="inline-flex items-center gap-1.5 text-[11px] text-ink-600">
            <span
              className="h-3 w-3 shrink-0 rounded-full border border-black/10"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span>{item.label}{item.range ? ` · ${item.range}` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
