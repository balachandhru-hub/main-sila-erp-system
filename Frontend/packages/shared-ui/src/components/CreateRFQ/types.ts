/* ---------------------------------- RFQ domain DTOs ----------------------------------
 * Mirrors packages/remote-buyer/src/dto/rfqDto.ts. Kept local to this component group
 * (instead of importing from remote-buyer) so shared-ui never depends on a remote's
 * source, which every remote depends on in turn.
 */

export interface RfqDocumentAssetDto {
  entityType: string;
  entityId: string;
  assetType: string;
  fileBytes: string;
  fileName: string;
  contentType: string;
  isSingletonAsset: boolean;
  id?: string;
}

export interface RfqQuestionDto {
  id?: string;
  rfqQuestionId?: string;
  question: string;
  questionType: string;
  isRequired: boolean;
  displayOrder: number;
  options: string[];
}

export interface RfqItemDto {
  id?: string;
  description: string;
  quantity: number;
  uom: string;
  materialCode: string;
  materialGroup: string;
  costCenter: string;
  attachments: RfqDocumentAssetDto[];
}

export interface ExternalSupplierDto {
  supplierName: string;
  email: string;
  phoneNumber: string;
  address: string;
}

export interface SupplierInviteDto {
  supplierId: string;
  userIds: string[];
}

export interface CreateRFQPayload {
  title: string;
  description: string;
  department: string;
  region: string;
  currency: string;
  deliveryLocation: string;
  startDate: string;
  endDate: string;
  deliveryTargetDate: string;
  budget: number;
  addLotOption: boolean;
  segmentId?: string;
  segmentTitle?: string;
  familyId?: string;
  familyTitle?: string;
  technicalSpecificationDocuments: RfqDocumentAssetDto[];
  termsConditionDocuments: RfqDocumentAssetDto[];
  questions: RfqQuestionDto[];
  items: RfqItemDto[];
  supplierIds: string[];
  supplierInvites?: SupplierInviteDto[];
  externalSuppliers?: ExternalSupplierDto[];
  rfqVerificationTemplateId: string | null;
}

export interface CreateRFQResponse {
  statusCode?: number;
  message?: string;
  description?: string;
  id: string;
}

export type SupplierVerificationType = "VERIFIED" | "UNVERIFIED";

export interface VerifiedSupplierSearchPayload {
  index: number;
  limit: number;
  searchTerm?: string;
  segmentCode?: string;
  familyCode?: string;
  type?: SupplierVerificationType;
  buyerId: string;
}

export interface VerifiedSupplierDto {
  supplierId: string;
  supplierName: string;
  snid: string;
  email: string;
  isVerified: boolean;
  organizationId?: string;
}

/* ---------------------------------- Masterdata DTOs ---------------------------------- */

export interface UnspscSegmentDto {
  segment: number;
  title: string;
}

export interface UnspscFamilyDto {
  family: number;
  title: string;
}

export interface CountryDto {
  id: string;
  countryName: string;
  countryCode: string;
  mobileCountryCode: string;
}

export interface UnitDto {
  id: string;
  key: string;
  type: string;
  description: string;
}

export interface CurrencyDto {
  id: string;
  currencyName: string;
  sortNumber: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  index: number;
  limit: number;
}

/* ---------------------------------- Verification template DTOs ---------------------------------- */

export interface TemplateQuestion {
  questionId: string;
  question: string;
  questionKey: string;
  questionType: string;
  displayOrder: number;
  answer: string;
  options: string[];
  isRequired: boolean;
}

export interface VerificationTemplate {
  templateId: string;
  templateCode: string;
  templateName: string;
  templateType: string;
  questions: TemplateQuestion[];
}

/* ---------------------------------- Item master DTOs ---------------------------------- */

export interface ItemMasterDto {
  id: string;
  buyerId: string;
  description: string;
  materialCode: string;
  materialGroup: string;
  productType?: string;
  baseUnitOfMeasure?: string;
  orderUnitOfMeasure?: string;
  alternateUnitOfMeasure?: string;
  valuationClass?: string;
  unitOfMeasureMapping?: string;
  subUnit?: string;
  microUnit?: string;
  approvalFlowId?: string;
  comment?: string;
}

export interface CreateItemMasterRequestDto {
  buyerId: string;
  description: string;
  materialCode: string;
  materialGroup: string;
  productType?: string;
  baseUnitOfMeasure?: string;
  orderUnitOfMeasure?: string;
  alternateUnitOfMeasure?: string;
  valuationClass?: string;
  unitOfMeasureMapping?: string;
  subUnit?: string;
  microUnit?: string;
  approvalFlowId?: string;
  comment?: string;
}

