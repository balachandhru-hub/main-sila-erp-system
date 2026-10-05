import type { SilaMeRole } from "./silaMeNav";

/**
 * What each SILA ME role may do in the screens, mirroring the role → feature grants seeded in Identity
 * (RoleFeatureMapping.csv). It only decides what the UI offers; the API checks every call again.
 */
export interface SilaMePermissions {
  manageLocation: boolean;
  manageMasterData: boolean;
  manageTransfer: boolean;
  approveTransfer: boolean;
  postGoodsIssue: boolean;
  postAdjustment: boolean;
  manageCount: boolean;
  approveCount: boolean;
  requestPurchase: boolean;
  manageRecipe: boolean;
  approveRecipe: boolean;
  approvePrice: boolean;
  managePos: boolean;
  postGrn: boolean;
  manageErpPosting: boolean;
  viewAudit: boolean;
}

const NONE: SilaMePermissions = {
  manageLocation: false, manageMasterData: false, manageTransfer: false, approveTransfer: false, postGoodsIssue: false,
  postAdjustment: false, manageCount: false, approveCount: false, requestPurchase: false, manageRecipe: false,
  approveRecipe: false, approvePrice: false, managePos: false, postGrn: false, manageErpPosting: false, viewAudit: false,
};

const BY_ROLE: Record<SilaMeRole, SilaMePermissions> = {
  admin: Object.fromEntries(Object.keys(NONE).map((key) => [key, true])) as unknown as SilaMePermissions,
  "store-manager": {
    ...NONE, manageTransfer: true, approveTransfer: true, postGoodsIssue: true, postAdjustment: true, manageCount: true,
    approveCount: true, requestPurchase: true, manageRecipe: true, approveRecipe: true, approvePrice: true, postGrn: true,
    manageErpPosting: true,
  },
  "outlet-manager": {
    ...NONE, manageTransfer: true, approveTransfer: true, postAdjustment: true, manageCount: true, requestPurchase: true,
    manageRecipe: true, approveRecipe: true, approvePrice: true,
  },
  "buyer-user": { ...NONE, manageTransfer: true, manageCount: true, approveRecipe: true, approvePrice: true, postGrn: true },
  "cost-controller": {
    ...NONE, manageTransfer: true, manageCount: true, approveCount: true, approveRecipe: true, approvePrice: true, postGrn: true,
    viewAudit: true,
  },
};

export const silaMePermissions = (role: SilaMeRole): SilaMePermissions => BY_ROLE[role];
