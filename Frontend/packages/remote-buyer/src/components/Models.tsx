import React, { useEffect, useState } from 'react';
import { FaArrowRight, FaCube, FaChevronDown, FaChevronUp, FaBoxes, FaUtensils, FaTruck, FaShieldAlt, FaCogs, FaCheckCircle } from 'react-icons/fa';
import { getMyOrganizationModels } from '../api/modelApi';
import type { ModelDto } from '../api/modelApi';
import { EmptyState, Loader, isErrorResponse } from '@vosox/shared-ui';
import { SILA_ME_MODEL_KEY, buildSilaMeNavItem, type SilaMeRole } from './silaMe/silaMeNav';
import './Models.css';

interface ModelsProps {
  silaMeRole?: SilaMeRole | null;
  onNavigate?: (navKey: string) => void;
  /** Opens a model inside the application. Returns false when the model has no screens here yet. */
  onOpenModel?: (model: ModelDto) => boolean;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Inventory": <FaBoxes />,
  "Recipe Management": <FaUtensils />,
  "Receiving": <FaTruck />,
  "Control": <FaShieldAlt />,
  "Setup": <FaCogs />,
};

const Models: React.FC<ModelsProps> = ({ silaMeRole, onNavigate, onOpenModel }) => {
  const [models, setModels] = useState<ModelDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>({});

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

  const toggleExpand = (key: string) => {
    setExpandedModels((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpen = (model: ModelDto) => {
    if (onOpenModel?.(model)) return;
    window.alert(`"${model.modelName}" is not available to launch yet. Please check back soon.`);
  };

  const silaMeNavData = silaMeRole ? buildSilaMeNavItem(silaMeRole) : null;

  return (
    <div className="models-container">
      <div className="models-header">
        <h1 className="pud-title">Add-ons</h1>
        <p className="pud-subtitle">Add-ons and specialized industry modules your organization currently has access to.</p>
      </div>

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
          {models.map((model) => {
            const isSilaMe = model.key === SILA_ME_MODEL_KEY;
            const isExpanded = !!expandedModels[model.key];

            if (isSilaMe && silaMeNavData) {
              return (
                <div className="models-card models-card--expanded" key={model.id}>
                  <div className="models-card-top">
                    <div className="models-card-icon models-card-icon--sila" aria-hidden="true">
                      <FaUtensils />
                    </div>
                    <div className="models-card-body">
                      <div className="models-card-header-row">
                        <div className="models-card-title">{model.modelName}</div>
                        <span className="models-badge models-badge--active">
                          <FaCheckCircle className="models-badge-icon" /> Active Add-on
                        </span>
                      </div>
                      <p className="models-card-desc">
                        Full-suite hospitality management covering inventory control, recipe costing, stock movements, goods receiving & ERP integration.
                      </p>
                    </div>
                  </div>

                  <div className="models-card-actions">
                    <button
                      type="button"
                      className="models-secondary-btn"
                      onClick={() => toggleExpand(model.key)}
                    >
                      {isExpanded ? (
                        <>
                          Hide Modules <FaChevronUp />
                        </>
                      ) : (
                        <>
                          Open Modules <FaChevronDown />
                        </>
                      )}
                    </button>
                  </div>

                  {isExpanded && silaMeNavData.subItems && (
                    <div className="models-modules-panel">
                      <div className="models-modules-title">Available Module Screens & Functions</div>
                      <div className="models-sections-grid">
                        {silaMeNavData.subItems.map((group, groupIdx) => (
                          <div className="models-section-box" key={groupIdx}>
                            <div className="models-section-header">
                              <span className="models-section-icon">
                                {SECTION_ICONS[group.label] || <FaCube />}
                              </span>
                              <span className="models-section-label">{group.label}</span>
                            </div>
                            <div className="models-feature-chips">
                              {group.items.map((item) => (
                                <button
                                  type="button"
                                  key={item.key}
                                  className="models-chip-btn"
                                  onClick={() => onNavigate?.(item.key)}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div className="models-card" key={model.id}>
                <div className="models-card-top">
                  <div className="models-card-icon" aria-hidden="true">
                    <FaCube />
                  </div>
                  <div className="models-card-body">
                    <div className="models-card-title">{model.modelName}</div>
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Models;