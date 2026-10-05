import { create } from 'zustand';
import { getPersonDetail, type PersonDetailDto } from '../api/Buyerapi';
import { isErrorResponse } from '@vosox/shared-ui';

export interface BuyerAuthState {
  personDetail: PersonDetailDto | null;
  personDetailLoading: boolean;
  // Fetches the logged-in buyer's profile once (called at BuyerApp mount, which
  // happens on login success and on a full page reload) and hands it out via
  // the store, so every consumer (Header, ProfileView, chat, ...) reads the
  // same value instead of each re-fetching independently.
  fetchPersonDetail: () => Promise<void>;
  setPersonDetail: (detail: PersonDetailDto) => void;
  reset: () => void;
}

export const useBuyerAuthStore = create<BuyerAuthState>((set) => ({
  personDetail: null,
  personDetailLoading: false,

  fetchPersonDetail: async () => {
    set({ personDetailLoading: true });
    const result = await getPersonDetail();
    if (!isErrorResponse(result)) {
      set({ personDetail: result, personDetailLoading: false });
    } else {
      set({ personDetailLoading: false });
    }
  },

  setPersonDetail: (detail: PersonDetailDto) => {
    set({ personDetail: detail });
  },

  reset: () => {
    set({ personDetail: null, personDetailLoading: false });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('session:expired', () => {
    useBuyerAuthStore.getState().reset();
  });
}
