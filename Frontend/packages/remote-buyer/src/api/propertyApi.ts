import axiosInstance from "./axiosInstance";
import { getMasterApprovalFlows, type MasterApprovalFlowDto } from "./Buyerapi";
import { readError } from "./readError";

/** A property (plant): its outlets share one weekly bucket and one approval flow. */
export interface Property {
  id: string;
  companyCode: string;
  plantCode: string;
  propertyName: string;
  /** Approval flow (type WEEKLY_BUCKET) started when the property's bucket is frozen. */
  masterApprovalFlowId?: string | null;
  approvalName?: string | null;
}

export interface PropertyWrite {
  companyCode: string;
  plantCode: string;
  propertyName: string;
  masterApprovalFlowId: string | null;
}

export const getProperties = async (): Promise<Property[]> => {
  try {
    const response = await axiosInstance.get<Property[]>("/api/v1/buyer/properties");
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load properties."));
  }
};

export const createProperty = async (payload: PropertyWrite): Promise<void> => {
  try {
    await axiosInstance.post("/api/v1/buyer/properties", payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not create the property."));
  }
};

export const updateProperty = async (propertyId: string, payload: PropertyWrite): Promise<void> => {
  try {
    await axiosInstance.put(`/api/v1/buyer/properties/${propertyId}`, payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the property."));
  }
};

/** Maps a catalog product to a material of the buyer's Item Master; the material code goes on the purchase order. */
export const setCatalogMaterialMapping = async (catalogId: string, materialId: string): Promise<void> => {
  try {
    await axiosInstance.put("/api/v1/buyer/catalog-material-mapping", { catalogId, materialId });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not map the material."));
  }
};

/** Every approval flow of type WEEKLY_BUCKET of the buyer. */
export const getWeeklyBucketApprovalFlows = async (buyerId: string): Promise<MasterApprovalFlowDto[]> => {
  const collected: MasterApprovalFlowDto[] = [];
  const seen = new Set<string>();
  for (let page = 0; page < 10; page += 1) {
    const batch = await getMasterApprovalFlows(buyerId, page * 50, 50);
    const fresh = batch.filter((flow) => !seen.has(flow.id));
    fresh.forEach((flow) => seen.add(flow.id));
    collected.push(...fresh);
    if (batch.length < 50 || fresh.length === 0) break;
  }
  return collected.filter((flow) => (flow.type ?? "").toUpperCase() === "WEEKLY_BUCKET");
};
