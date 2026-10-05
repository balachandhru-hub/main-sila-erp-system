export const ROLE_ID_MAPPING: Record<string, string> = {
  'BUYER_NETWORK_ADMIN': '61eb9b97-1fca-4beb-beb8-dc4b379cfa3a',
  'SUPPLIER_NETWORK_ADMIN': '22067509-af24-48f8-a7e9-416a0b6a439b',
  'BUYER_ADMINISTRATOR': 'c95f5a1b-4aec-4647-9328-895a58193ec4',
  'SUPPLIER_ADMINISTRATOR': '735bb267-fec0-489f-8249-d3d65b3857ea',
  'BUYER_USER': '5a72f81e-a2c5-4f4a-bd55-6376c3c9ed73',
  'OUTLET_MANAGER': '7c4e1a90-6b2d-4f58-9c31-0e8a5d6f4b21',
  'STORE_MANAGER': 'b054de41-7da1-4b96-a2aa-d8387bfb0ef0',
  'COST_CONTROLLER': '3f9d6c2e-5b1a-4e8f-9c7d-2a6b8e4f1c03',
  'SUPPLIER_USER': '937aab61-b505-4e1c-a5a3-cd63e29c6db9',
  'PLATFORM_ADMINISTRATOR': '113d8ead-40c2-425a-bc60-5989e6cdabca',
};


export const getRoleIdForCreating = (userRole: string): string => {
  let roleToCreate: string;

  if (userRole === 'BUYER_NETWORK_ADMIN') {
    roleToCreate = 'BUYER_ADMINISTRATOR';
  } else if (userRole === 'SUPPLIER_NETWORK_ADMIN') {
    roleToCreate = 'SUPPLIER_ADMINISTRATOR';
  } else if (userRole === 'BUYER_ADMINISTRATOR') {
    roleToCreate = 'BUYER_USER';
  } else if (userRole === 'SUPPLIER_ADMINISTRATOR') {
    roleToCreate = 'SUPPLIER_USER';
  } else {
    roleToCreate = userRole;
  }

  return ROLE_ID_MAPPING[roleToCreate] || '';
};
