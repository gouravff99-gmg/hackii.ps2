import type { ZoneAvailability } from "./types";

export const HEATMAP_THRESHOLDS = {
  intensity: [0.2, 0.4, 0.6, 0.8, 0.9] as const,
  opportunity: [20, 40, 60, 80, 90] as const,
  coverage: [0.25, 0.5, 1, 2] as const,
} as const;

export const HEATMAP_COLORS = {
  intensity: ["#2563EB", "#06B6D4", "#22C55E", "#FACC15", "#F97316", "#EF4444"],
  availability: {
    GOOD: "#22C55E",
    MODERATE: "#FACC15",
    LIMITED: "#F97316",
    HIGH_PRESSURE: "#EF4444",
    INSUFFICIENT_DATA: "#94A3B8",
  } satisfies Record<ZoneAvailability, string>,
  opportunity: ["#2563EB", "#06B6D4", "#22C55E", "#FACC15", "#F97316", "#EF4444"],
  supply: ["#DCFCE7", "#86EFAC", "#22C55E", "#15803D"],
  busy: ["#F3E8FF", "#C084FC", "#9333EA", "#6B21A8"],
  surplus: ["#DBEAFE", "#60A5FA", "#2563EB"],
  shortage: ["#FEF3C7", "#F97316", "#EF4444"],
  coverage: ["#EF4444", "#F97316", "#FACC15", "#22C55E", "#15803D"],
  noData: "#94A3B8",
  neutral: "#64748B",
} as const;

function colorAt(value: number, thresholds: readonly number[], colors: readonly string[]): string {
  if (!Number.isFinite(value)) return HEATMAP_COLORS.noData;
  const index = thresholds.findIndex((threshold) => value <= threshold);
  return colors[index < 0 ? colors.length - 1 : index];
}

export function intensityColor(value: number, peak: number): string {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(peak) || peak <= 0) {
    return HEATMAP_COLORS.noData;
  }
  const normalized = Math.min(1, value / peak);
  return colorAt(normalized, HEATMAP_THRESHOLDS.intensity, HEATMAP_COLORS.intensity);
}

export function availabilityColor(value: ZoneAvailability): string {
  return HEATMAP_COLORS.availability[value];
}

export function opportunityColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return HEATMAP_COLORS.noData;
  return colorAt(score, HEATMAP_THRESHOLDS.opportunity, HEATMAP_COLORS.opportunity);
}

export function supplyColor(value: number, peak: number): string {
  if (!Number.isFinite(value) || value <= 0) return HEATMAP_COLORS.noData;
  const normalized = Math.min(1, value / Math.max(1, peak));
  return colorAt(normalized, [0.25, 0.5, 0.75], HEATMAP_COLORS.supply);
}

export function busyColor(value: number, peak: number): string {
  if (!Number.isFinite(value) || value <= 0) return HEATMAP_COLORS.noData;
  const normalized = Math.min(1, value / Math.max(1, peak));
  return colorAt(normalized, [0.25, 0.5, 0.75], HEATMAP_COLORS.busy);
}

export function coverageColor(ratio: number, hasDemand: boolean): string {
  if (!hasDemand || !Number.isFinite(ratio)) return HEATMAP_COLORS.noData;
  return colorAt(ratio, HEATMAP_THRESHOLDS.coverage, HEATMAP_COLORS.coverage);
}

export function gapColor(gap: number, peakAbsoluteGap: number): string {
  if (!Number.isFinite(gap)) return HEATMAP_COLORS.noData;
  if (gap === 0) return HEATMAP_COLORS.neutral;
  const palette = gap < 0 ? HEATMAP_COLORS.surplus : HEATMAP_COLORS.shortage;
  const normalized = peakAbsoluteGap > 0 ? Math.min(1, Math.abs(gap) / peakAbsoluteGap) : 1;
  const thresholds = palette.length === 3 ? [0.34, 0.67] : [0.34, 0.67];
  return colorAt(normalized, thresholds, palette);
}
