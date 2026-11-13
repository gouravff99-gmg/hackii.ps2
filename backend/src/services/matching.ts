import { ALLOC_WEIGHTS, type AllocationBreakdown } from "@ps02/shared";

/** Minutes of effort credited for each completed ride when blending workload. */
export const WORKLOAD_COMPLETED_RIDE_MINUTES = 10;

export interface RankCandidate {
  driverId: string;
  driverName?: string;
  etaMin: number;
  distanceKm: number;
  /** busyMinutesToday + completedToday * WORKLOAD_COMPLETED_RIDE_MINUTES. */
  workload: number;
  /** 0..1 */
  acceptanceRate: number;
  /** Minutes since the driver last became idle. */
  idleMin: number;
}

export type AllocationWeights = {
  eta: number;
  workload: number;
  acceptance: number;
  idle: number;
};

/** Workload blend used by the SMART strategy. */
export function workloadOf(driver: {
  busyMinutesToday: number;
  completedToday: number;
}): number {
  return (
    Math.max(0, driver.busyMinutesToday) +
    Math.max(0, driver.completedToday) * WORKLOAD_COMPLETED_RIDE_MINUTES
  );
}

/** Minutes since `lastIdleSince`; negative clock skew is clamped to zero. */
export function idleMinutes(lastIdleSince: Date | string | null | undefined, now = new Date()): number {
  if (!lastIdleSince) return 0;
  const since = lastIdleSince instanceof Date ? lastIdleSince : new Date(lastIdleSince);
  const value = (now.getTime() - since.getTime()) / 60_000;
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Min-max normalisation across the candidate set. When every candidate shares
 * the same value the dimension cannot differentiate, so it contributes 0.
 */
export function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min < 1e-9) return values.map(() => 0);
  return values.map((value) => (value - min) / (max - min));
}

/**
 * SMART allocation: rank candidates by a weighted, explainable score.
 * Lower is better.
 *
 *   score = w.eta * etaNorm
 *         + w.workload * workloadNorm
 *         + w.acceptance * (1 - acceptanceRate)Norm
 *         - w.idle * idleNorm
 */
export function rankDrivers(
  candidates: RankCandidate[],
  weights: AllocationWeights = ALLOC_WEIGHTS,
): AllocationBreakdown[] {
  if (candidates.length === 0) return [];

  const etaNorm = minMaxNormalize(candidates.map((c) => c.etaMin));
  const workloadNorm = minMaxNormalize(candidates.map((c) => c.workload));
  const acceptanceNorm = minMaxNormalize(candidates.map((c) => 1 - clamp01(c.acceptanceRate)));
  const idleNorm = minMaxNormalize(candidates.map((c) => c.idleMin));

  const ranked = candidates.map((candidate, index) => {
    const normalized = {
      eta: round4(etaNorm[index]),
      workload: round4(workloadNorm[index]),
      acceptance: round4(acceptanceNorm[index]),
      idle: round4(idleNorm[index]),
    };

    const contributions = {
      eta: round4(weights.eta * normalized.eta),
      workload: round4(weights.workload * normalized.workload),
      acceptance: round4(weights.acceptance * normalized.acceptance),
      idle: round4(-weights.idle * normalized.idle),
    };

    const score = round4(
      contributions.eta + contributions.workload + contributions.acceptance + contributions.idle,
    );

    return {
      driverId: candidate.driverId,
      driverName: candidate.driverName,
      rank: 0,
      raw: {
        etaMin: round4(candidate.etaMin),
        workload: round4(candidate.workload),
        acceptanceRate: round4(candidate.acceptanceRate),
        idleMin: round4(candidate.idleMin),
      },
      normalized,
      contributions,
      score,
    } satisfies AllocationBreakdown;
  });

  ranked.sort((a, b) => a.score - b.score || a.raw.etaMin - b.raw.etaMin);
  ranked.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return ranked;
}

/**
 * Baseline allocation used for strategy comparison: closest driver wins.
 * Still returns a full breakdown so the admin UI can compare apples to apples.
 */
export function rankNearestOnly(candidates: RankCandidate[]): AllocationBreakdown[] {
  const ranked = [...candidates].sort(
    (a, b) => a.etaMin - b.etaMin || a.distanceKm - b.distanceKm,
  );

  return ranked.map((candidate, index) => ({
    driverId: candidate.driverId,
    driverName: candidate.driverName,
    rank: index + 1,
    raw: {
      etaMin: round4(candidate.etaMin),
      workload: round4(candidate.workload),
      acceptanceRate: round4(candidate.acceptanceRate),
      idleMin: round4(candidate.idleMin),
    },
    normalized: { eta: 0, workload: 0, acceptance: 0, idle: 0 },
    contributions: {
      eta: round4(candidate.etaMin),
      workload: 0,
      acceptance: 0,
      idle: 0,
    },
    score: round4(candidate.etaMin),
  }));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Human-readable reason for the top pick, shown in the admin "why" panel. */
export function explainTopPick(breakdown: AllocationBreakdown[]): string {
  const top = breakdown[0];
  if (!top) return "No available drivers within range.";
  const parts: string[] = [];
  if (top.normalized.eta <= 0.25) parts.push("short pickup ETA");
  if (top.normalized.workload <= 0.25) parts.push("light current workload");
  if (top.normalized.acceptance <= 0.25) parts.push("high acceptance rate");
  if (top.normalized.idle >= 0.75) parts.push("has been idle the longest");
  if (parts.length === 0) parts.push("best overall weighted score");
  return `Chosen for ${parts.join(", ")}.`;
}
