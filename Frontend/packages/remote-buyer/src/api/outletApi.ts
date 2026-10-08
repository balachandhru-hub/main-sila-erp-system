import axiosInstance from "./axiosInstance";
import { readError } from "./readError";

/** An outlet is a storage location of a property. */
export interface Outlet {
  id: string;
  outletName: string;
  outletCode?: string | null;
  description?: string | null;
  externalShipTo?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  country?: string | null;
  propertyId?: string | null;
  propertyName?: string | null;
  plantCode?: string | null;
  companyCode?: string | null;
  storageLocation?: string | null;
}

export interface OutletWrite {
  outletName: string;
  outletCode?: string | null;
  description?: string | null;
  externalShipTo?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  country?: string | null;
  propertyId: string | null;
  storageLocation: string | null;
}

/** The outlets assigned to one user. */
export interface OutletUserMapping {
  userId: string;
  outletIds: string[];
}

/** Only the caller's assigned outlets when the caller has assignments; otherwise every outlet. */
export const getOutlets = async (): Promise<Outlet[]> => {
  try {
    const response = await axiosInstance.get<Outlet[]>("/api/v1/buyer/outlets");
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load outlets."));
  }
};

export const createOutlet = async (payload: OutletWrite): Promise<void> => {
  try {
    await axiosInstance.post("/api/v1/buyer/outlets", payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not create the outlet."));
  }
};

export const updateOutlet = async (outletId: string, payload: OutletWrite): Promise<void> => {
  try {
    await axiosInstance.put(`/api/v1/buyer/outlets/${outletId}`, payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the outlet."));
  }
};

export const getOutletUsers = async (): Promise<OutletUserMapping[]> => {
  try {
    const response = await axiosInstance.get<OutletUserMapping[]>("/api/v1/buyer/outlets/users");
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the outlets of each user."));
  }
};

/** Replaces the outlets assigned to a user. */
export const setUserOutlets = async (userId: string, outletIds: string[]): Promise<void> => {
  try {
    await axiosInstance.put(`/api/v1/buyer/outlets/users/${userId}`, { outletIds });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not assign the outlets to the user."));
  }
};