export interface MasterApprovalFlowDto {
  id: string;
  approvalCode: string;
  approvalName: string;
  buyerId: string;
}

export interface ItemMasterSimilarityDto {
  id: string;
  materialCode: string;
  description: string;
}

export interface UploadItemMasterDocumentDto {
  entityType: string;
  entityId: string;
  assetType: string;
  fileBytes: string;
  fileName: string;
  contentType: string;
  isSingletonAsset: boolean;
  id?: string;
}

export interface UploadItemMasterFilePayload {
  document: UploadItemMasterDocumentDto;
  organizationId: string;
  buyerId: string;
  title: string;
  approvalFlowId: string;
  comment: string;
}

export interface ItemMasterUploadResultDto {
  totalRows: number;
  successfulUploads: number;
  failedUploads: number;
  errors: string[];
  excelMaterialMasterId: string;
}

/* ---------------------------------- Supplier user DTO (for SupplierUsersModal) ---------------------------------- */

export interface SupplierRfqUserDto {
  id: string;
  name: string;
  email: string;
  userRole?: string;
}

/* ---------------------------------- Injected API contracts ----------------------------------
 * Every backend call these components need is supplied by the host app as props, instead of
 * being imported here. This keeps shared-ui free of any dependency on a specific remote's
 * axios instance/auth, and lets each host pass its own already-working API module.
 */

export interface ItemMasterModalApi {
  createItemMaster: (payload: CreateItemMasterRequestDto) => Promise<ItemMasterDto>;
  getMasterApprovalFlows: (buyerId: string, index?: number, limit?: number) => Promise<MasterApprovalFlowDto[]>;
  checkItemMasterSimilarity: (buyerId: string, description: string, materialGroup: string) => Promise<ItemMasterSimilarityDto[]>;
}

export interface ItemMasterUploadModalApi {
  uploadItemMasterFile: (payload: UploadItemMasterFilePayload) => Promise<ItemMasterUploadResultDto>;
  getMasterApprovalFlows: (buyerId: string, index?: number, limit?: number) => Promise<MasterApprovalFlowDto[]>;
}

export interface SupplierUsersModalApi {
  getOrganizationUsersForRfq: (organizationId: string) => Promise<SupplierRfqUserDto[]>;
}

export interface CreateRFQApi {
  getBuyerProfile: () => Promise<{ id: string; organizationId?: string } | null>;
  getAllDepartments: (buyerId: string, index?: number, limit?: number, searchTerm?: string) => Promise<any>;
  getAllCostCenters: (departmentId: string, index?: number, limit?: number, searchTerm?: string) => Promise<any>;
  getAllItemMasters: (buyerId: string, index?: number, limit?: number, searchTerm?: string) => Promise<any>;
  createRFQ: (payload: CreateRFQPayload) => Promise<CreateRFQResponse>;
  getVerifiedSuppliers: (payload: VerifiedSupplierSearchPayload) => Promise<VerifiedSupplierDto[]>;
  getUnspscSegments: (pageIndex?: number, pageSize?: number, searchTerm?: string) => Promise<UnspscSegmentDto[]>;
  getUnspscFamilies: (segment: number, pageIndex?: number, pageSize?: number) => Promise<UnspscFamilyDto[]>;
  fetchBuyerVerificationTemplates: (index?: number, limit?: number, organizationId?: string) => Promise<VerificationTemplate[] | { statusCode: number; message?: string }>;
  fetchBuyerVerificationTemplateById: (templateId: string) => Promise<VerificationTemplate | { statusCode: number; message?: string }>;
  getCountries: (index: number, limit: number, searchTerm?: string) => Promise<PagedResult<CountryDto> | { statusCode: number }>;
  getUnits: (index: number, limit: number, searchTerm?: string) => Promise<PagedResult<UnitDto> | { statusCode: number }>;
  getCurrencies: (index: number, limit: number) => Promise<PagedResult<CurrencyDto> | { statusCode: number }>;
  fetchReferenceList: (keys: string[]) => Promise<any[] | { statusCode: number }>;
  itemMaster: ItemMasterModalApi;
  itemMasterUpload: ItemMasterUploadModalApi;
  supplierUsers: SupplierUsersModalApi;
}
