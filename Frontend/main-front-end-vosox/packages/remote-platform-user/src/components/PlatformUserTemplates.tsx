import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';
import { getAllBuyers } from '../api/platformApi';
import { EmptyState } from '@vosox/shared-ui';
import UserTemplate from './UserTemplate';
import './PlatformUserTemplates.css';

const sila_logo = `${window.location.protocol}//${window.location.host}/assets/SILA_Logo.png`;

export const PlatformUserTemplates: React.FC = () => {
  const navigate = useNavigate();

  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [buyersError, setBuyersError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBuyers = async () => {
      try {
        const data = await getAllBuyers({ index: 0, limit: 1000 });

        const resolved = Array.isArray(data)
          ? data
          : (data as any)?.buyers || (data as any)?.data || [];

        if (resolved.length > 0) {
          const first = resolved[0] as any;

          const buyerId = first.buyerId || first.id;
          const orgId = first.organizationId || first.id;

          if (buyerId && orgId) {
            setSelectedBuyerId(orgId);
          }
        }
      } catch (err: any) {
        setBuyersError(err.message || 'Failed to load buyers.');
      } finally {
        setLoadingBuyers(false);
      }
    };

    fetchBuyers();
  }, []);

  const handleClose = () => {
    navigate('../settings');
  };

  return (
    <div className="put-page">
      <header className="put-header">
        <img
          className="put-logo"
          src={sila_logo}
          alt="SILA"
        />
      </header>

      <main className="put-main">
        <div className="put-content-wrapper">
          <div className="put-page-header">
            <div className="put-title-section">
              <p className="put-page-description">
                Manage verification templates for buyers
              </p>
            </div>

            <button
              type="button"
              className="put-close-btn sila-btn sila-btn--secondary sila-btn--icon"
              onClick={handleClose}
              title="Close"
              aria-label="Close"
            >
              <FaTimes aria-hidden="true" />
            </button>
          </div>

          <div className="put-template-area">
            {loadingBuyers ? (
              <div className="put-loading-container" role="status" aria-live="polite">
                <div className="put-loading-content">
                  <span className="put-loading-spinner sila-spinner sila-spinner--lg" aria-hidden="true" />

                  <span className="put-loading-text">
                    Loading templates...
                  </span>
                </div>
              </div>
            ) : buyersError ? (
              <div className="put-error-container">
                <EmptyState variant="error" title="Error" description={buyersError} />
              </div>
            ) : selectedBuyerId ? (
              <div className="put-template-container">
                <UserTemplate organizationId={selectedBuyerId} />
              </div>
            ) : (
              <div className="put-empty-container">
                <EmptyState title="No organization data available." />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PlatformUserTemplates;