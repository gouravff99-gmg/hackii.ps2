import { SIM_SPEED } from "@ps02/shared";

/**
 * Runtime clock scaling. The simulator sets this to SIM_SPEED while it runs so
 * offer timeouts and retries feel right at accelerated time (ASSUMPTIONS #14).
 */
let speedFactor = 1;

export function setRuntimeSpeedFactor(factor: number) {
  speedFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
}

export function getRuntimeSpeedFactor(): number {
  return speedFactor;
}

export function isSimulationRunning(): boolean {
  return speedFactor > 1;
}

/** Scale a wall-clock duration by the current speed factor, with a small floor. */
export function scaledMs(durationMs: number, minMs = 200): number {
  return Math.max(minMs, Math.round(durationMs / speedFactor));
}

/** The value advertised to clients for offer countdowns. */
export function scaledSimSpeed(): number {
  return speedFactor;
}

export const BASE_SIM_SPEED = SIM_SPEED;
