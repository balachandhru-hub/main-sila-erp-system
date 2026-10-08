export interface AssetDto {
  id?: string;
  assetType?: string | null;
  assetName?: string;
  fileType?: string | null;
  fileName?: string;
}
export interface ErrorResponseDto {
  status_code: number;
  message: string;
  description: string;
}
export interface RegistrationDto {
  registrationType?: string;
  registrationNumber?: string;
  registrationName?: string;
  asset?: AssetDto;
  expiryDate?: string | null;
}

export interface BankAccountDto {
  accountHolderName?: string;
  bankName?: string;
  branchName?: string;
  accountNumber?: string;
  ifscCode?: string;
  swiftCode?: string;
  iban?: string;
  currency?: string;
  isPrimary?: boolean;
  isVerified?: boolean;
}

export interface DispatchLocationDto {
  id?: string; 
  locationName?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  country?: string;
  pinCode?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  isDefault?: boolean;
}

export interface BusinessProfileDto {
  organizationName?: string;
  email?: string;
  phone?: string;
  country?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  industry?: string;
  businessType?: string;
  employeeCount?: number;
  annualTurnover?: number;
  currency?: string;
  yearEstablished?: number;
  website?: string;
  description?: string;
  status?: string;
  comments?: string | null;
  isActive?: boolean;
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

export interface BuyerDto {
  id: string;
  organizationId: string;
  isActive?: boolean;
  businessProfile?: BusinessProfileDto;
  categories?: CategoryDto[];
  buyerCategories?: CategoryDto[];
  registrations?: RegistrationDto[];
  bankAccounts?: BankAccountDto[];
  dispatchLocations?: DispatchLocationDto[];
}

export interface SupplierDto {
  id: string;
  organizationId: string;
  isActive?: boolean;
  businessProfile?: BusinessProfileDto;
  categories?: CategoryDto[];
  supplierCategories?: CategoryDto[];
  registrations?: RegistrationDto[];
  bankAccounts?: BankAccountDto[];
  dispatchLocations?: DispatchLocationDto[];
}

export interface PaginationParamsDto {
  index: number;
  limit: number;
}

export interface AssetDownloadResponseDto {
  assetId: string;
  fileName: string;
  contentType: string;
  fileBytes: string;
}

export type PlatformEntityType = 'buyers' | 'suppliers';
export type PlatformRecordDto = BuyerDto | SupplierDto;