import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Dropdown,
  EmptyState,
  Input,
  Loader,
  PageHeader,
  RESTRICTIONS_KEYS,
  SearchInput,
  toastService as toast,
} from '@vosox/shared-ui';
import type {
  DropdownValue,
  DropdownLoadParams,
  DropdownLoadResult,
  RestrictionConfig,
} from '@vosox/shared-ui';
import { createBusinessUser, getOrganizationUsers } from './api/departmentcostapi';
import { getCountries } from './api/networkAdminApi';
import { FaPlus, FaTimes, FaUsers } from 'react-icons/fa';
import './UserAdmin.css';
import { useNetworkAdminAuthStore } from './store/useAuthStore';
import { ROLE_ID_MAPPING } from './constants/roleMapping';
import {
  getOutlets,
  getOutletUsers,
  setUserOutlets,
  type Outlet,
  type OutletUserMapping,
} from '../../remote-buyer/src/api/outletApi';

// The kinds of user a buyer administrator can create.
type BuyerUserType = 'BUYER_USER' | 'OUTLET_MANAGER' | 'STORE_MANAGER' | 'COST_CONTROLLER';
const BUYER_USER_TYPE_LABELS: Record<BuyerUserType, string> = {
  BUYER_USER: 'Buyer User',
  OUTLET_MANAGER: 'Outlet Manager',
  STORE_MANAGER: 'Store Manager',
  COST_CONTROLLER: 'Cost Controller',
};

// Outlet and store managers work for the outlets assigned at creation; buyer users and cost controllers need none.
const needsOutletsFor = (type: BuyerUserType): boolean => type === 'OUTLET_MANAGER' || type === 'STORE_MANAGER';

// Page size used by the async (paginated) Country Dropdown
const COUNTRY_PAGE_SIZE = 40;

// International phone: digits, optional leading "+", and common separators while typing.
// Max length is 20 (not 15) because it also counts the separators; digits are checked on submit.
const PHONE_RESTRICTIONS: RestrictionConfig[] = [
  { name: RESTRICTIONS_KEYS.PHONE },
  { name: RESTRICTIONS_KEYS.MAX_LENGTH, max: 20 },
];

// E.164: optional "+", then 7-15 digits (separators are stripped before checking)
const normalizePhone = (phone: string): string => phone.replace(/[\s\-()]/g, '');
const isValidPhone = (phone: string): boolean => /^\+?\d{7,15}$/.test(normalizePhone(phone));

interface BusinessUser {
  personId: string;
  userId: string;
  name: string;
  email: string;
  userName: string;
  roleId: string;
  roleName: string;
  phone?: string;
  country?: string;
  addressLine?: string;
  createdDate?: string;
}

interface UserFormData {
  name: string;
  email: string;
  phone: string;
  country: string;
  addressLine: string;
  userName: string;
  password: string;
  confirmPassword: string;
}

type FormErrors = Partial<Record<keyof UserFormData, string>>;

const INITIAL_FORM_DATA: UserFormData = {
  name: '',
  email: '',
  phone: '',
  country: '',
  addressLine: '',
  userName: '',
  password: '',
  confirmPassword: '',
};

