import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FaEye, FaEyeSlash, FaChevronDown, FaSearch, FaTimes } from 'react-icons/fa';
import type { User, UserRole } from '../../types';
import { ROLE_ID_MAPPING } from '../../constants/roleMapping';
import { getCountries } from '../../api/networkAdminApi';
import type { CountryDto } from '../../dto/networkAdminDto';
import { toastService } from '@vosox/shared-ui';
import './CreateUserModal.css';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (user: User) => Promise<void> | void;
  createRole: UserRole;
  isLoading?: boolean;
}

interface FormErrors {
  [key: string]: string;
}

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
  createRole,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: '',
    addressLine: '',
    userName: '',
    password: '',
    confirmPassword: '',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
  const [isLoadingCountries, setIsLoadingCountries] = useState(false);
  const [hasMoreCountries, setHasMoreCountries] = useState(false);
  const [countryIndex, setCountryIndex] = useState(0);
  const [selectedCountryLabel, setSelectedCountryLabel] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const countryListRef = useRef<HTMLDivElement>(null);

  const requestIdRef = useRef(0);

  const fetchCountries = useCallback(
    async (index: number, searchTerm: string, append: boolean) => {
      const requestId = ++requestIdRef.current;
      setIsLoadingCountries(true);
      try {
        const response = await getCountries(index, PAGE_SIZE, searchTerm);
        if (requestId !== requestIdRef.current) return;

        const newItems = response.items || [];
        setCountries((prev) => (append ? [...prev, ...newItems] : newItems));
        setCountryIndex(index + PAGE_SIZE);

        const reportedTotal = response.totalCount ?? 0;
        const moreByPageFill = newItems.length === PAGE_SIZE;
        setHasMoreCountries(reportedTotal > index + PAGE_SIZE || moreByPageFill);
      } catch {
        if (!append) setCountries([]);
        toastService.error('Unable to load countries. Please try again.');
      } finally {
        if (requestId === requestIdRef.current) setIsLoadingCountries(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isCountryDropdownOpen) return;
    fetchCountries(0, '', false);
  }, [isCountryDropdownOpen, fetchCountries]);

  useEffect(() => {
    if (!isCountryDropdownOpen) return;

    const handle = setTimeout(() => {
      fetchCountries(0, countrySearchQuery, false);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [countrySearchQuery]);

  const handleCountryScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100;

    if (isAtBottom && hasMoreCountries && !isLoadingCountries) {
      fetchCountries(countryIndex, countrySearchQuery, true);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };

    if (isCountryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCountryDropdownOpen]);

  useEffect(() => {
    if (isCountryDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isCountryDropdownOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleCountrySelect = (country: CountryDto) => {
    setFormData((prev) => ({
      ...prev,
      country: country.countryName,
    }));
    setSelectedCountryLabel(country.countryName);
    setIsCountryDropdownOpen(false);
    setCountrySearchQuery('');
    if (formErrors.country) {
      setFormErrors((prev) => ({
        ...prev,
        country: '',
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    if (!formData.name.trim()) {
      errors.name = 'Full name is required';
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!formData.email.includes('@')) {
      errors.email = 'Please enter a valid email';
    }

    if (!formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    }

    if (!formData.country) {
      errors.country = 'Please select a country';
    }

    if (!formData.addressLine.trim()) {
      errors.addressLine = 'Address is required';
    }

    if (!formData.userName.trim()) {
      errors.userName = 'Username is required';
    } else if (formData.userName.length < 3) {
      errors.userName = 'Username must be at least 3 characters';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toastService.error('Please fix the errors in the form');
      return;
    }

    const roleToCreate = createRole;
    const roleIdToUse = ROLE_ID_MAPPING[createRole];

    const newUser: User = {
      id: `temp-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      userRole: roleToCreate,
      createdAt: new Date().toISOString().split('T')[0],
      status: 'active',
      phone: formData.phone,
      country: formData.country,
      addressLine: formData.addressLine,
      userName: formData.userName,
      password: formData.password,
      roleId: roleIdToUse,
    };

    try {
      await onCreate(newUser);

      setFormData({
        name: '',
        email: '',
        phone: '',
        country: '',
        addressLine: '',
        userName: '',
        password: '',
        confirmPassword: '',
      });
      setSelectedCountryLabel('');
      setFormErrors({});
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch {
      // Backend API errors are displayed via toast notification on screen.
      // Do not display backend errors on the inline <span> element.
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        name: '',
        email: '',
        phone: '',
        country: '',
        addressLine: '',
        userName: '',
        password: '',
        confirmPassword: '',
      });
      setSelectedCountryLabel('');
      setFormErrors({});
      setIsCountryDropdownOpen(false);
      setCountrySearchQuery('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="nad-modal-overlay" onClick={handleClose}>
      <div
        className="nad-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nad-create-user-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nad-modal-header">
          <h2 id="nad-create-user-title" className="nad-modal-title">Create New User</h2>
          <button
            type="button"
            className="nad-modal-close"
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Close"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="nad-modal-form">
          <div className="nad-modal-body">
            <div className="nad-form-row">
              <div className="nad-form-group">
                <label htmlFor="name" className="nad-label">
                  Full Name <span className="nad-required sila-required" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  disabled={isLoading}
                  aria-invalid={formErrors.name ? true : undefined}
                  aria-describedby={formErrors.name ? 'name-error' : undefined}
                  className={`nad-input ${formErrors.name ? 'error' : ''}`}
                />
                {formErrors.name && <span id="name-error" className="nad-error-text sila-error-text">{formErrors.name}</span>}
              </div>

              <div className="nad-form-group">
                <label htmlFor="email" className="nad-label">
                  Email Address <span className="nad-required sila-required" aria-hidden="true">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  disabled={isLoading}
                  aria-invalid={formErrors.email ? true : undefined}
                  aria-describedby={formErrors.email ? 'email-error' : undefined}
                  className={`nad-input ${formErrors.email ? 'error' : ''}`}
                />
                {formErrors.email && <span id="email-error" className="nad-error-text sila-error-text">{formErrors.email}</span>}
              </div>
            </div>

            <div className="nad-form-row">
              <div className="nad-form-group">
                <label htmlFor="phone" className="nad-label">
                  Phone Number <span className="nad-required sila-required" aria-hidden="true">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 000-0000"
                  disabled={isLoading}
                  aria-invalid={formErrors.phone ? true : undefined}
                  aria-describedby={formErrors.phone ? 'phone-error' : undefined}
                  className={`nad-input ${formErrors.phone ? 'error' : ''}`}
                />
                {formErrors.phone && <span id="phone-error" className="nad-error-text sila-error-text">{formErrors.phone}</span>}
              </div>

              <div className="nad-form-group">
                <label htmlFor="country" className="nad-label">
                  Country <span className="nad-required sila-required" aria-hidden="true">*</span>
                </label>
                <div className="nad-country-select" ref={dropdownRef}>
                  <button
                    type="button"
                    id="country"
                    className={`nad-select-trigger ${formErrors.country ? 'error' : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={isCountryDropdownOpen}
                    aria-invalid={formErrors.country ? true : undefined}
                    aria-describedby={formErrors.country ? 'country-error' : undefined}
                    onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                    disabled={isLoading}
                  >
                    <span className="nad-select-value">
                      {selectedCountryLabel || 'Select a country'}
                    </span>
                    <FaChevronDown
                      className={`nad-select-icon ${isCountryDropdownOpen ? 'open' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {isCountryDropdownOpen && (
                    <div className="nad-dropdown">
                      <div className="nad-search-countries-wrapper">
                        <FaSearch className="nad-search-icon" aria-hidden="true" />
                        <input
                          ref={searchInputRef}
                          type="text"
                          placeholder="Search countries..."
                          value={countrySearchQuery}
                          onChange={(e) => setCountrySearchQuery(e.target.value)}
                          className="nad-search-field"
                          aria-label="Search countries"
                        />
                      </div>

                      <div
                        className="nad-options-list"
                        ref={countryListRef}
                        onScroll={handleCountryScroll}
                      >
                        {countries.length === 0 && !isLoadingCountries ? (
                          <div className="nad-no-results">
                            {countrySearchQuery ? 'No countries found' : 'No countries available'}
                          </div>
                        ) : (
                          countries.map((country) => (
                            <button
                              key={country.id}
                              type="button"
                              className={`nad-option ${
                                formData.country === country.countryName ? 'selected' : ''
                              }`}
                              onClick={() => handleCountrySelect(country)}
                            >
                              <span>{country.countryName}</span>
                              <span className="nad-country-code">{country.countryCode}</span>
                            </button>
                          ))
                        )}

                        {isLoadingCountries && (
                          <div className="nad-loading" role="status">
                            <span className="nad-spinner sila-spinner" aria-hidden="true"></span>
                            <span className="sila-visually-hidden">Loading countries</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {formErrors.country && <span id="country-error" className="nad-error-text sila-error-text">{formErrors.country}</span>}
              </div>
            </div>

            <div className="nad-form-group">
              <label htmlFor="addressLine" className="nad-label">
                Address <span className="nad-required sila-required" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                id="addressLine"
                name="addressLine"
                value={formData.addressLine}
                onChange={handleChange}
                placeholder="123 Main Street, Apt 4B"
                disabled={isLoading}
                aria-invalid={formErrors.addressLine ? true : undefined}
                  aria-describedby={formErrors.addressLine ? 'addressLine-error' : undefined}
                  className={`nad-input ${formErrors.addressLine ? 'error' : ''}`}
              />
              {formErrors.addressLine && (
                <span id="addressLine-error" className="nad-error-text sila-error-text">{formErrors.addressLine}</span>
              )}
            </div>

            <div className="nad-form-row">
              <div className="nad-form-group">
                <label htmlFor="userName" className="nad-label">
                  Username <span className="nad-required sila-required" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  id="userName"
                  name="userName"
                  value={formData.userName}
                  onChange={handleChange}
                  placeholder="johndoe123"
                  disabled={isLoading}
                  aria-invalid={formErrors.userName ? true : undefined}
                  aria-describedby={formErrors.userName ? 'userName-error' : undefined}
                  className={`nad-input ${formErrors.userName ? 'error' : ''}`}
                />
                {formErrors.userName && (
                  <span id="userName-error" className="nad-error-text sila-error-text">{formErrors.userName}</span>
                )}
              </div>
            </div>

            <div className="nad-form-row">
              <div className="nad-form-group">
                <label htmlFor="password" className="nad-label">
                  Password <span className="nad-required sila-required" aria-hidden="true">*</span>
                </label>
                <div className="nad-password-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min. 6 characters"
                    disabled={isLoading}
                    autoComplete="new-password"
                    data-lpignore="true"
                    aria-invalid={formErrors.password ? true : undefined}
                  aria-describedby={formErrors.password ? 'password-error' : undefined}
                  className={`nad-input ${formErrors.password ? 'error' : ''}`}
                  />
                  <button
                    type="button"
                    className="nad-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                  </button>
                </div>
                {formErrors.password && (
                  <span id="password-error" className="nad-error-text sila-error-text">{formErrors.password}</span>
                )}
              </div>

              <div className="nad-form-group">
                <label htmlFor="confirmPassword" className="nad-label">
                  Confirm Password <span className="nad-required sila-required" aria-hidden="true">*</span>
                </label>
                <div className="nad-password-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    disabled={isLoading}
                    autoComplete="new-password"
                    data-lpignore="true"
                    aria-invalid={formErrors.confirmPassword ? true : undefined}
                  aria-describedby={formErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                  className={`nad-input ${formErrors.confirmPassword ? 'error' : ''}`}
                  />
                  <button
                    type="button"
                    className="nad-toggle-password"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                  </button>
                </div>
                {formErrors.confirmPassword && (
                  <span id="confirmPassword-error" className="nad-error-text sila-error-text">{formErrors.confirmPassword}</span>
                )}
              </div>
            </div>

          </div>

          <div className="nad-modal-footer">
            <button
              type="button"
              className="nad-btn-cancel sila-btn sila-btn--secondary"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="nad-btn-submit sila-btn sila-btn--primary"
              disabled={isLoading}
            >
              {isLoading && <span className="sila-spinner" aria-hidden="true" />}
              {isLoading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;