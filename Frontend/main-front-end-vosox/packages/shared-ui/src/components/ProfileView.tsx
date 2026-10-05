import React, { useState, useEffect } from 'react';
import type { PersonDetail, PersonDetailUpdate } from '../types/profile';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';
import './ProfileView.css';

interface ProfileViewProps {
  personDetail: PersonDetail | null;
  loading: boolean;
  saving?: boolean;
  error?: string | null;
  onSave: (updates: PersonDetailUpdate) => Promise<void> | void;
  onBack: () => void;
}
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconMail = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const IconPhone = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const IconAt = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-5.5 8.28" />
  </svg>
);

const IconMapPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </svg>
);

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const EDITABLE_FIELDS: { key: keyof PersonDetail; label: string; icon: React.ReactNode }[] = [
  { key: 'name', label: 'Full Name', icon: <IconUser /> },
  { key: 'email', label: 'Email address', icon: <IconMail /> },
  { key: 'phone', label: 'Phone', icon: <IconPhone /> },
  { key: 'userName', label: 'Username', icon: <IconAt /> },
  { key: 'addressLine', label: 'Address', icon: <IconMapPin /> },
  { key: 'country', label: 'Country', icon: <IconGlobe /> },
];

export const ProfileView: React.FC<ProfileViewProps> = ({
  personDetail,
  loading,
  saving = false,
  error,
  onSave,
  onBack,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PersonDetailUpdate>({});

  useEffect(() => {
    if (personDetail) {
      const { personId, userId, organizationId, roleId, roleName, ...editable } = personDetail;
      setFormData(editable);
    }
  }, [personDetail]);

  const handleChange = (key: keyof PersonDetail, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditClick = () => setIsEditing(true);

  const handleCancel = () => {
    if (personDetail) {
      const { personId, userId, organizationId, roleId, roleName, ...editable } = personDetail;
      setFormData(editable);
    }
    setIsEditing(false);
  };

  const handleUpdate = async () => {
    await onSave(formData);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="profile-page-loading" role="status" aria-live="polite">
          <span className="sila-visually-hidden">Loading profile…</span>
          <div className="profile-skeleton-head">
            <Skeleton width={48} height={48} radius="50%" />
            <div className="profile-skeleton-lines">
              <Skeleton width={180} height={18} />
              <Skeleton width={96} height={12} />
            </div>
          </div>
          <div className="sila-card profile-section-card">
            <div className="profile-fields-grid">
              {EDITABLE_FIELDS.map(({ key }) => (
                <div className="profile-field" key={key}>
                  <Skeleton width={90} height={10} />
                  <Skeleton width="80%" height={14} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-page">
        <div className="sila-card profile-page-error">
          <EmptyState
            variant="error"
            title={error}
            action={
              <Button variant="secondary" size="sm" onClick={onBack}>
                <IconBack />
                Back
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!personDetail) {
    return null;
  }

  const initial = personDetail.name ? personDetail.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="profile-page">
      <div className="sila-page-header profile-header">
        <div className="sila-page-header-main profile-banner-name">
          <button
            className="sila-btn sila-btn--secondary sila-btn--icon sila-btn--sm profile-back-btn"
            onClick={onBack}
            type="button"
            aria-label="Back"
            title="Back"
          >
            <IconBack />
          </button>
          <div className="profile-avatar" aria-hidden="true">{initial}</div>
          <div className="profile-hero-text">
            <div className="sila-page-title-row">
              <h1 className="sila-page-title profile-hero-name">{personDetail.name}</h1>
              {personDetail.roleName && (
                <span className="sila-badge sila-badge--info profile-role-pill">{personDetail.roleName}</span>
              )}
            </div>
            {(personDetail.organizationName || personDetail.email) && (
              <p className="sila-page-description profile-hero-sub">
                {[personDetail.organizationName, personDetail.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="sila-card profile-section-card" aria-labelledby="profile-section-title">
        <div className="sila-card-header profile-section-header">
          <div>
            <h2 className="sila-card-title" id="profile-section-title">Personal Information</h2>
            <p className="sila-card-subtitle">Manage your name, contact details, and account identifiers.</p>
          </div>
          {!isEditing && (
            <Button variant="secondary" size="sm" className="profile-edit-btn" onClick={handleEditClick}>
              <IconEdit />
              Edit
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="profile-fields-grid">
            {EDITABLE_FIELDS.map(({ key, label }) => {
              const inputId = `profile-field-${key}`;
              return (
                <div className="profile-field is-editing" key={key}>
                  <label className="sila-label" htmlFor={inputId}>{label}</label>
                  <input
                    id={inputId}
                    className="sila-input"
                    type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
                    value={(formData[key as keyof PersonDetailUpdate] as string) ?? ''}
                    onChange={(e) => handleChange(key, e.target.value)}
                    disabled={saving}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <dl className="profile-fields-grid">
            {EDITABLE_FIELDS.map(({ key, label, icon }) => {
              const val = formData[key as keyof PersonDetailUpdate] as string | undefined;
              return (
                <div className="profile-field" key={key}>
                  <dt className="profile-field-label">
                    <span className="profile-field-icon" aria-hidden="true">{icon}</span>
                    {label}
                  </dt>
                  <dd className={`profile-field-value${val ? '' : ' profile-field-value--empty'}`}>{val || '—'}</dd>
                </div>
              );
            })}
          </dl>
        )}

        {isEditing && (
          <div className="sila-card-footer profile-edit-actions">
            <Button variant="secondary" className="profile-cancel-btn" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" className="profile-update-btn" onClick={handleUpdate} loading={saving}>
              {saving ? 'Updating…' : 'Update'}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};
