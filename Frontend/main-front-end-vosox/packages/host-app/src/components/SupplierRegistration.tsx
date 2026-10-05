import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@vosox/shared-ui';
import Header from './Header';
import './SupplierRegistration.css';
import { CiMail } from "react-icons/ci";
import { FaEye, FaEyeSlash, FaExclamationCircle } from "react-icons/fa";
import { sendOtp, verifyOtp } from '../api/authApi';
import { useNavigate } from 'react-router-dom';
import { createOrganization } from '../api/organizationApi';
import { Country, State } from 'country-state-city';

const CheckIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12.5l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const IconBack = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

const OTP_LENGTH = 6;
const OTP_DURATION = 600; // seconds

interface SupplierRegistrationProps {
    businessEmail?: string;
}

// Fields we validate in step 3
type FieldErrors = Partial<Record<
    | 'companyName' | 'phone' | 'country' | 'addressLine1' | 'city' | 'stateVal' | 'zip'
    | 'name' | 'adminEmail' | 'pw' | 'pw2',
    string
>>;

const SupplierRegistration: React.FC<SupplierRegistrationProps> = ({
    businessEmail: initialEmail,
}) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [email, setEmail] = useState(initialEmail ?? '');

    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [secondsLeft, setSecondsLeft] = useState(OTP_DURATION);
    const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [otpError, setOtpError] = useState('');
    const [isResendingOtp, setIsResendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

    const [companyName, setCompanyName] = useState('');
    const [country, setCountry] = useState('');
    const [addressLine1, setAddressLine1] = useState('');
    const [addressLine2, setAddressLine2] = useState('');
    const [city, setCity] = useState('');
    const [stateVal, setStateVal] = useState('');
    const [zip, setZip] = useState('');
    const [phone, setPhone] = useState('');
    const [name, setName] = useState('');
    const [adminEmail, setAdminEmail] = useState('');
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [createError, setCreateError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (step !== 2) return;
        if (secondsLeft <= 0) return;
        const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
        return () => clearInterval(t);
    }, [step, secondsLeft]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    const handleOtpChange = (index: number, value: string) => {
        if (value && !/^[0-9]$/.test(value)) return;
        const next = [...otp];
        next[index] = value;
        setOtp(next);
        if (value && index < OTP_LENGTH - 1) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleSendOtp = async () => {
        if (!email || isSendingOtp) return;
        setOtpError('');
        setIsSendingOtp(true);

        try {
            await sendOtp(email);
            setOtp(Array(OTP_LENGTH).fill(''));
            setSecondsLeft(OTP_DURATION);
            setStep(2);
        } catch (error: any) {
            const errorMsg = error.message || '';
            if (errorMsg.toLowerCase().includes('already been sent')) {
                setOtp(Array(OTP_LENGTH).fill(''));
                setSecondsLeft(OTP_DURATION);
                setStep(2);
            } else {
                setOtpError(errorMsg);
            }
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleResend = async () => {
        if (isResendingOtp) return;
        setOtpError('');
        setIsResendingOtp(true);

        try {
            await sendOtp(email);
            setOtp(Array(OTP_LENGTH).fill(''));
            setSecondsLeft(OTP_DURATION);
            otpRefs.current[0]?.focus();
        } catch (error: any) {
            setOtpError(error.message);
        } finally {
            setIsResendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpCode = otp.join('');
        if (otpCode.length !== OTP_LENGTH || isVerifyingOtp) return;
        setOtpError('');
        setIsVerifyingOtp(true);

        try {
            await verifyOtp(email, otpCode);
            setStep(3);
        } catch (error: any) {
            setOtpError(error.message);
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    const validateStep3 = (): boolean => {
        const errors: FieldErrors = {};
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!companyName.trim()) errors.companyName = 'Company legal name is required.';
        if (!phone.trim()) errors.phone = 'Phone number is required.';
        else if (!/^[0-9+()\-\s]{6,20}$/.test(phone.trim())) errors.phone = 'Enter a valid phone number.';

        if (!country) errors.country = 'Please select a country.';
        if (!addressLine1.trim()) errors.addressLine1 = 'Address line 1 is required.';
        if (!city.trim()) errors.city = 'City is required.';
        if (!stateVal) errors.stateVal = 'Please select a state.';
        if (!zip.trim()) errors.zip = 'ZIP / pin code is required.';

        if (!name.trim()) errors.name = 'Name is required.';

        if (!adminEmail.trim()) errors.adminEmail = 'Email is required.';
        else if (!emailRegex.test(adminEmail.trim())) errors.adminEmail = 'Enter a valid email address.';

        if (!pw) errors.pw = 'Password is required.';
        else if (pw.length < 8) errors.pw = 'Password must be at least 8 characters.';

        if (!pw2) errors.pw2 = 'Please repeat the password.';
        else if (pw !== pw2) errors.pw2 = 'Passwords do not match.';

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleCreateAccount = async () => {
        if (isCreatingAccount) return;

        const isValid = validateStep3();
        if (!isValid) {
            setCreateError('Please fill in all required fields correctly.');
            return;
        }

        if (!agreeTerms) {
            setCreateError('Please agree to the Terms of Use to continue.');
            return;
        }

        setIsCreatingAccount(true);
        setCreateError('');
        try {
            await createOrganization({
                organizationName: companyName,
                organizationType: 2,
                email: email,
                phone: phone,
                country: country,
                addressLine1: addressLine1,
                addressLine2: addressLine2,
                city: city,
                state: stateVal,
                pinCode: zip,
                personName: name.trim(),
                userName: email,
                personEmail: adminEmail,
                password: pw,
            });
            navigate('/');
        } catch (error: any) {
            setCreateError(error.response?.data?.message || error.message || 'Failed to create account');
        } finally {
            setIsCreatingAccount(false);
        }
    };

    const clearFieldError = (key: keyof FieldErrors) => {
        if (fieldErrors[key]) {
            setFieldErrors((prev: FieldErrors) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
        }
    };

    const handleBack = () => {
        if (step > 1) {
            setStep((prev) => (prev - 1) as 1 | 2 | 3);
        } else {
            navigate(-1);
        }
    };

    return (
        <div className="vr-page">
            <Header />

            <main className="vr-main">
                <div className={`vr-shell ${step === 3 ? 'vr-shell--wide' : ''}`}>
                    <div className="vr-intro">
                        <div className="vr-intro-header">
                            <button
                                type="button"
                                className={`sila-btn sila-btn--secondary sila-btn--icon sila-btn--sm ${step === 3 ? 'vr-back-btn-change' : 'vr-back-btn'} ${step === 1 ? 'vr-back-btn-chang' : ''}`}
                                onClick={handleBack}
                                aria-label="Back"
                                title="Back"
                            >
                                <IconBack />
                            </button>
                            <div className="vr-intro-text">
                                <h1 className="vr-title">Supplier Registration</h1>
                                {step < 3 && (
                                    <p className="vr-subtitle">
                                        {step === 1
                                            ? 'Create your supplier account to access sourcing opportunities'
                                            : 'Email Verification'}
                                    </p>
                                )}
                            </div>
                        </div>
                        <span className="vr-step-indicator">Step {step} of 3</span>
                    </div>

                    <div className="vr-stepper-row">
                        <Stepper current={step} />
                    </div>

                    {step < 3 ? (
                        <section className="vr-card">
                            <div className="vr-card-body">
                                {step === 1 && (
                                    <>
                                        <h2 className="vr-section-title">Verify Your Email Address</h2>
                                        <p className="vr-section-text">
                                            Enter your business email address. We&apos;ll send a One-Time Password (OTP) to
                                            verify your email before creating your supplier account.
                                        </p>

                                        <div className="vr-field">
                                            <label className="vr-label" htmlFor="vr-business-email">
                                                Business Email Address<span className="sila-required" aria-hidden="true">*</span>
                                            </label>
                                            <div className="vr-input-wrap">
                                                <CiMail className="vr-input-icon" aria-hidden="true" />
                                                <input
                                                    id="vr-business-email"
                                                    className="sila-input vr-input vr-input--icon"
                                                    type="email"
                                                    autoComplete="email"
                                                    placeholder="name@company.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    aria-invalid={otpError ? true : undefined}
                                                    aria-describedby={otpError ? 'vr-email-hint vr-email-error' : 'vr-email-hint'}
                                                />
                                            </div>
                                            <p className="vr-hint" id="vr-email-hint">Please use your official company email address.</p>
                                            {otpError && (
                                                <p className="vr-hint vr-hint--error" id="vr-email-error" role="alert">{otpError}</p>
                                            )}
                                        </div>
                                    </>
                                )}

                                {step === 2 && (
                                    <>
                                        <h2 className="vr-section-title">Verify Your Email</h2>
                                        <p className="vr-section-text">
                                            Enter the 6-digit verification code sent to{' '}
                                            <span className="vr-email-highlight">{email || 'supplier@company.com'}</span>
                                        </p>

                                        <div className="vr-otp-row" role="group" aria-label="One-time password">
                                            {otp.map((digit, i) => (
                                                <input
                                                    key={i}
                                                    ref={(el) => {
                                                        otpRefs.current[i] = el;
                                                    }}
                                                    className={`vr-otp-box ${otpError ? 'vr-otp-box--error' : ''}`}
                                                    type="text"
                                                    inputMode="numeric"
                                                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                                                    maxLength={1}
                                                    value={digit}
                                                    aria-label={`Digit ${i + 1} of ${OTP_LENGTH}`}
                                                    aria-invalid={otpError ? true : undefined}
                                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                                                />
                                            ))}
                                        </div>

                                        <div className="vr-otp-meta">
                                            <p className="vr-hint">
                                                OTP Expires in{' '}
                                                <span className="vr-timer">{formatTime(secondsLeft)}</span>
                                            </p>
                                            <p className="vr-hint">
                                                Didn&apos;t receive the code?{' '}
                                                <button
                                                    type="button"
                                                    className={`vr-link ${isResendingOtp ? 'vr-link--disabled' : ''}`}
                                                    aria-disabled={isResendingOtp || undefined}
                                                    onClick={() => {
                                                        if (!isResendingOtp) handleResend();
                                                    }}
                                                >
                                                    {isResendingOtp ? 'Sending...' : 'Resend OTP'}
                                                </button>
                                            </p>
                                        </div>
                                        {otpError && (
                                            <div className="sila-alert sila-alert--danger vr-alert" role="alert">
                                                <FaExclamationCircle className="vr-alert-icon" aria-hidden="true" />
                                                <span>{otpError}</span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="vr-card-footer">
                                {step === 1 && (
                                    <Button
                                        variant="primary"
                                        size="md"
                                        onClick={handleSendOtp}
                                        disabled={!email || isSendingOtp}
                                        loading={isSendingOtp}
                                    >
                                        {isSendingOtp ? 'Sending OTP...' : 'Continue'}
                                    </Button>
                                )}
                                {step === 2 && (
                                    <Button
                                        variant="primary"
                                        size="md"
                                        onClick={handleVerifyOtp}
                                        disabled={otp.join('').length !== OTP_LENGTH || isVerifyingOtp}
                                        loading={isVerifyingOtp}
                                    >
                                        {isVerifyingOtp ? 'Verifying...' : 'Verify & Continue'}
                                    </Button>
                                )}
                            </div>
                        </section>
                    ) : (
                        <div className="vr-card vr-step3">
                            <section className="vr-panel" aria-labelledby="vr-company-title">
                                <h2 className="vr-panel-title" id="vr-company-title">Company Information</h2>
                                <div className="vr-grid">
                                    <div className="vr-field vr-field--full">
                                        <label className="vr-label" htmlFor="vr-company-name">
                                            Company Legal Name<Req />
                                        </label>
                                        <input
                                            id="vr-company-name"
                                            className={`sila-input vr-input ${fieldErrors.companyName ? 'vr-input--error' : ''}`}
                                            autoComplete="organization"
                                            value={companyName}
                                            aria-invalid={fieldErrors.companyName ? true : undefined}
                                            aria-describedby={fieldErrors.companyName ? 'vr-company-name-error' : undefined}
                                            onChange={(e) => {
                                                setCompanyName(e.target.value);
                                                clearFieldError('companyName');
                                            }}
                                        />
                                        <FieldError id="vr-company-name-error" message={fieldErrors.companyName} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-phone">
                                            Phone Number<Req />
                                        </label>
                                        <input
                                            id="vr-phone"
                                            className={`sila-input vr-input ${fieldErrors.phone ? 'vr-input--error' : ''}`}
                                            type="tel"
                                            autoComplete="tel"
                                            value={phone}
                                            aria-invalid={fieldErrors.phone ? true : undefined}
                                            aria-describedby={fieldErrors.phone ? 'vr-phone-error' : undefined}
                                            onChange={(e) => {
                                                setPhone(e.target.value);
                                                clearFieldError('phone');
                                            }}
                                        />
                                        <FieldError id="vr-phone-error" message={fieldErrors.phone} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-country">
                                            Country / Region<Req />
                                        </label>
                                        <select
                                            id="vr-country"
                                            className={`sila-select vr-input vr-select ${fieldErrors.country ? 'vr-input--error' : ''}`}
                                            value={country}
                                            aria-invalid={fieldErrors.country ? true : undefined}
                                            aria-describedby={fieldErrors.country ? 'vr-country-error' : undefined}
                                            onChange={(e) => {
                                                setCountry(e.target.value);
                                                setStateVal('');
                                                clearFieldError('country');
                                            }}
                                        >
                                            <option value="">Select Country</option>
                                            {Country.getAllCountries().map((c: any) => (
                                                <option key={c.isoCode} value={c.isoCode}>
                                                    {c.name}
                                                </option>
                                            ))}
                                        </select>
                                        <FieldError id="vr-country-error" message={fieldErrors.country} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-address1">
                                            Address Line 1<Req />
                                        </label>
                                        <input
                                            id="vr-address1"
                                            className={`sila-input vr-input ${fieldErrors.addressLine1 ? 'vr-input--error' : ''}`}
                                            autoComplete="address-line1"
                                            value={addressLine1}
                                            aria-invalid={fieldErrors.addressLine1 ? true : undefined}
                                            aria-describedby={fieldErrors.addressLine1 ? 'vr-address1-error' : undefined}
                                            onChange={(e) => {
                                                setAddressLine1(e.target.value);
                                                clearFieldError('addressLine1');
                                            }}
                                        />
                                        <FieldError id="vr-address1-error" message={fieldErrors.addressLine1} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-address2">Address Line 2</label>
                                        <input
                                            id="vr-address2"
                                            className="sila-input vr-input"
                                            autoComplete="address-line2"
                                            value={addressLine2}
                                            onChange={(e) => setAddressLine2(e.target.value)}
                                        />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-city">
                                            City<Req />
                                        </label>
                                        <input
                                            id="vr-city"
                                            className={`sila-input vr-input ${fieldErrors.city ? 'vr-input--error' : ''}`}
                                            autoComplete="address-level2"
                                            value={city}
                                            aria-invalid={fieldErrors.city ? true : undefined}
                                            aria-describedby={fieldErrors.city ? 'vr-city-error' : undefined}
                                            onChange={(e) => {
                                                setCity(e.target.value);
                                                clearFieldError('city');
                                            }}
                                        />
                                        <FieldError id="vr-city-error" message={fieldErrors.city} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-state">
                                            State<Req />
                                        </label>
                                        <select
                                            id="vr-state"
                                            className={`sila-select vr-input vr-select ${fieldErrors.stateVal ? 'vr-input--error' : ''}`}
                                            value={stateVal}
                                            aria-invalid={fieldErrors.stateVal ? true : undefined}
                                            aria-describedby={fieldErrors.stateVal ? 'vr-state-error' : undefined}
                                            onChange={(e) => {
                                                setStateVal(e.target.value);
                                                clearFieldError('stateVal');
                                            }}
                                            disabled={!country}
                                        >
                                            <option value="">Select State</option>
                                            {country && State.getStatesOfCountry(country).map((s: any) => (
                                                <option key={s.isoCode} value={s.isoCode}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                        <FieldError id="vr-state-error" message={fieldErrors.stateVal} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-zip">
                                            ZIP Code / Pin Code<Req />
                                        </label>
                                        <input
                                            id="vr-zip"
                                            className={`sila-input vr-input ${fieldErrors.zip ? 'vr-input--error' : ''}`}
                                            autoComplete="postal-code"
                                            value={zip}
                                            aria-invalid={fieldErrors.zip ? true : undefined}
                                            aria-describedby={fieldErrors.zip ? 'vr-zip-error' : undefined}
                                            onChange={(e) => {
                                                setZip(e.target.value);
                                                clearFieldError('zip');
                                            }}
                                        />
                                        <FieldError id="vr-zip-error" message={fieldErrors.zip} />
                                    </div>
                                </div>
                            </section>

                            <section className="vr-panel" aria-labelledby="vr-admin-title">
                                <h2 className="vr-panel-title" id="vr-admin-title">Administrator Account Information</h2>
                                <div className="vr-grid">
                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-admin-name">
                                            Name<Req />
                                        </label>
                                        <input
                                            id="vr-admin-name"
                                            className={`sila-input vr-input ${fieldErrors.name ? 'vr-input--error' : ''}`}
                                            autoComplete="name"
                                            value={name}
                                            aria-invalid={fieldErrors.name ? true : undefined}
                                            aria-describedby={fieldErrors.name ? 'vr-admin-name-error' : undefined}
                                            onChange={(e) => {
                                                setName(e.target.value);
                                                clearFieldError('name');
                                            }}
                                        />
                                        <FieldError id="vr-admin-name-error" message={fieldErrors.name} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-admin-email">
                                            Email<Req />
                                        </label>
                                        <input
                                            id="vr-admin-email"
                                            className={`sila-input vr-input ${fieldErrors.adminEmail ? 'vr-input--error' : ''}`}
                                            type="email"
                                            autoComplete="email"
                                            value={adminEmail}
                                            aria-invalid={fieldErrors.adminEmail ? true : undefined}
                                            aria-describedby={fieldErrors.adminEmail ? 'vr-admin-email-error' : undefined}
                                            onChange={(e) => {
                                                setAdminEmail(e.target.value);
                                                clearFieldError('adminEmail');
                                            }}
                                        />
                                        <FieldError id="vr-admin-email-error" message={fieldErrors.adminEmail} />
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-pw">
                                            Password<Req />
                                        </label>
                                        <div className="vr-input-wrap">
                                            <input
                                                id="vr-pw"
                                                className={`sila-input vr-input vr-input--password ${fieldErrors.pw ? 'vr-input--error' : ''}`}
                                                type={showPassword ? 'text' : 'password'}
                                                autoComplete="new-password"
                                                value={pw}
                                                aria-invalid={fieldErrors.pw ? true : undefined}
                                                aria-describedby={fieldErrors.pw ? 'vr-pw-hint vr-pw-error' : 'vr-pw-hint'}
                                                onChange={(e) => {
                                                    setPw(e.target.value);
                                                    clearFieldError('pw');
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="vr-pw-toggle"
                                                onClick={() => setShowPassword(!showPassword)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                aria-pressed={showPassword}
                                            >
                                                {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                                            </button>
                                        </div>
                                        {fieldErrors.pw ? (
                                            <FieldError id="vr-pw-error" message={fieldErrors.pw} />
                                        ) : (
                                            <p className="vr-hint" id="vr-pw-hint">At least 8 characters.</p>
                                        )}
                                    </div>

                                    <div className="vr-field">
                                        <label className="vr-label" htmlFor="vr-pw2">
                                            Repeat Password<Req />
                                        </label>
                                        <div className="vr-input-wrap">
                                            <input
                                                id="vr-pw2"
                                                className={`sila-input vr-input vr-input--password ${fieldErrors.pw2 ? 'vr-input--error' : ''}`}
                                                type={showPassword2 ? 'text' : 'password'}
                                                autoComplete="new-password"
                                                value={pw2}
                                                aria-invalid={fieldErrors.pw2 ? true : undefined}
                                                aria-describedby={fieldErrors.pw2 ? 'vr-pw2-error' : undefined}
                                                onChange={(e) => {
                                                    setPw2(e.target.value);
                                                    clearFieldError('pw2');
                                                }}
                                            />
                                            <button
                                                type="button"
                                                className="vr-pw-toggle"
                                                onClick={() => setShowPassword2(!showPassword2)}
                                                aria-label={showPassword2 ? 'Hide password' : 'Show password'}
                                                aria-pressed={showPassword2}
                                            >
                                                {showPassword2 ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                                            </button>
                                        </div>
                                        <FieldError id="vr-pw2-error" message={fieldErrors.pw2} />
                                    </div>
                                </div>
                            </section>

                            {createError && (
                                <div className="sila-alert sila-alert--danger vr-alert vr-alert--block" role="alert">
                                    <FaExclamationCircle className="vr-alert-icon" aria-hidden="true" />
                                    <span>{createError}</span>
                                </div>
                            )}

                            <div className="vr-panel vr-panel--footer">
                                <label className="vr-checkbox">
                                    <input
                                        type="checkbox"
                                        className="vr-checkbox-input"
                                        checked={agreeTerms}
                                        onChange={() => setAgreeTerms(!agreeTerms)}
                                    />
                                    <span
                                        className={`vr-checkbox-box ${agreeTerms ? 'vr-checkbox-box--checked' : ''}`}
                                        aria-hidden="true"
                                    >
                                        {agreeTerms && <CheckIcon />}
                                    </span>
                                    <span>
                                        I have read and agree with the{' '}
                                        <a href="#" className="vr-link" onClick={(e) => e.preventDefault()}>
                                            Terms of Use.
                                        </a>
                                    </span>
                                </label>

                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={handleCreateAccount}
                                    disabled={isCreatingAccount}
                                    loading={isCreatingAccount}
                                >
                                    {isCreatingAccount ? 'Creating...' : 'Create Account'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const Req: React.FC = () => <span className="sila-required" aria-hidden="true">*</span>;

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
    message ? (
        <p className="vr-hint vr-hint--error" id={id}>
            <FaExclamationCircle aria-hidden="true" />
            {message}
        </p>
    ) : null;

const STEP_LABELS = ['Email', 'Verification', 'Company details'] as const;

const Stepper: React.FC<{ current: 1 | 2 | 3 }> = ({ current }) => {
    return (
        <ol className="sila-steps vr-stepper" aria-label="Registration progress">
            {STEP_LABELS.map((label, i) => {
                const n = i + 1;
                const state = n < current ? 'done' : n === current ? 'current' : 'upcoming';
                return (
                    <li
                        key={label}
                        className={`sila-step ${state === 'done' ? 'sila-step--done' : ''} ${state === 'current' ? 'sila-step--current' : ''}`}
                        aria-current={state === 'current' ? 'step' : undefined}
                    >
                        <span className="sila-step-marker">
                            {state === 'done' ? <CheckIcon /> : n}
                        </span>
                        <span className="vr-step-label">{label}</span>
                    </li>
                );
            })}
        </ol>
    );
};

export default SupplierRegistration;