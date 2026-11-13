import type { MobilityIntelligenceResponse } from "@ps02/shared";
import { api } from "./api";

export const intelligenceApi = {
  zones(signal?: AbortSignal, hour?: number) {
    const suffix = hour === undefined ? "" : `?hour=${hour}`;
    return api.get<MobilityIntelligenceResponse>(`/intelligence/zones${suffix}`, { signal });
  },
};
