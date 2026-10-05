import React, { useEffect, useState } from 'react';
import { EmptyState, Loader, ToastContainer } from '@vosox/shared-ui';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useNetworkAdminAuthStore } from './store/useAuthStore';
import { fetchReferenceList } from './api/masterdataApi';
import {
  getNetworkAdminProfile,
  getNetworkAdminOnboardingDetails,
  createNetworkAdminBuyerProfile,
  createNetworkAdminSupplierProfile,
  updateRejectedNetworkAdminBuyer,
  updateRejectedNetworkAdminSupplier,
  type NetworkAdminRole,
} from './api/networkAdminApi';
import type {
  NetworkAdminProfileResponse,
  NetworkAdminOnboardingResponse,
} from './dto/networkAdminDto';

const PlatformUserDashboard = React.lazy(() => import('./components/PlatformUserDashboard'));
const Department = React.lazy(() => import('./components/departmentbuyer'));
const DepartmentCostList = React.lazy(() => import('./components/DepartmentCostList'));
const NetworkAdminDashboard = React.lazy(() => import('./components/NetworkAdminDashboard/NetworkAdminDashboard'));
const NetworkAdminOnboarding = React.lazy(() => import('./components/NetworkAdminOnboarding/NetworkAdminOnboarding'));
const ItemMaster = React.lazy(() => import('./components/ItemMaster'));
const SupplierAdminDash = React.lazy(() => import('./components/SupplierAdminDash'));
const BuyerAdminDash = React.lazy(() => import('./components/BuyerAdminDash'));
const NetworkAdminProfilePage = React.lazy(() => import('./pages/NetworkAdminProfilePage'));
const PlatformUserTemplates = React.lazy(() => import('./components/PlatformUserTemplates'));
const BuyerAdminProfilePage = React.lazy(() => import('./pages/BuyerAdminProfilePage'));
const SupplierAdminProfilePage = React.lazy(() => import('./pages/SupplierAdminProfilePage'));

const NETWORK_ADMIN_ROLES: NetworkAdminRole[] = ['BUYER_NETWORK_ADMIN', 'SUPPLIER_NETWORK_ADMIN'];


