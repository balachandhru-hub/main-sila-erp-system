import { useCallback, useEffect, useState } from "react";
import type { SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { PAGE_SIZE } from "./receivingFormat";

export interface PagedList<T> {
  rows: T[];
  page: number;
  hasNext: boolean;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  reload: () => void;
}

/**
 * One page of a server list. `load` must be stable for the current filters (useCallback with the filters as
 * dependencies); a filter change goes back to page 1. One extra row tells whether there is a next page.
 */
export const usePagedList = <T>(load: (page: SilaPage) => Promise<T[]>, fallbackError: string): PagedList<T> => {
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setPage(1);
  }, [load]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    load({ index: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE + 1 })
      .then((data) => {
        if (!active) return;
        setHasNext(data.length > PAGE_SIZE);
        setRows(data.slice(0, PAGE_SIZE));
      })
      .catch((err: unknown) => {
        if (!active) return;
        setRows([]);
        setError(err instanceof Error ? err.message : fallbackError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, page, version, fallbackError]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { rows, page, hasNext, loading, error, setPage, reload };
};

/** The value after the user stops typing for a moment, so searches do not run on every key. */
export const useDebounced = (value: string, delay = 300): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};
