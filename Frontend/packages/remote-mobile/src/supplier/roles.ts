/** Identity roles that sign in as a supplier and must not see SILA Store. */
export const isSupplierOnlyRole = (roleName: string | null | undefined): boolean =>
  (roleName ?? '').trim().toUpperCase().startsWith('SUPPLIER');
