import type {
  AllocationBreakdown,
  AuthUser,
  ForecastCell,
  LatLng,
  Metrics,
  NearbyDriver,
  PoolCandidate,
  PoolPlan,
  Recommendation,
  Ride,
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
  status: DriverStatus;
  lat: number;
  lng: number;
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
  averagePassengerWaitSec: number;
  driverUtilization: number;
  totalPassengers: number;
}

export interface DriverAdminView {
  id: string;
  name: string;
  email: string;
  vehicleType: string;
  status: DriverStatus;
  lat: number;
  lng: number;
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
