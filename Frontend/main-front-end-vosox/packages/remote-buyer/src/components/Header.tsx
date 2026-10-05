import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, AccountMenuIcons } from '@vosox/shared-ui';
import type { AppNavItem, AppUserMenuItem } from '@vosox/shared-ui';
import { useBuyerAuthStore } from '../store/useBuyerAuthStore';

export type HeaderNavItem = AppNavItem;

export interface HeaderProps {
  navItems?: HeaderNavItem[];
  activeNav?: string;
  onNavClick?: (key: string) => void;
  onLogout?: () => void;
  /** The page rendered inside the shell. */
  children?: React.ReactNode;
}

/** Buyer portal chrome: shared AppShell wired to the buyer session and routes. */
const Header: React.FC<HeaderProps> = ({ navItems, activeNav, onNavClick, onLogout, children }) => {
  const navigate = useNavigate();
  // Sourced from the store, which fetches it once (on login and on reload) via
  // BuyerApp's mount effect - no per-component fetch, no local cache.
  const personDetail = useBuyerAuthStore((state) => state.personDetail);

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      sessionStorage.clear();
      localStorage.clear();
      window.dispatchEvent(new CustomEvent("session:expired"));
    }
  };

  const userMenuItems: AppUserMenuItem[] = [
    {
      key: 'companyProfile',
      label: 'Company Profile',
      icon: <AccountMenuIcons.Building />,
      onSelect: () => (onNavClick ? onNavClick('companyProfile') : navigate('/profile')),
    },
    { key: 'editProfile', label: 'Edit Profile', icon: <AccountMenuIcons.User />, onSelect: () => navigate('/profile') },
    { key: 'resetPassword', label: 'Reset Password', icon: <AccountMenuIcons.Lock />, onSelect: () => undefined },
    { key: 'support', label: 'Support', icon: <AccountMenuIcons.Help />, onSelect: () => undefined },
    { key: 'logout', label: 'Log Out', icon: <AccountMenuIcons.LogOut />, onSelect: handleLogout, tone: 'danger', dividerBefore: true },
  ];

  return (
    <AppShell
      onLogoClick={() => (onNavClick ? onNavClick('dashboard') : navigate('/dashboard'))}
      navItems={navItems}
      activeNav={activeNav}
      onNavClick={onNavClick}
      userName={personDetail?.name}
      userEmail={personDetail?.email}
      userFallbackName="Buyer Portal"
      userFallbackEmail="Enterprise Access"
      userMenuItems={userMenuItems}
    >
      {children}
    </AppShell>
  );
};

export default Header;
