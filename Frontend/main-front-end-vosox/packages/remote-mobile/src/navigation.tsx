import React, { createContext, useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

/** Path the app is mounted at (e.g. /mobile), without a trailing slash. */
const MobileBaseContext = createContext<string>('');

export const MobileBaseProvider: React.FC<{ base: string; children: React.ReactNode }> = ({ base, children }) => (
  <MobileBaseContext.Provider value={base}>{children}</MobileBaseContext.Provider>
);

export const useMobileBase = (): string => useContext(MobileBaseContext);

/** Absolute path of a screen inside the app, e.g. path('inventory/stock'). */
export const useMobilePath = (): ((screen: string) => string) => {
  const base = useMobileBase();
  return useCallback((screen: string) => `${base}/${screen.replace(/^\/+/, '')}`, [base]);
};

export interface GoOptions {
  replace?: boolean;
  state?: unknown;
}

/** Navigates to a screen of the app (paths relative to the app root). */
export const useGo = (): ((screen: string, options?: GoOptions) => void) => {
  const navigate = useNavigate();
  const path = useMobilePath();
  return useCallback(
    (screen: string, options?: GoOptions) => navigate(path(screen), { replace: options?.replace, state: options?.state }),
    [navigate, path],
  );
};
