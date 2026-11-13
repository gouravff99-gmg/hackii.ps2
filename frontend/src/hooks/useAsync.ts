import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { errorMessage } from "../services/api";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<T | null>;
  setData: Dispatch<SetStateAction<T | null>>;
}

/**
 * Tiny data-fetching primitive: loading + error state, manual reload and
 * optimistic updates through `setData`. Errors are surfaced, never swallowed.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loaderRef.current();
      setData(result);
      return result;
    } catch (err) {
      setError(errorMessage(err));
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload, setData };
}
