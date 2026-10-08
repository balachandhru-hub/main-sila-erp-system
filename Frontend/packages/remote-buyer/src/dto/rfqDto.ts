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

export interface RfqAssetAttachmentDto {
  id: string;
  assetType?: string;
  assetName?: string;
  fileType?: string;
  fileName?: string;
}

export interface SupplierTermsConditionStatusDto {
  termsAndCondition: boolean;
  supplierId: string;
  supplierName: string;
  attachments: RfqAssetAttachmentDto[];
}

export interface SupplierEsignStatusDto {
  supplierId: string;
  supplierName: string;
  attachments: RfqAssetAttachmentDto[];
}

export interface RfqQuestionOptionDto {
  id: string;
  label: string;
}

export interface RfqQuestionDto {
  id?: string; 
  rfqQuestionId?: string; 
  question: string;
  questionType: string;
  isRequired: boolean;
  displayOrder: number;
  options: string[];
  
  questionOptions?: RfqQuestionOptionDto[];
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
  statusCode: number;
  message: string;
  description: string;
  id: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  description: string;
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

export interface BuyerSupplierQuotationItem {
  id?: string;
  supplierRFQItemId?: string;
  buyerRFQItemId?: string;
  quotedPrice: number;
  tax?: number | null;
  discount?: number | null;
}

export interface RfqAnswerDto {
  rfqQuestionId: string;
  answer: string;
  attachment: RfqDocumentAssetDto | null;
  questionOptionId: string | null;
  questionOptionIds: string[];
}

export interface RfqSupplierAnswersDto {
  supplierRFQId: string;
  answers: RfqAnswerDto[];
}

export interface BuyerSupplierQuotation {
  totalPrice: number | null;
  deliveryCharge: number | null;
  tax: number | null;
  discount: number | null;
  deliveryType: string | null;
  status: string | null;
  supplierQuotationItems: BuyerSupplierQuotationItem[] | null;
  quotationId: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  isLead?: boolean;
  supplierRFQId?: string;
  isAwarded?: boolean;
}

export interface InvitedUserDto {
  rfqId: string;
  supplierId: string;
  organizationId: string;
  userId: string;
  name: string;
  email: string;
  userName: string;
}

export interface RfqSupplierRefDto {
  supplierId: string;
  supplierName: string;
}

export interface RfqExternalSupplierRefDto {
  externalSupplierId: string;
  externalSupplierName: string;
  supplierType: string;
}

export interface BuyerRFQDetailResponse {
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
  technicalSpecificationDocuments: RfqDocumentAssetDto[];
  termsConditionDocuments: RfqDocumentAssetDto[];
  questions: RfqQuestionDto[];
  items: RfqItemDto[];
  supplierIds: RfqSupplierRefDto[];
  externalSupplierIds?: RfqExternalSupplierRefDto[];
  invitedUsers?: InvitedUserDto[] | null;
  rfqVerificationTemplateId: string | null;
  supplierQuotation: BuyerSupplierQuotation[];
  supplierAnswers?: RfqSupplierAnswersDto | null;
  status?: string;
  supplierESigns?: SupplierEsignStatusDto[];
  supplierTermsConditions?: SupplierTermsConditionStatusDto[];
  /** Per supplier: whether the buyer has accepted that supplier's terms & conditions. */
  buyerTermsAndConditionStatuses?: {
    supplierId: string;
    supplierName: string;
    buyerTermsAndConditionAccepted: 'ACCEPTED' | 'REJECTED' | 'PENDING';
    isSupplierInvitedForContract?: boolean;
  }[];
  /** Whether the buyer has already accepted the supplier's terms & conditions. */
  supplierTermsAndConditionAccepted?: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  /** Contracts already created for this RFQ, one per supplier. */
  contracts?: {
    contractId: string;
    contractNumber: string;
    supplierId: string;
  }[];
}