import { useEffect, useState } from "react";
import type { LatLng, NearbyDriver } from "@ps02/shared";
import { errorMessage } from "../services/api";
import { driverApi } from "../services/driverApi";

export function useNearbyDrivers(point: LatLng | null, locationKey: string) {
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(Boolean(point));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!point) {
      setDrivers([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    driverApi
      .nearby(point.lat, point.lng, 10, undefined, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setDrivers(response.drivers);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setDrivers([]);
          setError(errorMessage(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [locationKey]);

  return { drivers, loading, error };
}
