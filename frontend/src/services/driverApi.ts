import type {
  DriverAdminView,
  DriverAreaOpportunitiesResponse,
  DriverDemandInsightsResponse,
  DriverDocumentType,
  DriverOnboardingApplication,
  NearbyDriversResponse,
} from "@ps02/shared";
import { api } from "./api";

export const driverApi = {
  nearby(lat: number, lng: number, radiusKm = 5, category?: string, signal?: AbortSignal) {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radiusKm: String(radiusKm),
    });
    if (category) params.set("category", category);
    return api.get<NearbyDriversResponse>(`/drivers/nearby?${params.toString()}`, { signal });
  },
  me() {
    return api.get<{ driver: DriverAdminView }>("/drivers/me");
  },
  demand() {
    return api.get<DriverDemandInsightsResponse>("/drivers/demand");
  },
  opportunities(category?: string, window?: string) {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (window) params.set("window", window);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return api.get<DriverAreaOpportunitiesResponse>(`/drivers/opportunities${suffix}`);
  },
  setStatus(status: string) {
    return api.post<{ driver: DriverAdminView }>("/drivers/status", { status });
  },
  updateLocation(lat: number, lng: number) {
    return api.post<{ driver: DriverAdminView }>("/drivers/location", { lat, lng });
  },
  updateVehicleRegistration(registration: string) {
    return api.put<{ driver: DriverAdminView }>("/drivers/vehicle-registration", { registration });
  },
  onboarding() {
    return api.get<{ application: DriverOnboardingApplication }>("/drivers/onboarding");
  },
  updateOnboarding(body: {
    safetyChecklist: Record<string, boolean>;
    safetyTrainingComplete: boolean;
    bankAccountNumber?: string;
    bankIfsc?: string;
  }) {
    return api.put<{ application: DriverOnboardingApplication }>("/drivers/onboarding", body);
  },
  uploadOnboardingDocument(type: DriverDocumentType, file: File, expiryDate?: string) {
    return api.upload<{ application: DriverOnboardingApplication }>(
      `/drivers/onboarding/documents/${type}`,
      file,
      expiryDate,
    );
  },
  submitOnboarding() {
    return api.post<{ application: DriverOnboardingApplication }>("/drivers/onboarding/submit");
  },
  downloadOnboardingDocument(documentId: string) {
    return api.download(`/drivers/onboarding/documents/${documentId}`);
  },
};
