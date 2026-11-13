import type { LatLng, PlaceSuggestion } from "@ps02/shared";
import { api } from "./api";

export const geocodingApi = {
  search(query: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ q: query });
    return api.get<{ suggestions: PlaceSuggestion[] }>(
      `/geocoding/search?${params.toString()}`,
      { signal },
    );
  },
  reverse(point: LatLng, signal?: AbortSignal) {
    const params = new URLSearchParams({
      lat: String(point.lat),
      lng: String(point.lng),
    });
    return api.get<{ displayName: string }>(
      `/geocoding/reverse?${params.toString()}`,
      { signal },
    );
  },
};
