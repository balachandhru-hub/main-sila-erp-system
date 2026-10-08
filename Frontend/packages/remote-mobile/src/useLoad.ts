import { useCallback, useEffect, useRef, useState } from 'react';

export interface LoadState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Runs `loader` when `key` changes (and on reload) and keeps loading / error / data.
 * Pass `key = null` to skip loading. Answers of superseded calls are ignored.
 */
export const useLoad = <T>(loader: () => Promise<T>, key: string | null): LoadState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(key !== null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    if (key === null) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Something went wrong.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { data, loading, error, reload };
};

/** Error text of a failed call. */
export const errorText = (caught: unknown, fallback = 'Something went wrong.'): string =>
  caught instanceof Error && caught.message ? caught.message : fallback;

/** Safe localStorage access (private mode, blocked storage). */
export const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStored = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice simply is not remembered.
  }
};
