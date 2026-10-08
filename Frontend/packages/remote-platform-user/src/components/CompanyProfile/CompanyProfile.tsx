import React, { useEffect, useState } from 'react';
import {
  FaArrowLeft,
  FaBuilding,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaFileContract,
  FaUniversity,
  FaTruck,
  FaThLarge,
  FaInfoCircle,
  FaChevronUp,
  FaChevronDown,
  FaChevronRight,
  FaCheck,
  FaTimes,
  FaFilePdf,
  FaEye,
  FaEyeSlash,
  FaUsers,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaIndustry,
  FaBriefcase,
  FaTags,
  FaUserCircle,
  FaCog,
  FaEdit,
  FaTrash,
  FaCubes
} from 'react-icons/fa';
import OrganizationModelAccess from '../OrganizationModelAccess';
import { useNetworkAdminAuthStore } from '../../store/useAuthStore';
import { getNetworkAdminProfile } from '../../api/networkAdminApi';
import {
  createDeliveryLocation,
  updateDeliveryLocation,
  deleteDeliveryLocation,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  createSupplierBankAccount,
  createSupplierDeliveryLocation,
  updateSupplierBankAccount,
  updateSupplierDeliveryLocation,
  deleteSupplierBankAccount,
  deleteSupplierDeliveryLocation,
} from '../../api/networkAdminApi';
import type { NetworkAdminRole } from '../../api/networkAdminApi';
import { useHostAuth } from './useHostAuth';
import type {
  CreateDeliveryLocationDto,
  UpdateDeliveryLocationDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
  CreateSupplierBankAccountDto,
  CreateSupplierDeliveryLocationDto,
  UpdateSupplierBankAccountDto,
  UpdateSupplierDeliveryLocationDto,
} from '../../api/networkAdminApi';
import type { NetworkAdminProfileResponse } from '../../dto/networkAdminDto';
import type {
  CategoryDto,
  RegistrationDto,
  BankAccountDto,
  DispatchLocationDto,
} from '../../dto/platformDto';
import './CompanyProfile.css';
import { FaPlus } from 'react-icons/fa6';
import { EmptyState, Loader, StatusBadge, isErrorResponse, toastService } from '@vosox/shared-ui';
import type { StatusTone } from '@vosox/shared-ui';

interface CompanyProfileProps {
  mode?: 'admin-review' | 'network-admin';
  showHeader?: boolean;
  entityLabel?: 'Buyer' | 'Supplier';
  fetchProfile?: () => Promise<any>;
  onBack?: () => void;
  onVerify?: () => void;
  onReject?: () => void;
  isStatusLoading?: boolean;
  statusError?: string | null;
  onViewDocument?: (assetId: string, fileName?: string) => void;
  onSettingsClick?: () => void;
}

type DispatchLocationWithId = DispatchLocationDto & { id?: string };
type BankAccountWithId = BankAccountDto & { id?: string };

interface ConfirmationModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'bank' | 'location' | null;
  item: BankAccountWithId | DispatchLocationWithId | null;
  isLoading: boolean;
}

const emptyDispatchForm: DispatchLocationWithId = {
  locationName: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: '',
  pinCode: '',
  contactPerson: '',
  contactPhone: '',
  contactEmail: '',
  isDefault: false,
};

const emptyBankForm: BankAccountWithId = {
  accountHolderName: '',
  bankName: '',
  branchName: '',
  accountNumber: '',
  ifscCode: '',
  swiftCode: '',
  iban: '',
  currency: '',
  isPrimary: false,
  isVerified: false,
};

