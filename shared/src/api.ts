import type {
  AllocationBreakdown,
  AuthUser,
  LatLng,
  DriverOnboardingApplication,
  DriverVerificationHistoryEntry,
  ForecastCell,
  Metrics,
  MobilityZoneInsight,
  NearbyDriver,
  PoolCandidate,
  PoolPlan,
  Recommendation,
  Ride,
  ZoneId,
  ZoneSnapshot,
} from "./types";
import type { DriverStatus, RideStatus, Strategy } from "./enums";

/* ------------------------------------------------------------------ */
/* Response envelopes returned by the REST API                         */
/* ------------------------------------------------------------------ */

export interface RideEventView {
  id: string;
  rideId: string;
  type: string;
  message: string;
  payload?: unknown;
  createdAt: string;
}

export interface RidePersonView {
  id: string;
  name: string;
  email?: string;
}

export interface RideDriverView {
  id: string;
  vehicleType: string;
  vehicleRegistration?: string | null;
  status: DriverStatus;
  lat: number;
  lng: number;
  locationUpdatedAt?: string;
  acceptanceRate: number;
  completedToday: number;
  user: RidePersonView;
}

/** Full ride detail (GET /rides/:id). */
export interface RideDetailView extends Ride {
  passenger: RidePersonView;
  driver?: RideDriverView | null;
  events: RideEventView[];
}

export interface RideListResponse {
  rides: Ride[];
}

export interface RideDetailResponse {
  ride: RideDetailView;
}

export interface DriverActiveRideResponse {
  ride: (RideDetailView & { passenger: RidePersonView }) | null;
}

export interface DriverOnboardingResponse {
  application: DriverOnboardingApplication;
}

export interface DriverOnboardingAdminResponse {
  applications: (DriverOnboardingApplication & {
    driver: { id: string; user: RidePersonView; vehicleType: string };
  })[];
  history: DriverVerificationHistoryEntry[];
}

export interface NearbyDriversResponse {
  drivers: NearbyDriver[];
}

export interface AdminOverviewMetrics {
  totalDrivers: number;
  availableDrivers: number;
  busyDrivers: number;
  offlineDrivers: number;
  activeRides: number;
  completedRidesToday: number;
  acceptedRidesToday: number;
  averagePassengerWaitSec: number | null;
  driverUtilization: number;
  totalPassengers: number;
}

export interface DriverAdminView {
  id: string;
  name: string;
  email: string;
  vehicleType: string;
  vehicleRegistration?: string | null;
  status: DriverStatus;
  lat: number;
  lng: number;
  locationUpdatedAt?: string;
  acceptanceRate: number;
  completedToday: number;
  busyMinutesToday: number;
  isSimulated: boolean;
  lastIdleSince: string;
}

export interface AdminRideView {
  id: string;
  status: RideStatus;
  passengerName: string;
  driverId: string | null;
  driverName: string | null;
  pickup: LatLng;
  drop: LatLng;
  distanceKm: number;
  fareEstimate: number;
  fareFinal: number | null;
  surgeMultiplier: number;
  requestedAt: string;
  completedAt: string | null;
}

export interface RideEventLogItem {
  id: string;
  rideId: string;
  type: string;
  message: string;
  rideStatus: RideStatus;
  createdAt: string;
}

export interface ZoneIntelligenceResponse {
  zones: ZoneSnapshot[];
  hourOfDay: number;
  windowMinutes: number;
  recommendations: Recommendation[];
}

export interface MobilityIntelligenceResponse {
  city: string;
  generatedAt: string;
  windowMinutes: number;
  staleLocationThresholdSeconds: number;
  zones: MobilityZoneInsight[];
}

export interface DriverZoneInsight extends ZoneSnapshot {
  distanceKm: number;
  recentRequests15m: number;
  measuredRequests15m: number;
  simulatedRequests15m: number;
}

export interface DriverDemandInsightsResponse {
  driverLocation: LatLng;
  currentZone: DriverZoneInsight;
  nearbyZones: DriverZoneInsight[];
  recommendation: {
    targetZone: ZoneId;
    center: LatLng;
    distanceKm: number;
    reason: string;
  } | null;
  driverStatus: DriverStatus;
  driverIsSimulated: boolean;
  hourOfDay: number;
  observedWindowMinutes: number;
  /** Inclusive hourly ranges from the synthetic demand profile. */
  peakPeriods: { startHour: number; endHour: number }[];
}

export interface ForecastComparisonResponse {
  hourOfDay: number;
  cells: ForecastCell[];
  totals: { predicted: number; actual: number; difference: number };
}

export interface PoolCandidateGroupView {
  rideIds: string[];
  plan: PoolPlan;
}

export interface PoolCandidatesResponse {
  candidates: PoolCandidate[];
  groups: PoolCandidateGroupView[];
}

export interface AllocationSnapshot {
  rideId: string;
  status: RideStatus;
  pickup: LatLng;
  drop: LatLng;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  requestedAt: string;
  scores: AllocationBreakdown[];
}

export interface EvaluationHistoryItem {
  id: string;
  seed: number;
  strategy: Strategy;
  metrics: Metrics;
  createdAt: string;
}

export interface SimStatusResponse {
  running: boolean;
  seed: number;
  strategy: Strategy;
  speed: number;
  simTime: string;
  drivers: number;
  activeRides: number;
}

export interface ChaosResponse {
  action: string;
  detail: string;
  reassigned?: boolean;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  city: string;
  simSpeed: number;
  database: boolean;
  databaseError?: string;
  time: string;
}

export interface AuthMeResponse {
  user: AuthUser;
}
