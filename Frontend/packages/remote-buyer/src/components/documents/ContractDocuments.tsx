import React, { useCallback, useState } from "react";
import { StatusBadge, toastService } from "@vosox/shared-ui";
import { fetchContracts, formatContractDate, type ContractAttachment, type ContractRecord } from "../../../../remote-platform-user/src/components/Contract/contractApi";
import { downloadBuyerAsset } from "../../../../remote-platform-user/src/api/platformApi";
import type { SilaPage } from "../../api/silaMe/silaReceivingApi";
import PagedListBody from "../silaMe/receiving/PagedListBody";
import { usePagedList } from "../silaMe/receiving/usePagedList";
import { openBlob } from "../silaMe/receiving/receivingFormat";

/** The stored asset (base64) as a Blob. */
const toBlob = (base64: string, contentType: string): Blob => {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let index = 0; index < bytes.length; index += 1) buffer[index] = bytes.charCodeAt(index);
  return new Blob([buffer], { type: contentType || "application/octet-stream" });
};

/** The organization's contracts (newest first) with the files attached to each; a file opens in a new tab. */
const ContractDocuments: React.FC = () => {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const load = useCallback((page: SilaPage) => fetchContracts(page.index, page.limit), []);
  const list = usePagedList<ContractRecord>(load, "Could not load the contracts.");

  const openAttachment = async (attachment: ContractAttachment) => {
    setOpeningId(attachment.id);
    try {
      const asset = await downloadBuyerAsset(attachment.assetId);
      if (!asset?.fileBytes) throw new Error("The file is empty or no longer available.");
      openBlob(toBlob(asset.fileBytes, asset.contentType));
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not open the attachment.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <PagedListBody list={list} noun="contracts" emptyTitle="No contracts yet">
      <div className="sila-table-wrap">
        <table className="sila-table">
          <thead>
            <tr>
              <th scope="col">Contract</th>
              <th scope="col">RFQ</th>
              <th scope="col">Created</th>
              <th scope="col">Status</th>
              <th scope="col">Attachments</th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((contract) => (
              <tr key={contract.id}>
                <td className="sila-cell-strong">
                  <span className="sila-ref">{contract.contractNumber}</span> {contract.contractName}
                </td>
                <td>{contract.rfqNumber || "—"}</td>
                <td>{formatContractDate(contract.dateCreated)}</td>
                <td><StatusBadge status={contract.status} size="sm" /></td>
                <td>
                  {(contract.attachments ?? []).length === 0 ? (
                    <span className="doc-muted">No attachments</span>
                  ) : (
                    <div className="doc-attachments">
                      {(contract.attachments ?? []).map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          className="sila-btn sila-btn--secondary sila-btn--sm"
                          disabled={openingId === attachment.id}
                          aria-label={`Open ${attachment.fileName}`}
                          onClick={() => openAttachment(attachment)}
                        >
                          {openingId === attachment.id ? "Opening..." : attachment.fileName}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PagedListBody>
  );
};

export default ContractDocuments;
