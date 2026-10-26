import { create } from 'zustand';
import { getTokenClaims } from '../api/authApi';

export type UserRole = 'buyer' | 'supplier' |'supplier-admin'|'supplier-business-user'| 'platform-user'| 'buyer-admin' | 'buyer-business-user' | 'outlet-manager' | 'store-manager' | 'cost-controller';
 
export const ROLE_MAPPING: Record<string, UserRole> = {
  '937aab61-b505-4e1c-a5a3-cd63e29c6db9': 'supplier',        // SUPPLIER
  '5a72f81e-a2c5-4f4a-bd55-6376c3c9ed73': 'buyer',           // BUYER
  '113d8ead-40c2-425a-bc60-5989e6cdabca': 'platform-user',   // PLATFORM_ADMINISTRATOR
  '61eb9b97-1fca-4beb-beb8-dc4b379cfa3a': 'platform-user',   // BUYER_NETWORK_ADMIN
  '22067509-af24-48f8-a7e9-416a0b6a439b': 'platform-user',   // SUPPLIER_NETWORK_ADMIN
  '735bb267-fec0-489f-8249-d3d65b3857ea': 'supplier-admin',  // SUPPLIER_ADMIN     
  'c95f5a1b-4aec-4647-9328-895a58193ec4': 'buyer-admin',    // BUYER_ADMIN
  '7c4e1a90-6b2d-4f58-9c31-0e8a5d6f4b21': 'outlet-manager', // OUTLET_MANAGER
  'b054de41-7da1-4b96-a2aa-d8387bfb0ef0': 'store-manager',  // STORE_MANAGER
  '3f9d6c2e-5b1a-4e8f-9c7d-2a6b8e4f1c03': 'cost-controller', // COST_CONTROLLER
  // F&B director / finance manager use the buyer shell. SILA screens still read the role name.
  '8d2a6c40-1f7e-4b9a-9c55-6e3a1d8b4f02': 'cost-controller', // FNB_DIRECTOR
  '9e3b7d51-2a8f-4c0b-8d66-7f4b2e9c5a13': 'cost-controller', // FINANCE_MANAGER
  '0a7c4e82-3b1f-4d6a-9e28-5c8f1a2b3d40': 'buyer', // AP_PROCESSOR
};

/** Supplier roles stay on supplier screens. Network admin is stored as platform-user, so the role id is the check. */
export const isSupplierRoleId = (roleId: string | null | undefined): boolean =>
  roleId === '937aab61-b505-4e1c-a5a3-cd63e29c6db9' ||
  roleId === '735bb267-fec0-489f-8249-d3d65b3857ea' ||
  roleId === '22067509-af24-48f8-a7e9-416a0b6a439b';
export interface AuthState {
  isLoggedIn: boolean;
  isInitialized:boolean;
  userRole: UserRole | null;
  userId: string | null;
  personId: string | null;
  organizationId: string | null;
  roleId: string | null;
  initializeAuth: ()=>Promise<void>;
  login: (
    details?: {
      userId?: string;
      personId?: string;
      organizationId?: string;
      roleId?: string;
    }
  ) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,        
  isInitialized: false,    
  userRole: null,
  userId: null,
  personId: null,
  organizationId: null,
  roleId: null,

  initializeAuth: async () => {
    try {
      const claims = await getTokenClaims(true);
      const resolvedRole = claims?.roleId ? ROLE_MAPPING[claims.roleId] : undefined;
      if (resolvedRole) {
        set({
          isLoggedIn: true,
          isInitialized: true,
          userRole: resolvedRole,
          userId: claims.userId || null,
          personId: claims.personId || null,
          organizationId: claims.organizationId || null,
          roleId: claims.roleId || null,
        });
        return;
      }
    } catch {
      // Not logged in or network error
    }

    set({
      isLoggedIn: false,
      isInitialized: true,
      userRole: null,
      userId: null,
      personId: null,
      organizationId: null,
      roleId: null,
    });
  },
   login: (details) => {
    const resolvedRole = details?.roleId ? ROLE_MAPPING[details.roleId] : undefined;
    if (!resolvedRole) {
      set({
        isLoggedIn: false,
        isInitialized: true,
        userRole: null,
        userId: null,
        personId: null,
        organizationId: null,
        roleId: null,
      });
      return;
    }

    set({
      isLoggedIn: true,
      isInitialized: true,
      userRole: resolvedRole,
      userId: details?.userId || null,
      personId: details?.personId || null,
      organizationId: details?.organizationId || null,
      roleId: details?.roleId || null,
    });
  },
  logout: () => {
    sessionStorage.clear();
    set({
      isLoggedIn: false,
      isInitialized: true,
      userRole: null,
      userId: null,
      personId: null,
      organizationId: null,
      roleId: null,
    });
  },
}));
