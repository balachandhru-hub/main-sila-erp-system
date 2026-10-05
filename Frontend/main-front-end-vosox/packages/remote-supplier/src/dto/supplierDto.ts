// supplierDto.ts

// ============================================================================
// METADATA / REFERENCE LIST DTOs
// ============================================================================

export type MetadataReferenceType =
  | 'INDUSTRY'
  | 'BUSINESS_TYPE'
  | 'DOCUMENT_TYPE'
  | 'ENTITY_TYPE'
  | 'CATALOG_TYPE';

export interface MetadataReferenceItem {
  id: string;
  key: string;
  type: MetadataReferenceType;
  description: string | null;
}
export interface CurrencyItem {
  id: string;
  currencyName: string;
  sortNumber: number;
}

export interface CurrencyListResponse {
  items: CurrencyItem[];
  totalCount: number;
  index: number;
  limit: number;
}
export interface SupplierCatalogAssetItem {
  id: string;
  assetType: string | null;
  assetName: string;
  fileType: string | null;
  fileName: string;
}

export interface SupplierCatalogListItem {
  id: string;
  catalogName: string;
  description: string;
  price: number;
  currency: string;
  unitOfMeasure: string;
  segment: number;
  segmentTitle: string;
  family: number;
  familyTitle: string;
  commodity: number;
  commodityTitle: string;
  class: number;
  classTitle: string;
  catalogType: string;
  isPunchOut: boolean;
  punchOutUrl: string;
  assets: SupplierCatalogAssetItem[];
}
export type MetadataReferenceListRequest = MetadataReferenceType[];
export type MetadataReferenceListResponse = MetadataReferenceItem[];
// ============================================================================
// SUPPLIER CATALOG DETAIL DTOs
// ============================================================================

export interface CatalogDetailAssetItem {
  id: string;
  assetType: string | null;
  assetName: string;
  fileType: string | null;
  fileName: string;
}
export interface CatalogDetailResponseItem {
  supplierId: string;
  catalogId: string;
  supplierName: string;
  catalogName: string;
  description: string;
  price: number;
  currency: string;
  unitOfMeasure: string;
  segment: number;
  segmentTitle: string;
  family: number;
  familyTitle: string;
  commodity: number;
  commodityTitle: string;
  class: number;
  classTitle: string;
  catalogType: string;
  sku?: string | null;
  availableStock?: number | null;
  discountPercent?: number | null;
  asset: CatalogDetailAssetItem[];
  isPunchOut: boolean;
  punchOutUrl: string;
}

// Response is an array (even though single catalogId is passed)
export type CatalogDetailResponse = CatalogDetailResponseItem[];
// ============================================================================
// SUPPLIER BUSINESS PROFILE
// ============================================================================

export interface BusinessProfileDto {
  organizationName: string;
  email: string;
  phone: string;
  emailVerified?: boolean;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
  industry: string;      // metadata key from INDUSTRY, e.g. 'MANUFACTURING'
  businessType: string;  // metadata key from BUSINESS_TYPE, e.g. 'EXPORTER'
  employeeCount: number;
  annualTurnover: number;
  currency: string;
  yearEstablished: number;
  website: string;
  description: string;
  status?: string; // 'PENDING' | 'APPROVED' | 'REJECTED'
}

// ============================================================================
// REGISTRATIONS / CERTIFICATIONS
// ============================================================================

export interface AssetDto {
  id?: string;
  entityType: string; // metadata key from ENTITY_TYPE, e.g. 'SUPPLIER'
  entityId: string;
  assetType: string;  // metadata key from DOCUMENT_TYPE, e.g. 'GST'
  fileName: string;
  contentType: string;
  isSingletonAsset: boolean;
  fileBytes: string;
}

export interface RegistrationDto {
  id?: string;
  registrationType: string; // metadata key from DOCUMENT_TYPE
  registrationNumber: string;
  registrationName: string;
  asset: AssetDto | null;
  expiryDate: string | null;
}

// ============================================================================
// BANK ACCOUNTS
// ============================================================================

export interface BankAccountDto {
  id?: string;
  accountHolderName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  ifscCode: string;
  swiftCode: string;
  iban: string;
  currency: string;
  isPrimary: boolean;
}

// ============================================================================
// DISPATCH LOCATIONS
// ============================================================================

export interface DispatchLocationDto {
  id?: string;
  locationName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  isDefault: boolean;
}

export interface CategoryDto {
  segment?: number;
  segmentTitle?: string;
  family?: number;
  familyTitle?: string;
  class?: number;
  classTitle?: string;
  commodity?: number;
  commodityTitle?: string;
}

