import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, AccountMenuIcons } from '@vosox/shared-ui';
import type { AppNavItem, AppUserMenuItem } from '@vosox/shared-ui';
import { useNetworkAdminAuthStore } from '../store/useAuthStore';
import type { UserRole } from '../types';

export type HeaderNavItem = AppNavItem;

export interface HeaderProps {
  navItems?: HeaderNavItem[];
  activeNav?: string;
  onNavClick?: (key: string) => void;
  onLogout?: () => void;
  /** The page rendered inside the shell. */
  children?: React.ReactNode;
}

/** Roles that have a personal profile page (at /profile). */
const ROLES_WITH_PROFILE: UserRole[] = ['BUYER_ADMINISTRATOR', 'SUPPLIER_ADMINISTRATOR', 'BUYER_NETWORK_ADMIN', 'SUPPLIER_NETWORK_ADMIN'];

/** Admin portal chrome: shared AppShell wired to the admin session and role routes. */
const Header: React.FC<HeaderProps> = ({ navItems, activeNav, onNavClick, onLogout, children }) => {
  const navigate = useNavigate();
  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const personDetail = useNetworkAdminAuthStore((state) => state.personDetail);
  const role = currentUser?.userRole;

  const goToProfile = () => navigate(role && ROLES_WITH_PROFILE.includes(role) ? '/profile' : '/dashboard');

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      sessionStorage.clear();
      localStorage.clear();
      window.dispatchEvent(new CustomEvent("session:expired"));
    }
  };

  const handleLogoClick = () => {
    if (onNavClick) {
      const dashItem = navItems?.find(
        (item) => item.key === 'dashboard' || item.label.toLowerCase() === 'dashboard'
      );
      onNavClick(dashItem ? dashItem.key : 'dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const userMenuItems: AppUserMenuItem[] = [
    {
      key: 'companyProfile',
      label: 'Company Profile',
      icon: <AccountMenuIcons.Building />,
      onSelect: () => (onNavClick ? onNavClick('companyProfile') : goToProfile()),
    },
    { key: 'editProfile', label: 'Edit Profile', icon: <AccountMenuIcons.User />, onSelect: goToProfile },
    { key: 'resetPassword', label: 'Reset Password', icon: <AccountMenuIcons.Lock />, onSelect: () => undefined },
    { key: 'support', label: 'Support', icon: <AccountMenuIcons.Help />, onSelect: () => undefined },
    { key: 'logout', label: 'Log Out', icon: <AccountMenuIcons.LogOut />, onSelect: handleLogout, tone: 'danger', dividerBefore: true },
  ];

  return (
    <AppShell
      onLogoClick={handleLogoClick}
      navItems={navItems}
      activeNav={activeNav}
      onNavClick={onNavClick}
      userName={personDetail?.name}
      userEmail={personDetail?.email}
      userFallbackName="Admin Portal"
      userFallbackEmail="System Administrator"
      userMenuItems={userMenuItems}
    >
      {children}
    </AppShell>
  );
};

export default Header;
