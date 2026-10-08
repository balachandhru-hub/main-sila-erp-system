import React, { useState, useRef, useEffect } from 'react';
import { fetchOnboardingDetails, fetchMetadataReferenceList, fetchSegments, fetchClasses } from '../api/supplierApi';
import type { MetadataReferenceItem } from '../dto/supplierDto';
import { Country, State, City } from 'country-state-city';
import './SupplierOnboardingForm.css';
import { FaChevronDown } from 'react-icons/fa';

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Step 1: Business Information
export interface Step1Data {
  industry: string;
  businessType: string;
  employeeCount: string;
  annualTurnover: string;
  currency: string;
  yearEstablished: string;
  website: string;
  companyDescription: string;
}

export const initialStep1Data: Step1Data = {
  industry: '',
  businessType: '',
  employeeCount: '',
  annualTurnover: '',
  currency: 'INR',
  yearEstablished: '',
  website: '',
  companyDescription: '',
};

// Step 2: Registrations & Certifications
export interface RegistrationEntry {
  id: string;
  type: string;
  number: string;
  name: string;
  expiryDate: string;
  certificateFile: File | null;
  certificateFileName: string | null;
}

export interface Step2Data {
  registrations: RegistrationEntry[];
}

export const initialStep2Data: Step2Data = {
  registrations: [],
};

// Step 3: Bank Account Information
export interface BankAccountEntry {
  id: string;
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

export interface Step3Data {
  accounts: BankAccountEntry[];
}

export const initialStep3Data: Step3Data = {
  accounts: [],
};

// Step 4: Dispatch Locations
export interface DispatchLocationEntry {
  id: string;
  locationName: string;
  contactPerson: string;
  country: string;
  state: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  pinCode: string;
  contactEmail: string;
  contactPhone: string;
  isDefault: boolean;
}

export interface Step4Data {
  locations: DispatchLocationEntry[];
  certifyTrue: boolean;
  agreeTerms: boolean;
  authorizeVerify: boolean;
}

export const initialStep4Data: Step4Data = {
  locations: [],
  certifyTrue: false,
  agreeTerms: false,
  authorizeVerify: false,
};

// ============================================================================
// HELPER COMPONENTS & CONSTANTS
// ============================================================================

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 12.5l5 5L20 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Metadata keys come back as UPPER_SNAKE_CASE (e.g. TEXTILES_APPAREL, GST).
// Short keys (<=4 chars) are treated as acronyms and kept uppercase;
// longer words get title-cased. e.g. 'TEXTILES_APPAREL' -> 'Textiles Apparel', 'GST' -> 'GST'
const formatMetadataLabel = (key: string): string =>
  key
    .split('_')
    .map((word) => (word.length <= 4 ? word : word.charAt(0) + word.slice(1).toLowerCase()))
    .join(' ');

const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP'];
const YEAR_OPTIONS = Array.from({ length: 60 }, (_, i) => String(new Date().getFullYear() - i));

interface StepMeta {
  id: number;
  label: string;
}

const STEPS: StepMeta[] = [
  { id: 1, label: 'Business Information' },
  { id: 2, label: 'Product & Service Categories' },
  { id: 3, label: 'Registrations & Certifications' },
  { id: 4, label: 'Bank Account Information' },
  { id: 5, label: 'Dispatch Locations' },
];

// ============================================================================
// STEP 1 COMPONENT: Step1BusinessInfo
// ============================================================================

interface Step1BusinessInfoProps {
  data: Step1Data;
  onChange: (data: Step1Data) => void;
  onValidationChange?: (isValid: boolean) => void;
  onboardingData?: any;
  industryOptions: MetadataReferenceItem[];
  businessTypeOptions: MetadataReferenceItem[];
}

const Step1BusinessInfo: React.FC<Step1BusinessInfoProps> = ({
  data,
  onChange,
  onValidationChange,
  onboardingData,
  industryOptions,
  businessTypeOptions,
}) => {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleField = <K extends keyof Step1Data>(field: K, value: Step1Data[K]) => {
    onChange({ ...data, [field]: value });
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const errors: Record<string, string> = {};
  if (!data.industry.trim()) errors.industry = 'Industry is required';
  if (!data.businessType.trim()) errors.businessType = 'Business Type is required';

  const isValid = Object.keys(errors).length === 0;

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const getFieldError = (field: string) => {
    if (!touched[field]) return null;
    return errors[field] || null;
  };

  const industryError = getFieldError('industry');
  const businessTypeError = getFieldError('businessType');

  return (
    <>
      <div className="vob-card">
        <h2 className="vob-title">Step 1: Business Information</h2>

        <div className="vob-grid">
          <div className="vob-field">
            <label className="vob-label vob-label--required" htmlFor="vob-industry">Industry</label>
            <select
              id="vob-industry"
              data-field="industry"
              className={`vob-select ${industryError ? 'vob-select--error' : ''}`}
              aria-invalid={Boolean(industryError) || undefined}
              value={data.industry}
              onChange={(e) => handleField('industry', e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, industry: true }))}
            >
              <option value="">Select Industry</option>
              {industryOptions.map((opt) => (
                <option key={opt.id} value={opt.key}>{formatMetadataLabel(opt.key)}</option>
              ))}
            </select>
            {industryError && <span className="vob-error-text" role="alert">{industryError}</span>}
          </div>

          <div className="vob-field">
            <label className="vob-label vob-label--required" htmlFor="vob-business-type">Business Type</label>
            <select
              id="vob-business-type"
              data-field="businessType"
              className={`vob-select ${businessTypeError ? 'vob-select--error' : ''}`}
              aria-invalid={Boolean(businessTypeError) || undefined}
              value={data.businessType}
              onChange={(e) => handleField('businessType', e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, businessType: true }))}
            >
              <option value="">Select Business Type</option>
              {businessTypeOptions.map((opt) => (
                <option key={opt.id} value={opt.key}>{formatMetadataLabel(opt.key)}</option>
              ))}
            </select>
            {businessTypeError && <span className="vob-error-text" role="alert">{businessTypeError}</span>}
          </div>

          <div className="vob-field">
            <label className="vob-label" htmlFor="vob-employee-count">Employee Count</label>
            <input
              id="vob-employee-count"
              type="number"
              min="0"
              placeholder="Employee Count"
              className="vob-input"
              value={data.employeeCount}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*$/.test(val)) {
                  handleField('employeeCount', val);
                }
              }}
            />
          </div>

          <div className="vob-field">
            <label className="vob-label" htmlFor="vob-annual-turnover">Annual Turnover</label>
            <input
              id="vob-annual-turnover"
              type="text"
              placeholder="Annual Turnover"
              className="vob-input"
              value={data.annualTurnover}
              onChange={(e) => {
                const val = e.target.value;
                if (/^\d*\.?\d*$/.test(val)) {
                  handleField('annualTurnover', val);
                }
              }}
            />
          </div>

          <div className="vob-field">
            <label className="vob-label" htmlFor="vob-currency">Currency</label>
            <select
              id="vob-currency"
              className="vob-select"
              value={data.currency}
              onChange={(e) => handleField('currency', e.target.value)}
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div className="vob-field">
            <label className="vob-label" htmlFor="vob-year-established">Year Established</label>
            <select
              id="vob-year-established"
              className="vob-select"
              value={data.yearEstablished}
              onChange={(e) => handleField('yearEstablished', e.target.value)}
            >
              <option value="">Select Year</option>
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="vob-field vob-field--full">
            <label className="vob-label" htmlFor="vob-website">Website</label>
            <input
              id="vob-website"
              type="url"
              placeholder="https://"
              className="vob-input"
              value={data.website}
              onChange={(e) => handleField('website', e.target.value)}
            />
          </div>

          <div className="vob-field vob-field--full">
            <label className="vob-label" htmlFor="vob-company-description">Company Description</label>
            <textarea
              id="vob-company-description"
              rows={4}
              placeholder="Tell buyers about your company, products, services and capabilities..."
              className="vob-textarea"
              value={data.companyDescription}
              onChange={(e) => handleField('companyDescription', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="vob-card">
        <h2 className="vob-title">Company Information</h2>
        {onboardingData ? (
          <div className="vob-grid">
            <div className="vob-info-group">
              <div className="vob-info-label">Organization Name</div>
              <div className="vob-info-value">{onboardingData.organizationName || '-'}</div>
            </div>
            <div className="vob-info-group">
              <div className="vob-info-label">Email</div>
              <div className="vob-info-value">{onboardingData.email || '-'}</div>
            </div>
            <div className="vob-info-group">
              <div className="vob-info-label">Phone</div>
              <div className="vob-info-value">{onboardingData.phone || '-'}</div>
            </div>
            <div className="vob-info-group">
              <div className="vob-info-label">Country</div>
              <div className="vob-info-value">{onboardingData.country || '-'}</div>
            </div>
            <div className="vob-info-group">
              <div className="vob-info-label">City</div>
              <div className="vob-info-value">{onboardingData.city || '-'}</div>
            </div>
            <div className="vob-info-group">
              <div className="vob-info-label">State</div>
              <div className="vob-info-value">{onboardingData.state || '-'}</div>
            </div>
            <div className="vob-info-group">
              <div className="vob-info-label">PIN / ZIP Code</div>
              <div className="vob-info-value">{onboardingData.pinCode || '-'}</div>
            </div>

            <div className="vob-info-divider" />

            <div className="vob-field--full">
              <div className="vob-info-label">Address</div>
              <div className="vob-address-block">
                {onboardingData.addressLine1 && <div>{onboardingData.addressLine1}</div>}
                {onboardingData.addressLine2 && <div>{onboardingData.addressLine2}</div>}
                {(onboardingData.city || onboardingData.state || onboardingData.pinCode) && (
                  <div>
                    {onboardingData.city}
                    {onboardingData.city && onboardingData.state && ', '}
                    {onboardingData.state}
                    {(onboardingData.city || onboardingData.state) && onboardingData.pinCode && ' - '}
                    {onboardingData.pinCode}
                  </div>
                )}
                {onboardingData.country && <div>{onboardingData.country}</div>}
              </div>
            </div>
          </div>
        ) : (
          <div className="vob-loading-text" role="status">Loading company information...</div>
        )}
      </div>
    </>
  );
};