const UserAdmin: React.FC = () => {
  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const userRole = currentUser?.userRole;
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<UserFormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [users, setUsers] = useState<BusinessUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<DropdownValue | null>(null);

  // Buyer administrator only: the user type being created and the outlets assigned to the user.
  const isBuyerAdmin = userRole === 'BUYER_ADMINISTRATOR';
  const [buyerUserType, setBuyerUserType] = useState<BuyerUserType>('BUYER_USER');
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletMappings, setOutletMappings] = useState<OutletUserMapping[]>([]);
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [outletError, setOutletError] = useState<string | null>(null);

  useEffect(() => {
    if (!isBuyerAdmin) return;
    let active = true;
    Promise.all([getOutlets(), getOutletUsers()])
      .then(([outletRows, mappingRows]) => {
        if (!active) return;
        setOutlets(outletRows);
        setOutletMappings(mappingRows);
      })
      .catch((err: unknown) => {
        if (active) toast.error(err instanceof Error ? err.message : 'Failed to load outlets');
      });
    return () => {
      active = false;
    };
  }, [isBuyerAdmin]);

  const outletNamesOf = (userId: string): string => {
    const outletIds = outletMappings.find((mapping) => mapping.userId === userId)?.outletIds ?? [];
    return outlets
      .filter((outlet) => outletIds.includes(outlet.id))
      .map((outlet) => outlet.outletName)
      .join(', ');
  };

  const toggleOutlet = (outletId: string) => {
    setOutletError(null);
    setSelectedOutletIds((current) =>
      current.includes(outletId) ? current.filter((id) => id !== outletId) : [...current, outletId],
    );
  };

  // ---- Async paginated loader for the Country Dropdown (`index` is an offset: 0, 40, 80, ...) ----
  const loadCountryOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const index = page * COUNTRY_PAGE_SIZE;
    const res = await getCountries(index, COUNTRY_PAGE_SIZE, search || undefined);
    const countries = res.items || [];
    const reportedTotal = res.totalCount ?? 0;
    return {
      options: countries.map((c) => ({ name: c.countryName, value: c.countryName })),
      // totalCount alone isn't reliable for this API, so a full page also means there may be more
      hasMore: countries.length === COUNTRY_PAGE_SIZE || reportedTotal > index + COUNTRY_PAGE_SIZE,
    };
  };

  // Fetch real users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      const orgId = currentUser?.organizationId;
      if (!orgId) {
        toast.error('Organization ID not found. Please log in again.');
        return;
      }
      setListLoading(true);
      try {
        const data = await getOrganizationUsers(orgId);
        setUsers(data);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load users', {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } finally {
        setListLoading(false);
      }
    };
    fetchUsers();
  }, [currentUser?.organizationId]);

  const getPageTitle = () => {
    if (userRole === 'BUYER_ADMINISTRATOR') return 'Buyer Business User List';
    if (userRole === 'SUPPLIER_ADMINISTRATOR') return 'Supplier Business User List';
    return 'Business User List';
  };

  const getPageSubtitle = () => {
    return `Manage and view all ${getUserTypeDisplayName()}s`;
  };

  const getBusinessUserRoleId = () => {
    if (userRole === 'BUYER_ADMINISTRATOR') return ROLE_ID_MAPPING[buyerUserType];
    if (userRole === 'SUPPLIER_ADMINISTRATOR') return '937aab61-b505-4e1c-a5a3-cd63e29c6db9';
    return null;
  };

  const getUserTypeDisplayName = () => {
    if (userRole === 'BUYER_ADMINISTRATOR') return BUYER_USER_TYPE_LABELS[buyerUserType];
    if (userRole === 'SUPPLIER_ADMINISTRATOR') return 'Supplier User';
    return 'Business User';
  };

  const handleCreateClick = () => {
    setShowModal(true);
    setFormErrors({});
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(INITIAL_FORM_DATA);
    setFormErrors({});
    setSelectedCountry(null);
    setBuyerUserType('BUYER_USER');
    setSelectedOutletIds([]);
    setOutletError(null);
  };

  const clearFieldError = (field: keyof UserFormData) => {
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name as keyof UserFormData);
  };

  const validateForm = (): FormErrors => {
    const errors: FormErrors = {};

    if (!formData.name) errors.name = 'Name is required';
    if (!formData.email) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Please enter a valid email';
    if (!formData.userName) errors.userName = 'Username is required';
    if (!formData.phone) errors.phone = 'Phone is required';
    else if (!isValidPhone(formData.phone)) {
      errors.phone = 'Enter a valid phone number with 7-15 digits (country code optional, e.g. +91 98765 43210)';
    }
    if (!formData.country) errors.country = 'Country is required';
    if (!formData.addressLine) errors.addressLine = 'Address is required';
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (!formData.confirmPassword) errors.confirmPassword = 'Confirm password is required';
    else if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Passwords do not match';

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    setFormErrors(errors);
    // An Outlet Manager requests for the outlets assigned here; a Store Manager freezes the bucket of their property.
    const needsOutlets = isBuyerAdmin && needsOutletsFor(buyerUserType);
    const missingOutlets = needsOutlets && selectedOutletIds.length === 0;
    setOutletError(missingOutlets ? 'Select at least one outlet' : null);
    if (Object.keys(errors).length > 0 || missingOutlets) return;

    setIsLoading(true);

    try {
      const roleId = getBusinessUserRoleId();
      const userTypeDisplay = getUserTypeDisplayName();

      if (!roleId) {
        toast.error('Invalid user role. Cannot create business user.');
        setIsLoading(false);
        return;
      }

      const response = await createBusinessUser({
        name: formData.name,
        email: formData.email,
        phone: normalizePhone(formData.phone),
        country: formData.country,
        addressLine: formData.addressLine,
        userName: formData.userName,
        password: formData.password,
        roleId: roleId,
      });

      const isSuccess = response.statusCode >= 200 && response.statusCode < 300;
      const userId = response.id || response.data?.id;

      if (isSuccess && userId) {
        toast.success(`${userTypeDisplay} created successfully! ID: ${userId}`, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        // The create call returns the person id; outlets are assigned to the user id.
        let createdUserId = userId;
        if (needsOutlets && currentUser?.organizationId) {
          try {
            const organizationUsers = await getOrganizationUsers(currentUser.organizationId);
            const created = organizationUsers.find((user) => user.personId === userId);
            if (!created) throw new Error('The new user could not be found to assign outlets.');
            createdUserId = created.userId;
            await setUserOutlets(createdUserId, selectedOutletIds);
            setOutletMappings((prev) => [
              ...prev.filter((mapping) => mapping.userId !== createdUserId),
              { userId: createdUserId, outletIds: selectedOutletIds },
            ]);
          } catch (outletErr: unknown) {
            toast.error(
              `The user was created, but the outlets were not assigned: ${
                outletErr instanceof Error ? outletErr.message : 'unknown error'
              }`,
            );
          }
        }

        const newUser: BusinessUser = {
          personId: userId,
          userId: createdUserId,
          name: formData.name,
          email: formData.email,
          userName: formData.userName,
          roleId: roleId,
          roleName: userTypeDisplay,
          phone: normalizePhone(formData.phone),
          country: formData.country,
          addressLine: formData.addressLine,
          createdDate: new Date().toISOString().split('T')[0],
        };

        setUsers((prev) => [newUser, ...prev]);
        handleCloseModal();
      } else {
        const errorMessage = response.message || response.description || 'Failed to create business user';
        toast.error(errorMessage, {
          position: 'top-right',
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        console.error('API Response:', response);
      }
    } catch (err: any) {
      const errorMessage = err?.message || err?.response?.data?.message || 'Failed to create business user';
      toast.error(errorMessage, {
        position: 'top-right',
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      console.error('Create user error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      (u.name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.userName || '').toLowerCase().includes(q) ||
      (u.phone || '').toLowerCase().includes(q) ||
      (u.country || '').toLowerCase().includes(q)
    );
  }, [searchQuery, users]);

  return (
    <div className="ua-dashboard">
      <PageHeader className="ua-header" title={getPageTitle()} description={getPageSubtitle()} />

      <div className="ua-content-wrapper">
        <div className="ua-controls-bar">
          <SearchInput
            containerClassName="ua-search-wrapper"
            className="ua-search-input"
            placeholder="Search by name, email, username, phone or country..."
            label="Search users"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="ua-action-buttons">
            <Button className="ua-create-btn" onClick={handleCreateClick} disabled={isLoading}>
              <FaPlus aria-hidden="true" />
              Create {getUserTypeDisplayName()}
            </Button>
          </div>
        </div>

        {listLoading ? (
          <div className="ua-loading-data">
            <Loader message="Loading your data..." />
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            className="ua-empty-state"
            icon={<FaUsers aria-hidden="true" />}
            title={searchQuery ? 'No users match your search.' : 'No users found.'}
          />
        ) : (
          <>
            <div className="ua-table-wrapper sila-table-wrap">
              <table className="ua-table sila-table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Email</th>
                    <th scope="col">Username</th>
                    <th scope="col">User Role</th>
                    {isBuyerAdmin && <th scope="col">Outlets</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.personId}>
                      <td>
                        <div className="ua-cell-name">{user.name}</div>
                      </td>
                      <td>{user.email}</td>
                      <td className="ua-cell-muted">{user.userName}</td>
                      <td>
                        <span className="ua-role-badge sila-badge sila-badge--neutral">{user.roleName}</span>
                      </td>
                      {isBuyerAdmin && <td className="ua-cell-muted">{outletNamesOf(user.userId) || '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ua-table-footer sila-pagination">
              <span>
                Showing {filteredUsers.length} of {users.length} users
              </span>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="user-admin-modal-overlay" onClick={handleCloseModal}>
          <div
            className="user-admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ua-create-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="user-admin-modal-header">
              <h2 id="ua-create-user-title">Create {getUserTypeDisplayName()}</h2>
              <button
                type="button"
                className="user-admin-modal-close"
                onClick={handleCloseModal}
                aria-label="Close dialog"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <form className="user-admin-form">
              <div className="user-admin-form-grid">
                {isBuyerAdmin && (
                  <div className="user-admin-form-group">
                    <label className="sila-label" htmlFor="ua-user-type">
                      User type<span className="sila-required">*</span>
                    </label>
                    <select
                      id="ua-user-type"
                      className="sila-select"
                      value={buyerUserType}
                      onChange={(e) => {
                        setBuyerUserType(e.target.value as BuyerUserType);
                        setOutletError(null);
                      }}
                    >
                      <option value="BUYER_USER">{BUYER_USER_TYPE_LABELS.BUYER_USER}</option>
                      <option value="OUTLET_MANAGER">{BUYER_USER_TYPE_LABELS.OUTLET_MANAGER}</option>
                      <option value="STORE_MANAGER">{BUYER_USER_TYPE_LABELS.STORE_MANAGER}</option>
                      <option value="COST_CONTROLLER">{BUYER_USER_TYPE_LABELS.COST_CONTROLLER}</option>
                    </select>
                  </div>
                )}

                {isBuyerAdmin && needsOutletsFor(buyerUserType) && (
                  <fieldset className="user-admin-form-group ua-outlet-options">
                    <legend className="sila-label">
                      Outlets<span className="sila-required">*</span>
                    </legend>
                    {outlets.length === 0 ? (
                      <span className="sila-help">
                        No outlets yet. Create them under Workflow &amp; Configuration → Outlets.
                      </span>
                    ) : (
                      outlets.map((outlet) => (
                        <label key={outlet.id} className="ua-outlet-option">
                          <input
                            type="checkbox"
                            checked={selectedOutletIds.includes(outlet.id)}
                            onChange={() => toggleOutlet(outlet.id)}
                          />
                          {outlet.outletName}
                        </label>
                      ))
                    )}
                    {outletError && <span className="sila-error-text">{outletError}</span>}
                  </fieldset>
                )}

                <Input
                  id="ua-name"
                  label="Name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter full name"
                  required
                  error={formErrors.name}
                />

                <Input
                  id="ua-email"
                  label="Email Address"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter email address"
                  required
                  error={formErrors.email}
                />

                <Input
                  id="ua-username"
                  label="Username"
                  type="text"
                  name="userName"
                  value={formData.userName}
                  onChange={handleInputChange}
                  placeholder="Enter username"
                  required
                  error={formErrors.userName}
                />

                <Input
                  id="ua-phone"
                  label="Phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="e.g. +91 98765 43210"
                  restrictions={PHONE_RESTRICTIONS}
                  required
                  error={formErrors.phone}
                />

                <div
                  className="user-admin-form-group"
                  onKeyDown={(e) => {
                    // Enter inside the dropdown's search box would otherwise submit the surrounding form.
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                >
                  <Dropdown
                    label="Country"
                    isRequired
                    placeholder="Select Country"
                    isAsync
                    loadOptions={loadCountryOptions}
                    value={selectedCountry}
                    error={formErrors.country}
                    onChange={(val) => {
                      setSelectedCountry(val);
                      setFormData((prev) => ({ ...prev, country: val?.value || '' }));
                      clearFieldError('country');
                    }}
                  />
                </div>

                <Input
                  id="ua-address"
                  label="Address"
                  type="text"
                  name="addressLine"
                  value={formData.addressLine}
                  onChange={handleInputChange}
                  placeholder="Enter address"
                  required
                  error={formErrors.addressLine}
                />

                <Input
                  id="ua-password"
                  label="Password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter password"
                  required
                  error={formErrors.password}
                />

                <Input
                  id="ua-confirm-password"
                  label="Confirm Password"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm password"
                  required
                  error={formErrors.confirmPassword}
                />
              </div>
            </form>
            <footer className="user-admin-footer">
              <div className="user-admin-form-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseModal}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={isLoading}
                  onClick={handleSubmit}
                >
                  {isLoading ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAdmin;