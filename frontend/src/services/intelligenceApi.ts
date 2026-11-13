import type { AreaDemandResponse, MobilityIntelligenceResponse } from "@ps02/shared";
import { api } from "./api";

export interface AreaDemandRequest {
  scenario?: string;
  day?: number;
  window?: string;
  hour?: number;
  source?: "auto" | "demo" | "live";
  date?: string;
  category?: string;
  lat?: number;
  lng?: number;
}

function queryString(request: AreaDemandRequest): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(request)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}

export const intelligenceApi = {
  zones(signal?: AbortSignal, hour?: number) {
    const suffix = hour === undefined ? "" : `?hour=${hour}`;
    return api.get<MobilityIntelligenceResponse>(`/intelligence/zones${suffix}`, { signal });
  },
  areas(request: AreaDemandRequest = {}, signal?: AbortSignal) {
    return api.get<AreaDemandResponse>(`/intelligence/areas${queryString(request)}`, { signal });
  },
};
