import React from "react";
import { Loader } from "@vosox/shared-ui";
import { useAttention } from "./useAttention";
import { formatCount } from "./attentionSources";
import { buildSuggestedActions, type BucketRole } from "./suggestedActions";
import "./attention.css";

interface NeedsAttentionPanelProps {
  currentUserId: string | null;
  /** The organization has the SILA ME add-on: recipe approvals, alerts and invoices are checked too. */
  hasSilaMe: boolean;
  /** How the user works with the weekly bucket; decides the suggested bucket action. */
  bucketRole: BucketRole;
  onNavigate: (navKey: string) => void;
}

const severityClass = (severity: string): string => {
  const key = severity.toUpperCase();
  if (key === "CRITICAL" || key === "HIGH") return "sila-badge sila-badge--danger sila-badge--sm";
  if (key === "MEDIUM") return "sila-badge sila-badge--warning sila-badge--sm";
  return "sila-badge sila-badge--info sila-badge--sm";
};

/** "Needs your attention": approvals waiting for the user, SILA ME alerts and suggested next actions. */
const NeedsAttentionPanel: React.FC<NeedsAttentionPanelProps> = ({ currentUserId, hasSilaMe, bucketRole, onNavigate }) => {
  const attention = useAttention({ currentUserId, hasSilaMe });
  const actions = buildSuggestedActions({
    buckets: attention.buckets,
    bucketRole,
    invoicesToReview: attention.invoicesToReview,
    hasSilaMe,
  });

  return (
    <section className="sila-card nya-panel" aria-labelledby="nya-title">
      <div className="sila-card-header">
        <div>
          <h2 className="sila-card-title" id="nya-title">Needs your attention</h2>
          <p className="sila-card-subtitle">Approvals waiting for you, alerts and what to do next</p>
        </div>
        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={attention.reload} disabled={attention.loading}>
          Refresh
        </button>
      </div>
      <div className="sila-card-body">
        {attention.loading ? (
          <Loader size={24} message="Checking what needs your attention..." />
        ) : (
          <div className="nya-columns">
            <div className="nya-column">
              <h3 className="nya-heading">Pending approvals</h3>
              {attention.approvals.length === 0 ? (
                <p className="nya-empty">Nothing is waiting for your approval.</p>
              ) : (
                <ul className="nya-list">
                  {attention.approvals.map((approval) => (
                    <li key={approval.navKey}>
                      <button type="button" className="nya-item" onClick={() => onNavigate(approval.navKey)}>
                        <span className="nya-item-label">{approval.label}</span>
                        <span className="sila-badge sila-badge--warning">{formatCount(approval.count)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {hasSilaMe && (
              <div className="nya-column">
                <h3 className="nya-heading">Alerts</h3>
                {attention.alerts.length === 0 ? (
                  <p className="nya-empty">No open SILA ME alerts.</p>
                ) : (
                  <ul className="nya-list">
                    {attention.alerts.slice(0, 3).map((alert) => (
                      <li key={alert.id}>
                        <button type="button" className="nya-item nya-item--stacked" onClick={() => onNavigate("silaAlerts")}>
                          <span className="nya-item-row">
                            <span className={severityClass(alert.severity)}>{alert.severity}</span>
                            <span className="nya-item-label">{alert.title}</span>
                          </span>
                          {alert.locationName && <span className="nya-item-note">{alert.locationName}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => onNavigate("silaAlerts")}>
                  View all alerts
                </button>
              </div>
            )}

            <div className="nya-column">
              <h3 className="nya-heading">Suggested next actions</h3>
              <ul className="nya-list">
                {actions.map((action) => (
                  <li key={action.id}>
                    <button type="button" className="nya-item nya-item--stacked" onClick={() => onNavigate(action.navKey)}>
                      <span className="nya-item-label">{action.label}</span>
                      <span className="nya-item-note">{action.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {!attention.loading && attention.failed.length > 0 && (
          <p className="nya-failed" role="status">
            Could not check {attention.failed.join(", ")}.{" "}
            <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={attention.reload}>Try again</button>
          </p>
        )}
      </div>
    </section>
  );
};

export default NeedsAttentionPanel;
