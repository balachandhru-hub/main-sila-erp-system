import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, UserRole } from '../../types';
import { useNetworkAdminAuthStore } from '../../store/useAuthStore';
import UserListTable from '../UserListTable/UserListTable';
import CreateUserModal from '../CreateUserModal/CreateUserModal';
import {
  Button,
  EmptyState,
  KpiCard,
  Loader,
  Modal,
  PageHeader,
  SearchInput,
  ToastContainer,
  toastService,
} from '@vosox/shared-ui';
import Header from '../Header';
import {
  getOrganizationUsers,
  createPerson,
  deleteUser,
} from '../../api/networkAdminApi';

import {
  FaUserShield,
  FaUsers,
  FaUserCheck,
  FaLayerGroup,
  FaPlus,
  FaLock,
  FaExclamationCircle,
} from 'react-icons/fa';
import './NetworkAdminDashboard.css';

const sectionInfo = {
  title: 'Network Admin Dashboard',
  subtitle: 'Manage your network users and settings',
};

const NetworkAdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const isLoading = useNetworkAdminAuthStore((state) => state.isLoading);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalCreateRole, setModalCreateRole] = useState<UserRole>(
    currentUser?.userRole === 'BUYER_NETWORK_ADMIN'
      ? 'BUYER_ADMINISTRATOR'
      : 'SUPPLIER_ADMINISTRATOR'
  );

  useEffect(() => {
    if (!currentUser?.organizationId) return;

    const fetchUsers = async () => {
      setIsLoadingData(true);
      setError(null);

      try {
        const users = await getOrganizationUsers(currentUser.organizationId!);
        setAllUsers(users);
      } catch {
        setError('Failed to load users');
        setAllUsers([]);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchUsers();
  }, [currentUser]);

  const handleCreateUser = async (newUser: User) => {
    setIsCreatingUser(true);

    try {
      const personId = await createPerson({
        name: newUser.name,
        email: newUser.email,
        phone: (newUser as any).phone || '',
        country: (newUser as any).country || '',
        addressLine: (newUser as any).addressLine || '',
        userName: (newUser as any).userName || '',
        password: (newUser as any).password || 'temp123',
        roleId: (newUser as any).roleId,
      });

      const userWithPersonId: User = { ...newUser, id: personId, personId };
      setAllUsers((prev) => [...prev, userWithPersonId]);

      toastService.success('User created successfully!');
      setIsModalOpen(false);
    } catch (err: any) {
      const rawMessage = err?.message || 'Failed to create user';
      const lower = rawMessage.toLowerCase();
      let userFacingError = rawMessage;

      if (
        lower.includes('email') ||
        lower.includes('already registered') ||
        lower.includes('already exists') ||
        lower.includes('duplicate')
      ) {
        userFacingError = 'Email address already exists. Please use a different email address.';
      } else if (lower.includes('username')) {
        userFacingError = 'This username is already taken. Please choose a different one.';
      }

      toastService.error(userFacingError);
      throw new Error(userFacingError);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (!user) return;

    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeletingUser(true);

    try {
      const personId = userToDelete.personId || userToDelete.id;

      await deleteUser(personId);

      setAllUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));

      toastService.success(`User "${userToDelete.name}" deleted successfully!`);

      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err: any) {
      toastService.error(err.message || 'Failed to delete user');
    } finally {
      setIsDeletingUser(false);
    }
  };

  const filterUsers = (list: User[]) => {
    const query = searchQuery.toLowerCase();
    if (!query) return list;
    return list.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const uname = ((u as any).userName || '').toLowerCase();
      return name.includes(query) || email.includes(query) || uname.includes(query);
    });
  };

  if (isLoading) {
    return (
      <div className="nad-loading-container">
        <Loader message="Loading dashboard..." />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="nad-not-auth-container">
        <EmptyState
          title="Not Authenticated"
          description="Please login first to access this dashboard."
          icon={<FaLock aria-hidden="true" />}
          action={
            <Button onClick={() => navigate('/login')} className="nad-redirect-btn">
              Go to Login
            </Button>
          }
        />
      </div>
    );
  }

  const activeCount = allUsers.filter((u) => u.status === 'active').length;
  const administrators = allUsers.filter(
    (u) =>
      u.userRole === 'BUYER_ADMINISTRATOR' ||
      u.userRole === 'SUPPLIER_ADMINISTRATOR'
  );
  const regularUsers = allUsers.filter(
    (u) =>
      u.userRole === 'BUYER_USER' ||
      u.userRole === 'SUPPLIER_USER'
  );

  const adminLabel =
    currentUser.userRole === 'BUYER_NETWORK_ADMIN'
      ? 'Buyer Administrators'
      : 'Supplier Administrators';
  const userLabel =
    currentUser.userRole === 'BUYER_NETWORK_ADMIN'
      ? 'Buyer Users'
      : 'Supplier Users';

  const filteredAdministrators = filterUsers(administrators);
  const filteredUsers = filterUsers(regularUsers);
  const allFilteredUsers = [...filteredAdministrators, ...filteredUsers];

  return (
    <Header>
      <ToastContainer />

      <div className="nad-shell">
        <div className="nad-main">
          <div className="nad-content">
            <PageHeader
              className="nad-content-header"
              title={sectionInfo.title}
              description={sectionInfo.subtitle}
            />

            <section className="nad-stats-grid sila-kpi-grid" aria-label="User summary">
              <KpiCard
                className="nad-stat-card"
                tone="primary"
                icon={<FaUserShield />}
                label={adminLabel}
                value={administrators.length}
              />
              <KpiCard
                className="nad-stat-card"
                icon={<FaUsers />}
                label={userLabel}
                value={regularUsers.length}
              />
              <KpiCard
                className="nad-stat-card"
                icon={<FaUserCheck />}
                label="Active Users"
                value={activeCount}
              />
              <KpiCard
                className="nad-stat-card"
                icon={<FaLayerGroup />}
                label="Total Users"
                value={allUsers.length}
              />
            </section>

            <div className="nad-controls-bar">
              <SearchInput
                containerClassName="nad-search-wrapper"
                className="nad-search-input"
                placeholder="Search by name, email or username..."
                label="Search users"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className="nad-action-buttons">
                <Button
                  variant="secondary"
                  className="nad-create-btn nad-create-user-btn"
                  onClick={() => {
                    setModalCreateRole(
                      currentUser.userRole === 'BUYER_NETWORK_ADMIN'
                        ? 'BUYER_USER'
                        : 'SUPPLIER_USER'
                    );
                    setIsModalOpen(true);
                  }}
                  disabled={isCreatingUser}
                  title="Create a new regular user"
                >
                  <FaPlus aria-hidden="true" />
                  Create {userLabel.slice(0, -1)}
                </Button>

                <Button
                  className="nad-create-btn"
                  onClick={() => {
                    setModalCreateRole(
                      currentUser.userRole === 'BUYER_NETWORK_ADMIN'
                        ? 'BUYER_ADMINISTRATOR'
                        : 'SUPPLIER_ADMINISTRATOR'
                    );
                    setIsModalOpen(true);
                  }}
                  disabled={isCreatingUser}
                  title="Create a new administrator user"
                >
                  <FaPlus aria-hidden="true" />
                  Create {adminLabel.slice(0, -1)}
                </Button>
              </div>
            </div>

            {error && (
              <div className="nad-alert-error sila-alert sila-alert--danger" role="alert">
                <FaExclamationCircle className="nad-alert-icon" aria-hidden="true" />
                <span>
                  <strong className="sila-alert-title">Error:</strong> {error}
                </span>
              </div>
            )}

            {isLoadingData ? (
              <div className="nad-loading-data sila-card">
                <Loader message="Please wait..." />
              </div>
            ) : (
              <div className="nad-lists-section">
                <UserListTable
                  users={allFilteredUsers}
                  title="All Users"
                  onDelete={handleDeleteUser}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateUser}
        createRole={modalCreateRole}
        isLoading={isCreatingUser}
      />

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeletingUser) return;
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        variant="danger"
        headerProps={{ heading: 'Delete User' }}
        bodyProps={{
          content: (
            <>
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>?
            </>
          ),
          contentDescription: 'This action cannot be undone.',
        }}
        footerProps={{
          secondaryButton: {
            text: 'Cancel',
            onClick: () => {
              setIsDeleteModalOpen(false);
              setUserToDelete(null);
            },
            disabled: isDeletingUser,
          },
          primaryButton: {
            text: isDeletingUser ? 'Deleting...' : 'Delete',
            onClick: confirmDeleteUser,
            loading: isDeletingUser,
          },
        }}
      />
    </Header>
  );
};

export default NetworkAdminDashboard;