import React, { useEffect, useState } from 'react';
import readXlsxFile from 'read-excel-file/browser';
import type { Sheet } from 'read-excel-file/browser';
import { EmptyState, Loader, toastService } from '@vosox/shared-ui';
import type {
  PendingMaterialApproval,
  MaterialApprovalDetail as MaterialApprovalDetailDto,
} from './materialApi';
import {
  fetchMaterialApprovalDetail,
  submitMaterialApprovalAction,
  classifyStatusText,
  MATERIAL_APPROVAL_STATUS,
} from './materialApi';
import MaterialApprovalCard from './MaterialApprovalCard';
import { ExcelSheetGrid, loadMaterialAssetFile, saveLoadedAssetFile } from './MaterialAssetFile';
import { MaterialStatusBadge } from './MaterialTable';
import './MaterialApproval.css';

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

interface MaterialApprovalDetailProps {
  material: PendingMaterialApproval;
  currentUserId: string | null;
  onBack: () => void;
  onApprovalSubmitted: () => void;
}

const InfoField: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="matap-info-field">
    <dt className="matap-info-label">{label}</dt>
    <dd className="matap-info-value">{value || '—'}</dd>
  </div>
);

const MaterialApprovalDetail: React.FC<MaterialApprovalDetailProps> = ({
  material,
  currentUserId,
  onBack,
  onApprovalSubmitted,
}) => {
  const [detail, setDetail] = useState<MaterialApprovalDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Bulk approvals have no material code/info; they're identified by an uploaded Excel file.
  const bulkAsset = detail?.asset ?? material.asset;
  const isBulk = material.uploadType === 'EXCEL' || !!bulkAsset;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    fetchMaterialApprovalDetail(material.predefinedMaterialId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load material approval details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [material.predefinedMaterialId]);

  useEffect(() => {
    setSheets([]);
    if (!bulkAsset) return;
    let cancelled = false;
    setLoadingItems(true);
    loadMaterialAssetFile(bulkAsset, 'Unable to load the uploaded items.')
      .then(async (file) => {
        if (!file) return;
        URL.revokeObjectURL(file.url);
        const parsed = await readXlsxFile(file.blob);
        if (!cancelled) setSheets(parsed);
      })
      .catch(() => toastService.error('Unable to read the uploaded Excel file.'))
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => { cancelled = true; };
  }, [bulkAsset?.id]);

  const handleDownload = async () => {
    if (!bulkAsset) return;
    setDownloading(true);
    const file = await loadMaterialAssetFile(bulkAsset, 'Unable to download document.');
    setDownloading(false);
    if (file) saveLoadedAssetFile(file);
  };

  const handleDecision = async (action: 'APPROVE' | 'REJECT', comment: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const status = action === 'APPROVE' ? MATERIAL_APPROVAL_STATUS.APPROVE : MATERIAL_APPROVAL_STATUS.REJECT;
      await submitMaterialApprovalAction(material.predefinedMaterialId, { status, comment });
      toastService.success(action === 'APPROVE' ? 'Material approved successfully.' : 'Material rejected.');
      onApprovalSubmitted();
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to submit your decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const overallTone = detail ? classifyStatusText(detail.status) : 'neutral';
  const isDecided = overallTone === 'approved' || overallTone === 'rejected';

  const approvers = [...(detail?.approvalUsers || [])].sort((a, b) => a.order - b.order);
  const approvedCount = approvers.filter((a) => classifyStatusText(a.status) === 'approved').length;

  return (
    <div className="matap-detail">
      <div className="matap-detail-header">
        <button
          type="button"
          className="sila-btn sila-btn--secondary sila-btn--icon matap-detail-close"
          onClick={onBack}
          aria-label="Back to list"
          title="Back to list"
        >
          <IconBack />
        </button>
        <div className="matap-detail-heading">
          {!isBulk && <span className="sila-ref matap-detail-ref-badge">{material.materialCode}</span>}
          <div className="matap-detail-title-row">
            <h2 className="matap-detail-title">
              {isBulk
                ? detail?.title || material.title || 'Bulk Material Approval'
                : material.description || material.title || 'Material Approval'}
            </h2>
            {detail && <MaterialStatusBadge value={detail.status} />}
          </div>
          {!isBulk && (
            <div className="matap-detail-meta">
              <span>{material.productType}</span>
              <span className="matap-detail-dot" aria-hidden="true">•</span>
              <span>{material.materialGroup}</span>
            </div>
          )}
        </div>
      </div>

      <div className="matap-detail-body">
        {loading ? (
          <Loader size={28} message="Loading material approval details..." />
        ) : error && !detail ? (
          <EmptyState variant="error" title="Couldn't load this approval" description={error} />
        ) : detail ? (
          <div className="matap-detail-stack">
            {isBulk ? (
              <section>
                <div className="matap-items-header">
                  <h3 className="matap-section-title">Items</h3>
                  {bulkAsset && (
                    <button
                      type="button"
                      className="sila-btn sila-btn--secondary sila-btn--sm"
                      disabled={downloading}
                      onClick={() => void handleDownload()}
                    >
                      {downloading ? 'Downloading…' : 'Download'}
                    </button>
                  )}
                </div>
                {loadingItems ? (
                  <Loader size={24} message="Loading items..." />
                ) : sheets.length > 0 ? (
                  <ExcelSheetGrid sheets={sheets} />
                ) : (
                  <EmptyState title="No items to display." />
                )}
              </section>
            ) : (
            <section>
              <h3 className="matap-section-title">Material Information</h3>
              <dl className="matap-info-grid">
                <InfoField label="Base UoM" value={detail.baseUnitOfMeasure} />
                <InfoField label="Order UoM" value={detail.orderUnitOfMeasure} />
                <InfoField label="Alternate UoM" value={detail.alternateUnitOfMeasure} />
                <InfoField label="Valuation Class" value={detail.valuationClass} />
                <InfoField label="UoM Mapping" value={detail.unitOfMeasureMapping} />
                <InfoField label="Sub Unit" value={detail.subUnit} />
                <InfoField label="Micro Unit" value={detail.microUnit} />
                <InfoField label="Status" value={detail.status ? <MaterialStatusBadge value={detail.status} /> : null} />
              </dl>
            </section>
            )}

            <section>
              <h3 className="matap-section-title">
                Approval Chain
                {approvers.length > 0 && (
                  <span className="matap-section-count">
                    {approvedCount} of {approvers.length} approved
                  </span>
                )}
              </h3>

              {approvers.length === 0 ? (
                <EmptyState title="No approvers assigned to this material yet." />
              ) : (
                <div className="matap-strip" role="list">
                  {approvers.map((approver, idx) => {
                    const cardTone = classifyStatusText(approver.status);
                    return (
                      <React.Fragment key={approver.userId}>
                        <MaterialApprovalCard
                          approverName={approver.userName}
                          approverEmail={approver.email}
                          position={approver.order}
                          isCurrentUser={!!currentUserId && approver.userId === currentUserId}
                          canAct={!!currentUserId && approver.userId === currentUserId && !isDecided && cardTone === 'pending'}
                          submitting={submitting}
                          onDecision={handleDecision}
                          statusTone={cardTone}
                        />
                        {idx < approvers.length - 1 && (
                          <span className={`matap-connector${cardTone === 'approved' ? ' matap-connector-done' : ''}`} aria-hidden="true">
                            <IconArrow />
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>

      <div className="matap-detail-footer">
        <button type="button" className="sila-btn sila-btn--secondary" onClick={onBack}>
          Back to list
        </button>
      </div>
    </div>
  );
};

export default MaterialApprovalDetail;
