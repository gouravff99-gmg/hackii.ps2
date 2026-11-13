import { useCallback, useEffect, useRef, useState } from "react";
import type { AreaDemandResponse } from "@ps02/shared";
import { SOCKET_EVENTS } from "@ps02/shared";
import { useSocketEvent } from "./useSocketEvent";
import { errorMessage } from "../services/api";
import { intelligenceApi, type AreaDemandRequest } from "../services/intelligenceApi";

export function useAreaDemand(request: AreaDemandRequest, refreshMs = 30_000) {
  const [data, setData] = useState<AreaDemandResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(request);
  const controllerRef = useRef<AbortController | null>(null);
  requestRef.current = request;

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    try {
      const response = await intelligenceApi.areas(requestRef.current, controller.signal);
      if (!controller.signal.aborted) {
        setData(response);
        setError(null);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorMessage(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const requestKey = JSON.stringify(
    Object.entries(request).sort(([left], [right]) => left.localeCompare(right)),
  );

  useSocketEvent<{ at: string }>(SOCKET_EVENTS.ZONES_UPDATE, () => void refresh());
  useSocketEvent<void>("connect", () => void refresh());

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), refreshMs);
    return () => {
      window.clearInterval(timer);
      controllerRef.current?.abort();
    };
  }, [refresh, refreshMs, requestKey]);

  return { data, loading, error, refresh };
}
