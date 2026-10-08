import React, { createContext, useContext, useMemo } from 'react';
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
   * What the UI offers, from the user's role (same mapping as the cloud screens). Until the profile is loaded
   * nothing is offered; the API checks every call again.
   */
  can: SilaMePermissions;
}

const NO_ACCESS: SilaMePermissions = Object.fromEntries(
  Object.keys(silaMePermissions('buyer-user')).map((key) => [key, false]),
) as unknown as SilaMePermissions;

const AccessContext = createContext<AccessState | null>(null);

/** Loads the signed-in user's profile once and derives what the app offers him. */
export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data, loading, error, reload } = useLoad(loadPerson, 'person');

  const value = useMemo<AccessState>(
    () => ({
      person: data,
      loading,
      error,
      reload,
      can: data ? silaMePermissions(silaMeRoleOf(data.roleName ?? '', false)) : NO_ACCESS,
    }),
    [data, loading, error, reload],
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
