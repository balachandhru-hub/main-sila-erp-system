import React from "react";
import { EmptyState, Loader, Modal } from "@vosox/shared-ui";
import type { SilaPosSource } from "../../../api/silaMe/silaPosMasterApi";

/** What the POS tabs receive from SilaPosIntegration. */
export interface SilaPosSourceTabProps {
  sources: SilaPosSource[];
  sourcesLoading: boolean;
  sourcesError: string | null;
  onReloadSources: () => void;
  canManage: boolean;
}

interface SourceGateProps extends SilaPosSourceTabProps {
  /** What the tab is about, e.g. "outlet mappings". */
  subject: string;
  children: React.ReactNode;
}

/** Loading / error / "create a source first" states shared by the mapping tabs. */
export const SilaPosSourceGate: React.FC<SourceGateProps> = ({ sources, sourcesLoading, sourcesError, onReloadSources, subject, children }) => {
  if (sourcesLoading) return <Loader size={24} message="Loading POS sources..." />;
  if (sourcesError) {
    return (
      <EmptyState
        variant="error"
        title="Couldn't load the POS sources"
        description={sourcesError}
        action={<button type="button" className="sila-btn sila-btn--secondary" onClick={onReloadSources}>Try again</button>}
      />
    );
  }
  if (sources.length === 0) return <EmptyState title="No POS source yet" description={`Create a POS source on the Sources tab to manage its ${subject}.`} />;
  return <>{children}</>;
};

interface SourceSelectProps {
  id: string;
  sources: SilaPosSource[];
  value: string;
  onChange: (sourceId: string) => void;
  /** Adds a "Default source" option with an empty value. */
  allowDefault?: boolean;
}

export const SilaPosSourceSelect: React.FC<SourceSelectProps> = ({ id, sources, value, onChange, allowDefault }) => (
  <div className="sila-field">
    <label className="sila-label" htmlFor={id}>POS source</label>
    <select id={id} className="sila-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {allowDefault && <option value="">Default source</option>}
      {sources.map((source) => (
        <option key={source.id} value={source.id}>
          {source.name}{source.isDefault ? " (default)" : ""}
        </option>
      ))}
    </select>
  </div>
);

/** The default source, else the first one, else "". */
export const defaultSourceId = (sources: SilaPosSource[]): string => (sources.find((source) => source.isDefault) ?? sources[0])?.id ?? "";

interface ConfirmProps {
  heading: string;
  content: string;
  description?: string;
  confirmText: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation of a destructive action. */
export const SilaPosConfirm: React.FC<ConfirmProps> = ({ heading, content, description, confirmText, busy, onConfirm, onClose }) => (
  <Modal
    isOpen
    onClose={onClose}
    variant="danger"
    size="sm"
    headerProps={{ heading }}
    bodyProps={{ content, contentDescription: description }}
    footerProps={{
      secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: busy },
      primaryButton: { text: confirmText, onClick: onConfirm, loading: busy },
    }}
  />
);
