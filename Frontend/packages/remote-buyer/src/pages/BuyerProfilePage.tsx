import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileView } from '@vosox/shared-ui';
import type { PersonDetail, PersonDetailUpdate } from '@vosox/shared-ui';
import { isErrorResponse } from '@vosox/shared-ui';
import { updatePersonDetail } from '../api/Buyerapi';
import { useBuyerAuthStore } from '../store/useBuyerAuthStore';
import Header from '../components/Header';

const BuyerProfilePage: React.FC = () => {
  const navigate = useNavigate();
  // Sourced from the store, which fetches it once (on login and on reload) via
  // BuyerApp's mount effect - no per-page fetch, no local cache.
  const personDetail = useBuyerAuthStore((state) => state.personDetail);
  const loading = useBuyerAuthStore((state) => state.personDetailLoading);
  const setPersonDetail = useBuyerAuthStore((state) => state.setPersonDetail);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (updates: PersonDetailUpdate) => {
    setSaving(true);
    setError(null);

    const result = await updatePersonDetail(updates);

    if (isErrorResponse(result)) {
      setError(result.message || 'Failed to update profile.');
      setSaving(false);
      return;
    }

    setPersonDetail(result);
    setSaving(false);
  };

  return (
    <Header>
      <ProfileView
        personDetail={personDetail as unknown as PersonDetail | null}
        loading={loading}
        saving={saving}
        error={error}
        onSave={handleSave}
        onBack={() => navigate('/dashboard')}
      />
    </Header>
  );
};

export default BuyerProfilePage;