import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@vosox/shared-ui';
import Header from './Header';
import {
  FaUser,
  FaLock,
  FaEye,
  FaEyeSlash,
  FaTruck,
  FaBuilding,
  FaShieldAlt,
  FaExclamationCircle,
  FaHandshake,
  FaUtensils,
  FaFileInvoice,
  FaCogs,
} from 'react-icons/fa';
import { login, getTokenClaims } from '../api/authApi';
import './Login.css';

type Role = 'supplier' | 'buyer' | 'platform-user';
type View = 'role-select' | 'sign-in';

const ROLE_IDS = {
  SUPPLIER: '937aab61-b505-4e1c-a5a3-cd63e29c6db9',
  BUYER: '5a72f81e-a2c5-4f4a-bd55-6376c3c9ed73',
  PLATFORM_ADMIN: '113d8ead-40c2-425a-bc60-5989e6cdabca',
  BUYER_NETWORK_ADMIN: '61eb9b97-1fca-4beb-beb8-dc4b379cfa3a',
  SUPPLIER_NETWORK_ADMIN: '22067509-af24-48f8-a7e9-416a0b6a439b',
  SUPPLIER_ADMIN: '735bb267-fec0-489f-8249-d3d65b3857ea',
  BUYER_ADMIN: 'c95f5a1b-4aec-4647-9328-895a58193ec4',
  OUTLET_MANAGER: '7c4e1a90-6b2d-4f58-9c31-0e8a5d6f4b21',
  STORE_MANAGER: 'b054de41-7da1-4b96-a2aa-d8387bfb0ef0',
  COST_CONTROLLER: '3f9d6c2e-5b1a-4e8f-9c7d-2a6b8e4f1c03',
} as const;

// const CheckIcon = () => (
//   <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <path d="M4 12.5l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
//   </svg>
// );

/** Lines shown outside the sign-in card. Add, edit, or clear entries here. */
const LOGIN_NOTICES = [
  'SILA — We are Launching REBUILD exclusively for Realestate and Buildings',
];