// ============================================================================
// STEP 2 COMPONENT: Step2Registrations
// ============================================================================

interface Step2RegistrationsProps {
  data: Step2Data;
  onChange: (data: Step2Data) => void;
  onValidationChange?: (isValid: boolean) => void;
  registrationTypeOptions: MetadataReferenceItem[];
}

interface Step2Draft {
  type: string;
  number: string;
  name: string;
  expiryDate: string;
  certificateFile: File | null;
}

const emptyStep2Draft: Step2Draft = {
  type: '',
  number: '',
  name: '',
  expiryDate: '',
  certificateFile: null,
};

const Step2Registrations: React.FC<Step2RegistrationsProps> = ({
  data,
  onChange,
  onValidationChange,
  registrationTypeOptions,
}) => {
  const [draft, setDraft] = useState<Step2Draft>(emptyStep2Draft);
  const [dragActive, setDragActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default the type dropdown to the first fetched option once options load
  useEffect(() => {
    if (!draft.type && registrationTypeOptions.length > 0) {
      setDraft((prev) => ({ ...prev, type: registrationTypeOptions[0].key }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrationTypeOptions]);

  const handleDraftField = <K extends keyof Step2Draft>(field: K, value: Step2Draft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFormError(null);
  };

  const handleFileSelect = (file: File | null) => {
    handleDraftField('certificateFile', file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) handleFileSelect(file);
  };

  const handleAddRegistration = () => {
    setFormError(null);
    if (!draft.number.trim() || !draft.name.trim()) {
      setFormError('Registration Number and Registration Name are required');
      return;
    }

    const newEntry: RegistrationEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: draft.type,
      number: draft.number.trim(),
      name: draft.name.trim(),
      expiryDate: draft.expiryDate,
      certificateFile: draft.certificateFile,
      certificateFileName: draft.certificateFile?.name ?? null,
    };

    onChange({ registrations: [...data.registrations, newEntry] });
    setDraft({ ...emptyStep2Draft, type: registrationTypeOptions[0]?.key ?? '' });
    setTouched({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = (id: string) => {
    onChange({ registrations: data.registrations.filter((r) => r.id !== id) });
  };

  const isValid = data.registrations.length > 0;

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const numberError = touched.number && !draft.number.trim() ? 'Registration Number is required' : null;
  const nameError = touched.name && !draft.name.trim() ? 'Registration Name is required' : null;

  return (
    <div className="vob-card">
      <h2 className="vob-title">Step 2: Registrations & Certifications</h2>

      {formError && <div className="vob-error-banner">{formError}</div>}

      <div className="vob-grid">
        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-registration-type">Registration Type</label>
          <select
            id="vob-registration-type"
            className="vob-select"
            value={draft.type}
            onChange={(e) => handleDraftField('type', e.target.value)}
          >
            {registrationTypeOptions.map((opt) => (
              <option key={opt.id} value={opt.key}>{formatMetadataLabel(opt.key)}</option>
            ))}
          </select>
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-registration-number">Registration Number</label>
          <input
            id="vob-registration-number"
            data-field="number"
            type="text"
            placeholder="Registration Number"
            className={`vob-input ${numberError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(numberError) || undefined}
            value={draft.number}
            onChange={(e) => handleDraftField('number', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, number: true }))}
          />
          {numberError && <span className="vob-error-text" role="alert">{numberError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-registration-name">Registration Name</label>
          <input
            id="vob-registration-name"
            data-field="name"
            type="text"
            placeholder="Registration Name"
            className={`vob-input ${nameError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(nameError) || undefined}
            value={draft.name}
            onChange={(e) => handleDraftField('name', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
          />
          {nameError && <span className="vob-error-text" role="alert">{nameError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-expiry-date">Expiry Date</label>
          <input
            id="vob-expiry-date"
            type="date"
            className="vob-input"
            value={draft.expiryDate}
            onChange={(e) => handleDraftField('expiryDate', e.target.value)}
          />
        </div>
      </div>

      <span className="vob-label" id="vob-upload-certificate-label">Upload Certificate</span>
      <div
        role="button"
        tabIndex={0}
        aria-labelledby="vob-upload-certificate-label"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`vob-upload-area ${dragActive ? 'vob-upload-area--active' : ''}`}
      >
        <span className={draft.certificateFile ? 'vob-upload-filename' : 'vob-upload-text'}>
          {draft.certificateFile
            ? draft.certificateFile.name
            : 'Click to select file or drag and drop certificate here'}
        </span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        className="vob-upload-input"
        onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
      />

      <div className="vob-action-row vob-action-row--end">
        <button
          type="button"
          onClick={handleAddRegistration}
          className="vob-btn vob-btn--primary vob-btn--sm"
        >
          + Add Registration
        </button>
      </div>

      {data.registrations.length === 0 && (
        <div className="vob-empty-state">
          No registrations added yet. Please add at least one registration to proceed.
        </div>
      )}

      {data.registrations.length > 0 && (
        <div className="vob-table-wrapper">
          <table className="vob-table">
            <thead className="vob-thead">
              <tr>
                <th className="vob-th">Type</th>
                <th className="vob-th">Number</th>
                <th className="vob-th">Name</th>
                <th className="vob-th">Expiry Date</th>
                <th className="vob-th">Attachments</th>
                <th className="vob-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.registrations.map((reg) => (
                <tr key={reg.id}>
                  <td className="vob-td">{formatMetadataLabel(reg.type)}</td>
                  <td className="vob-td">{reg.number}</td>
                  <td className="vob-td">{reg.name}</td>
                  <td className="vob-td">{reg.expiryDate || '—'}</td>
                  <td className="vob-td">
                    {reg.certificateFileName ? (
                      <span className="vob-badge vob-badge--attachment">
                        {reg.certificateFileName}
                      </span>
                    ) : (
                      <span className="vob-attachment-none">None</span>
                    )}
                  </td>
                  <td className="vob-td">
                    <button
                      type="button"
                      onClick={() => handleRemove(reg.id)}
                      className="vob-btn-icon"
                      aria-label="Remove registration"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STEP 3 COMPONENT: Step3BankInfo
// ============================================================================

interface Step3BankInfoProps {
  data: Step3Data;
  onChange: (data: Step3Data) => void;
  onValidationChange?: (isValid: boolean) => void;
}

interface Step3Draft {
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

const emptyStep3Draft: Step3Draft = {
  accountHolderName: '',
  bankName: '',
  branchName: '',
  accountNumber: '',
  ifscCode: '',
  swiftCode: '',
  iban: '',
  currency: 'INR',
  isPrimary: false,
};

const Step3BankInfo: React.FC<Step3BankInfoProps> = ({ data, onChange, onValidationChange }) => {
  const [draft, setDraft] = useState<Step3Draft>(emptyStep3Draft);
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const handleDraftField = <K extends keyof Step3Draft>(field: K, value: Step3Draft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFormError(null);
  };

  const handleAddAccount = () => {
    setFormError(null);
    if (
      !draft.accountHolderName.trim() ||
      !draft.bankName.trim() ||
      !draft.branchName.trim() ||
      !draft.accountNumber.trim() ||
      !draft.ifscCode.trim()
    ) {
      setFormError('Account Holder Name, Bank Name, Branch Name, Account Number, and IFSC Code are required.');
      return;
    }

    const isFirstAccount = data.accounts.length === 0;
    const shouldBePrimary = isFirstAccount || draft.isPrimary;

    const newEntry: BankAccountEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      accountHolderName: draft.accountHolderName.trim(),
      bankName: draft.bankName.trim(),
      branchName: draft.branchName.trim(),
      accountNumber: draft.accountNumber.trim(),
      ifscCode: draft.ifscCode.trim(),
      swiftCode: draft.swiftCode.trim(),
      iban: draft.iban.trim(),
      currency: draft.currency,
      isPrimary: shouldBePrimary,
    };

    const updatedAccounts = shouldBePrimary
      ? data.accounts.map((acc) => ({ ...acc, isPrimary: false }))
      : data.accounts;

    onChange({ accounts: [...updatedAccounts, newEntry] });
    setDraft(emptyStep3Draft);
    setTouched({});
  };

  const handleRemove = (id: string) => {
    const removedAccount = data.accounts.find((acc) => acc.id === id);
    let remainingAccounts = data.accounts.filter((acc) => acc.id !== id);

    if (removedAccount?.isPrimary && remainingAccounts.length > 0) {
      remainingAccounts = remainingAccounts.map((acc, index) =>
        index === 0 ? { ...acc, isPrimary: true } : acc
      );
    }

    onChange({ accounts: remainingAccounts });
  };

  const isValid = data.accounts.length > 0;

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const accountHolderNameError = touched.accountHolderName && !draft.accountHolderName.trim() ? 'Account Holder Name is required' : null;
  const bankNameError = touched.bankName && !draft.bankName.trim() ? 'Bank Name is required' : null;
  const branchNameError = touched.branchName && !draft.branchName.trim() ? 'Branch Name is required' : null;
  const accountNumberError = touched.accountNumber && !draft.accountNumber.trim() ? 'Account Number is required' : null;
  const ifscCodeError = touched.ifscCode && !draft.ifscCode.trim() ? 'IFSC Code is required' : null;

  return (
    <div className="vob-card">
      <h2 className="vob-title">Step 3: Bank Account Information</h2>

      {formError && <div className="vob-error-banner">{formError}</div>}

      <div className="vob-grid">
        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-account-holder-name">Account Holder Name</label>
          <input
            id="vob-account-holder-name"
            data-field="accountHolderName"
            type="text"
            placeholder="Account Holder Name"
            className={`vob-input ${accountHolderNameError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(accountHolderNameError) || undefined}
            value={draft.accountHolderName}
            onChange={(e) => handleDraftField('accountHolderName', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, accountHolderName: true }))}
          />
          {accountHolderNameError && <span className="vob-error-text" role="alert">{accountHolderNameError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-bank-name">Bank Name</label>
          <input
            id="vob-bank-name"
            data-field="bankName"
            type="text"
            placeholder="Bank Name"
            className={`vob-input ${bankNameError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(bankNameError) || undefined}
            value={draft.bankName}
            onChange={(e) => handleDraftField('bankName', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, bankName: true }))}
          />
          {bankNameError && <span className="vob-error-text" role="alert">{bankNameError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-branch-name">Branch Name</label>
          <input
            id="vob-branch-name"
            data-field="branchName"
            type="text"
            placeholder="Branch Name"
            className={`vob-input ${branchNameError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(branchNameError) || undefined}
            value={draft.branchName}
            onChange={(e) => handleDraftField('branchName', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, branchName: true }))}
          />
          {branchNameError && <span className="vob-error-text" role="alert">{branchNameError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-account-number">Account Number</label>
          <input
            id="vob-account-number"
            data-field="accountNumber"
            type="text"
            placeholder="Account Number"
            className={`vob-input ${accountNumberError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(accountNumberError) || undefined}
            value={draft.accountNumber}
            onChange={(e) => {
              const val = e.target.value;
              if (/^\d*$/.test(val)) {
                handleDraftField('accountNumber', val);
              }
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, accountNumber: true }))}
          />
          {accountNumberError && <span className="vob-error-text" role="alert">{accountNumberError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-ifsc-code">IFSC Code</label>
          <input
            id="vob-ifsc-code"
            data-field="ifscCode"
            type="text"
            placeholder="IFSC Code"
            className={`vob-input ${ifscCodeError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(ifscCodeError) || undefined}
            value={draft.ifscCode}
            onChange={(e) => handleDraftField('ifscCode', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, ifscCode: true }))}
          />
          {ifscCodeError && <span className="vob-error-text" role="alert">{ifscCodeError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-swift-code">SWIFT Code</label>
          <input
            id="vob-swift-code"
            type="text"
            placeholder="SWIFT Code"
            className="vob-input"
            value={draft.swiftCode}
            onChange={(e) => handleDraftField('swiftCode', e.target.value)}
          />
        </div>

        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-iban">IBAN</label>
          <input
            id="vob-iban"
            type="text"
            placeholder="IBAN"
            className="vob-input"
            value={draft.iban}
            onChange={(e) => handleDraftField('iban', e.target.value)}
          />
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-currency-2">Currency</label>
          <select
            id="vob-currency-2"
            className="vob-select"
            value={draft.currency}
            onChange={(e) => handleDraftField('currency', e.target.value)}
          >
            {CURRENCY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div className="vob-action-row">
          <label className="vob-checkbox-wrapper">
            <input
              type="checkbox"
              className="vob-checkbox"
              checked={draft.isPrimary}
              onChange={(e) => handleDraftField('isPrimary', e.target.checked)}
            />
            <span className="vob-checkbox-label">Primary Bank Account</span>
          </label>

          <button
            type="button"
            onClick={handleAddAccount}
            className="vob-btn vob-btn--primary vob-btn--sm"
          >
            + Add Account
          </button>
        </div>
      </div>

      {data.accounts.length === 0 && (
        <div className="vob-empty-state">
          No bank accounts added yet. Please add at least one bank account to proceed.
        </div>
      )}

      {data.accounts.length > 0 && (
        <div className="vob-table-wrapper">
          <table className="vob-table">
            <thead className="vob-thead">
              <tr>
                <th className="vob-th">Bank Name</th>
                <th className="vob-th">Account Holder Name</th>
                <th className="vob-th">Account Number</th>
                <th className="vob-th">Currency</th>
                <th className="vob-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((acc) => (
                <tr key={acc.id}>
                  <td className="vob-td">
                    {acc.bankName}
                    {acc.isPrimary && <span className="vob-badge vob-badge--primary">Primary</span>}
                  </td>
                  <td className="vob-td">{acc.accountHolderName}</td>
                  <td className="vob-td">{acc.accountNumber}</td>
                  <td className="vob-td">{acc.currency}</td>
                  <td className="vob-td">
                    <button
                      type="button"
                      onClick={() => handleRemove(acc.id)}
                      className="vob-btn-icon"
                      aria-label="Remove bank account"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STEP 4 COMPONENT: Step4DispatchLocations
// ============================================================================

interface Step4DispatchLocationsProps {
  data: Step4Data;
  onChange: (data: Step4Data) => void;
  onValidationChange?: (isValid: boolean) => void;
}

interface Step4Draft {
  locationName: string;
  contactPerson: string;
  country: string;
  state: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  pinCode: string;
  contactEmail: string;
  contactPhone: string;
  isDefault: boolean;
}

const emptyStep4Draft: Step4Draft = {
  locationName: '',
  contactPerson: '',
  country: '',
  state: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  pinCode: '',
  contactEmail: '',
  contactPhone: '',
  isDefault: false,
};

const Step4DispatchLocations: React.FC<Step4DispatchLocationsProps> = ({ data, onChange, onValidationChange }) => {
  const [draft, setDraft] = useState<Step4Draft>(emptyStep4Draft);
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const isReadOnly = false;
  const hasDefaultLocation = data.locations.some((loc) => loc.isDefault);

  const countries = Country.getAllCountries();
  const selectedCountryObj = countries.find(c => c.name === draft.country);
  const states = selectedCountryObj ? State.getStatesOfCountry(selectedCountryObj.isoCode) : [];
  const selectedStateObj = states.find(s => s.name === draft.state);
  const cities = (selectedCountryObj && selectedStateObj)
    ? City.getCitiesOfState(selectedCountryObj.isoCode, selectedStateObj.isoCode)
    : [];

  const handleDraftField = <K extends keyof Step4Draft>(field: K, value: Step4Draft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
    setFormError(null);
  };

  const handleAddLocation = () => {
    setFormError(null);
    if (
      !draft.locationName.trim() ||
      !draft.country.trim() ||
      !draft.state.trim() ||
      !draft.addressLine1.trim() ||
      !draft.city.trim() ||
      !draft.pinCode.trim()
    ) {
      setFormError('Location Name, Country, State, Address Line 1, City, and PIN/ZIP Code are required.');
      return;
    }

    const shouldBeDefault = draft.isDefault;

    const newEntry: DispatchLocationEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      locationName: draft.locationName.trim(),
      contactPerson: draft.contactPerson.trim(),
      country: draft.country.trim(),
      state: draft.state.trim(),
      addressLine1: draft.addressLine1.trim(),
      addressLine2: draft.addressLine2.trim(),
      city: draft.city.trim(),
      pinCode: draft.pinCode.trim(),
      contactEmail: draft.contactEmail.trim(),
      contactPhone: draft.contactPhone.trim(),
      isDefault: shouldBeDefault,
    };

    const updatedLocations = shouldBeDefault
      ? data.locations.map((loc) => ({ ...loc, isDefault: false }))
      : data.locations;

    onChange({
      ...data,
      locations: [...updatedLocations, newEntry],
    });
    setDraft(emptyStep4Draft);
    setTouched({});
  };

  const handleRemove = (id: string) => {
    const removedLocation = data.locations.find((loc) => loc.id === id);
    let remainingLocations = data.locations.filter((loc) => loc.id !== id);

    if (removedLocation?.isDefault && remainingLocations.length > 0) {
      remainingLocations = remainingLocations.map((loc, index) =>
        index === 0 ? { ...loc, isDefault: true } : loc
      );
    }

    onChange({
      ...data,
      locations: remainingLocations,
    });
  };

  const handleCheckboxChange = (field: 'certifyTrue' | 'agreeTerms' | 'authorizeVerify', val: boolean) => {
    onChange({
      ...data,
      [field]: val,
    });
  };

  const isValid = data.locations.length > 0 && data.certifyTrue && data.agreeTerms && data.authorizeVerify;

  useEffect(() => {
    onValidationChange?.(isValid);
  }, [isValid, onValidationChange]);

  const locationNameError = touched.locationName && !draft.locationName.trim() ? 'Location Name is required' : null;
  const countryError = touched.country && !draft.country.trim() ? 'Country is required' : null;
  const stateError = touched.state && !draft.state.trim() ? 'State is required' : null;
  const addressLine1Error = touched.addressLine1 && !draft.addressLine1.trim() ? 'Address Line 1 is required' : null;
  const cityError = touched.city && !draft.city.trim() ? 'City is required' : null;
  const pinCodeError = touched.pinCode && !draft.pinCode.trim() ? 'PIN / ZIP Code is required' : null;

  return (
    <div className="vob-card">
      <h2 className="vob-title">Step 4: Dispatch Locations</h2>

      {formError && <div className="vob-error-banner">{formError}</div>}

      <div className="vob-grid">
        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-location-name">Location Name</label>
          <input
            id="vob-location-name"
            data-field="locationName"
            type="text"
            placeholder="Location Name"
            className={`vob-input ${locationNameError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(locationNameError) || undefined}
            value={draft.locationName}
            onChange={(e) => handleDraftField('locationName', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, locationName: true }))}
            disabled={isReadOnly}
          />
          {locationNameError && <span className="vob-error-text" role="alert">{locationNameError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-contact-person">Contact Person</label>
          <input
            id="vob-contact-person"
            type="text"
            placeholder="Contact Person"
            className="vob-input"
            value={draft.contactPerson}
            onChange={(e) => handleDraftField('contactPerson', e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-country">Country</label>
          <select
            id="vob-country"
            data-field="country"
            className={`vob-select ${countryError ? 'vob-select--error' : ''}`}
            aria-invalid={Boolean(countryError) || undefined}
            value={draft.country}
            onChange={(e) => {
              handleDraftField('country', e.target.value);
              handleDraftField('state', '');
              handleDraftField('city', '');
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, country: true }))}
            disabled={isReadOnly}
          >
            <option value="">Select Country</option>
            {countries.map((c) => (
              <option key={c.isoCode} value={c.name}>{c.name}</option>
            ))}
            {isReadOnly && !selectedCountryObj && draft.country && (
              <option value={draft.country}>{draft.country}</option>
            )}
          </select>
          {countryError && <span className="vob-error-text" role="alert">{countryError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-state">State</label>
          <select
            id="vob-state"
            data-field="state"
            className={`vob-select ${stateError ? 'vob-select--error' : ''}`}
            aria-invalid={Boolean(stateError) || undefined}
            value={draft.state}
            onChange={(e) => {
              handleDraftField('state', e.target.value);
              handleDraftField('city', '');
            }}
            onBlur={() => setTouched((prev) => ({ ...prev, state: true }))}
            disabled={isReadOnly || !draft.country}
          >
            <option value="">Select State</option>
            {states.map((s) => (
              <option key={s.isoCode} value={s.name}>{s.name}</option>
            ))}
            {isReadOnly && !selectedStateObj && draft.state && (
              <option value={draft.state}>{draft.state}</option>
            )}
          </select>
          {stateError && <span className="vob-error-text" role="alert">{stateError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-address-line-1">Address Line 1</label>
          <input
            id="vob-address-line-1"
            data-field="addressLine1"
            type="text"
            placeholder="Address Line 1"
            className={`vob-input ${addressLine1Error ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(addressLine1Error) || undefined}
            value={draft.addressLine1}
            onChange={(e) => handleDraftField('addressLine1', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, addressLine1: true }))}
            disabled={isReadOnly}
          />
          {addressLine1Error && <span className="vob-error-text" role="alert">{addressLine1Error}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-address-line-2">Address Line 2</label>
          <input
            id="vob-address-line-2"
            type="text"
            placeholder="Address Line 2"
            className="vob-input"
            value={draft.addressLine2}
            onChange={(e) => handleDraftField('addressLine2', e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-city">City</label>
          <select
            id="vob-city"
            data-field="city"
            className={`vob-select ${cityError ? 'vob-select--error' : ''}`}
            aria-invalid={Boolean(cityError) || undefined}
            value={draft.city}
            onChange={(e) => handleDraftField('city', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
            disabled={isReadOnly || !draft.state}
          >
            <option value="">Select City</option>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
            {isReadOnly && !cities.find(c => c.name === draft.city) && draft.city && (
              <option value={draft.city}>{draft.city}</option>
            )}
          </select>
          {cityError && <span className="vob-error-text" role="alert">{cityError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label vob-label--required" htmlFor="vob-pin-zip-code">PIN / ZIP Code</label>
          <input
            id="vob-pin-zip-code"
            data-field="pinCode"
            type="text"
            placeholder="PIN / ZIP Code"
            className={`vob-input ${pinCodeError ? 'vob-input--error' : ''}`}
            aria-invalid={Boolean(pinCodeError) || undefined}
            value={draft.pinCode}
            onChange={(e) => handleDraftField('pinCode', e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, pinCode: true }))}
            disabled={isReadOnly}
          />
          {pinCodeError && <span className="vob-error-text" role="alert">{pinCodeError}</span>}
        </div>

        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-contact-email-id">Contact Email ID</label>
          <input
            id="vob-contact-email-id"
            type="email"
            placeholder="Contact Email ID"
            className="vob-input"
            value={draft.contactEmail}
            onChange={(e) => handleDraftField('contactEmail', e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div className="vob-field">
          <label className="vob-label" htmlFor="vob-contact-phone-number">Contact Phone Number</label>
          <input
            id="vob-contact-phone-number"
            type="tel"
            placeholder="Contact Phone Number"
            className="vob-input"
            value={draft.contactPhone}
            onChange={(e) => handleDraftField('contactPhone', e.target.value)}
            disabled={isReadOnly}
          />
        </div>

        <div className="vob-action-row">
          {!hasDefaultLocation ? (
            <label className="vob-checkbox-wrapper">
              <input
                type="checkbox"
                className="vob-checkbox"
                checked={draft.isDefault}
                onChange={(e) => handleDraftField('isDefault', e.target.checked)}
              />
              <span className="vob-checkbox-label">Default Dispatch Location</span>
            </label>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleAddLocation}
            className="vob-btn vob-btn--primary vob-btn--sm"
          >
            + Add Location
          </button>
        </div>
      </div>

      {data.locations.length === 0 && (
        <div className="vob-empty-state">
          No dispatch locations added yet. Please add at least one dispatch location to proceed.
        </div>
      )}

      {data.locations.length > 0 && (
        <div className="vob-table-wrapper">
          <table className="vob-table">
            <thead className="vob-thead">
              <tr>
                <th className="vob-th">Location Name</th>
                <th className="vob-th">City</th>
                <th className="vob-th">Contact Person</th>
                <th className="vob-th">State</th>
                <th className="vob-th">Phone Number</th>
                <th className="vob-th">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.locations.map((loc) => (
                <tr key={loc.id}>
                  <td className="vob-td">
                    {loc.locationName}
                    {loc.isDefault && <span className="vob-badge vob-badge--success">Default</span>}
                  </td>
                  <td className="vob-td">{loc.city}</td>
                  <td className="vob-td">{loc.contactPerson || '—'}</td>
                  <td className="vob-td">{loc.state}</td>
                  <td className="vob-td">{loc.contactPhone || '—'}</td>
                  <td className="vob-td">
                    <button
                      type="button"
                      onClick={() => handleRemove(loc.id)}
                      className="vob-btn-icon"
                      aria-label="Remove location"
                    >
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="vob-declarations">
        <label className="vob-declaration-row">
          <input
            type="checkbox"
            className="vob-declaration-checkbox"
            checked={data.certifyTrue}
            onChange={(e) => handleCheckboxChange('certifyTrue', e.target.checked)}
          />
          <span className="vob-declaration-text">I certify that the information provided is true and accurate.</span>
        </label>

        <label className="vob-declaration-row">
          <input
            type="checkbox"
            className="vob-declaration-checkbox"
            checked={data.agreeTerms}
            onChange={(e) => handleCheckboxChange('agreeTerms', e.target.checked)}
          />
          <span className="vob-declaration-text">
            I agree to the{' '}
            <a href="#terms" onClick={(e) => e.preventDefault()} className="vob-link">
              Terms & Conditions
            </a>
            .
          </span>
        </label>

        <label className="vob-declaration-row">
          <input
            type="checkbox"
            className="vob-declaration-checkbox"
            checked={data.authorizeVerify}
            onChange={(e) => handleCheckboxChange('authorizeVerify', e.target.checked)}
          />
          <span className="vob-declaration-text">I authorize CAS to verify the submitted documents.</span>
        </label>
      </div>
    </div>
  );
};

// ============================================================================
// STEP 2 COMPONENT: Step2Categories (Product & Service Categories)
// ============================================================================

export interface SelectedProduct {
  segment: number;
  family: number;
  title: string;
}

export interface SelectedSubProduct {
  class: number;
  commodity: number;
  title: string;
  parentSegment?: number;
  parentFamily?: number;
  parentTitle?: string;
}

interface Step2CategoriesProps {
  selectedProducts: SelectedProduct[];
  setSelectedProducts: React.Dispatch<React.SetStateAction<SelectedProduct[]>>;
  selectedSubProducts: SelectedSubProduct[];
  setSelectedSubProducts: React.Dispatch<React.SetStateAction<SelectedSubProduct[]>>;
  onValidationChange?: (isValid: boolean) => void;
}

function ProductDropdown({
  segments,
  onSelect,
  loading,
}: {
  segments: any[];
  onSelect: (family: SelectedProduct) => void;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleExpand = (segmentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSegments((prev) =>
      prev.includes(segmentId) ? prev.filter((id) => id !== segmentId) : [...prev, segmentId]
    );
  };

  return (
    <div ref={containerRef} className="custom-dropdown-container">
      <div
        className="custom-dropdown-trigger"
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <span>Select product</span>
        <FaChevronDown aria-hidden="true" className="vob-dropdown-caret" />
      </div>

      {isOpen && (
        <div className="custom-dropdown-menu" role="listbox">
          {loading ? (
            <div className="custom-dropdown-item-loading">Loading products...</div>
          ) : segments.length === 0 ? (
            <div className="custom-dropdown-item-empty">No products found.</div>
          ) : (
            segments.map((seg) => {
              const isExpanded = expandedSegments.includes(seg.segment);
              return (
                <div key={seg.segment} className="custom-dropdown-item-wrapper">
                  <div className="segment-row" onClick={(e) => toggleExpand(seg.segment, e)}>
                    <span>{seg.title}</span>
                    <button type="button" aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${seg.title}`} onClick={(e) => toggleExpand(seg.segment, e)}>
                      {isExpanded ? '−' : '+'}
                    </button>
                  </div>
                  {isExpanded && seg.family && (
                    <div className="nested-items-container">
                      {seg.family.map((fam: any) => (
                        <div
                          key={fam.family}
                          className="nested-item-row"
                          role="option"
                          aria-selected={false}
                          tabIndex={0}
                          onClick={() => {
                            onSelect({ segment: seg.segment, family: fam.family, title: fam.title });
                            setIsOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelect({ segment: seg.segment, family: fam.family, title: fam.title });
                              setIsOpen(false);
                            }
                          }}
                        >
                          {fam.title} ({fam.family})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SubProductDropdown({
  classes,
  onSelect,
  disabled,
  loading,
}: {
  classes: any[];
  onSelect: (commodity: SelectedSubProduct) => void;
  disabled: boolean;
  loading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedClasses, setExpandedClasses] = useState<number[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleExpand = (classId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedClasses((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  return (
    <div ref={containerRef} className="custom-dropdown-container">
      <div
        className={`custom-dropdown-trigger ${disabled ? 'custom-dropdown-trigger-disabled' : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-haspopup="listbox"
        aria-expanded={!disabled && isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        <span>{disabled ? 'Please select a product first' : 'Select sub-product'}</span>
        <FaChevronDown aria-hidden="true" className="vob-dropdown-caret" />
      </div>

      {!disabled && isOpen && (
        <div className="custom-dropdown-menu" role="listbox">
          {loading ? (
            <div className="custom-dropdown-item-loading">Loading sub-products...</div>
          ) : classes.length === 0 ? (
            <div className="custom-dropdown-item-empty">No sub-products found.</div>
          ) : (
            classes.map((cls) => {
              const isExpanded = expandedClasses.includes(cls.class);
              return (
                <div key={cls.class} className="custom-dropdown-item-wrapper">
                  <div className="class-row" onClick={(e) => toggleExpand(cls.class, e)}>
                    <span>{cls.title}</span>
                    <button type="button" aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${cls.title}`} onClick={(e) => toggleExpand(cls.class, e)}>
                      {isExpanded ? '−' : '+'}
                    </button>
                  </div>
                  {isExpanded && cls.commodity && (
                    <div className="nested-items-container">
                      {cls.commodity.map((com: any) => (
                        <div
                          key={com.commodity}
                          className="nested-item-row"
                          role="option"
                          aria-selected={false}
                          tabIndex={0}
                          onClick={() => {
                            onSelect({ class: cls.class, commodity: com.commodity, title: com.title });
                            setIsOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelect({ class: cls.class, commodity: com.commodity, title: com.title });
                              setIsOpen(false);
                            }
                          }}
                        >
                          {com.title} ({com.commodity})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const Step2Categories: React.FC<Step2CategoriesProps> = ({
  selectedProducts,
  setSelectedProducts,
  selectedSubProducts,
  setSelectedSubProducts,
  onValidationChange,
}) => {
  const [activeProduct, setActiveProduct] = useState<SelectedProduct | null>(null);
  const [segments, setSegments] = useState<any[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  useEffect(() => {
    const loadSegments = async () => {
      setLoadingSegments(true);
      try {
        const data = await fetchSegments();
        if (Array.isArray(data)) {
          setSegments(data);
        }
      } catch (err) {
      } finally {
        setLoadingSegments(false);
      }
    };
    loadSegments();
  }, []);

  useEffect(() => {
    if (!activeProduct) {
      setClasses([]);
      return;
    }
    const loadClasses = async () => {
      setLoadingClasses(true);
      try {
        const data = await fetchClasses(activeProduct.segment, activeProduct.family);
        if (Array.isArray(data)) {
          setClasses(data);
        }
      } catch (err) {
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, [activeProduct]);

  useEffect(() => {
    const isValid = selectedProducts.length > 0 && selectedSubProducts.length > 0;
    onValidationChange?.(isValid);
  }, [selectedProducts, selectedSubProducts, onValidationChange]);

  const handleSelectProduct = (product: SelectedProduct) => {
    if (!selectedProducts.some((p) => p.family === product.family)) {
      setSelectedProducts((prev) => [...prev, product]);
    }
    setActiveProduct(product);
  };

  const handleRemoveProduct = (familyCode: number) => {
    setSelectedProducts((prev) => {
      const remaining = prev.filter((p) => p.family !== familyCode);
      if (activeProduct?.family === familyCode) {
        if (remaining.length > 0) {
          setActiveProduct(remaining[remaining.length - 1]);
        } else {
          setActiveProduct(null);
        }
      }
      return remaining;
    });
    setSelectedSubProducts((prev) => prev.filter((p) => p.parentFamily !== familyCode));
  };

  const handleSelectSubProduct = (subProduct: SelectedSubProduct) => {
    if (!selectedSubProducts.some((p) => p.commodity === subProduct.commodity)) {
      setSelectedSubProducts((prev) => [
        ...prev,
        {
          ...subProduct,
          parentSegment: activeProduct?.segment || 0,
          parentFamily: activeProduct?.family || 0,
          parentTitle: activeProduct?.title || '',
        },
      ]);
    }
  };

  const handleRemoveSubProduct = (commodityCode: number) => {
    setSelectedSubProducts((prev) => prev.filter((p) => p.commodity !== commodityCode));
  };

  return (
    <div className="vob-card">
      <h2 className="vob-title">Step 2: Product &amp; Service Categories</h2>

      <div className="vob-category-section">
        <div className="vob-field">
          <span className="vob-label">
            Select Product (Segment &amp; Family)<span className="vob-required" aria-hidden="true">*</span>
          </span>
          <ProductDropdown
            segments={segments}
            onSelect={handleSelectProduct}
            loading={loadingSegments}
          />
        </div>

        <div className="vob-category-section-subtitle vob-category-section-subtitle--spaced">
          Selected Products ({selectedProducts.length}) - <em>Click a tag to select it for sub-products</em>
        </div>

        <div className="vob-category-tags vob-category-tags--products">
          {selectedProducts.length === 0 ? (
            <span className="custom-dropdown-item-empty">No products selected yet.</span>
          ) : (
            selectedProducts.map((p) => {
              const isActive = activeProduct?.family === p.family;
              return (
                <span
                  key={p.family}
                  className={`vob-category-tag ${isActive ? 'vob-category-tag-active' : ''}`}
                  onClick={() => setActiveProduct(p)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      setActiveProduct(p);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                >
                  {p.title} ({p.family})
                  <button
                    type="button"
                    aria-label={`Remove ${p.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveProduct(p.family);
                    }}
                  >
                    &times;
                  </button>
                </span>
              );
            })
          )}
        </div>

        <div className="vob-selector-divider" />

        <div className="vob-field">
          <span className="vob-label">
            Select Sub-Product (Class &amp; Commodity)
            {activeProduct && <span className="vob-active-product"> - for {activeProduct.title}</span>}
            <span className="vob-required" aria-hidden="true">*</span>
          </span>
          <SubProductDropdown
            classes={classes}
            onSelect={handleSelectSubProduct}
            disabled={!activeProduct}
            loading={loadingClasses}
          />
        </div>

        <div className="vob-category-section-subtitle vob-category-section-subtitle--spaced">
          Selected Sub-Products ({selectedSubProducts.length})
        </div>

        <div className="vob-category-tags vob-category-tags--subproducts">
          {selectedSubProducts.length === 0 ? (
            <span className="custom-dropdown-item-empty">No sub-products selected yet.</span>
          ) : (
            selectedSubProducts.map((p) => (
              <span key={p.commodity} className="vob-category-tag vob-category-tag-active-sub">
                {p.title} ({p.commodity})
                <button type="button" aria-label={`Remove ${p.title}`} onClick={() => handleRemoveSubProduct(p.commodity)}>
                  &times;
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUPPLIER ONBOARDING FORM (MAIN WIZARD ORCHESTRATOR)
// ============================================================================

interface SupplierOnboardingFormProps {
  onComplete: (data: {
    step1: Step1Data;
    selectedProducts: SelectedProduct[];
    selectedSubProducts: SelectedSubProduct[];
    step2: Step2Data;
    step3: Step3Data;
    step4: Step4Data;
  }) => Promise<void> | void;
}

const sila_logo = `${window.location.protocol}//${window.location.host}/assets/SILA_Logo.png`;

const SupplierOnboardingForm: React.FC<SupplierOnboardingFormProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [step1, setStep1] = useState<Step1Data>(initialStep1Data);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [selectedSubProducts, setSelectedSubProducts] = useState<SelectedSubProduct[]>([]);
  const [step2, setStep2] = useState<Step2Data>(initialStep2Data);
  const [step3, setStep3] = useState<Step3Data>(initialStep3Data);
  const [step4, setStep4] = useState<Step4Data>(initialStep4Data);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step1Valid, setStep1Valid] = useState(false);
  const [step2CategoriesValid, setStep2CategoriesValid] = useState(false);
  const [step2Valid, setStep2Valid] = useState(false);
  const [step3Valid, setStep3Valid] = useState(false);
  const [step4Valid, setStep4Valid] = useState(false);

  const [showValidationError, setShowValidationError] = useState(false);
  const [onboardingData, setOnboardingData] = useState<any>(null);

  // Metadata reference lists (fetched from backend, replaces hardcoded dropdowns)
  const [industryOptions, setIndustryOptions] = useState<MetadataReferenceItem[]>([]);
  const [businessTypeOptions, setBusinessTypeOptions] = useState<MetadataReferenceItem[]>([]);
  const [documentTypeOptions, setDocumentTypeOptions] = useState<MetadataReferenceItem[]>([]);

  useEffect(() => {
    const loadOnboardingData = async () => {
      try {
        const data = await fetchOnboardingDetails();
        setOnboardingData(data);
      } catch (err) {
      }
    };
    loadOnboardingData();
  }, []);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const items = await fetchMetadataReferenceList(['INDUSTRY', 'BUSINESS_TYPE', 'DOCUMENT_TYPE']);
        if (Array.isArray(items)) {
          setIndustryOptions(items.filter((i) => i.type === 'INDUSTRY'));
          setBusinessTypeOptions(items.filter((i) => i.type === 'BUSINESS_TYPE'));
          setDocumentTypeOptions(items.filter((i) => i.type === 'DOCUMENT_TYPE'));
        }
      } catch (err) {
      }
    };
    loadMetadata();
  }, []);

  const handleNext = async () => {
    setError(null);
    setShowValidationError(false);

    if (currentStep === 1 && !step1Valid) {
      setShowValidationError(true);
      return;
    }

    if (currentStep === 2 && !step2CategoriesValid) {
      setShowValidationError(true);
      return;
    }

    if (currentStep === 3 && !step2Valid) {
      setShowValidationError(true);
      return;
    }

    if (currentStep === 4 && !step3Valid) {
      setShowValidationError(true);
      return;
    }

    if (currentStep === 5 && !step4Valid) {
      setShowValidationError(true);
      return;
    }

    if (currentStep < 5) {
      setCurrentStep((s) => s + 1);
      setShowValidationError(false);
      return;
    }

    setSubmitting(true);
    try {
      await onComplete({
        step1,
        selectedProducts,
        selectedSubProducts,
        step2,
        step3,
        step4,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setError(null);
    setShowValidationError(false);
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  const isNextDisabled = submitting;

  const getTooltip = () => {
    if (submitting) return '';
    if (currentStep === 1 && !step1Valid) return 'Please fill in all required fields (Industry and Business Type) first';
    if (currentStep === 2 && !step2CategoriesValid) return 'Please select at least one product and one sub-product to proceed';
    if (currentStep === 3 && !step2Valid) return 'Please add at least one registration to proceed';
    if (currentStep === 4 && !step3Valid) return 'Please add at least one bank account to proceed';
    if (currentStep === 5 && !step4Valid) return 'Please add at least one location and certify all statements to proceed';
    return '';
  };

  return (
    <div className="vob-page">
      <header className="vob-header">
        <img src={sila_logo} alt="SILA" className="vob-logo" />
      </header>

      <main className="vob-main">
        <aside className="vob-sidebar" aria-label="Onboarding progress">
          <ol className="vob-step-list">
            {STEPS.map((step, index) => {
              const isCompleted = step.id < currentStep;
              const isActive = step.id === currentStep;

              return (
                <li
                  key={step.id}
                  className={`vob-step-item${index < STEPS.length - 1 ? ' vob-step-item--connected' : ''}${isCompleted ? ' vob-step-item--done' : ''}`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className={`vob-step-number ${isCompleted
                      ? 'vob-step-number--completed'
                      : isActive
                        ? 'vob-step-number--active'
                        : 'vob-step-number--pending'
                      }`}
                  >
                    {isCompleted ? <CheckIcon /> : step.id}
                  </span>
                  <span
                    className={`vob-step-label ${isCompleted
                      ? 'vob-step-label--completed'
                      : isActive
                        ? 'vob-step-label--active'
                        : 'vob-step-label--pending'
                      }`}
                  >
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="vob-content">
          {error && <div className="vob-error-banner">{error}</div>}

          {showValidationError && (
            <div className="vob-validation-banner">
              {currentStep === 1 && 'Please fill in all required fields (Industry and Business Type) before proceeding.'}
              {currentStep === 2 && 'Please select at least one product and sub-product before proceeding.'}
              {currentStep === 3 && 'Please add at least one registration before proceeding.'}
              {currentStep === 4 && 'Please add at least one bank account before proceeding.'}
              {currentStep === 5 && 'Please add at least one location and certify all statements before proceeding.'}
            </div>
          )}

          {currentStep === 1 && (
            <Step1BusinessInfo
              data={step1}
              onChange={setStep1}
              onValidationChange={setStep1Valid}
              onboardingData={onboardingData}
              industryOptions={industryOptions}
              businessTypeOptions={businessTypeOptions}
            />
          )}
          {currentStep === 2 && (
            <Step2Categories
              selectedProducts={selectedProducts}
              setSelectedProducts={setSelectedProducts}
              selectedSubProducts={selectedSubProducts}
              setSelectedSubProducts={setSelectedSubProducts}
              onValidationChange={setStep2CategoriesValid}
            />
          )}
          {currentStep === 3 && (
            <Step2Registrations
              data={step2}
              onChange={setStep2}
              onValidationChange={setStep2Valid}
              registrationTypeOptions={documentTypeOptions}
            />
          )}
          {currentStep === 4 && (
            <Step3BankInfo
              data={step3}
              onChange={setStep3}
              onValidationChange={setStep3Valid}
            />
          )}
          {currentStep === 5 && (
            <Step4DispatchLocations
              data={step4}
              onChange={setStep4}
              onValidationChange={setStep4Valid}
            />
          )}

          <div className="vob-nav-row">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 1 || submitting}
              className="vob-btn vob-btn--secondary"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={isNextDisabled}
              title={getTooltip()}
              className="vob-btn vob-btn--primary"
            >
              {submitting ? 'Saving...' : currentStep === 5 ? 'Submit Profile' : 'Next'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SupplierOnboardingForm;