// ============================================================================
// SUPPLIER PROFILE — READ (GET /supplier/profile)
// ============================================================================

export interface SupplierProfileResponse {
  id: string;
  organizationId: string;
  businessProfile: BusinessProfileDto;
  registrations: (Omit<RegistrationDto, 'asset'> & {
    asset?: {
      id?: string;
      assetType: string;
      fileName: string;
      contentType: string;
    };
  })[];
  bankAccounts: BankAccountDto[];
  dispatchLocations: DispatchLocationDto[];
  categories?: CategoryDto[];
  supplierCategories?: CategoryDto[];
}

// ============================================================================
// SUPPLIER PROFILE — CREATE (POST /supplier/register)
// ============================================================================

export interface CreateSupplierProfilePayload {
  organizationId: string | null;
  businessProfile: BusinessProfileDto;
  registrations: RegistrationDto[];
  bankAccounts: BankAccountDto[];
  dispatchLocations: DispatchLocationDto[];
  supplierCategories?: CategoryDto[];
}

// ============================================================================
// SUPPLIER PROFILE — UPDATE REJECTED (PUT /supplier/update-rejected-supplier)
// ============================================================================

export interface UpdateRejectedSupplierPayload {
  supplier: {
    supplierId: string;
    businessProfile: BusinessProfileDto;
    registrations: RegistrationDto[];
    bankAccounts: BankAccountDto[];
    dispatchLocations: DispatchLocationDto[];
    supplierCategories?: CategoryDto[];
  };
}

// ============================================================================
// RFQ DATA DTOs
// ============================================================================

export interface RFQMasterDataItem {
  rfqNumber: string;
  title: string;
  endDate: string;
  deliveryLocation: string;
  organizationName: string;
  rfqId: string;
  supplierRFQId?: string;
  status?: string | null;
}

export interface RFQDetailDocument {
  id: string;
  assetType: string;
  assetName: string;
  fileType: string;
  fileName: string;
}
export interface RFQQuestionOption {
  optionId: string;
  optionText: string;
  displayOrder: number;
}

export interface RFQQuestionAttachment {
  id: string;
  assetType: string;
  assetName: string;
  fileType: string;
  fileName: string;
}
export interface RFQQuestion {
  questionId: string;
  question: string;
  questionType: string;
  isRequired: boolean;
  displayOrder: number;
  options: RFQQuestionOption[];
  attachments: RFQQuestionAttachment[];
}

export interface RFQDetailItem {
  id?: string;
  buyerRFQItemId?: string;
  supplierRFQItemId?: string;
  supplierRFQId?: string;
  description: string;
  quantity: number;
  uom: string;
  materialCode: string;
  materialGroup: string;
  costCenter: string;
  costCenterName: string;
  attachments: RFQDetailDocument[];
  questions: RFQQuestion[];
  isAwarded?: boolean;
  awardedSupplierId?: string;
}

export interface RFQSupplierQuotation {
  id?: string;
  qutationId?: string;
  totalPrice: number;
  deliveryCharge: number;
  tax: number;
  discount: number;
  deliveryType: string;
  status: string;
  discountType?: string;
  taxType?: string;
  isLead?: boolean;
  rank?: string | number;
}

export interface RFQSupplierQuotationItem {
  id?: string;
  supplierRFQItemId?: string;
  buyerRFQItemId?: string;
  quotedPrice: number;
  deliveryCharge?: number;
  deliveryType?: string;
  discount?: number;
  discountType?: string;
  tax?: number;
  taxType?: string;
  subTotal?: number;
  quotedAmount?: number;
  rank?: string | number;
  isLineitemAvailable?: boolean;
}

export interface RFQDetailResponse {
  title: string;
  description: string;
  deliveryLocation: string;
  startDate: string;
  endDate: string;
  addLotOption: boolean;
  questions: RFQQuestion[];
  technicalSpecificationDocuments: RFQDetailDocument[];
  termsConditionDocuments: RFQDetailDocument[];
  items: RFQDetailItem[];
  supplierQuotation: RFQSupplierQuotation[];
  supplierQuotationItems: RFQSupplierQuotationItem[];
  /** The supplier's own e-signature documents for this RFQ. */
  eSignDocuments?: RFQDetailDocument[];
  /** true when the supplier submitted their own Terms & Conditions. */
  supplierTermsAndCondition?: boolean;
  supplierTermsConditionDocuments?: RFQDetailDocument[];
  /** "ACCEPTED" once the buyer has accepted - drives the "Buyer — Accepted" status. */
  buyerTermsAndConditionAccepted?: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  status?: string;
  /** "CONTRACT_CREATED" once the buyer has created the contract for an awarded RFQ; null before that. */
  contractStatus?: string | null;
  contractId?: string | null;
  buyerId?: string;
  buyerName?: string;
  isSupplierInvitedForContract?: boolean;
}

