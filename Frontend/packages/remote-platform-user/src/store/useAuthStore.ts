import { create } from 'zustand';
import type { User, UserRole } from '../types';
import { ROLE_ID_MAPPING } from '../constants/roleMapping';
import { getTokenClaims } from '../api/platformApi'
import { getPersonDetail, type PersonDetailDto } from '../api/networkAdminApi';
import { isErrorResponse } from '@vosox/shared-ui';

function notifySessionInvalid() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('session:expired'));
  }
}

export interface TokenClaims {
  userId: string;
  personId?: string;
  organizationId?: string;
  roleId: string;
  permissions?: string[];
  buyerId?: string;
  supplierId?: string | null;
  organizationType?: number;
}

export interface AuthState {
  currentUser: User | null;
  claims: TokenClaims | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  personDetail: PersonDetailDto | null;
  personDetailLoading: boolean;
  initializeFromSession: () => Promise<void>;
  setCurrentUser: (user: User) => void;
  setClaims: (claims: TokenClaims) => void;
  setPersonDetail: (detail: PersonDetailDto) => void;
  logout: () => void;
}

// Fetches the logged-in person's profile once per session and hands it out via
// the store, so every consumer (Header, ProfileView, chat, ...) reads the same
// value instead of each re-fetching (and racing) independently.
const loadPersonDetail = async (
  set: (partial: Partial<AuthState>) => void
) => {
  set({ personDetailLoading: true });
  const detail = await getPersonDetail();
  if (!isErrorResponse(detail)) {
    set({ personDetail: detail, personDetailLoading: false });
  } else {
    set({ personDetailLoading: false });
  }
};

export const useNetworkAdminAuthStore = create<AuthState>((set) => ({
  currentUser: null,
  claims: null,
  isAuthenticated: false,
  isLoading: true,
  personDetail: null,
  personDetailLoading: false,
  initializeFromSession: async () => {

    let claims;

    try {
      claims = await getTokenClaims(true);
      set({ claims });
    } catch {
      set({
        claims: null,
        currentUser: null,
        isLoading: false,
        isAuthenticated: false,
        personDetail: null,
      });
      notifySessionInvalid();
      return;
    }
    if (claims && claims.userId && claims.roleId) {
      const mappedRole = mapRoleIdToUserRole(claims.roleId);

      if (mappedRole) {
        const user: User = {
          id: claims.userId,
          email: `user-${claims.userId}@company.com`,
          name: 'User',
          userRole: mappedRole,
          createdAt: new Date().toISOString().split('T')[0],
          status: 'active',
          organizationId: claims.organizationId || undefined,
          userId: claims.userId,
          personId: claims.personId || undefined,
          roleId: claims.roleId,
          buyerId: claims.buyerId || undefined,
          supplierId: claims.supplierId || undefined,
        };

        set({
          currentUser: user,
          isAuthenticated: true,
          isLoading: false,
        });

        // Runs once here: this action fires right after login (first mount of
        // the remote app) and again on a full page reload (same mount path) -
        // never on every render, and never re-triggered by Header/ProfileView.
        loadPersonDetail(set);
      } else {
        set({
          claims: null,
          currentUser: null,
          isLoading: false,
          isAuthenticated: false,
          personDetail: null,
        });
        notifySessionInvalid();
      }
    } else {
      set({ isLoading: false, isAuthenticated: false, claims: null, currentUser: null, personDetail: null });
      notifySessionInvalid();
    }
  },


  setCurrentUser: (user: User) => {
    set({
      currentUser: user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  setClaims: (claims: TokenClaims) => {
  set({ claims });
  },

  setPersonDetail: (detail: PersonDetailDto) => {
    set({ personDetail: detail });
  },

  logout: () => {
    set({
      currentUser: null,
      claims: null,
      isAuthenticated: false,
      isLoading: true,
      personDetail: null,
      personDetailLoading: false,
    });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('session:expired', () => {
    useNetworkAdminAuthStore.getState().logout();
  });
}


const ROLE_ID_TO_USER_ROLE: Record<string, UserRole> = Object.fromEntries(
  Object.entries(ROLE_ID_MAPPING).map(([role, id]) => [id, role as UserRole])
);

function mapRoleIdToUserRole(roleId: string): UserRole | null {
  return ROLE_ID_TO_USER_ROLE[roleId] || null;
}