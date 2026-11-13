import { useCallback, useEffect, useState } from "react";
import type { MobilityIntelligenceResponse } from "@ps02/shared";
import { SOCKET_EVENTS } from "@ps02/shared";
import { useSocketEvent } from "./useSocketEvent";
import { errorMessage } from "../services/api";
import { intelligenceApi } from "../services/intelligenceApi";

export function useMobilityIntelligence(refreshMs = 30_000, hourOfDay?: number) {
  const [data, setData] = useState<MobilityIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await intelligenceApi.zones(signal, hourOfDay);
      if (signal?.aborted) return;
      setData(response);
      setError(null);
    } catch (reason) {
      if (signal?.aborted) return;
      setError(errorMessage(reason));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [hourOfDay]);

  useSocketEvent<{ at: string }>(SOCKET_EVENTS.ZONES_UPDATE, () => {
    void refresh();
  });
  useSocketEvent<void>("connect", () => {
    void refresh();
  });

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(), refreshMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refresh, refreshMs]);

  return { data, loading, error, refresh: () => void refresh() };
}
