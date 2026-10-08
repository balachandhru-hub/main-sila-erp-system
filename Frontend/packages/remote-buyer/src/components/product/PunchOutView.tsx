import React from "react";
import { ChevronLeftIcon, ExternalLinkIcon } from "@vosox/shared-ui";

interface PunchOutViewProps {
  catalogName: string;
  previewUrl: string;
  iframeBlocked: boolean;
  onIframeError: () => void;
  onBack: () => void;
}

/** Full-page PunchOut catalog preview, opened from a product's detail view. */
const PunchOutView: React.FC<PunchOutViewProps> = ({ catalogName, previewUrl, iframeBlocked, onIframeError, onBack }) => (
  <div className="pud-product-page">
    <div className="pud-catalog-fullview-header">
      <div>
        <button type="button" className="pud-btn pud-btn-outline" onClick={onBack}>
          <ChevronLeftIcon /> Back to {catalogName}
        </button>
      </div>
      <div className="pud-catalog-fullview-actions">
        <span className="pud-modal-badge">
          <ExternalLinkIcon /> PunchOut Catalog
        </span>
      </div>
    </div>

    <div className="pud-punchout-fullpage-body">
      <h1 className="pud-title">{catalogName}</h1>

      <div className="pud-punchout-fullpage-viewer">
        {iframeBlocked ? (
          <div className="pud-product-embed-blocked">
            <div className="pud-product-embed-blocked-text">
              <p className="pud-product-embed-blocked-title">Website Cannot Be Embedded</p>
              <p className="pud-product-embed-blocked-desc">
                This website has restricted embedding for security reasons.
              </p>
            </div>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pud-btn pud-btn-message"
            >
              <ExternalLinkIcon /> Open in New Tab
            </a>
          </div>
        ) : (
          <iframe
            src={previewUrl}
            className="pud-product-embed-frame"
            title="PunchOut Catalog"
            onError={onIframeError}
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock"
          />
        )}
      </div>
    </div>
  </div>
);

export default PunchOutView;
