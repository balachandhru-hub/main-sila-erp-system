import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileView } from '@vosox/shared-ui';
import type { PersonDetail, PersonDetailUpdate } from '@vosox/shared-ui';
import { isErrorResponse } from '@vosox/shared-ui';
import { updatePersonDetail } from '../api/networkAdminApi';
import { useNetworkAdminAuthStore } from '../store/useAuthStore';
import Header from '../components/Header';

const BuyerAdminProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const authLoading = useNetworkAdminAuthStore((state) => state.isLoading);
  // Sourced from the store, which fetches it once (on login and on reload) via
  // initializeFromSession - no per-page fetch, no local cache.
  const personDetail = useNetworkAdminAuthStore((state) => state.personDetail);
  const personDetailLoading = useNetworkAdminAuthStore((state) => state.personDetailLoading);
  const setPersonDetail = useNetworkAdminAuthStore((state) => state.setPersonDetail);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (updates: PersonDetailUpdate) => {
    setSaving(true);
    setError(null);

    const result = await updatePersonDetail(updates);

    if (isErrorResponse(result)) {
      setError(result.message || 'Failed to update profile.');
    } else {
      setPersonDetail(result);
    }

    setSaving(false);
  };

  if (authLoading) {
    return null;
  }

  return (
    <Header>
      <ProfileView
        personDetail={personDetail as unknown as PersonDetail | null}
        loading={personDetailLoading}
        saving={saving}
        error={error}
        onSave={handleSave}
        onBack={() => navigate('/dashboard')}
      />
    </Header>
  );
};

export default BuyerAdminProfilePage;