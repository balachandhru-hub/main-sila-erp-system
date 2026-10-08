import type {
  RFQDetailDocument,
  RFQDetailItem,
  RFQQuestion,
  RFQSupplierQuotation,
} from './supplierDto';

export interface InvitedUserDto {
  rfqId: string;
  supplierId: string;
  organizationId: string;
  userId: string;
  name: string;
  email: string;
  userName: string;
}

export interface ExternalSupplierQuotationItem {
  quotedPrice: number;
  supplierRFQItemId?: string | null;
  itemQuotationId?: string | null;
  buyerRFQItemId?: string | null;
  deliveryCharge?: number | null;
  deliveryType?: string | null;
  discount?: number | null;
  discountType?: string | null;
  tax?: number | null;
  taxType?: string | null;
  quotedAmount?: number;
  subTotal?: number;
  lineNumber?: number;
  rank?: string | number | null;
  isLineitemAvailable?: boolean;
}

export interface ExternalRFQDetailResponse {
  buyerName?: string;
  externalSupplierName?: string;
  title: string;
  description: string;
  deliveryLocation: string;
  startDate: string;
  endDate: string;
  addLotOption: boolean;
  technicalSpecificationDocuments: RFQDetailDocument[];
  termsConditionDocuments: RFQDetailDocument[];
  items: RFQDetailItem[];
  supplierQuotation: RFQSupplierQuotation[];
  supplierQuotationItems: ExternalSupplierQuotationItem[];
  questions: RFQQuestion[];
  invitedUsers: InvitedUserDto[];
  status?: string;
}

export interface ExternalQuotationItemPayload {
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
}

export interface ExternalSubmitQuotationPayload {
  supplierQuotationId?: string | null;
  supplierRFQId?: string | null;
  totalPrice: number;
  deliveryCharge: number;
  deliveryType: string;
  discount: number;
  discountType: string;
  tax: number;
  taxType: string;
  temporaryVerificationToken: null;
  items?: ExternalQuotationItemPayload[];
}

export interface ExternalSubmitQuotationResponse {
  statusCode: number;
  message: string;
  description: string;
  id: string;
}

export interface ExternalAssetDto {
  assetId: string;
  fileName: string;
  contentType: string;
  fileBytes: string;
}
