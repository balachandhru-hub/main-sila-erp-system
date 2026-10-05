import React, { useEffect, useState } from 'react';
import { FaArrowRight, FaCube } from 'react-icons/fa';
import { getMyOrganizationModels } from '../api/modelApi';
import type { ModelDto } from '../api/modelApi';
import { EmptyState, Loader, isErrorResponse } from '@vosox/shared-ui';
import './Models.css';

interface ModelsProps {
  /** Opens a model inside the application. Returns false when the model has no screens here yet. */
  onOpenModel?: (model: ModelDto) => boolean;
}

const Models: React.FC<ModelsProps> = ({ onOpenModel }) => {
  const [models, setModels] = useState<ModelDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getMyOrganizationModels();
        if (cancelled) return;

        if (isErrorResponse(result)) {
          setError(result.message || 'Failed to load add-ons');
          return;
        }
        setModels(result);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load add-ons');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpen = (model: ModelDto) => {
    if (onOpenModel?.(model)) return;
    window.alert(`"${model.modelName}" is not available to launch yet. Please check back soon.`);
  };

  return (
    <>
      <h1 className="pud-title">Add-ons</h1>
      <p className="pud-subtitle">Add-ons your organization currently has access to.</p>

      {isLoading ? (
        <div className="models-loading-wrapper">
          <Loader size={28} message="Loading add-ons..." />
        </div>
      ) : error ? (
        <EmptyState className="models-message models-message-error" variant="error" title={error} />
      ) : models.length === 0 ? (
        <EmptyState
          className="models-message models-message-empty"
          icon={<FaCube aria-hidden="true" />}
          title="No add-ons have been assigned to your organization yet."
          description="Contact your administrator for access."
        />
      ) : (
        <div className="models-grid">
          {models.map((model) => (
            <div className="models-card" key={model.id}>
              <div className="models-card-icon" aria-hidden="true">
                <FaCube />
              </div>
              <div className="models-card-body">
                <div className="models-card-title">{model.modelName}</div>
              </div>
              <div className="models-card-footer">
                <button
                  type="button"
                  className="models-open-btn"
                  onClick={() => handleOpen(model)}
                  aria-label={`Open ${model.modelName}`}
                >
                  Open
                  <FaArrowRight aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default Models;