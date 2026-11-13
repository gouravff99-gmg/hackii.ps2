import type {
  DriverActiveRideResponse,
  EstimateResponse,
  LatLng,
  NearbyDriversResponse,
  Ride,
  RideDetailResponse,
  RideDetailView,
  RideListResponse,
  RideOfferPayload,
  RouteResult,
} from "@ps02/shared";
import { api } from "./api";

export const rideApi = {
  estimate(pickup: LatLng, drop: LatLng, category?: string, signal?: AbortSignal) {
    return api.post<EstimateResponse>("/rides/estimate", { pickup, drop, category }, { signal });
  },
  create(pickup: LatLng, drop: LatLng, category?: string) {
    return api.post<{ ride: Ride }>("/rides", { pickup, drop, category });
  },
  get(rideId: string) {
    return api.get<RideDetailResponse>(`/rides/${rideId}`);
  },
  trackingRoute(rideId: string, origin: LatLng, signal?: AbortSignal) {
    return api.post<RouteResult>(`/rides/${rideId}/tracking-route`, origin, { signal });
  },
  history() {
    return api.get<RideListResponse>("/rides/history");
  },
  cancel(rideId: string) {
    return api.post<RideDetailResponse>(`/rides/${rideId}/cancel`);
  },
  rate(rideId: string, rating: number, feedback?: string) {
    return api.post<{ ride: Ride }>(`/rides/${rideId}/rating`, { rating, feedback });
  },
  driverActive() {
    return api.get<DriverActiveRideResponse>("/rides/driver/active");
  },
  driverOffer() {
    return api.get<{ offer: RideOfferPayload | null }>("/rides/driver/offer");
  },
  driverHistory() {
    return api.get<RideListResponse>("/rides/driver/history");
  },
  respond(rideId: string, accept: boolean) {
    return api.post<{ ride: RideDetailView; accepted: boolean }>(`/rides/${rideId}/respond`, {
      accept,
    });
  },
  advance(rideId: string, status: "ARRIVING" | "ARRIVED" | "ONGOING" | "COMPLETED") {
    return api.post<RideDetailResponse>(`/rides/${rideId}/advance`, { status });
  },
  driverCancel(rideId: string) {
    return api.post<{ ok: boolean }>(`/rides/${rideId}/driver-cancel`);
  },
};
