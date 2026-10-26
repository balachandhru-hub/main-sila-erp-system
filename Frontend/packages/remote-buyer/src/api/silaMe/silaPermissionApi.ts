import axiosInstance from "../axiosInstance";
import {
  silaMePermissions,
  silaMePermissionsFromCodes,
  type SilaMePermissions,
} from "../../components/silaMe/silaMePermissions";
import type { SilaMeRole } from "../../components/silaMe/silaMeNav";

/** Identity permission codes for the signed-in role. */
export const loadSilaMePermissionCodes = async (): Promise<string[]> => {
  const response = await axiosInstance.get<string[]>("/api/v1/identity/auth/permissions");
  return Array.isArray(response.data) ? response.data : [];
};

/**
 * Live permission flags from Identity. Role templates are used only when the list cannot be loaded.
 * They no longer imply invoice or credit memo from POST_SILA_GRN.
 */
export const loadSilaMePermissions = async (role: SilaMeRole): Promise<SilaMePermissions> => {
  const fallback = silaMePermissions(role);
  try {
    return silaMePermissionsFromCodes(await loadSilaMePermissionCodes(), fallback);
  } catch {
    return fallback;
  }
};
