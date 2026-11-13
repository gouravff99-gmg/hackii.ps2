import type {
  DriverAdminView,
  DriverDemandInsightsResponse,
  DriverDocumentType,
  DriverOnboardingApplication,
  NearbyDriversResponse,
} from "@ps02/shared";
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
  demand() {
    return api.get<DriverDemandInsightsResponse>("/drivers/demand");
  },
  setStatus(status: string) {
    return api.post<{ driver: DriverAdminView }>("/drivers/status", { status });
  },
  updateLocation(lat: number, lng: number) {
    return api.post<{ driver: DriverAdminView }>("/drivers/location", { lat, lng });
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
