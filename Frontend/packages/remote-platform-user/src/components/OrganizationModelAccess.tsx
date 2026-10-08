import React, { useEffect, useState } from 'react';
import { FaCube, FaCheck, FaSave } from 'react-icons/fa';
import { getAllModels, updateOrganizationModels } from '../api/modelApi';
import type { ModelDto } from '../api/modelApi';
import { isErrorResponse } from '@vosox/shared-ui';
import './OrganizationModelAccess.css';

interface OrganizationModelAccessProps {
  organizationId: string;
  assignedModels: ModelDto[];
  onAccessUpdated?: () => void;
}

const OrganizationModelAccess: React.FC<OrganizationModelAccessProps> = ({
  organizationId,
  assignedModels,
  onAccessUpdated,
}) => {
  const [allModels, setAllModels] = useState<ModelDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(assignedModels.map((m) => m.id))
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      const result = await getAllModels();
      if (cancelled) return;
      if (isErrorResponse(result)) {
        setError(result.message || 'Failed to load models');
      } else {
        setAllModels(result);
      }
      setIsLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedIds(new Set(assignedModels.map((m) => m.id)));
    setIsDirty(false);
  }, [assignedModels]);

  const toggleModel = (modelId: string) => {
    setSaveSuccess(false);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const result = await updateOrganizationModels({
        organizationId,
        modelIds: Array.from(selectedIds),
      });

      if (isErrorResponse(result)) {
        setSaveError(result.message || 'Failed to update model access');
        return;
      }

      if (result === true) {
        setSaveSuccess(true);
        setIsDirty(false);
        onAccessUpdated?.();
      } else {
        setSaveError('Failed to update model access');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="cp-section-box oma-root">
        <div className="oma-state" role="status" aria-live="polite">
          <span className="sila-spinner" aria-hidden="true" />
          <span className="cp-empty-inline">Loading models...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-section-box oma-root">
        <div className="sila-alert sila-alert--danger cp-modal-error" role="alert">{error}</div>
      </div>
    );
  }

  return (
    <div className="cp-section-box oma-root">
      <div className="oma-stack">
        {saveError && (
          <div className="sila-alert sila-alert--danger cp-modal-error" role="alert">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="sila-alert sila-alert--success oma-success-banner" role="status">
            Model access updated successfully.
          </div>
        )}

        {allModels.length === 0 ? (
          <p className="cp-empty-inline oma-empty">No models available.</p>
        ) : (
          <div className="oma-grid" role="group" aria-label="Model access">
            {allModels.map((model) => {
              const checked = selectedIds.has(model.id);
              return (
                <label
                  key={model.id}
                  className={`oma-card${checked ? ' oma-card-checked' : ''}`}
                  htmlFor={`model-${model.id}`}
                >
                  <div className="oma-card-icon" aria-hidden="true">
                    <FaCube />
                  </div>
                  <div className="oma-card-body">
                    <div className="oma-card-name">{model.modelName}</div>
                  </div>
                  <input
                    id={`model-${model.id}`}
                    type="checkbox"
                    className="oma-checkbox"
                    checked={checked}
                    onChange={() => toggleModel(model.id)}
                  />
                  {checked && (
                    <span className="oma-check-badge" aria-hidden="true">
                      <FaCheck />
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <div className="oma-actions">
          <span className="oma-count">
            {selectedIds.size} of {allModels.length} selected
          </span>
          <button
            type="button"
            className="sila-btn sila-btn--primary"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            aria-busy={isSaving || undefined}
          >
            {isSaving ? (
              <>
                <span className="sila-spinner" aria-hidden="true" /> Saving...
              </>
            ) : (
              <>
                <FaSave aria-hidden="true" /> Save Access
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrganizationModelAccess;