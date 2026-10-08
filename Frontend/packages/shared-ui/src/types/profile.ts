export interface PersonDetail {
  personId: string;
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  phone: string;
  userName: string;
  addressLine: string;
  country: string;
  roleId: string;
  roleName: string;
  organizationName: string;
  organizationEmail: string;
}

type ReadOnlyPersonFields = 'personId' | 'userId' | 'organizationId' | 'roleId' | 'roleName';

export type PersonDetailUpdate = Partial<Omit<PersonDetail, ReadOnlyPersonFields>>;