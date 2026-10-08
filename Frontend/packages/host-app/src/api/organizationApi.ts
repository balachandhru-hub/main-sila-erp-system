import axiosInstance from './axiosInstance';

export interface CreateOrganizationPayload {
  organizationName: string;
  organizationType: number;
  email: string;
  phone: string;
  country: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pinCode: string;
  verificationToken?: string;
  personName: string;
  personEmail: string;
  userName: string;
  password: string;
}

export const createOrganization = async (payload: CreateOrganizationPayload) => {
  const response = await axiosInstance.post('/api/v1/identity/auth/register', payload);
  return response.data;
};
