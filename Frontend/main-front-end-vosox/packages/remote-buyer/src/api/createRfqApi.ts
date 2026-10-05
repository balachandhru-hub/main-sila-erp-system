import type { CreateRFQApi } from "@vosox/shared-ui";
import {
  getBuyerProfile,
  getAllDepartments,
  getAllCostCenters,
  getAllItemMasters,
  createRFQ,
  getVerifiedSuppliers,
  getUnspscSegments,
  getUnspscFamilies,
  fetchBuyerVerificationTemplates,
  fetchBuyerVerificationTemplateById,
  createItemMaster,
  getMasterApprovalFlows,
  checkItemMasterSimilarity,
  uploadItemMasterFile,
} from "./Buyerapi";
import { getCountries, getUnits, getCurrencies, fetchReferenceList } from "./masterdataApi";
import { getOrganizationUsersForRfq } from "../../../remote-platform-user/src/api/networkAdminApi";

/** The API functions the shared CreateRFQ screen calls. */
export const createRfqApi: CreateRFQApi = {
  getBuyerProfile,
  getAllDepartments,
  getAllCostCenters,
  getAllItemMasters,
  createRFQ,
  getVerifiedSuppliers,
  getUnspscSegments,
  getUnspscFamilies,
  fetchBuyerVerificationTemplates,
  fetchBuyerVerificationTemplateById,
  getCountries,
  getUnits,
  getCurrencies,
  fetchReferenceList,
  itemMaster: { createItemMaster, getMasterApprovalFlows, checkItemMasterSimilarity },
  itemMasterUpload: { uploadItemMasterFile, getMasterApprovalFlows },
  supplierUsers: { getOrganizationUsersForRfq },
};