export interface SupplierContractDto {
  id: string;
  contractNumber: string;
  contractName: string;
  rfqId: string;
  rfqNumber: string;
  rfqTitle: string;
  startDate: string;
  endDate: string;
  amount: number;
  dateCreated: string;
  attachments: {
    id: string;
    assetId: string;
    type: string;
    fileName: string;
  }[];
  approvalFlows: {
    id: string;
    approvalCode: string;
    approvalName: string;
    contractId: string;
    type: string;
    totalAmount: number;
    currency: string;
  }[];
}

export interface SubmitQuotationPayload {
  supplierQuotationId?: string | null;
  supplierRFQId?: string | null;
  totalPrice: number;
  deliveryCharge: number;
  deliveryType: string;
  discount: number;
  discountType: string;
  tax: number;
  taxType: string;
  temporaryVerificationToken?: string;
  items?: {
    supplierRFQItemId?: string | null;
    buyerRFQItemId: string;
    quotedPrice: number;
    deliveryCharge?: number;
    deliveryType?: string;
    discount?: number;
    discountType?: string;
    tax?: number;
    taxType?: string;
    isLineitemAvailable?: boolean;
  }[];
}
// ============================================================================
// SUPPLIER CATALOG (POST /supplier/catalog)
// ============================================================================

export interface CatalogAssetDto {
  id?: string;
  entityType: string;
  entityId: string;
  assetType: string;
  fileBytes: string;
  fileName: string;
  contentType: string;
  isSingletonAsset: boolean;
}


export interface CatalogDetailDto {
  id?: string;
  catalogName: string;
  description: string;
  price: number;
  unitOfMeasure: string;
  sku?: string | null;
  availableStock?: number | null;
  discountPercent?: number | null;
  catalogType: string;
  segment: number;
  segmentTitle: string;
  family: number;
  familyTitle: string;
  commodity: number;
  commodityTitle: string;
  class: number;
  classTitle: string;
  isPunchOut: boolean;
  punchOutUrl: string;
  assets: CatalogAssetDto[];
}

export interface UpdateCatalogStockPayload {
  sku: string;
  availableStock: number | null;
  discountPercent: number | null;
}

export interface CreateSupplierCatalogPayload {
  organizationId: string;
  catalog: CatalogDetailDto;
}

export interface RfqDocumentAssetDto {
  entityType: string;
  entityId: string;
  assetType: string;
  fileBytes: string;
  fileName: string;
  contentType: string;
  isSingletonAsset?: boolean;
  id?: string;
}

export interface SubmitRfqAnswerItemDto {
  rfqQuestionId: string;
  answer?: string;
  questionOptionId?: string | null;
  questionOptionIds?: string[];
  attachment?: RfqDocumentAssetDto | null;
}

export interface SubmitRfqAnswersPayload {
  supplierRFQId: string;
  supplierId: string;
  answers: SubmitRfqAnswerItemDto[];
}
export interface ErrorResponseDto {
  status_code: number;
  message: string;
  description: string;
}

export interface OtpActionResponse {
  success?: boolean;
  statusCode: number;
  message: string;
  description: string;
  token?: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

// ============================================================================
// SUPPLIER QUOTATION BY SUPPLIER ID (per-supplier RFQ quotation)
// ============================================================================

export interface SupplierQuotationByIdItem {
  supplierRFQId: string;
  supplierId: string;
  supplierName: string;
  totalPrice: number;
  deliveryCharge: number | null;
  tax: number | null;
  discount: number | null;
  deliveryType: string | null;
  status: string;
  quotationId: string;
  isLead?: boolean;
  currency?: string;
  rank?: string | number;
  isAwarded?: boolean;
  supplierQuotationItems: {
    quotedPrice: number;
    supplierRFQItemId?: string;
    buyerRFQItemId?: string;
    itemQuotationId?: string;
    itemQutationId?: string;
    deliveryCharge?: number | null;
    deliveryType?: string | null;
    discount?: number | null;
    discountType?: string | null;
    tax?: number | null;
    taxType?: string | null;
    quotedAmount?: number;
    subTotal?: number;
    isLineitemAvailable?: boolean;
    lineNumber?: number;
    rank?: string | number;
    isAwarded?: boolean;
  }[];
}

export interface SupplierQuotationBySupplierIdResponse {
  suppliers: SupplierQuotationByIdItem[];
}