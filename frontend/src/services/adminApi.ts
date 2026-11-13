import type {
  AdminOverviewMetrics,
  AdminRideView,
  AllocationSnapshot,
  ChaosResponse,
  DriverAdminView,
  EvaluationHistoryItem,
  ForecastComparisonResponse,
  Metrics,
  PoolCandidatesResponse,
  Recommendation,
  RideDetailResponse,
  RideEventLogItem,
  SimStatusResponse,
  Strategy,
  ZoneIntelligenceResponse,
} from "@ps02/shared";
import { api } from "./api";

export const adminApi = {
  overview() {
    return api.get<AdminOverviewMetrics>("/admin/overview");
  },
  drivers() {
    return api.get<{ drivers: DriverAdminView[] }>("/admin/drivers");
  },
  rides(limit = 50) {
    return api.get<{ rides: AdminRideView[] }>(`/admin/rides?limit=${limit}`);
  },
  events(limit = 60) {
    return api.get<{ events: RideEventLogItem[] }>(`/admin/events?limit=${limit}`);
  },
  rideDetail(rideId: string) {
    return api.get<RideDetailResponse>(`/rides/${rideId}`);
  },
  cancelRide(rideId: string) {
    return api.post<RideDetailResponse>(`/rides/${rideId}/cancel`);
  },
  zones(hour?: number) {
    const suffix = hour === undefined ? "" : `?hour=${hour}`;
    return api.get<ZoneIntelligenceResponse>(`/admin/zones${suffix}`);
  },
  forecast(hour?: number) {
    const suffix = hour === undefined ? "" : `?hour=${hour}`;
    return api.get<ForecastComparisonResponse>(`/admin/forecast${suffix}`);
  },
  recommendations(hour?: number) {
    const suffix = hour === undefined ? "" : `?hour=${hour}`;
    return api.get<{ recommendations: Recommendation[] }>(`/admin/recommendations${suffix}`);
  },
  poolCandidates() {
    return api.get<PoolCandidatesResponse>("/admin/pool-candidates");
  },
  allocations() {
    return api.get<{ allocations: AllocationSnapshot[] }>("/admin/allocations");
  },
  simStatus() {
    return api.get<SimStatusResponse>("/admin/sim");
  },
  startSim(body: { seed?: number; strategy?: Strategy; speed?: number; numDrivers?: number }) {
    return api.post<SimStatusResponse>("/admin/sim/start", body);
  },
  stopSim() {
    return api.post<SimStatusResponse>("/admin/sim/stop");
  },
  resetSim() {
    return api.post<SimStatusResponse>("/admin/sim/reset");
  },
  chaos(body: { action: string; driverId?: string; rideId?: string }) {
    return api.post<ChaosResponse>("/admin/chaos", body);
  },
  evaluate(body: { seed?: number; simulatedMinutes?: number; numDrivers?: number }) {
    return api.post<{ nearest: Metrics; smart: Metrics; runs: EvaluationHistoryItem[] }>(
      "/admin/evaluate",
      body,
    );
  },
  simRuns() {
    return api.get<{ runs: EvaluationHistoryItem[] }>("/admin/sim-runs");
  },
};
