import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { getMyLocations, type SilaLocation } from '../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { readStored, useLoad, writeStored } from './useLoad';

const STORAGE_KEY = 'silaStore.locationId';

export interface MyLocationState {
  locations: SilaLocation[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** The chosen location, otherwise the first of mine; null when the user has none. */
  location: SilaLocation | null;
  setLocationId: (locationId: string) => void;
}

const MyLocationContext = createContext<MyLocationState | null>(null);

/** Loads the user's locations once and remembers the chosen one. */
export const MyLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, loading, error, reload } = useLoad(getMyLocations, 'mine');
  const [chosenId, setChosenId] = useState<string | null>(() => readStored(STORAGE_KEY));

  const setLocationId = useCallback((locationId: string) => {
    setChosenId(locationId);
    writeStored(STORAGE_KEY, locationId);
  }, []);

  const value = useMemo<MyLocationState>(() => {
    const locations = data ?? [];
    const location = locations.find((item) => item.id === chosenId) ?? locations[0] ?? null;
    return { locations, loading, error, reload, location, setLocationId };
  }, [data, loading, error, reload, chosenId, setLocationId]);

  return <MyLocationContext.Provider value={value}>{children}</MyLocationContext.Provider>;
};

export const useMyLocation = (): MyLocationState => {
  const value = useContext(MyLocationContext);
  if (!value) throw new Error('useMyLocation must be used inside MyLocationProvider.');
  return value;
};
