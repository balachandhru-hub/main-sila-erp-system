export type UserRole = 
  | 'BUYER_NETWORK_ADMIN' 
  | 'SUPPLIER_NETWORK_ADMIN' 
  | 'BUYER_ADMINISTRATOR' 
  | 'SUPPLIER_ADMINISTRATOR' 
  | 'BUYER_USER' 
  | 'SUPPLIER_USER'
  | 'OUTLET_MANAGER'
  | 'STORE_MANAGER'
  | 'COST_CONTROLLER'
  | 'PLATFORM_ADMINISTRATOR';

export interface User {
  id: string;
  email: string;
  name: string;
  userRole: UserRole;
  createdAt: string;
  status: 'active' | 'inactive';
  buyerId?:string;
  supplierId?:string;
  organizationId?: string;
  userId?: string;
  personId?: string;
  roleId?: string;
  phone?: string;
  country?: string;
  addressLine?: string;
  userName?: string;
  password?: string;
}

