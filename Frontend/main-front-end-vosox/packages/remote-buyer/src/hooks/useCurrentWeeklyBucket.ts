import { useCallback, useEffect, useRef, useState } from "react";
import { getOutlets, type Outlet } from "../api/outletApi";
import { getCurrentWeeklyBucket, type WeeklyBucketDetail } from "../api/weeklyBucketApi";

export interface CurrentWeeklyBucket {
  /** The outlets the user can request for; the picker is shown only when there is more than one. */
  outlets: Outlet[];
  outletId: string;
  setOutletId: (outletId: string) => void;
  showOutletPicker: boolean;
  /** The outlets belong to several properties, so the user has to say which one before a bucket can be shown. */
  mustChooseOutlet: boolean;
  bucket: WeeklyBucketDetail | null;
  setBucket: (bucket: WeeklyBucketDetail) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * The active weekly bucket of the user's property. The server derives the property from the user's outlet;
 * the outlet is asked for only when that is ambiguous (outlets of several properties).
 */
export const useCurrentWeeklyBucket = (enabled = true): CurrentWeeklyBucket => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletsLoaded, setOutletsLoaded] = useState(false);
  const [outletId, setOutletId] = useState("");
  const [bucket, setBucket] = useState<WeeklyBucketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestRef = useRef(0);

  const propertyCount = new Set(outlets.map((outlet) => outlet.propertyId ?? "")).size;
  const showOutletPicker = outlets.length > 1;
  const mustChooseOutlet = propertyCount > 1 && !outletId;

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    getOutlets()
      .then((rows) => {
        if (!active) return;
        setOutlets(rows);
        // One property: the first outlet is as good as any to find the bucket. Several: the user chooses.
        const properties = new Set(rows.map((outlet) => outlet.propertyId ?? ""));
        setOutletId(rows.length > 0 && properties.size === 1 ? rows[0].id : "");
        setOutletsLoaded(true);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not load outlets.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !outletsLoaded) return;
    if (mustChooseOutlet) {
      setBucket(null);
      setError(null);
      setLoading(false);
      return;
    }
    const request = requestRef.current + 1;
    requestRef.current = request;
    setLoading(true);
    setError(null);
    getCurrentWeeklyBucket(outletId || undefined)
      .then((data) => {
        if (requestRef.current === request) setBucket(data);
      })
      .catch((err: unknown) => {
        if (requestRef.current !== request) return;
        setBucket(null);
        setError(err instanceof Error ? err.message : "Could not load the weekly bucket.");
      })
      .finally(() => {
        if (requestRef.current === request) setLoading(false);
      });
  }, [enabled, outletsLoaded, outletId, mustChooseOutlet, reloadKey]);

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  return { outlets, outletId, setOutletId, showOutletPicker, mustChooseOutlet, bucket, setBucket, loading, error, reload };
};
