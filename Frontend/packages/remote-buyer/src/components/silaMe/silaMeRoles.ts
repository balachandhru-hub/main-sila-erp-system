import type { SilaMeRole } from "./silaMeNav";

/** Identity role names of the buyer-side users who can work in SILA ME. */
export const SILA_ME_ROLE_NAMES = {
  OUTLET_MANAGER: "OUTLET_MANAGER",
  STORE_MANAGER: "STORE_MANAGER",
  COST_CONTROLLER: "COST_CONTROLLER",
} as const;

/**
 * The SILA ME role of the signed-in user, from their Identity role name.
 * A cost controller watches costs, stock and variances across the property (full SILA access in the backend).
 */
export const silaMeRoleOf = (roleName: string, isAdmin: boolean): SilaMeRole => {
  if (isAdmin) return "admin";
  switch ((roleName || "").toUpperCase()) {
    case SILA_ME_ROLE_NAMES.STORE_MANAGER:
      return "store-manager";
    case SILA_ME_ROLE_NAMES.OUTLET_MANAGER:
      return "outlet-manager";
    case SILA_ME_ROLE_NAMES.COST_CONTROLLER:
      return "cost-controller";
    default:
      return "buyer-user";
  }
};