const fileToBase64 = (file: File): Promise<string> => {
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

interface NetworkAdminOnboardingRouteProps {
  role: NetworkAdminRole;
  organizationId: string | null;
  onCompleteSuccess: () => void;
  onboardingData: NetworkAdminOnboardingResponse | null;
  rejectedProfile: NetworkAdminProfileResponse | null;
}

const NetworkAdminOnboardingRoute: React.FC<NetworkAdminOnboardingRouteProps> = ({
  role,
  organizationId,
  onCompleteSuccess,
  onboardingData,
  rejectedProfile,
}) => {
  const navigate = useNavigate();

  const handleOnboardingComplete = async (data: any) => {
    const orgId = organizationId ;

    if (!orgId) {
      throw new Error('Organization ID not found. Please log in again.');
    }

    try {
      const categoriesFromForm =
        data.selectedSubProducts?.length > 0
          ? data.selectedSubProducts.map((sub: any) => ({
              segment: sub.parentSegment || 0,
              segmentTitle: sub.parentTitle || '',
              family: sub.parentFamily || 0,
              familyTitle: sub.parentTitle || '',
              class: sub.class,
              classTitle: sub.title,
              commodity: sub.commodity,
              commodityTitle: sub.title,
            }))
          : data.selectedProducts?.map((product: any) => ({
              segment: product.segment,
              segmentTitle: product.title,
              family: product.family,
              familyTitle: product.title,
              class: 0,
              classTitle: '',
              commodity: 0,
              commodityTitle: '',
            })) || [];

      const entityTypeKey = role === 'BUYER_NETWORK_ADMIN' ? 'BUYER' : 'SUPPLIER';
const entityTypes = await fetchReferenceList(['ENTITY_TYPE']);
const entityId = Array.isArray(entityTypes)
    ? entityTypes.find((e: any) => e.key === entityTypeKey)?.id || ''
    : '';
      const mappedRegistrations = await Promise.all(
        data.registrations.map(async (r: any) => {
          const fileBytes = r.certificateFile ? await fileToBase64(r.certificateFile) : '';
          return {
            registrationNumber: r.number,
            registrationName: r.name,
            expiryDate: r.expiryDate ? new Date(r.expiryDate).toISOString() : null,
            registrationType: r.type,
            registrationDocument: {
              entityType: entityTypeKey,
              entityId,
              assetType: r.type,
              fileBytes,
              fileName: r.certificateFile?.name || r.attachmentName || '',
              contentType: r.certificateFile?.type || 'application/pdf',
              isSingletonAsset: true,
            },
          };
        })
      );

      if (role === 'BUYER_NETWORK_ADMIN') {
        const payload = {
          organizationId: orgId,
          organizationName: onboardingData?.organizationName || '',
          email: onboardingData?.email || '',
          phone: onboardingData?.phone || '',
          country: onboardingData?.country || '',
          addressLine1: onboardingData?.addressLine1 || '',
          addressLine2: onboardingData?.addressLine2 || '',
          city: onboardingData?.city || '',
          state: onboardingData?.state || '',
          pinCode: onboardingData?.pinCode || '',
          industry: data.businessInfo.industry,
          businessType: data.businessInfo.businessType,
          employeeCount: parseInt(data.businessInfo.employeeCount, 10) || 0,
          annualTurnover: parseFloat(data.businessInfo.annualTurnover) || 0,
          currency: data.businessInfo.currency,
          yearEstablished: parseInt(data.businessInfo.yearEstablished, 10) || 0,
          website: data.businessInfo.website || '',
          description: data.businessInfo.companyDescription || '',
          status: 'PENDING',
          buyerCategories: categoriesFromForm,
          buyerBankAccounts: data.bankAccounts.map((b: any) => ({
            accountHolderName: b.accountHolderName,
            bankName: b.bankName,
            branchName: b.branchName,
            accountNumber: b.accountNumber,
            ifscCode: b.ifscCode,
            swiftCode: b.swiftCode || '',
            currency: b.currency,
            isPrimary: b.isPrimary,
          })),
          buyerDocumentRegistrations: mappedRegistrations,
          buyerDeliveryLocations: data.dispatchLocations.map((l: any) => ({
            locationName: l.locationName,
            addressLine1: l.addressLine1,
            addressLine2: l.addressLine2 || '',
            city: l.city,
            state: l.state,
            country: l.country,
            pinCode: l.pinZip,
            contactPerson: l.contactPerson,
            contactPhone: l.contactPhone,
            isDefault: l.isDefault,
          })),
        };

        if (rejectedProfile) {
          await updateRejectedNetworkAdminBuyer({
            buyer: {
              buyerId: rejectedProfile.id,
              businessProfile: {
                organizationId: payload.organizationId,
                organizationName: payload.organizationName,
                email: payload.email,
                phone: payload.phone,
                country: payload.country,
                addressLine1: payload.addressLine1,
                addressLine2: payload.addressLine2,
                city: payload.city,
                state: payload.state,
                pinCode: payload.pinCode,
                industry: payload.industry,
                businessType: payload.businessType,
                employeeCount: payload.employeeCount,
                annualTurnover: payload.annualTurnover,
                currency: payload.currency,
                yearEstablished: payload.yearEstablished,
                website: payload.website,
                description: payload.description,
                status: payload.status,
              },
              buyerCategories: payload.buyerCategories,
              buyerBankAccounts: payload.buyerBankAccounts,
              buyerDocumentRegistrations: payload.buyerDocumentRegistrations,
              buyerDeliveryLocations: payload.buyerDeliveryLocations,
            },
          });
        } else {
          await createNetworkAdminBuyerProfile(payload);
        }
      } else {
        const payload = {
          organizationId: orgId,
          businessProfile: {
            organizationName: onboardingData?.organizationName || '',
            email: onboardingData?.email || '',
            phone: onboardingData?.phone || '',
            country: onboardingData?.country || '',
            addressLine1: onboardingData?.addressLine1 || '',
            addressLine2: onboardingData?.addressLine2 || '',
            city: onboardingData?.city || '',
            state: onboardingData?.state || '',
            pinCode: onboardingData?.pinCode || '',
            industry: data.businessInfo.industry,
            businessType: data.businessInfo.businessType,
            employeeCount: parseInt(data.businessInfo.employeeCount, 10) || 0,
            annualTurnover: parseFloat(data.businessInfo.annualTurnover) || 0,
            currency: data.businessInfo.currency,
            yearEstablished: parseInt(data.businessInfo.yearEstablished, 10) || 0,
            website: data.businessInfo.website || '',
            description: data.businessInfo.companyDescription || '',
            status: 'PENDING',
          },
          registrations: mappedRegistrations.map((r) => ({
            registrationType: r.registrationType,
            registrationNumber: r.registrationNumber,
            registrationName: r.registrationName,
            asset: r.registrationDocument,
            expiryDate: r.expiryDate,
          })),
          bankAccounts: data.bankAccounts.map((b: any) => ({
            accountHolderName: b.accountHolderName,
            bankName: b.bankName,
            branchName: b.branchName,
            accountNumber: b.accountNumber,
            ifscCode: b.ifscCode,
            swiftCode: b.swiftCode || '',
            iban: b.iban || '',
            currency: b.currency,
            isPrimary: b.isPrimary,
          })),
          dispatchLocations: data.dispatchLocations.map((l: any) => ({
            locationName: l.locationName,
            addressLine1: l.addressLine1,
            addressLine2: l.addressLine2 || '',
            city: l.city,
            state: l.state,
            country: l.country,
            pinCode: l.pinZip,
            contactPerson: l.contactPerson,
            contactEmail: l.contactEmail || '',
            contactPhone: l.contactPhone,
            isDefault: l.isDefault,
          })),
          supplierCategories: categoriesFromForm,
        };

        if (rejectedProfile) {
          await updateRejectedNetworkAdminSupplier({
            supplier: {
              supplierId: rejectedProfile.id,
              businessProfile: payload.businessProfile,
              registrations: payload.registrations,
              bankAccounts: payload.bankAccounts,
              dispatchLocations: payload.dispatchLocations,
              supplierCategories: payload.supplierCategories,
            },
          });
        } else {
          await createNetworkAdminSupplierProfile(payload);
        }
      }
      onCompleteSuccess();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      throw error;
    }
  };

  return (
    <NetworkAdminOnboarding
      onComplete={handleOnboardingComplete}
      onboardingData={onboardingData}
      rejectedProfile={rejectedProfile}
    />
  );
};

const PlatformUserApp: React.FC = () => {
  const initializeFromSession = useNetworkAdminAuthStore((state) => state.initializeFromSession);
  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const isLoading = useNetworkAdminAuthStore((state) => state.isLoading);

  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [onboardingData, setOnboardingData] = useState<NetworkAdminOnboardingResponse | null>(null);
  const [rejectedProfile, setRejectedProfile] = useState<NetworkAdminProfileResponse | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    initializeFromSession();
  }, []);

  const isNetworkAdmin =
    currentUser ? NETWORK_ADMIN_ROLES.includes(currentUser.userRole as NetworkAdminRole) : false;
  const networkAdminRole = currentUser?.userRole as NetworkAdminRole | undefined;

  useEffect(() => {
    if (isLoading || !isNetworkAdmin || !networkAdminRole) {
      setCheckingProfile(false);
      return;
    }

    const checkProfile = async () => {
     const orgId = currentUser?.organizationId;
      if (!orgId) {
        setCheckingProfile(false);
        return;
      }
      try {
        const profile = await getNetworkAdminProfile(networkAdminRole);

        if (profile !== null) {
          if (profile.businessProfile?.status === 'REJECTED') {
            const onboarding = await getNetworkAdminOnboardingDetails();
            setOnboardingData(onboarding);
            setRejectedProfile(profile);
            setProfileComplete(false);
          } else {
            setProfileComplete(true);
          }
        } else {
          const onboarding = await getNetworkAdminOnboardingDetails();
          setOnboardingData(onboarding);
          setRejectedProfile(null);
          setProfileComplete(false);
        }
      } catch (error: any) {
        try {
          const onboarding = await getNetworkAdminOnboardingDetails();
          setOnboardingData(onboarding);
        } catch {
        }
        setProfileComplete(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkProfile();
  }, [isLoading, isNetworkAdmin, networkAdminRole, currentUser?.organizationId]);

  if (isLoading || (isNetworkAdmin && checkingProfile)) {
    return <Loader fullScreen message="Loading your dashboard..." />;
  }

  if (!currentUser) return <Navigate to="/" replace />;

  const role = currentUser.userRole;
  const onboardingPending = profileComplete === false;

  // Every role uses the same role-neutral URLs (/dashboard, /profile, …). Only the signed-in
  // role's routes are declared, so another role's pages cannot be reached by typing a URL.
  const renderRoutes = () => {
    switch (role) {
      case 'PLATFORM_ADMINISTRATOR':
        return (
          <>
            <Route path="dashboard" element={<PlatformUserDashboard />} />
            <Route path="settings" element={<Department />} />
            <Route path="departmentcostlist" element={<DepartmentCostList />} />
            <Route path="templates" element={<PlatformUserTemplates />} />
            <Route path="itemmaster" element={<ItemMaster />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        );

      case 'BUYER_ADMINISTRATOR':
        return (
          <>
            <Route path="profile" element={<BuyerAdminProfilePage />} />
            {/* Dashboard sections (/dashboard, /rfqs, /users, …) are resolved inside the dashboard. */}
            <Route path="*" element={<BuyerAdminDash />} />
          </>
        );

      case 'SUPPLIER_ADMINISTRATOR':
        return (
          <>
            <Route path="profile" element={<SupplierAdminProfilePage />} />
            <Route path="*" element={<SupplierAdminDash />} />
          </>
        );

      case 'BUYER_NETWORK_ADMIN':
      case 'SUPPLIER_NETWORK_ADMIN':
        return (
          <>
            <Route
              path="onboarding"
              element={
                profileComplete ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <NetworkAdminOnboardingRoute
                    role={role}
                    organizationId={currentUser.organizationId || null}
                    onCompleteSuccess={() => setProfileComplete(true)}
                    onboardingData={onboardingData}
                    rejectedProfile={rejectedProfile}
                  />
                )
              }
            />
            <Route
              path="profile"
              element={onboardingPending ? <Navigate to="/onboarding" replace /> : <NetworkAdminProfilePage />}
            />
            <Route
              path="dashboard"
              element={onboardingPending ? <Navigate to="/onboarding" replace /> : <NetworkAdminDashboard />}
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        );

      default:
        return (
          <Route
            path="*"
            element={<EmptyState variant="error" title="No access" description="Your role does not have access to this portal." />}
          />
        );
    }
  };

  return (
    <>
      <ToastContainer />
      <React.Suspense fallback={<Loader fullScreen message="Loading your dashboard..." />}>
        <Routes>
          {renderRoutes()}
        </Routes>
      </React.Suspense>
    </>
  );
};

export default PlatformUserApp;