import type {
  ChaosAction,
  DriverStatus,
  DriverDocumentType,
  DriverOnboardingStatus,
  DocumentReviewStatus,
  RideStatus,
  Role,
  Strategy,
  VehicleType,
} from "./enums";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceSuggestion extends LatLng {
  placeId: string;
  displayName: string;
  type?: string;
}

export interface BBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** A zone id is "r{row}c{col}", e.g. "r3c7". */
export type ZoneId = string;

/* ------------------------------------------------------------------ */
/* Persistence-shaped types (mirror Prisma models, no Prisma imports)  */
/* ------------------------------------------------------------------ */

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export interface Driver {
  id: string;
  userId: string;
  vehicleType: VehicleType | string;
  status: DriverStatus;
  lat: number;
  lng: number;
  acceptanceRate: number;
  completedToday: number;
  busyMinutesToday: number;
  lastIdleSince: string;
  isSimulated: boolean;
}

export interface DriverOnboardingDocument {
  id: string;
  type: DriverDocumentType;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentReviewStatus;
  expiryDate?: string | null;
  rejectionReason?: string | null;
  uploadedAt: string;
}

export interface DriverOnboardingApplication {
  driverId: string;
  status: DriverOnboardingStatus;
  adminComments?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  documents: DriverOnboardingDocument[];
  safetyChecklist: Record<string, boolean>;
  safetyTrainingComplete: boolean;
  bankAccountLast4?: string | null;
  bankIfsc?: string | null;
  completionPercent: number;
  updatedAt: string;
}

export interface DriverVerificationHistoryEntry {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: string;
  actorName: string;
}

export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string | null;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
  status: RideStatus;
  distanceKm: number;
  etaMin: number;
  fareEstimate: number;
  fareFinal?: number | null;
  surgeMultiplier: number;
  requestedAt: string;
  acceptedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  promisedEtaMin: number;
  poolGroupId?: string | null;
  allocationScores?: AllocationBreakdown[] | null;
  simRunId?: string | null;
}

export interface RideEventRecord {
  id: string;
  rideId: string;
  type: string;
  message: string;
  payload?: unknown;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Routing / fare                                                      */
/* ------------------------------------------------------------------ */

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  /** Ordered points along the route; empty for the Haversine fallback. */
  polyline: LatLng[];
  source: "osrm" | "haversine";
}

export interface EstimateRequest {
  pickup: LatLng;
  drop: LatLng;
}

export interface EstimateResponse {
  distanceKm: number;
  /** Passenger trip duration in minutes. */
  etaMin: number;
  durationMin: number;
  fare: number;
  surge: number;
  polyline: LatLng[];
  source: "osrm" | "haversine";
}

export interface NearbyDriver {
  id: string;
  name: string;
  vehicleType: string;
  lat: number;
  lng: number;
  distanceKm: number;
  etaMin: number;
}

/* ------------------------------------------------------------------ */
/* Allocation (Feature 4)                                              */
/* ------------------------------------------------------------------ */

export interface AllocationRaw {
  etaMin: number;
  workload: number;
  acceptanceRate: number;
  idleMin: number;
}

export interface AllocationNormalized {
  eta: number;
  workload: number;
  acceptance: number;
  idle: number;
}

export interface AllocationBreakdown {
  driverId: string;
  driverName?: string;
  rank: number;
  raw: AllocationRaw;
  normalized: AllocationNormalized;
  contributions: {
    eta: number;
    workload: number;
    acceptance: number;
    idle: number;
  };
  /** Lower is better. */
  score: number;
}

/* ------------------------------------------------------------------ */
/* Zones / surge / forecast (Features 1 + 2)                           */
/* ------------------------------------------------------------------ */

export interface ZoneSnapshot {
  zoneId: ZoneId;
  row: number;
  col: number;
  center: LatLng;
  demand: number;
  supply: number;
  ratio: number;
  surge: number;
  predictedDemand?: number;
}

export interface Recommendation {
  fromZone: ZoneId;
  toZone: ZoneId;
  driversToMove: number;
  reason: string;
}

export interface ForecastCell {
  zoneId: ZoneId;
  hourOfDay: number;
  predictedDemand: number;
  actualDemand?: number;
  difference?: number;
}

/* ------------------------------------------------------------------ */
/* Pooling (Feature 3)                                                 */
/* ------------------------------------------------------------------ */

export interface PoolCandidate {
  rideId: string;
  pickup: LatLng;
  drop: LatLng;
  soloDistanceKm: number;
  soloDurationMin: number;
  soloFare: number;
}

export interface PoolStop {
  kind: "pickup" | "drop";
  rideId: string;
  location: LatLng;
  /** Index into the distance matrix used to build the plan. */
  node: number;
}

export interface PoolPlan {
  ok: boolean;
  rideIds: string[];
  stopOrder: PoolStop[];
  totalDistanceKm: number;
  totalDurationMin: number;
  perRider: {
    rideId: string;
    detourRatio: number;
    pooledFare: number;
    soloFare: number;
  }[];
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Simulator / evaluation                                              */
/* ------------------------------------------------------------------ */

export interface SimConfig {
  seed: number;
  strategy: Strategy;
  speed: number;
}

export interface SimStatus {
  running: boolean;
  seed: number;
  strategy: Strategy;
  speed: number;
  simTime: string;
  drivers: number;
  activeRides: number;
}

export interface SimRunRecord {
  id: string;
  seed: number;
  strategy: Strategy;
  metrics: Metrics;
  createdAt: string;
}

export interface Metrics {
  strategy: Strategy;
  seed: number;
  simulatedMinutes: number;
  ridesRequested: number;
  ridesCompleted: number;
  ridesCancelled: number;
  /** Seconds of simulated time. */
  avgPassengerWaitSec: number;
  avgPickupEtaMin: number;
  driverUtilization: number;
  completionRate: number;
  reassignmentCount: number;
  /** Population standard deviation of completed rides per driver. */
  fairnessStdDev: number;
}

export interface ChaosRequest {
  action: ChaosAction;
  driverId?: string;
  rideId?: string;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  driverId?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
