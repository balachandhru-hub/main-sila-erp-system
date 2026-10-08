import React, { useState } from "react";
import { EmptyState, Loader, toastService } from "@vosox/shared-ui";
import { deletePosSource, type SilaPosSource } from "../../../api/silaMe/silaPosMasterApi";
import SilaPosSourceForm from "./SilaPosSourceForm";
import { SilaPosConfirm, type SilaPosSourceTabProps } from "./SilaPosShared";
import { errorText, posLabel } from "./posFormat";

type Dialog = { kind: "edit"; source: SilaPosSource | null } | { kind: "delete"; source: SilaPosSource };

/** POS sources: the POS systems the sales come from; one is the default for uploads and API pulls. */
const SilaPosSources: React.FC<SilaPosSourceTabProps> = ({ sources, sourcesLoading, sourcesError, onReloadSources, canManage }) => {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (source: SilaPosSource) => {
    setDeleting(true);
    try {
      await deletePosSource(source.id);
      toastService.success(`POS source ${source.name} deleted.`);
      setDialog(null);
      onReloadSources();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not delete the POS source."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="srec-stack">
      {canManage && (
        <div className="srec-actions spos-toolbar">
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setDialog({ kind: "edit", source: null })}>
            New POS source
          </button>
        </div>
      )}

      {sourcesLoading ? (
        <Loader size={24} message="Loading POS sources..." />
      ) : sourcesError ? (
        <EmptyState
          variant="error"
          title="Couldn't load the POS sources"
          description={sourcesError}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={onReloadSources}>Try again</button>}
        />
      ) : sources.length === 0 ? (
        <EmptyState title="No POS source yet" description="Without a source, sales match outlets by location code and recipes by POS code." />
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">POS system</th>
                <th scope="col">Integration</th>
                <th scope="col" className="srec-num">Outlet mappings</th>
                <th scope="col" className="srec-num">Item mappings</th>
                <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td>
                    <span className="sila-cell-strong">{source.name}</span>
                    {source.isDefault && <span className="sila-badge sila-badge--info sila-badge--sm spos-inline-badge">Default</span>}
                  </td>
                  <td>{posLabel(source.posSystem)}</td>
                  <td>{posLabel(source.integrationKind)}</td>
                  <td className="srec-num">{source.outletMappingCount}</td>
                  <td className="srec-num">{source.itemMappingCount}</td>
                  <td>
                    {canManage && (
                      <div className="srec-actions">
                        <button
                          type="button"
                          className="sila-btn sila-btn--secondary sila-btn--sm"
                          aria-label={`Edit POS source ${source.name}`}
                          onClick={() => setDialog({ kind: "edit", source })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="sila-btn sila-btn--ghost sila-btn--sm"
                          aria-label={`Delete POS source ${source.name}`}
                          onClick={() => setDialog({ kind: "delete", source })}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === "edit" && (
        <SilaPosSourceForm
          source={dialog.source}
          isFirst={sources.length === 0}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onReloadSources();
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <SilaPosConfirm
          heading="Delete POS source"
          content={`Delete ${dialog.source.name}?`}
          description="Its outlet and item mappings are removed too. Received sales are kept."
          confirmText="Delete"
          busy={deleting}
          onConfirm={() => handleDelete(dialog.source)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default SilaPosSources;
