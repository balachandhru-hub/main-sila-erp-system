import { useEffect, useState } from "react";

/** Which side of the product grid the filter drawer sits on. */
export type FilterDrawerSide = "left" | "right";

interface FilterDrawerState {
  open: boolean;
  side: FilterDrawerSide;
}

const STORAGE_KEY = "vosox.productCatalog.filterDrawer";
const DEFAULT_STATE: FilterDrawerState = { open: false, side: "left" };

const readState = (): FilterDrawerState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<FilterDrawerState>;
    return {
      open: parsed.open === true,
      side: parsed.side === "right" ? "right" : "left",
    };
  } catch {
    // Storage can be blocked (private mode, policies) or hold an old value: start closed on the left.
    return DEFAULT_STATE;
  }
};

/** Open/closed state and side of the catalog's filter drawer, remembered in this browser. */
export const useFilterDrawer = () => {
  const [state, setState] = useState<FilterDrawerState>(readState);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Not remembering the drawer is harmless; the catalog works the same.
    }
  }, [state]);

  return {
    open: state.open,
    side: state.side,
    toggle: () => setState((current) => ({ ...current, open: !current.open })),
    close: () => setState((current) => ({ ...current, open: false })),
    moveToOtherSide: () => setState((current) => ({ ...current, side: current.side === "left" ? "right" : "left" })),
  };
};
