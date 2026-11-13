/**
 * Single source of truth for all tunable system parameters.
 * Change CITY / bounds here only; zones are derived from it.
 */

export const CITY = {
  name: "Bengaluru",
  center: { lat: 12.9716, lng: 77.5946 },
  /** ~20 km x 20 km bounding box around the centre. */
  bounds: {
    north: 13.06202,
    south: 12.88118,
    east: 77.68678,
    west: 77.50242,
  },
} as const;

/** Approximate mainland India bounds used for passenger booking and map selection. */
export const INDIA_BOUNDS = {
  north: 37.6,
  south: 6.5,
  east: 97.5,
  west: 68.0,
} as const;

export const INDIA_CENTER = { lat: 22.5, lng: 82.75 } as const;

export const ZONE_SIZE_KM = 1;

export const FARE = {
  base: 40,
  perKm: 12,
  perMin: 1.5,
  minFare: 60,
} as const;

/**
 * Service-category fare cards. CAR reuses the existing FARE card so legacy
 * behaviour is unchanged. POOL applies `POOL.fareDiscount` after the car fare.
 */
export const FARE_BY_CATEGORY = {
  BIKE: { base: 20, perKm: 6.5, perMin: 0.8, minFare: 25 },
  CAR: FARE,
  POOL: FARE,
} as const;

export const SIM = {
  speed: 8,
  numDrivers: 25,
  locationEmitMs: 1_000,
  proactiveDispatchIntervalMs: 5 * 60 * 1_000,
} as const;

export const NUM_DRIVERS = SIM.numDrivers;
export const SIM_SPEED = SIM.speed;

export const ALLOC_WEIGHTS = {
  eta: 0.45,
  workload: 0.2,
  acceptance: 0.15,
  idle: 0.2,
} as const;

export const TIMEOUTS = {
  /** Simulated-scaled driver offer timeout. */
  driverResponseMs: 15_000,
  /** Reassign when actual arrival ETA exceeds promised by this fraction. */
  delayThreshold: 0.3,
} as const;

export const POOL = {
  pickupRadiusKm: 1.5,
  dropRadiusKm: 2,
  maxDetour: 0.3,
  maxRiders: 3,
  scanIntervalMs: 30_000,
  /** Pooled rider pays soloFare * fareDiscount. */
  fareDiscount: 0.75,
} as const;

export const SURGE = {
  factor: 0.5,
  min: 1.0,
  max: 2.5,
  supplyFloor: 1,
} as const;

export const MATCHING = {
  candidateRadiusKm: 5,
} as const;
