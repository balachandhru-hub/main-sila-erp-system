import type { BuyerDto, SupplierDto } from './platformDto';
export type NetworkAdminProfileResponse = BuyerDto | SupplierDto;
export interface OrganizationUserDto {
  personId: string;
  userId: string;
  name: string;
  email: string;
  userName: string;
  roleId: string;
  roleName: string;
}

export interface CreatePersonRequestDto {
  name: string;
  email: string;
  phone: string;
  country: string;
  addressLine: string;
  userName: string;
  password: string;
  roleId: string;
}

export interface CountryDto {
  id: string;
  countryName: string;
  countryCode: string;
  mobileCountryCode: string;
}


export interface CountriesResponseDto {
  items: CountryDto[];
  totalCount: number;
  index: number;
  limit: number;
}


export interface ErrorResponseDto {
  statusCode: number;
  message: string;
  description: string;
}

// export interface NetworkAdminProfileResponse {
//   id: string;
//   organizationId: string;
//   businessProfile: {
//     organizationName: string;
//     email: string;
//     phone: string;
//     country: string;
//     addressLine1: string;
//     addressLine2: string;
//     city: string;
//     state: string;
//     pinCode: string;
//     industry: string;
//     businessType: string;
//     employeeCount: number;
//     annualTurnover: number;
//     currency: string;
//     yearEstablished: number;
//     website: string;
//     description: string;
//     status: string;
//     comments?: string;
//     comment?: string;
//   };
//   registrations: any[];
//   bankAccounts: any[];
//   dispatchLocations: any[];
//   categories: any[];
// }

export interface NetworkAdminOnboardingResponse {
  id: string;
  organizationName: string;
  organizationType: string;
  email: string;
  phone: string;
  country: string;
  emailVerified: boolean;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface NetworkAdminBuyerRegistrationPayload {
  organizationId: string;
  organizationName: string;
  email: string;
  phone: string;
  country: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pinCode: string;
  industry: string;
  businessType: string;
  employeeCount: number;
  annualTurnover: number;
  currency: string;
  yearEstablished: number;
  website: string;
  description: string;
  status: string;
  buyerCategories: {
    segment: number;
    segmentTitle: string;
    family: number;
    familyTitle: string;
    class: number;
    classTitle: string;
    commodity: number;
    commodityTitle: string;
  }[];
  buyerBankAccounts: {
    accountHolderName: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    ifscCode: string;
    swiftCode: string;
    currency: string;
    isPrimary: boolean;
  }[];
  buyerDocumentRegistrations: {
    registrationNumber: string;
    registrationName: string;
    expiryDate: string | null;
    registrationType: string;
    registrationDocument: {
      entityType: string;
      entityId: string;
      assetType: string;
      fileBytes: string;
      fileName: string;
      contentType: string;
      isSingletonAsset: boolean;
      id?: string;
    };
  }[];
  buyerDeliveryLocations: {
    locationName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    pinCode: string;
    contactPerson: string;
    contactPhone: string;
    isDefault: boolean;
  }[];
}

export interface NetworkAdminUpdateRejectedBuyerPayload {
  buyer: {
    buyerId: string;
    businessProfile: {
      organizationId: string;
      organizationName: string;
      email: string;
      phone: string;
      country: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      state: string;
      pinCode: string;
      industry: string;
      businessType: string;
      employeeCount: number;
      annualTurnover: number;
      currency: string;
      yearEstablished: number;
      website: string;
      description: string;
      status: string;
    };
    buyerCategories: (NetworkAdminBuyerRegistrationPayload['buyerCategories'][0] & { id?: string })[];
    buyerBankAccounts: (NetworkAdminBuyerRegistrationPayload['buyerBankAccounts'][0] & { id?: string })[];
    buyerDocumentRegistrations: (NetworkAdminBuyerRegistrationPayload['buyerDocumentRegistrations'][0] & { id?: string })[];
    buyerDeliveryLocations: (NetworkAdminBuyerRegistrationPayload['buyerDeliveryLocations'][0] & { id?: string })[];
  };
}

export interface NetworkAdminSupplierBusinessProfile {
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
  industry: string;
  businessType: string;
  employeeCount: number;
  annualTurnover: number;
  currency: string;
  yearEstablished: number;
  website: string;
  description: string;
  status?: string;
}

export interface NetworkAdminSupplierAsset {
  id?: string;
  entityType: string;
  entityId: string;
  assetType: string;
  fileName: string;
  contentType: string;
  isSingletonAsset: boolean;
  fileBytes: string;
}

export interface NetworkAdminSupplierRegistration {
  id?: string;
  registrationType: string;
  registrationNumber: string;
  registrationName: string;
  asset: NetworkAdminSupplierAsset | null;
  expiryDate: string | null;
}

export interface NetworkAdminSupplierBankAccount {
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

export interface NetworkAdminSupplierDispatchLocation {
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

export interface NetworkAdminSupplierCategory {
  segment?: number;
  segmentTitle?: string;
  family?: number;
  familyTitle?: string;
  class?: number;
  classTitle?: string;
  commodity?: number;
  commodityTitle?: string;
}

export interface NetworkAdminSupplierRegistrationPayload {
  organizationId: string | null;
  businessProfile: NetworkAdminSupplierBusinessProfile;
  registrations: NetworkAdminSupplierRegistration[];
  bankAccounts: NetworkAdminSupplierBankAccount[];
  dispatchLocations: NetworkAdminSupplierDispatchLocation[];
  supplierCategories?: NetworkAdminSupplierCategory[];
}

export interface NetworkAdminUpdateRejectedSupplierPayload {
  supplier: {
    supplierId: string;
    businessProfile: NetworkAdminSupplierBusinessProfile;
    registrations: NetworkAdminSupplierRegistration[];
    bankAccounts: NetworkAdminSupplierBankAccount[];
    dispatchLocations: NetworkAdminSupplierDispatchLocation[];
    supplierCategories?: NetworkAdminSupplierCategory[];
  };
}