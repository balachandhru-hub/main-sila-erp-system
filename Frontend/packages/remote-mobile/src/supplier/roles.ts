/** Same identity role ids the host uses to keep a supplier session on supplier screens. */
const SUPPLIER_ROLE_IDS = new Set([
  '937aab61-b505-4e1c-a5a3-cd63e29c6db9',
  '735bb267-fec0-489f-8249-d3d65b3857ea',
  '22067509-af24-48f8-a7e9-416a0b6a439b',
]);

/** A supplier identity stays inside the supplier workspace, whether the check sees the role name or the role id. */
export const isSupplierOnlyRole = (roleName: string | null | undefined, roleId?: string | null): boolean =>
  SUPPLIER_ROLE_IDS.has((roleId ?? '').toLowerCase()) ||
  (roleName ?? '').trim().toUpperCase().startsWith('SUPPLIER');