const formatCurrency = (amount?: number, currency?: string) => {
  if (amount === undefined || amount === null) return '-';
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString('en-IN')}`;
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusClassMap: Record<string, string> = {
  PENDING_VERIFICATION: 'cp-status-pending',
  PENDING: 'cp-status-pending',
  VERIFIED: 'cp-status-verified',
  APPROVED: 'cp-status-verified',
  REJECTED: 'cp-status-rejected',
};

const statusLabelMap: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending Verification',
  PENDING: 'Pending Verification',
  VERIFIED: 'Verified',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/* Badge tone for each status class above (unknown statuses fall back to "pending"). */
const statusToneMap: Record<string, StatusTone> = {
  'cp-status-pending': 'warning',
  'cp-status-verified': 'success',
  'cp-status-rejected': 'danger',
};

const YesNoBadge: React.FC<{ value?: boolean }> = ({ value }) => (
  <span className={`sila-badge sila-badge--sm cp-status-pill ${value ? 'sila-badge--success' : 'sila-badge--neutral'}`}>
    {value ? 'Yes' : 'No'}
  </span>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}> = ({ icon, title, isOpen, onToggle, extra }) => (
  <button type="button" className="cp-card-title" onClick={onToggle} aria-expanded={isOpen}>
    <span className="cp-card-icon" aria-hidden="true">{icon}</span>
    <span className="cp-card-title-text">{title}</span>
    {extra}
    <span className="cp-card-chevron" aria-hidden="true">{isOpen ? <FaChevronUp /> : <FaChevronDown />}</span>
  </button>
);

const MaskedAccountNumber: React.FC<{ accountNumber?: string }> = ({ accountNumber }) => {
  const [revealed, setRevealed] = useState(false);
  if (!accountNumber) return <span className="cp-field-value">-</span>;
  const masked =
    accountNumber.length >= 4
      ? '********' + accountNumber.slice(-4)
      : accountNumber;
  return (
    <span className="cp-field-value cp-field-masked">
      <span className="cp-field-mono">{revealed ? accountNumber : masked}</span>
      <button
        type="button"
        className="cp-icon-toggle"
        onClick={() => setRevealed((v) => !v)}
        aria-label="Toggle account number visibility"
        aria-pressed={revealed}
        title={revealed ? 'Hide' : 'Show'}
      >
        {revealed ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
      </button>
    </span>
  );
};

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, isLoading, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="sila-overlay cp-confirmation-overlay" onClick={onCancel}>
      <div
        className="sila-modal cp-confirmation-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cp-confirmation-title"
        aria-describedby="cp-confirmation-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sila-modal-header cp-confirmation-header">
          <h3 id="cp-confirmation-title" className="sila-modal-title cp-confirmation-title">{title}</h3>
          <button
            type="button"
            className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-confirmation-close"
            onClick={onCancel}
            aria-label="Close"
            disabled={isLoading}
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <div className="sila-modal-body cp-confirmation-body">
          <p id="cp-confirmation-message" className="sila-modal-text cp-confirmation-message">{message}</p>
        </div>

        <div className="sila-modal-footer cp-confirmation-footer">
          <button
            type="button"
            className="sila-btn sila-btn--secondary cp-confirmation-btn cp-confirmation-btn-cancel"
            onClick={onCancel}
            disabled={isLoading}
          >
            No, Cancel
          </button>
          <button
            type="button"
            className="sila-btn sila-btn--danger cp-confirmation-btn cp-confirmation-btn-delete"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="sila-spinner" aria-hidden="true" />
                Deleting...
              </>
            ) : (
              <>
                <FaTrash aria-hidden="true" />
                Yes, Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};


const CompanyProfile: React.FC<CompanyProfileProps> = ({
  mode = 'admin-review',
  showHeader = true,
  entityLabel: propsEntityLabel,
  fetchProfile,
  onBack,
  onVerify,
  onReject,
  isStatusLoading = false,
  statusError = null,
  onViewDocument,
  onSettingsClick,
}) => {
  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const auth = useHostAuth();
  const [profile, setProfile] = useState<NetworkAdminProfileResponse | any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState({
    profile: true,
    registrations: true,
    bank: true,
    dispatch: true,
    categories: true,
    models: true,
  });

  const [dispatchLocations, setDispatchLocations] = useState<DispatchLocationWithId[]>([]);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchModalView, setDispatchModalView] = useState<'list' | 'form'>('list');
  const [editingLocation, setEditingLocation] = useState<DispatchLocationWithId | null>(null);
  const [dispatchForm, setDispatchForm] = useState<DispatchLocationWithId>(emptyDispatchForm);
  const [isDispatchSubmitting, setIsDispatchSubmitting] = useState(false);
  const [dispatchFormError, setDispatchFormError] = useState<string | null>(null);
  const [, setDeletingLocationId] = useState<string | null>(null);
  const [dispatchListError, setDispatchListError] = useState<string | null>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccountWithId[]>([]);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankModalView, setBankModalView] = useState<'list' | 'form'>('list');
  const [editingBankAccount, setEditingBankAccount] = useState<BankAccountWithId | null>(null);
  const [bankForm, setBankForm] = useState<BankAccountWithId>(emptyBankForm);
  const [isBankSubmitting, setIsBankSubmitting] = useState(false);
  const [bankFormError, setBankFormError] = useState<string | null>(null);
  const [, setDeletingBankAccountId] = useState<string | null>(null);
  const [bankListError, setBankListError] = useState<string | null>(null);

  const [confirmationModal, setConfirmationModal] = useState<ConfirmationModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: null,
    item: null,
    isLoading: false,
  });

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const isBuyer =
    currentUser?.userRole === 'BUYER_NETWORK_ADMIN' ||
    currentUser?.userRole === 'BUYER_ADMINISTRATOR' ||
    currentUser?.userRole === 'BUYER_USER';

  const isSupplier =
    currentUser?.userRole === 'SUPPLIER_NETWORK_ADMIN' ||
    currentUser?.userRole === 'SUPPLIER_ADMINISTRATOR' ||
    currentUser?.userRole === 'SUPPLIER_USER';

  const isManageable = isBuyer || isSupplier;

  // ---- Validation helpers: only one primary bank account / one default location ----
  const hasOtherPrimaryBank = (excludeId?: string) =>
    bankAccounts.some((a) => a.isPrimary && a.id !== excludeId);

  const hasOtherDefaultLocation = (excludeId?: string) =>
    dispatchLocations.some((l) => l.isDefault && l.id !== excludeId);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (fetchProfile) {
          const data = await fetchProfile();
          if (!cancelled) setProfile(data);
        } else {
          const userRole = currentUser?.userRole;
          const role: NetworkAdminRole = userRole
            ? userRole.includes('BUYER') ? 'BUYER_NETWORK_ADMIN' : 'SUPPLIER_NETWORK_ADMIN'
            : 'SUPPLIER_NETWORK_ADMIN';
          const data = await getNetworkAdminProfile(role);
          if (!cancelled) setProfile(data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load company profile');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [fetchProfile, currentUser]);

  const reloadProfile = async () => {
    try {
      if (fetchProfile) {
        const data = await fetchProfile();
        setProfile(data);
      }
    } catch (err: any) {
      toastService.error('Failed to reload profile after model access is updated.');
    }
  };

  useEffect(() => {
    if (profile?.dispatchLocations) {
      setDispatchLocations(profile.dispatchLocations);
    }
  }, [profile]);

  useEffect(() => {
    if (profile?.bankAccounts) {
      setBankAccounts(profile.bankAccounts);
    }
  }, [profile]);

  const entityLabel = propsEntityLabel || (isBuyer ? 'Buyer' : 'Supplier');

  const openDispatchModal = () => {
    setDispatchModalView('list');
    setEditingLocation(null);
    setDispatchFormError(null);
    setDispatchListError(null);
    setIsDispatchModalOpen(true);
  };

  const closeDispatchModal = () => {
    setIsDispatchModalOpen(false);
    setDispatchModalView('list');
    setEditingLocation(null);
    setDispatchForm(emptyDispatchForm);
    setDispatchFormError(null);
  };

  const openAddLocationForm = () => {
    setEditingLocation(null);
    setDispatchForm(emptyDispatchForm);
    setDispatchFormError(null);
    setDispatchModalView('form');
  };

  const openEditLocationForm = (loc: DispatchLocationWithId) => {
    setEditingLocation(loc);
    setDispatchForm({ ...loc });
    setDispatchFormError(null);
    setDispatchModalView('form');
  };

  const handleDispatchFormChange = (
    field: keyof DispatchLocationWithId,
    value: string | boolean
  ) => {
    setDispatchForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleDispatchFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchFormError(null);

    if (!dispatchForm.locationName || !dispatchForm.addressLine1 || !dispatchForm.city) {
      setDispatchFormError('Please fill in the required fields.');
      return;
    }

    if (dispatchForm.isDefault && hasOtherDefaultLocation(editingLocation?.id)) {
      setDispatchFormError(
        'You already have a default dispatch location. Please unset it before setting a new one as default.'
      );
      return;
    }

    setIsDispatchSubmitting(true);

    const basePayload = {
      locationName: dispatchForm.locationName || '',
      addressLine1: dispatchForm.addressLine1 || '',
      addressLine2: dispatchForm.addressLine2 || '',
      city: dispatchForm.city || '',
      state: dispatchForm.state || '',
      country: dispatchForm.country || '',
      pinCode: dispatchForm.pinCode || '',
      contactPerson: dispatchForm.contactPerson || '',
      contactPhone: dispatchForm.contactPhone || '',
      isDefault: !!dispatchForm.isDefault,
    };

    try {
      if (editingLocation?.id) {
        // UPDATE - works for both buyer and supplier
        let result;

        if (isBuyer) {
          const updatePayload: UpdateDeliveryLocationDto = {
            ...basePayload,
            buyerId: auth?.buyerId || '',
          };
          result = await updateDeliveryLocation(editingLocation.id, updatePayload);
        } else if (isSupplier) {
          const updateSupplierPayload: UpdateSupplierDeliveryLocationDto = {
            ...basePayload,
            contactEmail: dispatchForm.contactEmail || '',
            supplierId: auth?.supplierId || '',
          } as UpdateSupplierDeliveryLocationDto;
          result = await updateSupplierDeliveryLocation(editingLocation.id, updateSupplierPayload);
        } else {
          setDispatchFormError('Unable to determine user type');
          setIsDispatchSubmitting(false);
          return;
        }

        if (isErrorResponse(result)) {
          setDispatchFormError(result.message || 'Failed to update location');
          return;
        }

        setDispatchLocations((prev) =>
          prev.map((loc) =>
            loc.id === editingLocation.id ? { ...basePayload, id: editingLocation.id } : loc
          )
        );
      } else {
        // CREATE - works for both buyer and supplier
        let result;

        if (isBuyer) {
          const createPayload: CreateDeliveryLocationDto = basePayload as CreateDeliveryLocationDto;
          result = await createDeliveryLocation(createPayload);
        } else if (isSupplier) {
          const createSupplierPayload: CreateSupplierDeliveryLocationDto = {
            ...basePayload,
            contactEmail: dispatchForm.contactEmail || '',
          } as CreateSupplierDeliveryLocationDto;
          result = await createSupplierDeliveryLocation(createSupplierPayload);
        } else {
          setDispatchFormError('Unable to determine user type');
          setIsDispatchSubmitting(false);
          return;
        }

        if (!('id' in result)) {
          setDispatchFormError(result.message || 'Failed to create location');
          return;
        }

        setDispatchLocations((prev) => [
          ...prev,
          {
            ...basePayload,
            id: result.id,
          },
        ]);
      }

      setDispatchModalView('list');
      setEditingLocation(null);
      setDispatchForm(emptyDispatchForm);
    } catch (err: any) {
      setDispatchFormError(err.message || 'Something went wrong');
    } finally {
      setIsDispatchSubmitting(false);
    }
  };

  const openDeleteLocationConfirmation = (loc: DispatchLocationWithId) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Dispatch Location',
      message: `Are you sure you want to delete "${loc.locationName || 'this location'}"? This action cannot be undone.`,
      type: 'location',
      item: loc,
      isLoading: false,
    });
  };

  const handleConfirmDeleteLocation = async () => {
    const loc = confirmationModal.item as DispatchLocationWithId;
    if (!loc?.id) return;

    setConfirmationModal((prev) => ({ ...prev, isLoading: true }));
    setDispatchListError(null);
    setDeletingLocationId(loc.id);

    try {
      let result;

      if (isBuyer) {
        result = await deleteDeliveryLocation(loc.id);
      } else if (isSupplier) {
        result = await deleteSupplierDeliveryLocation(loc.id);
      } else {
        setDispatchListError('Unable to determine user type');
        setConfirmationModal((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      if (isErrorResponse(result)) {
        setDispatchListError(result.message || 'Failed to delete location');
        setConfirmationModal((prev) => ({ ...prev, isLoading: false }));
        return;
      }
      setDispatchLocations((prev) => prev.filter((l) => l.id !== loc.id));
      setConfirmationModal({ isOpen: false, title: '', message: '', type: null, item: null, isLoading: false });
    } catch (err: any) {
      setDispatchListError(err.message || 'Something went wrong while deleting');
      setConfirmationModal((prev) => ({ ...prev, isLoading: false }));
    } finally {
      setDeletingLocationId(null);
    }
  };

  const openBankModal = () => {
    setBankModalView('list');
    setEditingBankAccount(null);
    setBankFormError(null);
    setBankListError(null);
    setIsBankModalOpen(true);
  };

  const closeBankModal = () => {
    setIsBankModalOpen(false);
    setBankModalView('list');
    setEditingBankAccount(null);
    setBankForm(emptyBankForm);
    setBankFormError(null);
  };

  const openAddBankForm = () => {
    setEditingBankAccount(null);
    setBankForm(emptyBankForm);
    setBankFormError(null);
    setBankModalView('form');
  };

  const openEditBankForm = (acc: BankAccountWithId) => {
    setEditingBankAccount(acc);
    setBankForm({ ...acc });
    setBankFormError(null);
    setBankModalView('form');
  };

  const handleBankFormChange = (
    field: keyof BankAccountWithId,
    value: string | boolean
  ) => {
    setBankForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBankFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBankFormError(null);

    if (
      !bankForm.accountHolderName ||
      !bankForm.bankName ||
      !bankForm.accountNumber ||
      !bankForm.ifscCode
    ) {
      setBankFormError('Please fill in the required fields.');
      return;
    }

    if (bankForm.isPrimary && hasOtherPrimaryBank(editingBankAccount?.id)) {
      setBankFormError(
        'You already have a primary bank account. Please unset it before setting a new one as primary.'
      );
      return;
    }

    setIsBankSubmitting(true);

    const basePayload = {
      accountHolderName: bankForm.accountHolderName || '',
      bankName: bankForm.bankName || '',
      branchName: bankForm.branchName || '',
      accountNumber: bankForm.accountNumber || '',
      ifscCode: bankForm.ifscCode || '',
      swiftCode: bankForm.swiftCode || '',
      currency: bankForm.currency || '',
      isPrimary: !!bankForm.isPrimary,
    };

    try {
      if (editingBankAccount?.id) {
        // UPDATE - works for both buyer and supplier
        let result;

        if (isBuyer) {
          const updatePayload: UpdateBankAccountDto = {
            ...basePayload,
            buyerId: auth?.buyerId || '',
            isVerified: editingBankAccount.isVerified || false,
          };
          result = await updateBankAccount(editingBankAccount.id, updatePayload);
        } else if (isSupplier) {
          const updateSupplierPayload: UpdateSupplierBankAccountDto = {
            ...basePayload,
            iban: bankForm.iban || '',
            isVerified: editingBankAccount.isVerified || false,
            supplierId: auth?.supplierId || '',
          } as UpdateSupplierBankAccountDto;
          result = await updateSupplierBankAccount(editingBankAccount.id, updateSupplierPayload);
        } else {
          setBankFormError('Unable to determine user type');
          setIsBankSubmitting(false);
          return;
        }

        if (isErrorResponse(result)) {
          setBankFormError(result.message || 'Failed to update bank account');
          return;
        }

        setBankAccounts((prev) =>
          prev.map((acc) =>
            acc.id === editingBankAccount.id
              ? { ...basePayload, id: editingBankAccount.id, isVerified: editingBankAccount.isVerified }
              : acc
          )
        );
      } else {
        // CREATE - works for both buyer and supplier
        let result;

        if (isBuyer) {
          const createPayload: CreateBankAccountDto = basePayload as CreateBankAccountDto;
          result = await createBankAccount(createPayload);
        } else if (isSupplier) {
          const createSupplierPayload: CreateSupplierBankAccountDto = {
            ...basePayload,
            iban: bankForm.iban || '',
          } as CreateSupplierBankAccountDto;
          result = await createSupplierBankAccount(createSupplierPayload);
        } else {
          setBankFormError('Unable to determine user type');
          setIsBankSubmitting(false);
          return;
        }

        if (!('id' in result)) {
          setBankFormError(result.message || 'Failed to create bank account');
          return;
        }

        setBankAccounts((prev) => [
          ...prev,
          {
            ...basePayload,
            id: result.id,
            isVerified: false,
          },
        ]);
      }

      setBankModalView('list');
      setEditingBankAccount(null);
      setBankForm(emptyBankForm);
    } catch (err: any) {
      setBankFormError(err.message || 'Something went wrong');
    } finally {
      setIsBankSubmitting(false);
    }
  };

  const openDeleteBankAccountConfirmation = (acc: BankAccountWithId) => {
    setConfirmationModal({
      isOpen: true,
      title: 'Delete Bank Account',
      message: `Are you sure you want to delete the bank account "${acc.bankName || 'this account'}"? This action cannot be undone.`,
      type: 'bank',
      item: acc,
      isLoading: false,
    });
  };

  const handleConfirmDeleteBankAccount = async () => {
    const acc = confirmationModal.item as BankAccountWithId;
    if (!acc?.id) return;

    setConfirmationModal((prev) => ({ ...prev, isLoading: true }));
    setBankListError(null);
    setDeletingBankAccountId(acc.id);

    try {
      let result;

      if (isBuyer) {
        result = await deleteBankAccount(acc.id);
      } else if (isSupplier) {
        result = await deleteSupplierBankAccount(acc.id);
      } else {
        setBankListError('Unable to determine user type');
        setConfirmationModal((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      if (isErrorResponse(result)) {
        setBankListError(result.message || 'Failed to delete bank account');
        setConfirmationModal((prev) => ({ ...prev, isLoading: false }));
        return;
      }
      setBankAccounts((prev) => prev.filter((a) => a.id !== acc.id));
      setConfirmationModal({ isOpen: false, title: '', message: '', type: null, item: null, isLoading: false });
    } catch (err: any) {
      setBankListError(err.message || 'Something went wrong while deleting');
      setConfirmationModal((prev) => ({ ...prev, isLoading: false }));
    } finally {
      setDeletingBankAccountId(null);
    }
  };

  const handleConfirmationCancel = () => {
    setConfirmationModal({
      isOpen: false,
      title: '',
      message: '',
      type: null,
      item: null,
      isLoading: false,
    });
  };

  const handleConfirmationConfirm = () => {
    if (confirmationModal.type === 'bank') {
      handleConfirmDeleteBankAccount();
    } else if (confirmationModal.type === 'location') {
      handleConfirmDeleteLocation();
    }
  };

  if (isLoading) {
    return (
      <div className="cp-page--platform cp-loading-container">
        <Loader message="Loading company profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-page--platform cp-error-container">
        <EmptyState variant="error" icon={<FaInfoCircle className="cp-error-icon" aria-hidden="true" />} title={error} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="cp-page--platform cp-empty-container">
        <EmptyState icon={<FaBuilding className="cp-empty-icon" aria-hidden="true" />} title="No company profile found." />
      </div>
    );
  }

  const bp = profile.businessProfile || {};
  const registrations: RegistrationDto[] = profile.registrations || [];
  const categories: CategoryDto[] =
    (profile as any).categories ||
    (profile as any).buyerCategories ||
    (profile as any).supplierCategories ||
    [];

  const statusKey = bp.status || '';
  const statusUpper = statusKey.toUpperCase();
  const isPending = statusUpper === 'PENDING_VERIFICATION' || statusUpper === 'PENDING' || statusUpper === '' || statusUpper === 'PENDING_REVIEW';
  const statusClass = statusClassMap[statusKey] || statusClassMap[statusUpper] || 'cp-status-pending';
  const statusLabel = statusLabelMap[statusKey] || statusLabelMap[statusUpper] || statusKey || '-';
  const statusTone = statusToneMap[statusClass] || 'warning';

  const statusBadge = (
    <StatusBadge status={statusKey || 'PENDING'} label={statusLabel} tone={statusTone} dot />
  );

  const reviewActions =
    mode === 'admin-review' && isPending && (onVerify || onReject) ? (
      <div className="cp-header-actions">
        {onVerify && (
          <button
            type="button"
            className="sila-btn sila-btn--success"
            title="Verify this company"
            onClick={onVerify}
            disabled={isStatusLoading}
          >
            <FaCheck aria-hidden="true" />
            Verify
          </button>
        )}
        {onReject && (
          <button
            type="button"
            className="sila-btn sila-btn--secondary cp-btn-reject-action"
            title="Reject this company"
            onClick={onReject}
            disabled={isStatusLoading}
          >
            <FaTimes aria-hidden="true" />
            Reject
          </button>
        )}
      </div>
    ) : null;

  return (
    <div className="cp-page cp-page--platform">
      {showHeader && (
        <div className="sila-page-header cp-page-header cp-page-header-flex">
          <div className="sila-page-header-main cp-page-header-left">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Back to Dashboard"
                aria-label="Back to Dashboard"
                className="sila-btn sila-btn--secondary sila-btn--icon sila-btn--sm sila-page-back cp-back-btn"
              >
                <FaArrowLeft className="cp-back-btn-icon" aria-hidden="true" />
              </button>
            )}
            <div>
              <div className="sila-page-title-row">
                <h1 className="sila-page-title cp-page-title">Company Details</h1>
                {statusBadge}
              </div>
              <p className="sila-page-description cp-page-subtitle">View and manage {entityLabel.toLowerCase()} information</p>
            </div>
          </div>

          {(reviewActions || onSettingsClick) && (
            <div className="sila-page-actions">
              {reviewActions}
              {onSettingsClick && (
                <button
                  type="button"
                  className="sila-btn sila-btn--secondary sila-btn--icon cp-settings-btn"
                  onClick={onSettingsClick}
                  title="Settings"
                  aria-label="Settings"
                >
                  <FaCog aria-hidden="true" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {statusError && (
        <div className="sila-alert sila-alert--danger cp-status-error-banner" role="alert">
          <FaInfoCircle className="cp-alert-icon" aria-hidden="true" />
          <span>{statusError}</span>
        </div>
      )}

      <div className="cp-container">
        <div className="cp-header-card">
          {onBack && !showHeader && (
            <div className="cp-back-btn-wrapper">
              <button
                type="button"
                onClick={onBack}
                title="Back to Dashboard"
                className="sila-btn sila-btn--ghost sila-btn--sm cp-back-btn cp-back-btn-sm"
              >
                <FaArrowLeft className="cp-back-btn-icon" aria-hidden="true" /> Back
              </button>
            </div>
          )}
          <div className="cp-header-top">
            <div className="cp-header-left">
              <div className="cp-org-icon" aria-hidden="true">
                <FaBuilding />
              </div>
              <div className="cp-org-info">
                <h2 className="cp-org-name">{bp.organizationName || '-'}</h2>
                <div className="cp-org-contact">
                  {bp.email && (
                    <span className="cp-contact-item">
                      <FaEnvelope aria-hidden="true" />
                      {bp.email}
                    </span>
                  )}
                  {bp.phone && (
                    <span className="cp-contact-item">
                      <FaPhone aria-hidden="true" />
                      +91 {bp.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!showHeader && reviewActions}
          </div>

          <div className="cp-org-badges">
            {!showHeader && statusBadge}
            {bp.businessType && <span className="sila-badge sila-badge--neutral">{bp.businessType}</span>}
            {bp.industry && <span className="sila-badge sila-badge--neutral">{bp.industry}</span>}
          </div>
        </div>

        <div className="cp-body">
          <div className="cp-main-col">
            <section className="cp-card">
              <SectionHeader
                icon={<FaBuilding />}
                title="1. Business Profile"
                isOpen={openSections.profile}
                onToggle={() => toggleSection('profile')}
              />
              {openSections.profile && (
                <div className="cp-section-box">
                  <div className="cp-grid cp-grid-profile">
                    <div className="cp-grid-column">
                      <div className="cp-field">
                        <span className="cp-field-label">Organization Name</span>
                        <span className="cp-field-value">{bp.organizationName || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Email</span>
                        <span className="cp-field-value cp-field-link">{bp.email || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Phone</span>
                        <span className="cp-field-value">{bp.phone ? `+91 ${bp.phone}` : '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Website</span>
                        {bp.website ? (
                          <a
                            href={bp.website}
                            target="_blank"
                            rel="noreferrer"
                            className="cp-field-value cp-field-link"
                          >
                            {bp.website}
                          </a>
                        ) : (
                          <span className="cp-field-value">-</span>
                        )}
                      </div>
                    </div>

                    <div className="cp-grid-column cp-address-box">
                      <div className="cp-field">
                        <span className="cp-field-label">Industry</span>
                        <span className="cp-field-value">{bp.industry || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Business Type</span>
                        <span className="cp-field-value">{bp.businessType || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Employee Count</span>
                        <span className="cp-field-value cp-field-num">{bp.employeeCount ?? '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Annual Turnover</span>
                        <span className="cp-field-value cp-field-num">{formatCurrency(bp.annualTurnover, bp.currency)}</span>
                      </div>
                    </div>

                    <div className="cp-grid-column cp-address-box">
                      <div className="cp-field">
                        <span className="cp-field-label">Year Established</span>
                        <span className="cp-field-value cp-field-num">{bp.yearEstablished ?? '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Currency</span>
                        <span className="cp-field-value">{bp.currency || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Description</span>
                        <span className="cp-field-value cp-field-value-regular">{bp.description || '-'}</span>
                      </div>
                    </div>

                    <div className="cp-grid-column cp-address-box">
                      <div className="cp-field">
                        <span className="cp-field-label cp-field-label-icon">
                          <FaMapMarkerAlt aria-hidden="true" />
                          Address
                        </span>
                        <span className="cp-field-value">
                          {bp.addressLine1 || '-'}
                          <br />
                          {bp.city || '-'}, {bp.state || '-'}
                          <br />
                          {bp.pinCode || '-'}, {bp.country || '-'}
                        </span>
                      </div>
                      <div className="cp-sub-grid">
                        <div className="cp-field">
                          <span className="cp-field-label">Country</span>
                          <span className="cp-field-value">{bp.country || '-'}</span>
                        </div>
                        <div className="cp-field">
                          <span className="cp-field-label">State</span>
                          <span className="cp-field-value">{bp.state || '-'}</span>
                        </div>
                        <div className="cp-field">
                          <span className="cp-field-label">City</span>
                          <span className="cp-field-value">{bp.city || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="cp-card">
              <SectionHeader
                icon={<FaFileContract />}
                title="2. Business Registrations"
                isOpen={openSections.registrations}
                onToggle={() => toggleSection('registrations')}
                extra={<span className="sila-count sila-count--neutral">{registrations.length}</span>}
              />
              {openSections.registrations && (
                <div className="cp-section-box cp-section-box-flush">
                  {registrations.length === 0 ? (
                    <p className="cp-empty-inline">No registrations added</p>
                  ) : (
                    <div className="sila-table-wrap cp-table-wrapper">
                      <table className="sila-table cp-table">
                        <thead>
                          <tr>
                            <th scope="col">Type</th>
                            <th scope="col">Number</th>
                            <th scope="col">Name</th>
                            <th scope="col">Expiry Date</th>
                            <th scope="col">Document</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrations.map((reg, idx) => (
                            <tr key={idx}>
                              <td className="sila-cell-strong">{reg.registrationType || '-'}</td>
                              <td><span className="sila-ref">{reg.registrationNumber || '-'}</span></td>
                              <td>{reg.registrationName || '-'}</td>
                              <td className="cp-cell-nowrap">{formatDate(reg.expiryDate)}</td>
                              <td>
                                {reg.asset?.fileName || (reg.asset as any)?.id ? (
                                  <div className="sila-file cp-doc-link-wrapper">
                                    <span className="sila-file-icon cp-doc-file-icon" aria-hidden="true">
                                      <FaFilePdf className="cp-pdf-icon" />
                                    </span>
                                    <span className="sila-file-name cp-doc-link" title={reg.asset?.fileName}>
                                      {reg.asset?.fileName || 'Document'}
                                    </span>
                                    <button
                                      type="button"
                                      className={`sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-doc-actions ${onViewDocument ? 'cp-doc-actions-clickable' : 'cp-doc-actions-default'}`}
                                      onClick={() => {
                                        const assetId = reg.asset?.id || (reg.asset as any)?.id;
                                        if (assetId && onViewDocument) {
                                          onViewDocument(assetId, reg.asset?.fileName);
                                        }
                                      }}
                                      title="View Document"
                                      aria-label={`View document ${reg.asset?.fileName || ''}`.trim()}
                                    >
                                      <FaEye className="cp-eye-icon" aria-hidden="true" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="sila-cell-muted">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="cp-card">
              <div className="cp-card-header-flex">
                <SectionHeader
                  icon={<FaUniversity />}
                  title="3. Bank Accounts"
                  isOpen={openSections.bank}
                  onToggle={() => toggleSection('bank')}
                  extra={
                    bankAccounts.some((a) => a.isPrimary) ? (
                      <span className="sila-badge sila-badge--sm sila-badge--success cp-pill">
                        <FaCheck aria-hidden="true" /> Primary Account
                      </span>
                    ) : undefined
                  }
                />
                {isManageable && (
                  <button
                    type="button"
                    className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-manage-btn"
                    title="Manage Bank Accounts"
                    aria-label="Manage Bank Accounts"
                    onClick={openBankModal}
                  >
                    <FaCog aria-hidden="true" />
                  </button>
                )}
              </div>
              {openSections.bank && (
                <div className="cp-section-box">
                  {bankAccounts.length === 0 ? (
                    <p className="cp-empty-inline">No bank accounts added</p>
                  ) : (
                    bankAccounts.map((acc, idx) => (
                      <React.Fragment key={acc.id || idx}>
                        {idx > 0 && <div className="cp-divider" />}
                        <div className="cp-grid cp-grid-3">
                          <div className="cp-field">
                            <span className="cp-field-label">Account Holder Name</span>
                            <span className="cp-field-value">{acc.accountHolderName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Account Number</span>
                            <MaskedAccountNumber accountNumber={acc.accountNumber} />
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Currency</span>
                            <span className="cp-field-value">{acc.currency || '-'}</span>
                          </div>

                          <div className="cp-field">
                            <span className="cp-field-label">Bank Name</span>
                            <span className="cp-field-value">{acc.bankName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">IFSC Code</span>
                            <span className="cp-field-value cp-field-mono">{acc.ifscCode || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Primary Account</span>
                            <YesNoBadge value={acc.isPrimary} />
                          </div>

                          <div className="cp-field">
                            <span className="cp-field-label">Branch Name</span>
                            <span className="cp-field-value">{acc.branchName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">SWIFT Code</span>
                            <span className="cp-field-value cp-field-mono">{acc.swiftCode || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Verified</span>
                            <YesNoBadge value={acc.isVerified} />
                          </div>
                        </div>
                      </React.Fragment>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="cp-card">
              <div className="cp-card-header-flex">
                <SectionHeader
                  icon={<FaTruck />}
                  title="4. Delivery Locations"
                  isOpen={openSections.dispatch}
                  onToggle={() => toggleSection('dispatch')}
                />
                {isManageable && (
                  <button
                    type="button"
                    className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-manage-btn"
                    title="Manage Delivery Locations"
                    aria-label="Manage Delivery Locations"
                    onClick={openDispatchModal}
                  >
                    <FaCog aria-hidden="true" />
                  </button>
                )}
              </div>
              {openSections.dispatch && (
                <div className="cp-section-box">
                  {dispatchLocations.length === 0 ? (
                    <p className="cp-empty-inline">No delivery locations added</p>
                  ) : (
                    dispatchLocations.map((loc, idx) => (
                      <React.Fragment key={loc.id || idx}>
                        {idx > 0 && <div className="cp-divider" />}
                        <div className="cp-grid cp-grid-3">
                          <div className="cp-field">
                            <span className="cp-field-label">Location Name</span>
                            <span className="cp-field-value">{loc.locationName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Address</span>
                            <span className="cp-field-value">
                              {loc.addressLine1 || '-'}
                              <br />
                              {loc.city && <>{loc.city}, </>}
                              {loc.state && <>{loc.state} - </>}
                              {loc.country}
                            </span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Default Location</span>
                            <YesNoBadge value={loc.isDefault} />
                          </div>

                          <div className="cp-field">
                            <span className="cp-field-label">Contact Person</span>
                            <span className="cp-field-value">{loc.contactPerson || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Contact Email</span>
                            <span className="cp-field-value">{loc.contactEmail || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Contact Phone</span>
                            <span className="cp-field-value">
                              {loc.contactPhone ? `+91 ${loc.contactPhone}` : '-'}
                            </span>
                          </div>
                        </div>
                      </React.Fragment>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="cp-card">
              <SectionHeader
                icon={<FaThLarge />}
                title="5. Product Categories"
                isOpen={openSections.categories}
                onToggle={() => toggleSection('categories')}
                extra={<span className="sila-count sila-count--neutral">{categories.length}</span>}
              />
              {openSections.categories && (
                <div className="cp-section-box">
                  {categories.length === 0 ? (
                    <p className="cp-empty-inline">No categories added</p>
                  ) : (
                    <div className="cp-category-list">
                      {categories.map((cat, idx) => (
                        <div className="cp-category-chain" key={idx}>
                          <div className="cp-category-step">
                            <span className="cp-category-label cp-category-label-segment">Segment</span>
                            <span className="cp-field-value cp-field-mono">{cat.segment ?? '-'}</span>
                            <span className="cp-category-sub">{cat.segmentTitle || '-'}</span>
                          </div>
                          <span className="cp-category-arrow" aria-hidden="true"><FaChevronRight /></span>
                          <div className="cp-category-step">
                            <span className="cp-category-label cp-category-label-family">Family</span>
                            <span className="cp-field-value cp-field-mono">{cat.family ?? '-'}</span>
                            <span className="cp-category-sub">{cat.familyTitle || '-'}</span>
                          </div>
                          <span className="cp-category-arrow" aria-hidden="true"><FaChevronRight /></span>
                          <div className="cp-category-step">
                            <span className="cp-category-label cp-category-label-class">Class</span>
                            <span className="cp-field-value cp-field-mono">{cat.class ?? '-'}</span>
                            <span className="cp-category-sub">{cat.classTitle || '-'}</span>
                          </div>
                          <span className="cp-category-arrow" aria-hidden="true"><FaChevronRight /></span>
                          <div className="cp-category-step">
                            <span className="cp-category-label cp-category-label-commodity">Commodity</span>
                            <span className="cp-field-value cp-field-mono">{cat.commodity ?? '-'}</span>
                            <span className="cp-category-sub">{cat.commodityTitle || '-'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {mode === 'admin-review' && (profile as any)?.organizationId && (
              <section className="cp-card">
                <SectionHeader
                  icon={<FaCubes />}
                  title="6. Model Access"
                  isOpen={openSections.models}
                  onToggle={() => toggleSection('models')}
                />
                {openSections.models && (
                  <div className="cp-section-box">
                    <OrganizationModelAccess
                      organizationId={(profile as any).organizationId}
                      assignedModels={(profile as any).models || []}
                      onAccessUpdated={() => reloadProfile()}
                    />
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="cp-side-col" aria-label={`${entityLabel} Summary`}>
            <div className="cp-card cp-summary-card">
              <div className="cp-card-title cp-card-title-static">
                <span className="cp-card-icon" aria-hidden="true">
                  <FaInfoCircle />
                </span>
                <h2 className="cp-card-title-text">{entityLabel} Summary</h2>
              </div>

              <div className="cp-summary-content">
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaBuilding className="cp-summary-icon" aria-hidden="true" /> Organization Name
                  </span>
                  <span className="cp-summary-value">{bp.organizationName || '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaInfoCircle className="cp-summary-icon" aria-hidden="true" /> Status
                  </span>
                  <StatusBadge status={statusKey || 'PENDING'} label={statusLabel} tone={statusTone} size="sm" />
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaIndustry className="cp-summary-icon" aria-hidden="true" /> Industry
                  </span>
                  <span className="cp-summary-value">{bp.industry || '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaBriefcase className="cp-summary-icon" aria-hidden="true" /> Business Type
                  </span>
                  <span className="cp-summary-value">{bp.businessType || '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaUsers className="cp-summary-icon" aria-hidden="true" /> Employees
                  </span>
                  <span className="cp-summary-value cp-field-num">{bp.employeeCount ?? '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaMoneyBillWave className="cp-summary-icon" aria-hidden="true" /> Annual Turnover
                  </span>
                  <span className="cp-summary-value cp-field-num">{formatCurrency(bp.annualTurnover, bp.currency)}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaCalendarAlt className="cp-summary-icon" aria-hidden="true" /> Year Established
                  </span>
                  <span className="cp-summary-value cp-field-num">{bp.yearEstablished ?? '-'}</span>
                </div>

                <div className="cp-divider" />

                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaFileContract className="cp-summary-icon" aria-hidden="true" /> Registrations
                  </span>
                  <span className="cp-summary-value cp-field-num">{registrations.length}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaUniversity className="cp-summary-icon" aria-hidden="true" /> Bank Accounts
                  </span>
                  <span className="cp-summary-value cp-field-num">{bankAccounts.length}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaMapMarkerAlt className="cp-summary-icon" aria-hidden="true" /> Delivery Locations
                  </span>
                  <span className="cp-summary-value cp-field-num">{dispatchLocations.length}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaTags className="cp-summary-icon" aria-hidden="true" /> Product Categories
                  </span>
                  <span className="cp-summary-value cp-field-num">{categories.length}</span>
                </div>

                <div className="cp-divider" />

                <div className="cp-summary-row cp-summary-row-stacked">
                  <span className="cp-summary-label">
                    <FaUserCircle className="cp-summary-icon" aria-hidden="true" /> Created By
                  </span>
                  <span className="cp-summary-value cp-summary-value-link">{bp.email || '-'}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {isBankModalOpen && (
        <div className="sila-overlay cp-modal-overlay" onClick={closeBankModal}>
          <div
            className="sila-modal sila-modal--lg cp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-bank-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header cp-modal-header">
              <h3 id="cp-bank-modal-title" className="sila-modal-title cp-modal-title">
                {bankModalView === 'list'
                  ? 'Bank Accounts'
                  : editingBankAccount
                    ? 'Edit Bank Account'
                    : 'Add Bank Account'}
              </h3>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-modal-close"
                onClick={closeBankModal}
                aria-label="Close"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="sila-modal-body cp-modal-body">
              {bankModalView === 'list' ? (
                <>
                  {bankListError && (
                    <div className="sila-alert sila-alert--danger cp-modal-error" role="alert">{bankListError}</div>
                  )}

                  <div className="cp-modal-toolbar">
                    <button
                      type="button"
                      className="sila-btn sila-btn--primary sila-btn--sm cp-btn-add-location"
                      onClick={openAddBankForm}
                    >
                      <FaPlus aria-hidden="true" /> Add New Bank Account
                    </button>
                  </div>

                  {bankAccounts.length === 0 ? (
                    <p className="cp-empty-inline cp-empty-inline-boxed">
                      No bank accounts added yet
                    </p>
                  ) : (
                    <ul className="cp-location-list">
                      {bankAccounts.map((acc, idx) => (
                        <li className="cp-location-list-item" key={acc.id || idx}>
                          <span className="cp-location-list-icon" aria-hidden="true">
                            <FaUniversity />
                          </span>
                          <div className="cp-location-list-info">
                            <div className="cp-location-list-name">
                              {acc.bankName || '-'}
                              {acc.isPrimary && (
                                <span className="sila-badge sila-badge--sm sila-badge--success cp-location-default-tag">
                                  <FaCheck aria-hidden="true" /> Primary
                                </span>
                              )}
                            </div>
                            <div className="cp-location-list-address">
                              {acc.accountHolderName}
                              {acc.accountNumber ? ` • ****${acc.accountNumber.slice(-4)}` : ''}
                            </div>
                          </div>
                          <div className="cp-location-list-actions">
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-icon-action-btn"
                              title="Edit"
                              aria-label={`Edit ${acc.bankName || 'bank account'}`}
                              onClick={() => openEditBankForm(acc)}
                              disabled={!acc.id}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-icon-action-btn cp-icon-action-btn-danger"
                              title="Delete"
                              aria-label={`Delete ${acc.bankName || 'bank account'}`}
                              onClick={() => openDeleteBankAccountConfirmation(acc)}
                              disabled={!acc.id}
                            >
                              <FaTrash aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <form className="cp-dispatch-form" onSubmit={handleBankFormSubmit}>
                  {bankFormError && (
                    <div className="sila-alert sila-alert--danger cp-modal-error" role="alert">{bankFormError}</div>
                  )}

                  <div className="cp-form-grid">
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-bank-holder">
                        Account Holder Name<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="cp-bank-holder"
                        className="sila-input"
                        type="text"
                        value={bankForm.accountHolderName || ''}
                        onChange={(e) => handleBankFormChange('accountHolderName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-bank-name">
                        Bank Name<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="cp-bank-name"
                        className="sila-input"
                        type="text"
                        value={bankForm.bankName || ''}
                        onChange={(e) => handleBankFormChange('bankName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-bank-branch">Branch Name</label>
                      <input
                        id="cp-bank-branch"
                        className="sila-input"
                        type="text"
                        value={bankForm.branchName || ''}
                        onChange={(e) => handleBankFormChange('branchName', e.target.value)}
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-bank-account-number">
                        Account Number<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="cp-bank-account-number"
                        className="sila-input"
                        type="text"
                        value={bankForm.accountNumber || ''}
                        onChange={(e) => handleBankFormChange('accountNumber', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-bank-ifsc">
                        IFSC Code<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="cp-bank-ifsc"
                        className="sila-input"
                        type="text"
                        value={bankForm.ifscCode || ''}
                        onChange={(e) => handleBankFormChange('ifscCode', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-bank-swift">SWIFT Code</label>
                      <input
                        id="cp-bank-swift"
                        className="sila-input"
                        type="text"
                        value={bankForm.swiftCode || ''}
                        onChange={(e) => handleBankFormChange('swiftCode', e.target.value)}
                      />
                    </div>
                    {isSupplier && (
                      <div className="sila-field cp-form-field">
                        <label className="sila-label" htmlFor="cp-bank-iban">IBAN</label>
                        <input
                          id="cp-bank-iban"
                          className="sila-input"
                          type="text"
                          value={bankForm.iban || ''}
                          onChange={(e) => handleBankFormChange('iban', e.target.value)}
                        />
                      </div>
                    )}
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-bank-currency">Currency</label>
                      <input
                        id="cp-bank-currency"
                        className="sila-input"
                        type="text"
                        value={bankForm.currency || ''}
                        onChange={(e) => handleBankFormChange('currency', e.target.value)}
                        placeholder="e.g. INR, USD"
                      />
                    </div>
                    <div className="sila-field sila-field--full cp-form-field cp-form-field-checkbox">
                      <label className="cp-checkbox-label" htmlFor="cp-bank-primary">
                        <input
                          id="cp-bank-primary"
                          type="checkbox"
                          checked={!!bankForm.isPrimary}
                          disabled={hasOtherPrimaryBank(editingBankAccount?.id)}
                          onChange={(e) => handleBankFormChange('isPrimary', e.target.checked)}
                          aria-describedby={hasOtherPrimaryBank(editingBankAccount?.id) ? 'cp-bank-primary-hint' : undefined}
                        />
                        Set as Primary Account
                      </label>
                      {hasOtherPrimaryBank(editingBankAccount?.id) && (
                        <span id="cp-bank-primary-hint" className="sila-help cp-form-hint">You already have a primary account</span>
                      )}
                    </div>
                  </div>

                  <div className="sila-form-actions cp-form-actions">
                    <button
                      type="button"
                      className="sila-btn sila-btn--secondary cp-btn-cancel"
                      onClick={() => setBankModalView('list')}
                      disabled={isBankSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="sila-btn sila-btn--primary"
                      disabled={isBankSubmitting}
                      aria-busy={isBankSubmitting || undefined}
                    >
                      {isBankSubmitting && <span className="sila-spinner" aria-hidden="true" />}
                      {isBankSubmitting
                        ? 'Saving...'
                        : editingBankAccount
                          ? 'Update Account'
                          : 'Save Account'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {isDispatchModalOpen && (
        <div className="sila-overlay cp-modal-overlay" onClick={closeDispatchModal}>
          <div
            className="sila-modal sila-modal--lg cp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cp-dispatch-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header cp-modal-header">
              <h3 id="cp-dispatch-modal-title" className="sila-modal-title cp-modal-title">
                {dispatchModalView === 'list'
                  ? 'Delivery Locations'
                  : editingLocation
                    ? 'Edit Delivery Location'
                    : 'Add Delivery Location'}
              </h3>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-modal-close"
                onClick={closeDispatchModal}
                aria-label="Close"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="sila-modal-body cp-modal-body">
              {dispatchModalView === 'list' ? (
                <>
                  {dispatchListError && (
                    <div className="sila-alert sila-alert--danger cp-modal-error" role="alert">{dispatchListError}</div>
                  )}

                  <div className="cp-modal-toolbar">
                    <button
                      type="button"
                      className="sila-btn sila-btn--primary sila-btn--sm cp-btn-add-location"
                      onClick={openAddLocationForm}
                    >
                      <FaPlus aria-hidden="true" /> Add New Location
                    </button>
                  </div>

                  {dispatchLocations.length === 0 ? (
                    <p className="cp-empty-inline cp-empty-inline-boxed">
                      No delivery locations added yet
                    </p>
                  ) : (
                    <ul className="cp-location-list">
                      {dispatchLocations.map((loc, idx) => (
                        <li className="cp-location-list-item" key={loc.id || idx}>
                          <span className="cp-location-list-icon" aria-hidden="true">
                            <FaMapMarkerAlt />
                          </span>
                          <div className="cp-location-list-info">
                            <div className="cp-location-list-name">
                              {loc.locationName || '-'}
                              {loc.isDefault && (
                                <span className="sila-badge sila-badge--sm sila-badge--success cp-location-default-tag">
                                  <FaCheck aria-hidden="true" /> Default
                                </span>
                              )}
                            </div>
                            <div className="cp-location-list-address">
                              {loc.addressLine1}
                              {loc.city ? `, ${loc.city}` : ''}
                              {loc.state ? `, ${loc.state}` : ''}
                              {loc.country ? `, ${loc.country}` : ''}
                            </div>
                          </div>
                          <div className="cp-location-list-actions">
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-icon-action-btn"
                              title="Edit"
                              aria-label={`Edit ${loc.locationName || 'location'}`}
                              onClick={() => openEditLocationForm(loc)}
                              disabled={!loc.id}
                            >
                              <FaEdit aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-icon-action-btn cp-icon-action-btn-danger"
                              title="Delete"
                              aria-label={`Delete ${loc.locationName || 'location'}`}
                              onClick={() => openDeleteLocationConfirmation(loc)}
                              disabled={!loc.id}
                            >
                              <FaTrash aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <form className="cp-dispatch-form" onSubmit={handleDispatchFormSubmit}>
                  {dispatchFormError && (
                    <div className="sila-alert sila-alert--danger cp-modal-error" role="alert">{dispatchFormError}</div>
                  )}

                  <div className="cp-form-grid">
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-name">
                        Location Name<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="cp-loc-name"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.locationName || ''}
                        onChange={(e) => handleDispatchFormChange('locationName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-address1">
                        Address Line 1<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="cp-loc-address1"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.addressLine1 || ''}
                        onChange={(e) => handleDispatchFormChange('addressLine1', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-address2">Address Line 2</label>
                      <input
                        id="cp-loc-address2"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.addressLine2 || ''}
                        onChange={(e) => handleDispatchFormChange('addressLine2', e.target.value)}
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-city">
                        City<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="cp-loc-city"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.city || ''}
                        onChange={(e) => handleDispatchFormChange('city', e.target.value)}
                        required
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-state">State</label>
                      <input
                        id="cp-loc-state"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.state || ''}
                        onChange={(e) => handleDispatchFormChange('state', e.target.value)}
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-country">Country</label>
                      <input
                        id="cp-loc-country"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.country || ''}
                        onChange={(e) => handleDispatchFormChange('country', e.target.value)}
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-pin">Pin Code</label>
                      <input
                        id="cp-loc-pin"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.pinCode || ''}
                        onChange={(e) => handleDispatchFormChange('pinCode', e.target.value)}
                      />
                    </div>
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-contact-person">Contact Person</label>
                      <input
                        id="cp-loc-contact-person"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.contactPerson || ''}
                        onChange={(e) => handleDispatchFormChange('contactPerson', e.target.value)}
                      />
                    </div>
                    {isSupplier && (
                      <div className="sila-field cp-form-field">
                        <label className="sila-label" htmlFor="cp-loc-contact-email">Contact Email</label>
                        <input
                          id="cp-loc-contact-email"
                          className="sila-input"
                          type="email"
                          value={dispatchForm.contactEmail || ''}
                          onChange={(e) => handleDispatchFormChange('contactEmail', e.target.value)}
                        />
                      </div>
                    )}
                    <div className="sila-field cp-form-field">
                      <label className="sila-label" htmlFor="cp-loc-contact-phone">Contact Phone</label>
                      <input
                        id="cp-loc-contact-phone"
                        className="sila-input"
                        type="text"
                        value={dispatchForm.contactPhone || ''}
                        onChange={(e) => handleDispatchFormChange('contactPhone', e.target.value)}
                      />
                    </div>
                    <div className="sila-field sila-field--full cp-form-field cp-form-field-checkbox">
                      <label className="cp-checkbox-label" htmlFor="cp-loc-default">
                        <input
                          id="cp-loc-default"
                          type="checkbox"
                          checked={!!dispatchForm.isDefault}
                          disabled={hasOtherDefaultLocation(editingLocation?.id)}
                          onChange={(e) => handleDispatchFormChange('isDefault', e.target.checked)}
                          aria-describedby={hasOtherDefaultLocation(editingLocation?.id) ? 'cp-loc-default-hint' : undefined}
                        />
                        Set as Default Location
                      </label>
                      {hasOtherDefaultLocation(editingLocation?.id) && (
                        <span id="cp-loc-default-hint" className="sila-help cp-form-hint">You already have a default location</span>
                      )}
                    </div>
                  </div>

                  <div className="sila-form-actions cp-form-actions">
                    <button
                      type="button"
                      className="sila-btn sila-btn--secondary cp-btn-cancel"
                      onClick={() => setDispatchModalView('list')}
                      disabled={isDispatchSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="sila-btn sila-btn--primary"
                      disabled={isDispatchSubmitting}
                      aria-busy={isDispatchSubmitting || undefined}
                    >
                      {isDispatchSubmitting && <span className="sila-spinner" aria-hidden="true" />}
                      {isDispatchSubmitting
                        ? 'Saving...'
                        : editingLocation
                          ? 'Update Location'
                          : 'Save Location'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={confirmationModal.isOpen}
        title={confirmationModal.title}
        message={confirmationModal.message}
        isLoading={confirmationModal.isLoading}
        onConfirm={handleConfirmationConfirm}
        onCancel={handleConfirmationCancel}
      />
    </div>
  );
};

export default CompanyProfile;
