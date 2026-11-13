import type { DriverAdminView, NearbyDriversResponse } from "@ps02/shared";
import { api } from "./api";

export const driverApi = {
  nearby(lat: number, lng: number, radiusKm = 5) {
    return api.get<NearbyDriversResponse>(
      `/drivers/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`,
    );
  },
  me() {
    return api.get<{ driver: DriverAdminView }>("/drivers/me");
  },
  setStatus(status: string) {
    return api.post<{ driver: DriverAdminView }>("/drivers/status", { status });
  },
  updateLocation(lat: number, lng: number) {
    return api.post<{ driver: DriverAdminView }>("/drivers/location", { lat, lng });
  },
};
