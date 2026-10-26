import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadSilaMePermissions } from '../../remote-buyer/src/api/silaMe/silaPermissionApi';
import { silaMeRoleOf } from '../../remote-buyer/src/components/silaMe/silaMeRoles';
import { silaMePermissions, type SilaMePermissions } from '../../remote-buyer/src/components/silaMe/silaMePermissions';
import { loadPerson, type PersonDetailDto } from './person';
import { useLoad } from './useLoad';

export interface AccessState {
  person: PersonDetailDto | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /**
   * What the UI offers, from Identity permission codes (same model as Cloud).
   * Until the profile and permission list are loaded nothing is offered; the API checks every call again.
   */
  can: SilaMePermissions;
}

const NO_ACCESS: SilaMePermissions = Object.fromEntries(
  Object.keys(silaMePermissions('buyer-user')).map((key) => [key, false]),
) as unknown as SilaMePermissions;

const AccessContext = createContext<AccessState | null>(null);

/** Loads the signed-in user's profile and Identity permissions once. */
export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, loading, error, reload } = useLoad(loadPerson, 'person');
  const role = silaMeRoleOf(data?.roleName ?? '', false);
  const [can, setCan] = useState<SilaMePermissions>(NO_ACCESS);

  useEffect(() => {
    let active = true;
    if (!data) {
      setCan(NO_ACCESS);
      return undefined;
    }
    const fallback = silaMePermissions(role);
    setCan(fallback);
    loadSilaMePermissions(role).then((next) => {
      if (active) setCan(next);
    });
    return () => {
      active = false;
    };
  }, [data, role]);

  const value = useMemo<AccessState>(
    () => ({
      person: data,
      loading,
      error,
      reload,
      can,
    }),
    [data, loading, error, reload, can],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export const useAccess = (): AccessState => {
  const value = useContext(AccessContext);
  if (!value) throw new Error('useAccess must be used inside AccessProvider.');
  return value;
};

/** First name of the user, for the greeting. */
export const firstNameOf = (person: PersonDetailDto | null): string => (person?.name ?? '').trim().split(/\s+/)[0] ?? '';

/** Up to two initials of the user, for the avatar. */
export const initialsOf = (person: PersonDetailDto | null): string =>
  (person?.name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