interface LoginProps {
  onLoginSuccess?: (
    details: {
      userId?: string;
      personId?: string;
      organizationId?: string;
      roleId?: string;
      buyerId?: string;
      supplierId?: string;
      permissions?: string[];
      organizationType?: number;
    }
  ) => void;
  onCreateAccount?: () => void;
  onCreateBuyerAccount?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onCreateAccount, onCreateBuyerAccount }) => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('sign-in');
  const [role, setRole] = useState<Role>('supplier');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  // const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = () => {
    if (role === 'supplier') {
      onCreateAccount?.();
    } else if (role === 'buyer') {
      onCreateBuyerAccount?.();
    }
  };

  // Every role lands on the same role-neutral URL; the host picks the right app for the role.
  const getRedirectUrl = (roleId: string): string | null => {
    switch (roleId) {
      case ROLE_IDS.BUYER_ADMIN:
      case ROLE_IDS.SUPPLIER_ADMIN:
      case ROLE_IDS.BUYER_NETWORK_ADMIN:
      case ROLE_IDS.SUPPLIER_NETWORK_ADMIN:
      case ROLE_IDS.PLATFORM_ADMIN:
      case ROLE_IDS.SUPPLIER:
      case ROLE_IDS.BUYER:
      case ROLE_IDS.OUTLET_MANAGER:
      case ROLE_IDS.STORE_MANAGER:
      case ROLE_IDS.COST_CONTROLLER:
        return '/dashboard';
      default:
        return null;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    setIsLoading(true);
    try {
      await login(username, password);

      try {
        const claims = await getTokenClaims(true);
        if (claims && claims.roleId) {
          const details = {
            userId: claims.userId,
            personId: claims.personId,
            organizationId: claims.organizationId,
            roleId: claims.roleId,
            buyerId: claims.buyerId,
            supplierId: claims.supplierId,
            permissions: claims.permissions,
            organizationType: claims.organizationType,
          };

          const redirectUrl = getRedirectUrl(claims.roleId);
          if (!redirectUrl) {
            setError('Unrecognized user role. Please contact support.');
            return;
          }

          onLoginSuccess?.(details);
          navigate(redirectUrl, { replace: true });
        } else {
          setError('Failed to retrieve user claims. Role ID not found.');
        }
      } catch (claimsError: any) {
        setError(claimsError.message || 'Failed to retrieve user claims.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="vx-page">
      <Header />

      <main className="vx-main">
        <div className="vx-stage">
        {LOGIN_NOTICES.length > 0 && (
          <ul className="vx-notices" aria-label="SILA notices">
            {LOGIN_NOTICES.map((notice) => (
              <li key={notice}><span>{notice}</span></li>
            ))}
          </ul>
        )}
        <div className="vx-card">
          <aside className="vx-left" aria-label="About SILA">
            <div className="vx-left-intro">
              <div className="vx-left-lockup">
                <p className="vx-left-brand">SILA</p>
                <p className="vx-left-overline">Intelligent Business Operations</p>
              </div>
              <h2 className="vx-left-title">One Platform.<br />Connected Operations.</h2>
              <p className="vx-left-text">
                Procurement, hospitality, finance and enterprise operations connected through one intelligent platform.
              </p>
            </div>
            <ul className="vx-caps">
              <li>
                <FaHandshake aria-hidden="true" />
                <span>
                  <strong>Procurement</strong>
                  Supplier Management · Sourcing · e-Auction
                </span>
              </li>
              <li>
                <FaUtensils aria-hidden="true" />
                <span>
                  <strong>Hospitality</strong>
                  Menu Engineering · Inventory · Operations
                </span>
              </li>
              <li>
                <FaFileInvoice aria-hidden="true" />
                <span>
                  <strong>Finance</strong>
                  Invoice Automation · e-Invoicing
                </span>
              </li>
              <li>
                <FaCogs aria-hidden="true" />
                <span>
                  <strong>Enterprise</strong>
                  Workflow · Analytics · AI Automation
                </span>
              </li>
            </ul>
            <p className="vx-left-foot">
              <FaShieldAlt aria-hidden="true" />
              <span>Connected operations. Intelligent decisions.</span>
            </p>
          </aside>

          <div className="vx-right">
            <div className="vx-right-inner">
              {view === 'role-select' ? (
                <>
                  <h1 className="vx-title">Welcome</h1>
                  <p className="vx-subtitle" id="vx-role-hint">Select your role to continue</p>

                  <div className="vx-role-grid" role="radiogroup" aria-labelledby="vx-role-hint">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={role === 'supplier'}
                      className={`vx-role-card ${role === 'supplier' ? 'vx-role-card--active' : ''}`}
                      onClick={() => setRole('supplier')}
                    >
                      <span className="vx-role-icon" aria-hidden="true"><FaTruck /></span>
                      <span className="vx-role-label">Supplier</span>
                      <span className="vx-role-radio" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={role === 'buyer'}
                      className={`vx-role-card ${role === 'buyer' ? 'vx-role-card--active' : ''}`}
                      onClick={() => setRole('buyer')}
                    >
                      <span className="vx-role-icon" aria-hidden="true"><FaBuilding /></span>
                      <span className="vx-role-label">Buyer</span>
                      <span className="vx-role-radio" aria-hidden="true" />
                    </button>
                  </div>

                  <Button variant="primary" size="lg" fullWidth onClick={handleContinue}>
                    Continue as {role === 'supplier' ? 'Supplier' : 'Buyer'}
                  </Button>

                  <p className="vx-footer-text">
                    Already have an account?{' '}
                    <button type="button" className="vx-link" onClick={() => setView('sign-in')}>
                      Sign In
                    </button>
                  </p>
                </>
              ) : (
                <form onSubmit={handleSignIn} noValidate aria-busy={isLoading || undefined}>
                  <h1 className="vx-title">Welcome to SILA</h1>
                  <p className="vx-subtitle">Sign in to your workspace</p>
                  {error && (
                    <div className="sila-alert sila-alert--danger vx-alert" role="alert" id="vx-login-error">
                      <FaExclamationCircle className="vx-alert-icon" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="vx-field">
                    <label className="vx-label" htmlFor="vx-username">Username</label>
                    <div className="vx-input-wrap">
                      <FaUser className="vx-input-icon" aria-hidden="true" />
                      <input
                        id="vx-username"
                        className="sila-input vx-input"
                        type="text"
                        autoComplete="username"
                        placeholder="Enter your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={isLoading}
                        aria-invalid={error && !username ? true : undefined}
                        aria-describedby={error ? 'vx-login-error' : undefined}
                      />
                    </div>
                  </div>

                  <div className="vx-field">
                    <label className="vx-label" htmlFor="vx-password">Password</label>
                    <div className="vx-input-wrap">
                      <FaLock className="vx-input-icon" aria-hidden="true" />
                      <input
                        id="vx-password"
                        className="sila-input vx-input vx-input--password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        aria-invalid={error && !password ? true : undefined}
                        aria-describedby={error ? 'vx-login-error' : undefined}
                      />
                      <button
                        type="button"
                        className="vx-pw-toggle"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                      </button>
                    </div>
                  </div>

                  <div className="vx-row-between">
                    {/* <label className="vx-checkbox">
                      <input
                        type="checkbox"
                        className="vx-checkbox-input"
                        checked={rememberMe}
                        onChange={() => setRememberMe(!rememberMe)}
                      />
                      <span
                        className={`vx-checkbox-box ${rememberMe ? 'vx-checkbox-box--checked' : ''}`}
                        aria-hidden="true"
                      >
                        {rememberMe && <CheckIcon />}
                      </span>
                      Remember me
                    </label> */}
                    <a
                      type="button"
                      className="vx-link"
                      onClick={(e) => {
                        e.preventDefault();
                      }}
                    >
                      Forgot Password?
                    </a>
                  </div>

                  <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </Button>

                  <p className="vx-footer-text">
                    New to SILA?{' '}
                    <a href="#" className="vx-link" onClick={(e) => {
                      e.preventDefault();
                      if (role === 'platform-user') {
                        setRole('supplier');
                      }
                      setView('role-select');
                    }}>
                      Create an Account
                    </a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
        </div>
      </main>
    </div>
  );
};

export default Login;