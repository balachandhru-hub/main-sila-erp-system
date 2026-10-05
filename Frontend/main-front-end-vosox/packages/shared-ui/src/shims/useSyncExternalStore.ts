/* ESM stand-in for the `use-sync-external-store` package (used by react-redux inside recharts).

   Why: that package ships CommonJS that calls `require('react')`. @originjs/vite-plugin-federation
   only rewrites ESM `import ... from 'react'` to the shared, host-provided React, so in a
   production build those `require` calls bind to a private copy of React bundled into the remote.
   Hooks then run against a React that is not rendering and crash with
   "Cannot read properties of null (reading 'useRef')". Every app's vite config aliases the package
   here (see ../../build/federationAliases.ts), so it imports the shared React like any other module.

   React 19 has useSyncExternalStore built in; the selector variant below is a direct port of
   React's own use-sync-external-store/with-selector implementation. */
import { useDebugValue, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

export { useSyncExternalStore };

type Subscribe = (onStoreChange: () => void) => () => void;

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: Subscribe,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  // Holds the last rendered selection so `isEqual` can keep references stable across store updates.
  const instRef = useRef<{ hasValue: boolean; value: Selection | null } | null>(null);
  if (instRef.current === null) {
    instRef.current = { hasValue: false, value: null };
  }
  const inst = instRef.current;

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;

    const memoizedSelector = (nextSnapshot: Snapshot): Selection => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && inst.hasValue) {
          const currentSelection = inst.value as Selection;
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection;
            return currentSelection;
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }

      const prevSnapshot = memoizedSnapshot;
      const prevSelection = memoizedSelection;
      if (Object.is(prevSnapshot, nextSnapshot)) return prevSelection;

      const nextSelection = selector(nextSnapshot);
      if (isEqual !== undefined && isEqual(prevSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return prevSelection;
      }
      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };

    const serverSnapshot = getServerSnapshot ?? null;
    return [
      () => memoizedSelector(getSnapshot()),
      serverSnapshot === null ? undefined : () => memoizedSelector(serverSnapshot()),
    ] as const;
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);

  useDebugValue(value);
  return value;
}
