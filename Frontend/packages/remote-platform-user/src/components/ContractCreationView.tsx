import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  fetchBuyerAsset,
  fetchBuyerRfqContractStatus,
  fetchBuyerContractById,
  createBuyerContract,
  finalizeBuyerContract,
  inviteSupplierForContract,
  type BuyerRfqContractRefDto,
  type CreateBuyerContractPayload,
  type BuyerContractApprovalUserStatusDto,
} from "../api/platformApi";
import { fetchReferenceList } from "../api/masterdataApi";
import { Button, ChatPanel, IconChatBubble, toastService, getStatusTone, StatusBadge, type ChatApiAdapter, type ChatParticipantProfile, type RfqChatHubParams } from "@vosox/shared-ui";
import silaLogo from "../../../shared-ui/src/assets/sila-logo.png";
import { DetailField } from "./ContractCreation/DetailField";
import { SignaturePad } from "./ContractCreation/SignaturePad";
import { fmtINR as fmtAmount, nowLabel, resolveMimeType, loadImageAsDataUrl, uint8ArrayToBase64 } from "./ContractCreation/contractFormatters";
import { buildMergedContractPdfBytes, resolveEffectiveSignDetails, type ContractPdfInput } from "./ContractCreation/contractPdf";
import "./ContractCreationView.css";

/** The parts of a created contract this screen shows, as returned by the buyer and supplier contract APIs. */
export interface ContractDetails {
  id?: string;
  /** Id the buyer's ERP returned for the executed contract (buyer contract API only). */
  erpContractId?: string | null;
  /** NOT_CONFIGURED, PENDING, SYNCED, FAILED or UNKNOWN (buyer contract API only). */
  erpSyncStatus?: string | null;
  contractName: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  /** The contract's approval chain, when one is configured - supplier signing waits for every entry to approve. */
  approvalUsers?: BuyerContractApprovalUserStatusDto[];
}

export interface RfqAssetAttachment {
  id: string;
  assetType?: string;
  assetName?: string;
  fileType?: string;
  fileName?: string;
}

export interface TermsConditionStatusEntry {
  termsAndCondition: boolean;
  supplierId: string;
  supplierName: string;
  attachments: RfqAssetAttachment[];
}

export interface EsignStatusEntry {
  supplierId: string;
  supplierName: string;
  attachments: RfqAssetAttachment[];
}

export interface ContractCreationViewProps {
  rfq: any;
  lineItems: any[];
  effectiveQuotations: any[];
  displaySuppliers?: any[];
  selections?: Record<string, string>;
  distinctSelected?: string[];
  getQuoteItemForRfqItem?: (quotation: any, rfqItem: any) => any | null;
  onBack: () => void;
  role?: "buyer" | "supplier";
  supplierId?: string;
  supplierName?: string;
  /** Logged-in buyer's display name, used as the default e-signature signer name. */
  buyerName?: string;
  /** Logged-in buyer's role/title, used as the default e-signature signer designation. */
  buyerDesignation?: string;
  onUploadSupplierTerms?: (payload: { rfqId: string; termsAndCondition: boolean; documents?: any[] }) => Promise<any>;
  onUploadSupplierEsign?: (rfqId: string, payload: {
    entityType?: string;
    entityId?: string;
    assetType?: string;
    fileBytes?: string;
    fileName?: string;
    contentType?: string;
    isSingletonAsset?: boolean;
    id?: string;
  }) => Promise<any>;
  onUploadBuyerEsign?: (rfqId: string, payload: {
    entityType?: string;
    entityId?: string;
    assetType?: string;
    fileBytes?: string;
    fileName?: string;
    contentType?: string;
    isSingletonAsset?: boolean;
    id?: string;
  }) => Promise<any>;
  /** Buyer: re-uploads the buyer's Terms & Conditions document via "Proposed Edits", after the supplier rejects it. */
  onUploadBuyerTerms?: (rfqId: string, document: {
    entityType?: string;
    entityId?: string;
    assetType?: string;
    fileBytes?: string;
    fileName?: string;
    contentType?: string;
    isSingletonAsset?: boolean;
    id?: string;
  }) => Promise<any>;
  /** Buyer sets a status (e.g. "APPROVE") on a supplier's terms & conditions, with an optional comment
   *  (required by the API on rejection, to tell the supplier why). Buyer role only. */
  onAcceptSupplierTerms?: (rfqId: string, supplierId: string, status: string, comment?: string) => Promise<any>;
  /** Supplier sets a status (e.g. "ACCEPTED") on the buyer's terms & conditions, with an optional comment
   *  (required by the API on rejection, to tell the buyer why). Supplier role only. */
  onAcceptBuyerTerms?: (rfqId: string, status: string, comment?: string) => Promise<any>;
  /** Fetches the latest per-supplier terms & conditions status/attachments for this RFQ. */
  fetchTermsConditions?: (rfqId: string) => Promise<TermsConditionStatusEntry[] | { statusCode: number }>;
  /** Fetches the latest per-supplier e-signature status/attachments for this RFQ. */
  fetchESigns?: (rfqId: string) => Promise<EsignStatusEntry[] | { statusCode: number }>;
  /** Supplier: loads the contract the buyer created (its id is the RFQ's contractId). */
  fetchContract?: (contractId: string) => Promise<ContractDetails | { statusCode: number; message?: string }>;
  /** Re-fetches this RFQ so eSignDocuments/supplierESigns (and other rfq-by-id fields) reflect a just-uploaded
   *  e-sign. Also used on mount for the buyer role, since the buyer's own signed status has no other live source
   *  (unlike the supplier's, which fetchESigns/fetchTermsConditions keep fresh) - the `rfq` prop passed in can be
   *  a snapshot taken well before the contract screen was opened. */
  refetchRfq?: (rfqId: string) => Promise<void>;
  /**
   * Chat, mirroring the RFQ Details page's chat trigger. Built by the caller (BidComparisonAwardView for
   * buyer, SupplierRfqQuotationSummary for supplier) since it needs that host's own message API and profile
   * store — this view never talks to either remote's API layer directly, same as the other supplier-side
   * callbacks above. Omitted entirely when a caller doesn't wire it in (chat trigger just doesn't render).
   */
  chatApi?: ChatApiAdapter;
  chatHubParams?: RfqChatHubParams;
  currentUserProfile?: ChatParticipantProfile | null;
  isLoadingCurrentUserProfile?: boolean;
}

export interface SignDetails {
  signerName: string;
  signerDesignation: string;
  signedAt: string;
  method: "e-sign" | "upload";
  fileName?: string;
  drawnSignatureUrl?: string;
}

interface ContractState {
  supplierId: string;
  contractNumber: string;
  itemIds: string[];
  startDate: string;
  endDate: string;
  dateError: boolean;
  step: "details" | "terms" | "sign" | "completed";
  sent: boolean;
  tcContent: string;
  tcEdited: boolean;
  tcLastUpdatedAt: string | null;
  tcEditorOpen: boolean;
  tcDraft: string;
  buyerFinalAccepted: boolean;
  supplierFinalAccepted: boolean;
  supplierFinalRejected?: boolean;
  /** Buyer: a Terms & Conditions document added through "Proposed Edits", sent with the contract. */
  buyerTcFile?: File | null;
  buyerSigned: boolean;
  supplierSigned: boolean;
  buyerSignDetails?: SignDetails | null;
  supplierSignDetails?: SignDetails | null;
  messages: Array<{ sender: string; text: string; time: string }>;
  draftMessage: string;
}

export const ContractCreationView: React.FC<ContractCreationViewProps> = ({
  rfq,
  lineItems,
  effectiveQuotations,
  displaySuppliers = [],
  selections = {},
  distinctSelected = [],
  getQuoteItemForRfqItem,
  onBack,
  role = "buyer",
  supplierId,
  supplierName,
  buyerName,
  buyerDesignation,
  onUploadSupplierTerms,
  onUploadSupplierEsign,
  onUploadBuyerEsign,
  onUploadBuyerTerms,
  onAcceptSupplierTerms,
  onAcceptBuyerTerms,
  fetchTermsConditions,
  fetchESigns,
  fetchContract,
  refetchRfq,
  chatApi,
  chatHubParams,
  currentUserProfile = null,
  isLoadingCurrentUserProfile = false,
}) => {
  const isSupplier = role === "supplier";
  const rfqId: string | undefined = rfq?.rfqId || rfq?.id || (rfq as any)?._id;

  // The RFQ's own currency (e.g. "INR", "USD"), as returned by rfq-by-id —
  // left blank (not defaulted to "INR") when the API doesn't return one,
  // since guessing a currency could mislead the buyer/supplier.
  const currency = rfq?.currency || "";
  const fmtINR = (val: number) => {
    const formatted = fmtAmount(val);
    return currency && formatted !== "—" ? `${formatted} ${currency}` : formatted;
  };

  // Preloaded once as a data URL so the executed-contract PDF can embed the SILA logo (jsPDF's addImage needs a
  // data URI, not a plain asset URL).
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadImageAsDataUrl(silaLogo)
      .then((dataUrl) => {
        if (!cancelled) setLogoDataUrl(dataUrl);
      })
      .catch(() => {
        // Non-fatal: the PDF is still generated without the logo.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Supplier role: the supplier's own Terms & Conditions and e-signature state, as returned by the supplier's rfq-by-id.
  // Read once so the accepted status, T&C documents and e-signature survive leaving and reopening the contract.
  const supplierHasOwnTc = isSupplier && (rfq as any)?.supplierTermsAndCondition === true;
  const supplierOwnTcDocs: RfqAssetAttachment[] = isSupplier ? (rfq as any)?.supplierTermsConditionDocuments || [] : [];
  // Supplier role: whether the buyer has approved the supplier's own uploaded T&C (supplierTermsAndConditionAccepted
  // on the supplier's rfq-by-id). The signing step still shows once the supplier has submitted their own terms,
  // but actually signing must wait for this to be "ACCEPTED" - see supplierSignBlockedByPendingTcApproval below.
  const supplierOwnTcApprovedByBuyer = isSupplier && (rfq as any)?.supplierTermsAndConditionAccepted === "ACCEPTED";
  // Supplier: uploaded their own T&C but the buyer hasn't approved it yet (still PENDING or REJECTED) - the
  // "Contract Signing" step still shows so both signature statuses are visible, but the actual sign actions
  // (E-Sign / Upload Signed Contract) must stay disabled until the buyer approves.
  const supplierSignBlockedByPendingTcApproval = supplierHasOwnTc && !supplierOwnTcApprovedByBuyer;
  const supplierHasSigned = isSupplier && ((rfq as any)?.eSignDocuments?.length ?? 0) > 0;
  // Buyer role: eSignDocuments on the buyer's own rfq-by-id is the buyer's own signature (see rfqBuyerSigned
  // below). Read once, same as supplierHasSigned, so an already-signed buyer doesn't see "Proceed to Signing"
  // again after leaving and reopening the contract.
  const buyerHasSigned = !isSupplier && ((rfq as any)?.eSignDocuments?.length ?? 0) > 0;

  // Real terms-condition / e-sign status per supplier, sourced from the RFQ payload
  // (buyer's rfq-by-id already includes it) and refreshed via the dedicated status endpoints.
  const [termsConditions, setTermsConditions] = useState<TermsConditionStatusEntry[]>(
    (rfq as any)?.supplierTermsConditions || []
  );
  const [eSigns, setESigns] = useState<EsignStatusEntry[]>((rfq as any)?.supplierESigns || []);

  useEffect(() => {
    setTermsConditions((rfq as any)?.supplierTermsConditions || []);
  }, [(rfq as any)?.supplierTermsConditions]);

  useEffect(() => {
    setESigns((rfq as any)?.supplierESigns || []);
  }, [(rfq as any)?.supplierESigns]);

  const refreshTermsConditions = async () => {
    if (!fetchTermsConditions || !rfqId) return;
    try {
      const res = await fetchTermsConditions(rfqId);
      if (Array.isArray(res)) setTermsConditions(res);
    } catch (err) {
      console.error("Failed to refresh terms & conditions status:", err);
    }
  };

  const refreshESigns = async () => {
    if (!fetchESigns || !rfqId) return;
    try {
      const res = await fetchESigns(rfqId);
      if (Array.isArray(res)) setESigns(res);
    } catch (err) {
      console.error("Failed to refresh e-signature status:", err);
    }
  };

  useEffect(() => {
    refreshTermsConditions();
    refreshESigns();
    // Buyer: the `rfq` prop can be a snapshot taken when the RFQ page was first opened, well before either party
    // signed - refreshESigns/refreshTermsConditions keep the supplier's status fresh via dedicated endpoints, but
    // the buyer's own signed status (rfq.eSignDocuments) has no such endpoint, so re-fetch the whole RFQ here too.
    if (!isSupplier && rfqId) refetchRfq?.(rfqId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  const [busyAssetId, setBusyAssetId] = useState<string | null>(null);

  // Downloads the asset, or with `preview` opens it in a new tab (the browser itself downloads types it can't display, e.g. Excel).
  const handleDownloadAsset = async (assetId: string, defaultName: string = "Document", preview: boolean = false) => {
    setBusyAssetId(assetId);
    // Open the tab right away, while still inside the click, so the browser doesn't block it after the fetch below.
    const previewTab = preview ? window.open("", "_blank") : null;
    if (previewTab) previewTab.opener = null;
    try {
      const res = await fetchBuyerAsset(assetId);
      if (res && "fileBytes" in res && res.fileBytes) {
        const fileName = (res as any).fileName || defaultName;
        const mime = resolveMimeType((res as any).contentType || (res as any).fileType, fileName);
        const base64Str = (res as any).fileBytes.includes(",") ? (res as any).fileBytes.split(",")[1] : (res as any).fileBytes;
        const byteCharacters = atob(base64Str);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });
        const url = URL.createObjectURL(blob);
        if (preview) {
          if (previewTab) {
            previewTab.location.href = url;
          } else {
            window.open(url, "_blank", "noopener,noreferrer");
          }
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } else {
        previewTab?.close();
        alert("Document file content not available for download.");
      }
    } catch (err) {
      previewTab?.close();
      console.error("Failed to download document:", err);
      alert(preview ? "Unable to preview document." : "Unable to download document.");
    } finally {
      setBusyAssetId(null);
    }
  };

  const renderTermsDocs = (docs: RfqAssetAttachment[]) => (
    <div className="contract-tc-docs">
      {docs.map((doc, idx) => {
        const docName = doc.fileName || doc.assetName || `Terms_Document_${idx + 1}`;
        return (
          <div key={doc.id || idx} className="contract-tc-doc">
            <span className="contract-doc-icon">📎</span>
            <span className="contract-doc-name">{docName}</span>
            {doc.id && (
              <>
                <button
                  type="button"
                  onClick={() => handleDownloadAsset(doc.id, docName, true)}
                  disabled={busyAssetId === doc.id}
                  className="contract-btn contract-btn--outline contract-btn--xs"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadAsset(doc.id, docName)}
                  disabled={busyAssetId === doc.id}
                  className="contract-btn contract-btn--soft contract-btn--xs"
                >
                  Download
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  // Determine awarded suppliers
  const awardedSupplierIds = useMemo(() => {
    if (distinctSelected && distinctSelected.length > 0) return distinctSelected;
    if (displaySuppliers && displaySuppliers.length > 0) return [displaySuppliers[0].id];
    if (supplierId) return [supplierId];
    if (lineItems && lineItems.length > 0) {
      const itemWithAward = lineItems.find((it: any) => it.awardedSupplierId);
      if (itemWithAward?.awardedSupplierId) return [itemWithAward.awardedSupplierId];
    }
    return ["SUPPLIER-1"];
  }, [distinctSelected, displaySuppliers, supplierId, lineItems]);

  const resolveQuoteItem = (quotation: any, rfqItem: any) => {
    if (getQuoteItemForRfqItem) {
      return getQuoteItemForRfqItem(quotation, rfqItem);
    }
    if (!quotation) return null;
    const rfqItemId = rfqItem?.id || rfqItem?.itemId || rfqItem?._id || rfqItem?.buyerRFQItemId;
    const itemsList = quotation.items || quotation.supplierQuotationItems || rfq?.supplierQuotationItems || [];
    return (
      itemsList.find((qi: any) =>
        (qi.supplierRFQItemId && rfqItem?.supplierRFQItemId && qi.supplierRFQItemId === rfqItem.supplierRFQItemId) ||
        (qi.supplierRFQItemId && rfqItemId && qi.supplierRFQItemId === rfqItemId) ||
        (qi.buyerRFQItemId && rfqItemId && qi.buyerRFQItemId === rfqItemId) ||
        (qi.buyerRFQItemId && rfqItem?.buyerRFQItemId && qi.buyerRFQItemId === rfqItem.buyerRFQItemId) ||
        qi.id === rfqItemId ||
        qi.itemQuotationId === rfqItemId
      ) || null
    );
  };

  // The awarded ids on this screen can be quotation ids. The terms & conditions, e-signature, buyer-acceptance and
  // contract data from the API are keyed by the supplier's own id, so match them through this.
  const resolveSupplierId = (id: string): string => {
    const quotation = effectiveQuotations.find((q: any) => q.quotationId === id || q.supplierId === id || q._id === id);
    return String(quotation?.supplierId || id);
  };

  // Map of line items for each awarded supplier
  const supplierItemsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    awardedSupplierIds.forEach((sid) => {
      map[sid] = [];
    });
    lineItems.forEach((item: any) => {
      const itemId = item.id || item.itemId || item._id;

      // Supplier mode, or a single-supplier contract view: an RFQ's line items can still be split-awarded
      // across several suppliers even when only one supplier's contract is open here, so only the items
      // actually awarded to that supplier belong in it - not every line item on the RFQ. Only filters when the
      // item itself carries an isAwarded flag (as the RFQ's own supplier/buyer rfq-by-id items do); an RFQ with
      // no per-item award data at all falls through to "include everything" below, same as before, and the
      // "ensure every supplier has line items" pass further down restores the full list if filtering still
      // leaves this supplier with none.
      if (isSupplier || awardedSupplierIds.length === 1) {
        const targetSid = awardedSupplierIds[0] || supplierId;
        if (targetSid) {
          if (!map[targetSid]) map[targetSid] = [];
          if (typeof item.isAwarded === "boolean") {
            const resolvedTargetSid = resolveSupplierId(targetSid);
            const isAwardedToTarget =
              item.isAwarded === true && (!item.awardedSupplierId || item.awardedSupplierId === resolvedTargetSid);
            if (isAwardedToTarget) map[targetSid].push(itemId);
          } else {
            map[targetSid].push(itemId);
          }
          return;
        }
      }

      let suppId = (selections && selections[itemId]) || item.awardedSupplierId;
      if (!suppId && effectiveQuotations && effectiveQuotations.length > 0) {
        const suppQuotation = effectiveQuotations.find((q: any) =>
          q.supplierId === supplierId || q.quotationId === supplierId
        ) || effectiveQuotations[0];
        const qi = resolveQuoteItem(suppQuotation, item);
        if (qi && qi.isAwarded) {
          suppId = suppQuotation.supplierId || supplierId || awardedSupplierIds[0];
        }
      }
      if (!suppId) suppId = awardedSupplierIds[0];
      if (suppId) {
        if (!map[suppId]) map[suppId] = [];
        map[suppId].push(itemId);
      }
    });
    // Ensure every awarded supplier has at least line items if empty
    awardedSupplierIds.forEach((sid) => {
      if (!map[sid] || map[sid].length === 0) {
        map[sid] = lineItems.map((it: any) => it.id || it.itemId || it._id);
      }
    });
    return map;
  }, [awardedSupplierIds, lineItems, selections, effectiveQuotations, isSupplier, supplierId]);

  // Initialize contracts state per supplier
  const [contracts, setContracts] = useState<Record<string, ContractState>>(() => {
    const initial: Record<string, ContractState> = {};
    awardedSupplierIds.forEach((sid) => {
      // Buyer: whether this specific supplier has already signed, from the RFQ's per-supplier supplierESigns
      // (supplierHasSigned only covers the supplier role's own signature, so it can't be reused here).
      const supplierAlreadySignedForBuyer =
        !isSupplier &&
        ((((rfq as any)?.supplierESigns || []).find((e: any) => String(e.supplierId) === resolveSupplierId(sid))
          ?.attachments?.length ?? 0) > 0);
      // Buyer: this supplier was already invited to review the contract terms (rfq-by-id's
      // buyerTermsAndConditionStatuses[].isSupplierInvitedForContract) - "Send to Supplier(s)" must not offer to
      // send to them again, even if they haven't been the active tab yet (the "details" -> "terms" transition
      // elsewhere only runs for whichever supplier is currently open).
      const supplierAlreadyInvited =
        !isSupplier &&
        ((rfq as any)?.buyerTermsAndConditionStatuses || []).some(
          (s: any) => String(s.supplierId) === resolveSupplierId(sid) && s.isSupplierInvitedForContract === true
        );
      initial[sid] = {
        supplierId: sid,
        contractNumber: "CTR-2026-" + (10000 + Math.floor(Math.random() * 89999)).toString().slice(0, 5),
        itemIds: supplierItemsMap[sid] || [],
        startDate: "2026-09-15",
        endDate: "2027-09-14",
        dateError: false,
        // Supplier: having already submitted their own T&C only skips straight to signing if the buyer actually
        // accepted it - a rejected submission must stay on "terms" so the upload card re-appears for a replacement.
        step: isSupplier
          ? (supplierHasSigned ||
            (supplierHasOwnTc && supplierOwnTcDocs.length > 0 && (rfq as any)?.supplierTermsAndConditionAccepted !== "REJECTED")
              ? "sign"
              : "terms")
          : (buyerHasSigned && supplierAlreadySignedForBuyer
              ? "completed"
              : buyerHasSigned
                ? "sign"
                : supplierAlreadyInvited
                  ? "terms"
                  : "details"),
        sent: isSupplier ? true : (buyerHasSigned || supplierAlreadyInvited),
        tcContent:
          "1. Payment Terms: 45 days from invoice date.\n2. Delivery: Within 30 days of purchase order issuance.\n3. Warranty: 12 months standard warranty on all items from date of delivery.\n4. Penalty: 1% of order value per week of delay, capped at maximum 10%.",
        tcEdited: false,
        tcLastUpdatedAt: null,
        tcEditorOpen: false,
        tcDraft: "",
        // Buyer: whether this buyer has already approved this supplier's terms, from the RFQ's per-supplier statuses.
        buyerFinalAccepted: isSupplier
          ? true
          : ((rfq as any)?.buyerTermsAndConditionStatuses || []).some(
              (s: any) => String(s.supplierId) === resolveSupplierId(sid) && s.buyerTermsAndConditionAccepted === "ACCEPTED"
            ),
        supplierFinalAccepted: supplierHasOwnTc && (rfq as any)?.supplierTermsAndConditionAccepted !== "REJECTED",
        buyerSigned: buyerHasSigned,
        supplierSigned: isSupplier ? supplierHasSigned : supplierAlreadySignedForBuyer,
        messages: isSupplier
          ? [
              {
                sender: "Buyer",
                text: "Contract terms issued for supplier review.",
                time: nowLabel(),
              },
            ]
          : [],
        draftMessage: "",
      };
    });
    return initial;
  });

  const [activeContractId, setActiveContractId] = useState<string>(
    isSupplier && supplierId && awardedSupplierIds.includes(supplierId)
      ? supplierId
      : awardedSupplierIds[0] || ""
  );

  const [isChatOpen, setIsChatOpen] = useState(false);



  // E-Sign Modal State
  const [eSignModalContractId, setESignModalContractId] = useState<string | null>(null);
  const [signerNameInput, setSignerNameInput] = useState("");
  const [signerDesignationInput, setSignerDesignationInput] = useState("");
  const [declarationChecked, setDeclarationChecked] = useState(true);
  const [drawnSignatureData, setDrawnSignatureData] = useState<string | null>(null);
  // Signing this party's copy inside the modal, either by drawing a signature or uploading an already-signed
  // document - both apply the same way (see confirmApplyESign / handleUploadSignedContract) so they live as one
  // choice in the modal rather than a second "Upload Signed Contract" button next to "E-Sign Contract".
  const [eSignMethod, setESignMethod] = useState<"draw" | "upload">("draw");
  const [signedContractFile, setSignedContractFile] = useState<File | null>(null);

  // Supplier Terms & Conditions Document Upload State
  const [supplierTcFile, setSupplierTcFile] = useState<File | null>(null);
  // "Is there any Supplier Terms & Conditions?" yes = supplier uploads their own (sent as true), no = proceed with the buyer's (sent as false).
  // Defaults to "yes" when the supplier already has their own T&C on file (e.g. pending buyer approval after a
  // reload) - otherwise the "No, proceed with buyer's terms" box would render alongside an upload that already happened.
  const [hasSupplierTcChoice, setHasSupplierTcChoice] = useState<"yes" | "no">(supplierHasOwnTc ? "yes" : "no");
  const [includeSupplierTc, setIncludeSupplierTc] = useState(true);
  // Supplier: set once "Proceed with Buyer T&C" (the "No" path) has actually been submitted - there is no
  // per-supplier terms-status refetch wired up for the supplier role, so this local flag is the only reliable
  // signal that the step is finished (unlike the buyer-only activeTcEntry). Used by canProceedToSigning below.
  const [supplierProceededWithBuyerTc, setSupplierProceededWithBuyerTc] = useState(false);
  const [uploadingSupplierTc, setUploadingSupplierTc] = useState(false);
  const [supplierTcStatusMsg, setSupplierTcStatusMsg] = useState<string | null>(null);
  const supplierTcStatusMsgClass = `contract-status-msg${supplierTcStatusMsg?.includes("Success") ? " contract-status-msg--success" : ""}`;
  // Supplier: reason for rejecting the buyer's Terms & Conditions, asked for before the reject call is sent.
  const [showRejectBuyerTermsComment, setShowRejectBuyerTermsComment] = useState(false);
  const [rejectBuyerTermsComment, setRejectBuyerTermsComment] = useState("");
  const [rejectBuyerTermsCommentError, setRejectBuyerTermsCommentError] = useState<string | null>(null);

  // A row of the ENTITY_TYPE reference list: its id is the entityId of that party's uploaded assets.
  const getEntityTypeByKey = async (key: "SUPPLIER" | "BUYER") => {
    const entityTypes = await fetchReferenceList(["ENTITY_TYPE"]);
    const entity = Array.isArray(entityTypes) ? entityTypes.find((e) => e.key === key) : undefined;
    if (!entity) {
      throw new Error(`${key} entity type not found.`);
    }
    return { entityId: entity.id as string, entityType: entity.key as string };
  };

  // The supplier's uploaded assets (terms & conditions, e-signature).
  const getSupplierEntityType = () => getEntityTypeByKey("SUPPLIER");
  // The buyer's uploaded assets (terms & conditions, e-signature).
  const getBuyerEntityType = () => getEntityTypeByKey("BUYER");

  const handleUploadSupplierTcFileDirect = async (id: string) => {
    if (!supplierTcFile || !onUploadSupplierTerms) return;
    setUploadingSupplierTc(true);
    setSupplierTcStatusMsg(null);
    try {
      const fileBytes = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(supplierTcFile);
      });

      const rfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
      const { entityId, entityType } = await getSupplierEntityType();
      const docAsset = {
        entityId,
        entityType,
        assetType: "SUPPLIER_TERMS_CONDITION",
        fileName: supplierTcFile.name,
        isSingletonAsset: false,
        fileBytes: fileBytes,
      };

      const res = await onUploadSupplierTerms({
        rfqId: rfqId,
        termsAndCondition: true,
        documents: [docAsset],
      });

      if (res && "statusCode" in res && res.statusCode >= 400) {
        setSupplierTcStatusMsg(res.message || "Failed to upload terms document.");
        setUploadingSupplierTc(false);
        return;
      }

      setSupplierTcStatusMsg("Success! Supplier terms uploaded & submitted.");
      const c = contracts[id];
      if (c) {
        const timeStr = nowLabel();
        updateContract(id, {
          supplierFinalAccepted: true,
          supplierFinalRejected: false,
          tcEdited: true,
          tcLastUpdatedAt: timeStr,
          messages: [
            ...c.messages,
            {
              sender: "Supplier",
              text: `Supplier submitted custom Terms & Conditions document (${supplierTcFile.name}).`,
              time: timeStr,
            },
          ],
        });
      }
    } catch (err: any) {
      setSupplierTcStatusMsg(err?.message || "Failed to upload document.");
    } finally {
      setUploadingSupplierTc(false);
    }
  };

  // Supplier chose "No" - explicitly tells the backend termsAndCondition=false (no custom terms), so the
  // buyer's side sees a definitive answer and its flow can continue instead of waiting indefinitely.
  const handleProceedWithBuyerTc = async (id: string) => {
    if (!onUploadSupplierTerms) return;
    setUploadingSupplierTc(true);
    setSupplierTcStatusMsg(null);
    try {
      const rfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
      const res = await onUploadSupplierTerms({ rfqId, termsAndCondition: false });
      if (res && "statusCode" in res && res.statusCode >= 400) {
        setSupplierTcStatusMsg(res.message || "Failed to proceed with the buyer's terms.");
        return;
      }
      setSupplierTcStatusMsg("Proceeding with the buyer's Terms & Conditions.");
      setSupplierProceededWithBuyerTc(true);
      await refreshTermsConditions();
    } catch (err: any) {
      setSupplierTcStatusMsg(err?.message || "Failed to proceed with the buyer's terms.");
    } finally {
      setUploadingSupplierTc(false);
    }
  };

  const activeContract = contracts[activeContractId];

  const updateContract = (id: string, patch: Partial<ContractState>) => {
    setContracts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  // Real terms-condition / e-sign status for the currently active supplier, when the API has data for it.
  const activeTcEntry = activeContract
    ? termsConditions.find((e) => String(e.supplierId) === resolveSupplierId(activeContract.supplierId))
    : undefined;
  const activeEsignEntry = activeContract
    ? eSigns.find((e) => String(e.supplierId) === resolveSupplierId(activeContract.supplierId))
    : undefined;

  // The supplier's own Terms & Conditions documents, for the executed-contract PDF/print. Supplier role: their
  // own rfq-by-id (supplierOwnTcDocs). Buyer role: supplierOwnTcDocs is always empty (it's supplier-only data),
  // so use what fetchTermsConditions returned for the active supplier instead (the same source the "Supplier
  // Terms Received" card below uses) - otherwise the buyer's PDF never merges in the supplier's terms.
  const supplierTcDocsForContract: RfqAssetAttachment[] = isSupplier
    ? supplierOwnTcDocs
    : activeTcEntry?.termsAndCondition === true
      ? activeTcEntry?.attachments || []
      : [];

  // Buyer/Supplier Signature status row (Action Step: Signing), sourced directly from rfq-by-id.
  // Buyer role: eSignDocuments is the buyer's own signature; supplierESigns[].attachments (activeEsignEntry) is
  // the active supplier's. Supplier role: eSignDocuments is the supplier's own; buyerESignDocuments is the buyer's.
  const rfqBuyerSigned = isSupplier
    ? ((rfq as any)?.buyerESignDocuments?.length ?? 0) > 0
    : ((rfq as any)?.eSignDocuments?.length ?? 0) > 0;
  const rfqSupplierSigned = isSupplier
    ? ((rfq as any)?.eSignDocuments?.length ?? 0) > 0
    : (activeEsignEntry?.attachments?.length ?? 0) > 0;
  // Buyer role: once both sides have actually signed (per rfq-by-id), the contract is ready to download —
  // "Proceed to Signing" no longer applies and the "Download Contract" section shows regardless of the local step.
  const buyerBothSigned = !isSupplier && rfqBuyerSigned && rfqSupplierSigned;
  // Role-agnostic version of the check above, used to gate chat visibility for either role:
  // both sides have actually signed per rfq-by-id, regardless of the local step.
  const bothPartiesSigned = rfqBuyerSigned && rfqSupplierSigned;

  // The buyer's own Terms & Conditions documents attached to the RFQ.
  const buyerTermsDocs: RfqAssetAttachment[] =
    (rfq as any)?.termsConditionDocuments || (rfq as any)?.termsConditionDocument || [];

  // The RFQ's contract template document(s), from both the buyer's and the supplier's rfq-by-id - shown so either
  // side can download/preview the template the contract is based on.
  const contractTemplateDocs: RfqAssetAttachment[] = (rfq as any)?.contractTemplateDocuments || [];

  // termsAndCondition means "the supplier has their own Terms & Conditions".
  // Buyer: once the supplier's entry is known (true or false) there is no terms review card, the contract goes straight to signing.
  // Buyer: the contract name defaults to the RFQ's own title/number, so it never has to be asked for - it can
  // still be changed via the pencil icon (openContractNameEditor) next to the contract title.
  const [contractName, setContractName] = useState(() =>
    ((rfq as any)?.title || (rfq as any)?.rfqNo || (rfq as any)?.name || "").toString().trim()
  );
  const [contractNameDraft, setContractNameDraft] = useState("");
  // Contracts already created for this RFQ (one per supplier), from the buyer's rfq-by-id, and their details from the contract API.
  const [contractRefs, setContractRefs] = useState<BuyerRfqContractRefDto[]>((rfq as any)?.contracts || []);
  const [createdContracts, setCreatedContracts] = useState<Record<string, ContractDetails>>({});
  const [contractLoadError, setContractLoadError] = useState<string | null>(null);
  // Supplier: the contract the buyer created, loaded with the RFQ's contractId.
  const [supplierContract, setSupplierContract] = useState<ContractDetails | null>(null);
  const openedContractSupplierRef = useRef(false);
  const [buyerTermsError, setBuyerTermsError] = useState<string | null>(null);
  // Buyer: reason for rejecting the supplier's Terms & Conditions, asked for before the reject call is sent.
  const [showRejectSupplierTermsComment, setShowRejectSupplierTermsComment] = useState(false);
  const [rejectSupplierTermsComment, setRejectSupplierTermsComment] = useState("");
  const [rejectSupplierTermsCommentError, setRejectSupplierTermsCommentError] = useState<string | null>(null);
  // Whether the buyer has already accepted each supplier's terms & conditions, from the buyer's rfq-by-id.
  const [termsAcceptedStatuses, setTermsAcceptedStatuses] = useState<
    { supplierId: string; supplierName: string; supplierTermsAndConditionAccepted: 'ACCEPTED' | 'REJECTED' | 'PENDING' }[]
  >(Array.isArray((rfq as any)?.supplierTermsAndConditionAccepted) ? (rfq as any).supplierTermsAndConditionAccepted : []);
  const activeTermsAcceptedEntry = activeContract
    ? termsAcceptedStatuses.find((e) => String(e.supplierId) === resolveSupplierId(activeContract.supplierId))
    : undefined;
  // contract-accept-summary (buyer role): per-supplier whether that supplier has accepted the buyer's terms,
  // from the buyer's rfq-by-id. Refreshed alongside termsAcceptedStatuses in loadLatestContractStatus.
  const [buyerAcceptedStatuses, setBuyerAcceptedStatuses] = useState<
    { supplierId: string; supplierName: string; buyerTermsAndConditionAccepted: 'ACCEPTED' | 'REJECTED' | 'PENDING' }[]
  >(Array.isArray((rfq as any)?.buyerTermsAndConditionStatuses) ? (rfq as any).buyerTermsAndConditionStatuses : []);
  // Supplier role: the flat buyerTermsAndConditionAccepted / supplierTermsAndConditionAccepted statuses
  // ("ACCEPTED" | "REJECTED" | "PENDING") from the RFQ (there is only one buyer-supplier context, so no
  // per-supplier array). Updated locally right after the supplier accepts/rejects the buyer's terms, since
  // there is no rfq-by-id refetch wired up for the supplier role.
  const [supplierScreenAcceptance, setSupplierScreenAcceptance] = useState<{
    buyerTermsAndConditionAccepted: 'ACCEPTED' | 'REJECTED' | 'PENDING';
    supplierTermsAndConditionAccepted: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  }>({
    buyerTermsAndConditionAccepted: (rfq as any)?.buyerTermsAndConditionAccepted || "PENDING",
    supplierTermsAndConditionAccepted: (rfq as any)?.supplierTermsAndConditionAccepted || "PENDING",
  });
  // Asked for when the contract record is created ("Approvals"), not when the screen opens.
  const [showContractNameModal, setShowContractNameModal] = useState(false);
  const [contractNameError, setContractNameError] = useState<string | null>(null);
  const [sendingContract, setSendingContract] = useState(false);
  const [sendContractError, setSendContractError] = useState<string | null>(null);
  // Buyer: creates the contract record, normally via "Approvals" (see createContractRecord).
  const [creatingContract, setCreatingContract] = useState(false);
  const [createContractError, setCreateContractError] = useState<string | null>(null);
  // Buyer: the file picked in the "Proposed Edits" dialog, kept per contract only once saved.
  const [pendingBuyerTcFile, setPendingBuyerTcFile] = useState<File | null>(null);
  // Buyer: re-uploading the Terms & Conditions document (via "Proposed Edits", after a supplier rejection).
  const [uploadingBuyerTc, setUploadingBuyerTc] = useState(false);
  const [buyerTcUploadStatusMsg, setBuyerTcUploadStatusMsg] = useState<string | null>(null);
  const buyerTcUploadStatusMsgClass = `contract-status-msg${buyerTcUploadStatusMsg?.includes("Success") ? " contract-status-msg--success" : ""}`;
  // Buyer: which suppliers' contracts "Send" applies to when several suppliers were awarded.
  const [selectAllSuppliers, setSelectAllSuppliers] = useState(true);
  const [sendSelection, setSendSelection] = useState<Record<string, boolean>>({});

  // Buyer: reload the RFQ when the contract screen opens so each supplier's latest terms & conditions,
  // e-signature and buyer-acceptance status are shown, not the data loaded earlier on the award screen.
  const [latestLoading, setLatestLoading] = useState(false);
  const [latestError, setLatestError] = useState<string | null>(null);
  // Loads each supplier's latest terms & conditions, e-signature and buyer-acceptance status from the buyer's
  // rfq-by-id. Used on open, and again after the buyer accepts a supplier's terms.
  const loadLatestContractStatus = async () => {
    if (isSupplier || !rfqId) return;
    setLatestLoading(true);
    setLatestError(null);
    try {
      const latest = await fetchBuyerRfqContractStatus(rfqId);
      if ("statusCode" in latest) {
        setLatestError(latest.message || "Failed to load the latest contract details.");
        return;
      }
      setTermsConditions(latest.supplierTermsConditions || []);
      setESigns(latest.supplierESigns || []);
      setContractRefs(latest.contracts || []);
      setTermsAcceptedStatuses(latest.supplierTermsAndConditionAccepted || []);
      setBuyerAcceptedStatuses(latest.buyerTermsAndConditionStatuses || []);
      const acceptedSupplierIds = (latest.buyerTermsAndConditionStatuses || [])
        .filter((s) => s.buyerTermsAndConditionAccepted === "ACCEPTED")
        .map((s) => String(s.supplierId));
      setContracts((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((sid) => {
          if (acceptedSupplierIds.includes(resolveSupplierId(sid))) {
            next[sid] = { ...next[sid], buyerFinalAccepted: true };
          }
        });
        return next;
      });
    } finally {
      setLatestLoading(false);
    }
  };
  useEffect(() => {
    loadLatestContractStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  // Buyer: a supplier whose contract already exists is not sent one again. Load its name, dates and attachments
  // from the contract API and show them instead of the editable defaults.
  useEffect(() => {
    if (isSupplier || contractRefs.length === 0) return;
    let cancelled = false;
    const contractSupplierIds = contractRefs.map((ref) => String(ref.supplierId));
    setContracts((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((sid) => {
        if (contractSupplierIds.includes(resolveSupplierId(sid))) {
          next[sid] = { ...next[sid], sent: true, step: next[sid].step === "details" ? "terms" : next[sid].step };
        }
      });
      return next;
    });
    // Open on the supplier that has a contract, once, so its details are what the buyer sees first.
    if (!openedContractSupplierRef.current) {
      const withContract = awardedSupplierIds.find((id) => contractSupplierIds.includes(resolveSupplierId(id)));
      if (withContract) {
        openedContractSupplierRef.current = true;
        setActiveContractId(withContract);
      }
    }
    setContractLoadError(null);
    Promise.all(contractRefs.map((ref) => fetchBuyerContractById(ref.contractId))).then((results) => {
      if (cancelled) return;
      const loaded: Record<string, ContractDetails> = {};
      results.forEach((res, i) => {
        if ("statusCode" in res) {
          setContractLoadError(res.message || "Failed to load the contract.");
        } else {
          loaded[String(contractRefs[i].supplierId)] = res;
        }
      });
      setCreatedContracts(loaded);
      setContracts((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((sid) => {
          const created = loaded[resolveSupplierId(sid)];
          if (created) {
            next[sid] = { ...next[sid], startDate: created.startDate.slice(0, 10), endDate: created.endDate.slice(0, 10), dateError: false };
          }
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractRefs]);

  const activeSupplierId = activeContract ? resolveSupplierId(activeContract.supplierId) : "";
  // Terms-acceptance status for the "contract-accept-summary" and the supplier's Accept/Reject actions on the
  // buyer's terms. Buyer role: per-supplier arrays matched against the active supplier tab. Supplier role: the
  // flat RFQ statuses, kept current via supplierScreenAcceptance.
  const activeBuyerTermsStatus = isSupplier
    ? supplierScreenAcceptance.buyerTermsAndConditionAccepted
    : buyerAcceptedStatuses.find((entry) => String(entry.supplierId) === String(activeSupplierId))
        ?.buyerTermsAndConditionAccepted || "PENDING";
  const activeBuyerTermsAccepted = activeBuyerTermsStatus === "ACCEPTED";
  const activeBuyerTermsRejected = activeBuyerTermsStatus === "REJECTED";
  const activeSupplierTermsStatus = isSupplier
    ? supplierScreenAcceptance.supplierTermsAndConditionAccepted
    : termsAcceptedStatuses.find((entry) => String(entry.supplierId) === String(activeSupplierId))
        ?.supplierTermsAndConditionAccepted || "PENDING";
  const activeSupplierTermsAccepted = activeSupplierTermsStatus === "ACCEPTED";
  const activeSupplierTermsRejected = activeSupplierTermsStatus === "REJECTED";
  // Buyer role: termsAndCondition === false on its own is not proof the supplier chose "proceed with buyer's
  // terms" - it is also the backend's default/unset value before the supplier has responded at all, so it must
  // not be treated as "resolved" by itself (otherwise a freshly opened, never-sent contract would show as
  // already accepted). Requiring the supplier's e-signature too means this only kicks in once the supplier has
  // actually gone through their "No" choice and signed, which is the point that choice becomes final - see the
  // "Supplier Terms Received" card hidden below for the same termsAndCondition === false case.
  const buyerSideTermsResolved =
    !isSupplier && activeTcEntry?.termsAndCondition === false && (activeEsignEntry?.attachments?.length ?? 0) > 0;
  // Buyer role: "Proceed to Signing" is only enabled once both the active supplier's acceptance statuses are
  // true. Supplier role: accepting the buyer's T&C only unlocks the Yes/No choice below - it must not by itself
  // enable signing. Signing is only ready once that second choice is actually resolved: "No" (proceed with the
  // buyer's terms - supplierProceededWithBuyerTc) closes the T&C phase outright, while "Yes" (upload own terms)
  // still needs the buyer's approval (activeSupplierTermsAccepted, the "Buyer —" badge) before it counts as done.
  const canProceedToSigning = isSupplier
    ? activeBuyerTermsAccepted &&
      (activeTcEntry?.termsAndCondition === false ||
        supplierProceededWithBuyerTc ||
        activeSupplierTermsAccepted)
    : activeBuyerTermsAccepted && (activeSupplierTermsAccepted || buyerSideTermsResolved);
  const activeContractRef = contractRefs.find((ref) => String(ref.supplierId) === activeSupplierId);
  const activeCreated: ContractDetails | undefined = isSupplier
    ? supplierContract ?? undefined
    : createdContracts[activeSupplierId];
  // Buyer: a contract ref still in "OPEN" status has a backend record but hasn't been finalized/executed yet,
  // so "Create Contract" in the completed card (and the record-creation calls it triggers) must stay available
  // for it the same way as when there's no record at all - only an executed/closed contract counts as created.
  const isContractRefOpen = (supplierKey: string) =>
    contractRefs.find((ref) => String(ref.supplierId) === resolveSupplierId(supplierKey))?.status === "OPEN";
  const activeContractOpen = !isSupplier && isContractRefOpen(activeContract?.supplierId ?? "");

  // Buyer signs first, then every approver in the contract's approval chain must approve, and only then can the
  // supplier sign (approvers act from the separate Contracts screen - see Contract/ContractDetail.tsx). No approval
  // chain configured for this contract is treated as nothing to wait for, so contracts without one sign as before.
  // Prefers the buyer's rfq-by-id (activeContractRef.approvalUsers, refreshed by loadLatestContractStatus right
  // after "Approvals" succeeds) and falls back to the contract-by-id fetch (activeCreated) for the supplier role,
  // whose rfq-by-id has no `contracts` array of its own.
  const activeApprovalUsers = activeContractRef?.approvalUsers ?? activeCreated?.approvalUsers ?? [];
  const allApproversApproved =
    activeApprovalUsers.length === 0 || activeApprovalUsers.every((a) => getStatusTone(a.status) === "success");
  const supplierSignBlockedByPendingApproval = isSupplier && Boolean(activeCreated) && !allApproversApproved;
  const supplierSignBlockedByBuyerNotSigned = isSupplier && !(activeContract?.buyerSigned || rfqBuyerSigned);
  const supplierSignBlocked =
    supplierSignBlockedByPendingTcApproval || supplierSignBlockedByBuyerNotSigned || supplierSignBlockedByPendingApproval;
  // Buyer: once the contract exists, "Proceed to Signing" only replaces the approval chain once every approver
  // has actually approved it - while any are still pending, the chain itself (userName + status) shows instead.
  const approvalsPending = !isSupplier && Boolean(activeContractRef) && activeApprovalUsers.length > 0 && !allApproversApproved;

  const renderApprovalChain = () => (
    <div className="contract-approval-list">
      <div className="contract-sign-label">
        Approval Chain ({activeApprovalUsers.filter((a) => getStatusTone(a.status) === "success").length} of {activeApprovalUsers.length} approved)
      </div>
      {[...activeApprovalUsers]
        .sort((a, b) => a.order - b.order)
        .map((approver) => (
          <div key={approver.userId} className="contract-approval-row">
            <span className="contract-approval-name">{approver.userName}</span>
            <StatusBadge status={approver.status} size="sm" dot />
          </div>
        ))}
    </div>
  );

  // Supplier: load the created contract (name, number, dates) and show its dates instead of the editable defaults.
  const supplierContractId: string | undefined = isSupplier ? (rfq as any)?.contractId || undefined : undefined;
  useEffect(() => {
    if (!supplierContractId || !fetchContract) return;
    let cancelled = false;
    setContractLoadError(null);
    fetchContract(supplierContractId).then((res) => {
      if (cancelled) return;
      if ("statusCode" in res) {
        setContractLoadError(res.message || "Failed to load the contract.");
        return;
      }
      setSupplierContract(res);
      setContracts((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((sid) => {
          next[sid] = { ...next[sid], startDate: res.startDate.slice(0, 10), endDate: res.endDate.slice(0, 10), dateError: false };
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierContractId]);

  // Buyer: no contract name is asked for once the RFQ has a contract. For a supplier that has none, while other
  // suppliers do, the name is asked for when "Send" is clicked.
  useEffect(() => {
    if (isSupplier) return;
    if (activeContractRef || (contractRefs.length > 0 && !contractName)) {
      setShowContractNameModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeContractRef?.contractId, activeContract?.supplierId, contractRefs]);

  // Supplier: no terms review once they have submitted their own documents - unless the buyer rejected them, in
  // which case the terms step must stay open (or be reopened) so a replacement document can be uploaded.
  const tcDeclined = supplierHasOwnTc && supplierOwnTcDocs.length > 0 && !activeSupplierTermsRejected;

  useEffect(() => {
    if (!activeContract) return;
    if (tcDeclined) {
      if (activeContract.step === "terms" || activeContract.step === "details") {
        updateContract(activeContract.supplierId, {
          buyerFinalAccepted: true,
          supplierFinalAccepted: true,
          step: activeContract.buyerSigned && activeContract.supplierSigned ? "completed" : "sign",
        });
      }
    } else if (
      isSupplier &&
      activeSupplierTermsRejected &&
      (activeContract.step === "sign" || activeContract.step === "completed")
    ) {
      // Supplier: the buyer rejected the previously submitted Terms & Conditions after this contract had already
      // advanced past the terms step - send it back so a replacement document can be uploaded.
      updateContract(activeContract.supplierId, { supplierFinalAccepted: false, step: "terms" });
    } else if (
      !isSupplier &&
      activeContract.step === "details" &&
      (activeTcEntry?.termsAndCondition === true || (activeEsignEntry?.attachments?.length ?? 0) > 0)
    ) {
      // Buyer: the supplier has already responded, so the contract was sent earlier - go to the terms step.
      updateContract(activeContract.supplierId, { sent: true, step: "terms" });
      setShowContractNameModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeContract?.step,
    activeContract?.supplierId,
    tcDeclined,
    activeSupplierTermsRejected,
    activeTcEntry?.termsAndCondition,
    activeEsignEntry?.attachments?.length,
  ]);

  // Buyer: keep the acceptance flags in line with the supplier's termsAndCondition.
  // false = the supplier answered without terms of their own, so there is nothing to approve: both sides are
  // accepted and Proceed to Signing is available. This applies once the contract exists in the API; right after
  // "Send to Supplier" in this session the supplier cannot have answered yet, so both sides stay awaiting.
  // true = the supplier's own T&C is submitted, so the supplier side is accepted. If the buyer has already accepted
  // them (this supplier's entry in supplierTermsAndConditionAccepted) there is nothing left to approve; otherwise
  // the buyer still has to Accept.
  useEffect(() => {
    if (isSupplier || !activeContract || activeContract.step !== "terms") return;
    if (activeTcEntry?.termsAndCondition === false) {
      if (activeContractRef && !(activeContract.buyerFinalAccepted && activeContract.supplierFinalAccepted)) {
        updateContract(activeContract.supplierId, { buyerFinalAccepted: true, supplierFinalAccepted: true });
      }
      return;
    }
    if (activeTcEntry?.termsAndCondition !== true) return;
    const buyerAlreadyAccepted = activeTermsAcceptedEntry?.supplierTermsAndConditionAccepted === "ACCEPTED";
    if (!activeContract.supplierFinalAccepted || (buyerAlreadyAccepted && !activeContract.buyerFinalAccepted)) {
      updateContract(activeContract.supplierId, {
        supplierFinalAccepted: true,
        ...(buyerAlreadyAccepted ? { buyerFinalAccepted: true } : {}),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTcEntry?.termsAndCondition,
    activeContractRef?.contractId,
    activeTermsAcceptedEntry?.supplierTermsAndConditionAccepted,
    activeContract?.step,
    activeContract?.supplierId,
  ]);

  // Buyer: a supplier whose e-signature has been uploaded has signed, so show them as signed / accepted.
  const supplierEsignUploaded = !isSupplier && (activeEsignEntry?.attachments?.length ?? 0) > 0;
  useEffect(() => {
    if (!activeContract || !supplierEsignUploaded || activeContract.supplierSigned) return;
    updateContract(activeContract.supplierId, {
      supplierSigned: true,
      ...(activeContract.step === "sign" && activeContract.buyerSigned ? { step: "completed" as const } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierEsignUploaded, activeContract?.supplierId, activeContract?.supplierSigned]);

  // Buyer: the buyer's own signature, mirrored from rfqBuyerSigned (rfq.eSignDocuments) the same way the effect
  // above mirrors the supplier's. Needed because rfq.eSignDocuments has no dedicated refresh endpoint like
  // fetchESigns/fetchTermsConditions do - it only becomes fresh via the refetchRfq() call on mount, which
  // resolves after the initial contracts state (and its buyerSigned) was already set from the (possibly stale) rfq.
  useEffect(() => {
    if (isSupplier || !activeContract || !rfqBuyerSigned || activeContract.buyerSigned) return;
    updateContract(activeContract.supplierId, {
      buyerSigned: true,
      ...(activeContract.step === "sign" && activeContract.supplierSigned ? { step: "completed" as const } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqBuyerSigned, activeContract?.supplierId, activeContract?.buyerSigned]);

  const showTermsAcceptanceCard =
    !tcDeclined &&
    (activeContract?.step === "terms" ||
      activeContract?.step === "completed" ||
      (activeContract?.step === "sign" && !(activeContract.buyerSigned && activeContract.supplierSigned)));

  // Supplier Accept / Reject of the buyer's Terms & Conditions, shown in the "Contract Terms & Conditions" card.
  // Visibility is driven only by the backend's buyerTermsAndConditionAccepted (activeBuyerTermsAccepted), plus
  // the one case where accepting/rejecting the buyer's terms doesn't apply: the supplier already has their own
  // T&C on record (activeTcEntry). It stays visible regardless of the Yes/No radio choice below - rejecting the
  // buyer's terms does not, by itself, unlock the "upload your own terms" step; the buyer's terms must still be
  // accepted first (see the "IF YES"/"IF NO" gating below). showTermsAcceptanceCard is not repeated here since
  // this JSX already sits inside that same condition.
  const showBuyerTermsDecision =
    isSupplier &&
    activeTcEntry?.termsAndCondition !== true &&
    !activeBuyerTermsAccepted;

  // Helper calculation for contract value per supplier
  const getContractValue = (id: string) => {
    const c = contracts[id];
    if (!c) return 0;
    const itemIdsToCalculate = (supplierItemsMap[id] && supplierItemsMap[id].length > 0)
      ? supplierItemsMap[id]
      : c.itemIds;
    const suppQuotation =
      effectiveQuotations.find(
        (q: any) => (q.quotationId === id || q.supplierId === id || q._id === id)
      ) || effectiveQuotations[0];

    const calculatedSum = itemIdsToCalculate.reduce((sum, itemId) => {
      const item = lineItems.find(
        (x: any) => (x.id || x.itemId || x._id) === itemId
      );
      if (!item) return sum;
      const qi = suppQuotation ? resolveQuoteItem(suppQuotation, item) : null;
      if (!qi) return sum;
      const qty = item.quantity || item.qty || 1;
      const unitPrice = qi?.quotedAmount ?? qi?.quotedPrice ?? 0;
      const discount = qi?.discount ?? (qi as any)?.discountPercentage ?? 0;
      const tax = qi?.tax ?? (qi as any)?.taxPercentage ?? (qi as any)?.gst ?? 0;
      const delivery = qi?.deliveryCharge ?? (qi as any)?.deliveryAmount ?? 0;
      const discAmt = discount > 0 ? Math.round((unitPrice * qty) * (discount / 100)) : 0;
      const taxAmt = tax > 0 ? Math.round((unitPrice * qty - discAmt) * (tax / 100)) : 0;
      return sum + (qi?.subTotal ?? (unitPrice * qty - discAmt + taxAmt + delivery));
    }, 0);

    if (calculatedSum > 0) return calculatedSum;
    if (suppQuotation?.totalPrice) return suppQuotation.totalPrice;
    return 0;
  };

  // Helper for active contract supplier name
  const getSupplierName = (sid: string) => {
    const q = effectiveQuotations.find(
      (x: any) => (x.quotationId === sid || x.supplierId === sid || x._id === sid)
    );
    const supplierIdToMatch = q?.supplierId || sid;

    // Check rfq.supplierIds
    const internalSupp = rfq?.supplierIds?.find(
      (s: any) => s.supplierId === supplierIdToMatch
    );
    if (internalSupp?.supplierName) return internalSupp.supplierName;

    // Check rfq.externalSupplierIds
    const externalSupp = rfq?.externalSupplierIds?.find(
      (s: any) => s.externalSupplierId === supplierIdToMatch
    );
    if (externalSupp?.externalSupplierName) return externalSupp.externalSupplierName;

    // Check quotation attributes
    if (q?.supplierName) return q.supplierName;
    if (q?.organizationName) return q.organizationName;

    const obj = displaySuppliers.find((s: any) => s.id === sid || s.id === supplierIdToMatch);
    return obj?.name || supplierName || "Supplier";
  };

  // Chat is scoped to the single counterparty this contract workspace is about — the active supplier
  // (buyer's view) or the buyer (supplier's view) — not every supplier on the RFQ.
  const chatCounterparty = activeContract
    ? isSupplier
      ? { id: supplierId || activeContract.supplierId, name: (rfq as any)?.buyerName || "Buyer", isExternal: false }
      : { id: resolveSupplierId(activeContract.supplierId), name: getSupplierName(activeContract.supplierId), isExternal: false }
    : null;
  // Visible through Details/Terms/Sign, hidden once both parties have signed (Completed).
  const canShowChat =
    !!chatApi && !!chatHubParams && !!rfqId && !!activeContract && !(activeContract.step === "completed" || bothPartiesSigned);

  // Date handlers
  const handleStartDateChange = (id: string, val: string) => {
    const c = contracts[id];
    const patch: Partial<ContractState> = { startDate: val };
    const dateErr = new Date(c.endDate) < new Date(val);
    patch.dateError = dateErr;

    if (c.sent && !dateErr) {
      const sender = isSupplier ? "Supplier" : "Buyer";
      patch.messages = [
        ...c.messages,
        { sender, text: `Updated the contract start date to ${val}.`, time: nowLabel() },
      ];
    }
    updateContract(id, patch);
  };

  const handleEndDateChange = (id: string, val: string) => {
    const c = contracts[id];
    const patch: Partial<ContractState> = { endDate: val };
    const dateErr = new Date(val) < new Date(c.startDate);
    patch.dateError = dateErr;

    if (c.sent && !dateErr) {
      const sender = isSupplier ? "Supplier" : "Buyer";
      patch.messages = [
        ...c.messages,
        { sender, text: `Updated the contract end date to ${val}.`, time: nowLabel() },
      ];
    }
    updateContract(id, patch);
  };

  // T&C Editor Modal handlers
  const openTcEditor = (id: string) => {
    if (!isSupplier) {
      setPendingBuyerTcFile(contracts[id]?.buyerTcFile ?? null);
      setBuyerTcUploadStatusMsg(null);
    }
    updateContract(id, {
      tcEditorOpen: true,
      tcDraft: contracts[id].tcContent,
    });
  };

  const closeTcEditor = (id: string) => {
    updateContract(id, { tcEditorOpen: false });
  };

  const saveTcEditor = async (id: string) => {
    const c = contracts[id];
    const timeStr = nowLabel();

    if (isSupplier && supplierTcFile && onUploadSupplierTerms) {
      setUploadingSupplierTc(true);
      setSupplierTcStatusMsg(null);
      try {
        const fileBytes = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(supplierTcFile);
        });

        const rfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
        const { entityId, entityType } = await getSupplierEntityType();
        const docAsset = {
          entityId,
          entityType,
          assetType: "SUPPLIER_TERMS_CONDITION",
          fileName: supplierTcFile.name,
          isSingletonAsset: false,
          fileBytes: fileBytes,
        };

        const res = await onUploadSupplierTerms({
          rfqId: rfqId,
          termsAndCondition: includeSupplierTc,
          documents: [docAsset],
        });

        if (res && "statusCode" in res && res.statusCode >= 400) {
          setSupplierTcStatusMsg(res.message || "Failed to upload terms document.");
          setUploadingSupplierTc(false);
          return;
        }

        setSupplierTcStatusMsg("Success! Supplier terms uploaded.");
      } catch (err: any) {
        setSupplierTcStatusMsg(err?.message || "Failed to upload document.");
        setUploadingSupplierTc(false);
        return;
      } finally {
        setUploadingSupplierTc(false);
      }
    }

    if (!isSupplier && activeBuyerTermsRejected) {
      if (!pendingBuyerTcFile) {
        setBuyerTcUploadStatusMsg("Please attach a Terms & Conditions document.");
        return;
      }
      if (onUploadBuyerTerms) {
        setUploadingBuyerTc(true);
        setBuyerTcUploadStatusMsg(null);
        try {
          const fileBytes = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.includes(",") ? result.split(",")[1] : result;
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(pendingBuyerTcFile);
          });

          const targetRfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
          const { entityId, entityType } = await getBuyerEntityType();
          const res = await onUploadBuyerTerms(targetRfqId, {
            entityId,
            entityType,
            assetType: "TERMS_CONDITION",
            fileName: pendingBuyerTcFile.name,
            contentType: pendingBuyerTcFile.type || resolveMimeType(undefined, pendingBuyerTcFile.name),
            isSingletonAsset: true,
            fileBytes,
          });

          if (res && "statusCode" in res && res.statusCode >= 400) {
            setBuyerTcUploadStatusMsg(res.message || "Failed to upload the Terms & Conditions document.");
            setUploadingBuyerTc(false);
            return;
          }

          setBuyerTcUploadStatusMsg("Success! Terms & Conditions document uploaded.");
          await loadLatestContractStatus();
        } catch (err: any) {
          setBuyerTcUploadStatusMsg(err?.message || "Failed to upload the Terms & Conditions document.");
          setUploadingBuyerTc(false);
          return;
        } finally {
          setUploadingBuyerTc(false);
        }
      }
    }

    const patch: Partial<ContractState> = {
      tcContent: c.tcDraft,
      tcEdited: true,
      tcLastUpdatedAt: timeStr,
      tcEditorOpen: false,
    };
    if (!isSupplier) patch.buyerTcFile = pendingBuyerTcFile;
    if (c.sent) {
      const sender = isSupplier ? "Supplier" : "Buyer";
      patch.messages = [
        ...c.messages,
        {
          sender,
          text: supplierTcFile
            ? `Supplier uploaded custom Terms & Conditions document (${supplierTcFile.name}).`
            : `${sender} updated the Terms & Conditions proposed edits.`,
          time: timeStr,
        },
      ];
    }
    updateContract(id, patch);
  };



  // Negotiation Actions
  const handleBuyerAcceptFinal = async (id: string) => {
    const targetRfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
    setBuyerTermsError(null);
    if (onAcceptSupplierTerms && targetRfqId) {
      try {
        const res = await onAcceptSupplierTerms(targetRfqId, resolveSupplierId(id), "APPROVE");
        if (res && "statusCode" in res && res.statusCode >= 400) {
          setBuyerTermsError(res.message || "Failed to accept the supplier's terms & conditions.");
          return;
        }
        await loadLatestContractStatus();
      } catch (err: any) {
        console.error("Failed to update supplier terms & conditions status:", err);
        setBuyerTermsError(err?.message || "Failed to accept the supplier's terms & conditions.");
        return;
      }
    }
    updateContract(id, { buyerFinalAccepted: true });
  };

  // Buyer: rejects the supplier's own Terms & Conditions. Unlike Accept, this does not set buyerFinalAccepted,
  // so signing stays blocked (supplierSignBlockedByPendingTcApproval) until the buyer accepts instead.
  const handleBuyerRejectFinal = async (id: string, comment?: string) => {
    const targetRfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
    setBuyerTermsError(null);
    if (onAcceptSupplierTerms && targetRfqId) {
      try {
        const res = await onAcceptSupplierTerms(targetRfqId, resolveSupplierId(id), "REJECT", comment);
        if (res && "statusCode" in res && res.statusCode >= 400) {
          setBuyerTermsError(res.message || "Failed to reject the supplier's terms & conditions.");
          return;
        }
        setShowRejectSupplierTermsComment(false);
        setRejectSupplierTermsComment("");
        await loadLatestContractStatus();
      } catch (err: any) {
        console.error("Failed to update supplier terms & conditions status:", err);
        setBuyerTermsError(err?.message || "Failed to reject the supplier's terms & conditions.");
      }
    }
  };

  // Buyer: "Reject" on the supplier's submitted Terms & Conditions opens this comment box instead of rejecting
  // right away - the API requires a comment explaining the rejection, collected before handleBuyerRejectFinal fires.
  const handleSubmitRejectSupplierTermsComment = () => {
    if (!rejectSupplierTermsComment.trim()) {
      setRejectSupplierTermsCommentError("Please add a comment explaining the rejection.");
      return;
    }
    setRejectSupplierTermsCommentError(null);
    handleBuyerRejectFinal(activeContractId, rejectSupplierTermsComment.trim());
  };

  const handleSupplierAcceptFinal = async (id: string) => {
    const rfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
    setUploadingSupplierTc(true);
    setSupplierTcStatusMsg(null);
    try {
      if (onAcceptBuyerTerms && rfqId) {
        const res = await onAcceptBuyerTerms(rfqId, "APPROVE");
        if (res && "statusCode" in res && res.statusCode >= 400) {
          setSupplierTcStatusMsg(res.message || "Failed to accept buyer terms & conditions.");
          setUploadingSupplierTc(false);
          return;
        }
      }
      setSupplierTcStatusMsg("Success! Buyer terms & conditions accepted.");
      await refreshTermsConditions();
      // Accepting the buyer's T&C only unlocks the Yes/No choice below - it does not by itself finish the T&C
      // phase, so supplierFinalAccepted/canProceedToSigning must not be set here (see canProceedToSigning).
      updateContract(id, { supplierFinalRejected: false });
      if (isSupplier) {
        setSupplierScreenAcceptance((prev) => ({ ...prev, buyerTermsAndConditionAccepted: "ACCEPTED" }));
      }
    } catch (err: any) {
      console.error("Failed to accept buyer terms & conditions:", err);
      setSupplierTcStatusMsg(err?.message || "Failed to accept terms.");
    } finally {
      setUploadingSupplierTc(false);
    }
  };

  const handleSupplierRejectFinal = async (id: string, comment?: string) => {
    const rfqId = rfq?.rfqId || rfq?.id || (rfq as any)?._id || id;
    setUploadingSupplierTc(true);
    setSupplierTcStatusMsg(null);
    try {
      if (onAcceptBuyerTerms && rfqId) {
        const res = await onAcceptBuyerTerms(rfqId, "REJECT", comment);
        if (res && "statusCode" in res && res.statusCode >= 400) {
          setSupplierTcStatusMsg(res.message || "Failed to reject buyer terms & conditions.");
          setUploadingSupplierTc(false);
          return;
        }
      }
      setSupplierTcStatusMsg("Buyer terms & conditions rejected. You cannot upload custom terms & conditions yet - accept the buyer's Terms & Conditions above first.");
      setHasSupplierTcChoice("yes");
      setShowRejectBuyerTermsComment(false);
      setRejectBuyerTermsComment("");
      await refreshTermsConditions();
      updateContract(id, { supplierFinalAccepted: false, supplierFinalRejected: true });
      if (isSupplier) {
        setSupplierScreenAcceptance((prev) => ({ ...prev, buyerTermsAndConditionAccepted: "REJECTED" }));
      }
    } catch (err: any) {
      console.error("Failed to reject buyer terms & conditions:", err);
      setSupplierTcStatusMsg(err?.message || "Failed to reject terms.");
    } finally {
      setUploadingSupplierTc(false);
    }
  };

  // Supplier: "Reject" on the buyer's Terms & Conditions opens this comment box instead of rejecting right away -
  // the API requires a comment explaining the rejection, so it's collected before handleSupplierRejectFinal fires.
  const handleSubmitRejectBuyerTermsComment = () => {
    if (!rejectBuyerTermsComment.trim()) {
      setRejectBuyerTermsCommentError("Please add a comment explaining the rejection.");
      return;
    }
    setRejectBuyerTermsCommentError(null);
    handleSupplierRejectFinal(activeContractId, rejectBuyerTermsComment.trim());
  };

  const handleConfirmContractName = () => {
    const name = contractNameDraft.trim();
    if (!name) {
      setContractNameError("Please enter a contract name.");
      return;
    }
    setContractName(name);
    setContractNameError(null);
    setShowContractNameModal(false);
  };

  const openContractNameEditor = () => {
    setContractNameDraft(contractName);
    setContractNameError(null);
    setShowContractNameModal(true);
  };

  // Buyer: invite one supplier per contract to review and negotiate Terms & Conditions. This no longer creates
  // the contract itself - that happens once both parties have signed (see handleCreateContract).
  // Stops at the first failure; contracts already sent stay sent. Returns an error message, or null on success.
  const sendContract = async (ids: string[]): Promise<string | null> => {
    if (ids.length === 0 || !rfqId) return "Contract not found.";
    for (const id of ids) {
      const c = contracts[id];
      if (!c) return "Contract not found.";
      try {
        const res = await inviteSupplierForContract({
          rfqId,
          supplierId: resolveSupplierId(c.supplierId),
        });
        if ("statusCode" in res && res.statusCode >= 400) {
          return [res.message || "Failed to send the contract.", res.description].filter(Boolean).join(" - ");
        }
        updateContract(id, { sent: true, step: "terms" });
      } catch (err: any) {
        return err?.message || "Failed to send the contract.";
      }
    }
    return null;
  };

  // The contract name defaults to the RFQ's title/number (see the contractName initializer above) - this is just
  // a fallback for the rare case the RFQ itself has neither, so contract creation is never blocked asking for one.
  const hasContractName = (): boolean => {
    if (contractName.trim()) return true;
    const fallback = ((rfq as any)?.rfqId || (rfq as any)?.id || rfqId || "Contract").toString().trim();
    setContractName(fallback);
    return true;
  };

  const handleSendToSupplier = async (id: string) => {
    setSendingContract(true);
    setSendContractError(null);
    const error = await sendContract([id]);
    if (error) {
      setSendContractError(error);
      toastService.error(error, 5000);
    } else {
      toastService.success("Contract terms sent to supplier for review.", 5000);
    }
    setSendingContract(false);
  };

  // Buyer, several awarded suppliers: the contracts still on the Details step that "Send" applies to.
  const pendingContractIds = awardedSupplierIds.filter(
    (id) => contracts[id]?.step === "details" && !contracts[id].dateError
  );
  const selectedPendingIds = selectAllSuppliers
    ? pendingContractIds
    : pendingContractIds.filter((id) => sendSelection[id]);
  const showBulkSendBar = !isSupplier && awardedSupplierIds.length > 1 && pendingContractIds.length > 0;

  // The bar at the bottom: with several suppliers selected it shows their combined value and all their names,
  // and its button sends to those suppliers. Otherwise it is for the supplier on screen.
  const sendBarIds = showBulkSendBar && selectedPendingIds.length > 1 ? selectedPendingIds : [activeContractId];
  const sendBarIsBulk = sendBarIds.length > 1;

  const handleBulkSend = async () => {
    setSendingContract(true);
    setSendContractError(null);
    const error = await sendContract(selectedPendingIds);
    if (error) {
      setSendContractError(error);
      toastService.error(error, 5000);
    } else {
      toastService.success("Contract terms sent to suppliers for review.", 5000);
      setSendSelection({});
    }
    setSendingContract(false);
  };

  // Buyer: once both sides' Terms & Conditions are accepted, "Approvals" is what actually creates the contract
  // record (and its approval chain) in the backend - not "Proceed to Signing" (see createContractRecord). Neither
  // party has signed yet at this point, so the attached PDF is built with no signatures (buildContractPdfInput's
  // sign-detail args are null) - it still merges in the line items, the contract template and both parties'
  // Terms & Conditions, the same way handleCreateContract does for the later, fully-signed copy.
  const handleSendForApprovals = async (id: string) => {
    const contract = contracts[id];
    if (!contract) return;
    if (!hasContractName()) return;
    setCreatingContract(true);
    try {
      const { entityId, entityType } = await getEntityTypeByKey("BUYER");
      const mergedPdfBytes = await buildMergedContractPdfBytes(
        buildContractPdfInput(id, contract, null, null)
      );
      const pdfAttachment = {
        entityId,
        entityType,
        assetType: "PREDEFINE_CONTRACT_ATTACHMENT",
        fileName: `${contract.contractNumber || "Contract"}.pdf`,
        contentType: "application/pdf",
        isSingletonAsset: false,
        fileBytes: uint8ArrayToBase64(mergedPdfBytes),
      };
      await createContractRecord(id, [pdfAttachment]);
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to create the contract.";
      setCreateContractError(errorMsg);
      toastService.error(errorMsg, 5000);
    } finally {
      setCreatingContract(false);
    }
  };

  // Moves to the Signing step. Buyer role: only reachable once the contract record already exists (via "Approvals"
  // above) - the button is not shown/enabled before that (see canProceedToSigning usage below).
  const handleProceedToSigning = (id: string) => {
    updateContract(id, { step: "sign" });
  };

  // Signing Actions
  const openESignModal = (id: string) => {
    setESignModalContractId(id);
    setDrawnSignatureData(null);
    setESignMethod("draw");
    setSignedContractFile(null);
    setSignerNameInput(
      isSupplier
        ? supplierName || getSupplierName(id) || "Supplier Representative"
        : buyerName || "Buyer"
    );
    setSignerDesignationInput(
      isSupplier ? "Authorized Representative" : buyerDesignation || "Procurement Manager"
    );
  };

  const confirmApplyESign = async (id: string) => {
    const c = contracts[id];
    if (!c) return;
    const timeStr = nowLabel();

    if (isSupplier) {
      const isBuyerSigned = c.buyerSigned;
      const signDetails: SignDetails = {
        signerName: signerNameInput.trim() || supplierName || getSupplierName(c.supplierId),
        signerDesignation: signerDesignationInput.trim() || "Authorized Representative",
        signedAt: timeStr,
        method: "e-sign",
        drawnSignatureUrl: drawnSignatureData || undefined,
      };
      const msg = {
        sender: "Supplier",
        text: `Supplier E-Signature applied by ${signDetails.signerName} (${signDetails.signerDesignation}).`,
        time: timeStr,
      };
      updateContract(id, {
        supplierSigned: true,
        supplierSignDetails: signDetails,
        messages: [...c.messages, msg],
        step: isBuyerSigned ? "completed" : "sign",
      });

      if (onUploadSupplierEsign) {
        const targetRfqId = rfq?.rfqId || rfq?.id || activeContractId || id;
        const rawBytes = drawnSignatureData
          ? (drawnSignatureData.includes(",") ? drawnSignatureData.split(",")[1] : drawnSignatureData)
          : "";
        const nameSlug = (signerNameInput.trim() || supplierName || "supplier").toLowerCase().replace(/\s+/g, "_");
        try {
          const { entityId, entityType } = await getSupplierEntityType();
          const payload = {
            entityId,
            entityType,
            assetType: "ESIGN",
            fileName: `${nameSlug}_signature.png`,
            isSingletonAsset: false,
            fileBytes: rawBytes,
          };
          await onUploadSupplierEsign(targetRfqId, payload);
          await refreshESigns();
          await refetchRfq?.(rfqId || targetRfqId);
        } catch (err) {
          console.error("Failed to upload supplier esign:", err);
        }
      }
    } else {
      const isSupplierSigned = c.supplierSigned;
      const signDetails: SignDetails = {
        signerName: signerNameInput.trim() || buyerName || "Buyer",
        signerDesignation: signerDesignationInput.trim() || buyerDesignation || "Procurement Manager",
        signedAt: timeStr,
        method: "e-sign",
        drawnSignatureUrl: drawnSignatureData || undefined,
      };
      const msg = {
        sender: "Buyer",
        text: `Applied E-Signature by ${signDetails.signerName} (${signDetails.signerDesignation}).`,
        time: timeStr,
      };
      updateContract(id, {
        buyerSigned: true,
        buyerSignDetails: signDetails,
        messages: [...c.messages, msg],
        step: isSupplierSigned ? "completed" : "sign",
      });

      if (onUploadBuyerEsign) {
        const targetRfqId = rfq?.rfqId || rfq?.id || activeContractId || id;
        const rawBytes = drawnSignatureData
          ? (drawnSignatureData.includes(",") ? drawnSignatureData.split(",")[1] : drawnSignatureData)
          : "";
        const nameSlug = (signerNameInput.trim() || "buyer").toLowerCase().replace(/\s+/g, "_");
        const payload = {
          entityType: "BuyerEsign",
          entityId: targetRfqId,
          assetType: "BuyerEsign",
          fileBytes: rawBytes,
          fileName: `${nameSlug}_signature.png`,
          contentType: "image/png",
          isSingletonAsset: true,
          id: targetRfqId,
        };
        try {
          await onUploadBuyerEsign(targetRfqId, payload);
          await refreshESigns();
        } catch (err) {
          console.error("Failed to upload buyer esign:", err);
        }
      }
    }
    setESignModalContractId(null);
  };

  const handleUploadSignedContract = (id: string, fileName?: string, fileObj?: File) => {
    const c = contracts[id];
    if (!c) return;
    const timeStr = nowLabel();

    if (isSupplier) {
      const isBuyerSigned = c.buyerSigned;
      const signDetails: SignDetails = {
        signerName: signerNameInput.trim() || supplierName || getSupplierName(c.supplierId),
        signerDesignation: signerDesignationInput.trim() || "Authorized Representative",
        signedAt: timeStr,
        method: "upload",
        fileName: fileName || "Signed_Contract_Supplier.pdf",
      };
      const msg = {
        sender: "Supplier",
        text: `Uploaded signed contract (${signDetails.fileName}).`,
        time: timeStr,
      };
      updateContract(id, {
        supplierSigned: true,
        supplierSignDetails: signDetails,
        messages: [...c.messages, msg],
        step: isBuyerSigned ? "completed" : "sign",
      });

      if (onUploadSupplierEsign && fileObj) {
        const targetRfqId = rfq?.rfqId || rfq?.id || activeContractId || id;
        const reader = new FileReader();
        reader.onload = async () => {
          const result = reader.result as string;
          const fileBytes = result.includes(",") ? result.split(",")[1] : result;
          try {
            const { entityId, entityType } = await getSupplierEntityType();
            const payload = {
              entityId,
              entityType,
              assetType: "ESIGN",
              fileName: fileObj.name || "Signed_Contract_Supplier.pdf",
              isSingletonAsset: false,
              fileBytes: fileBytes,
            };
            await onUploadSupplierEsign(targetRfqId, payload);
            await refreshESigns();
            await refetchRfq?.(rfqId || targetRfqId);
          } catch (err) {
            console.error("Failed to upload supplier esign file:", err);
          }
        };
        reader.readAsDataURL(fileObj);
      }
    } else {
      const isSupplierSigned = c.supplierSigned;
      const signDetails: SignDetails = {
        signerName: signerNameInput.trim() || buyerName || "Buyer",
        signerDesignation: signerDesignationInput.trim() || buyerDesignation || "Procurement Manager",
        signedAt: timeStr,
        method: "upload",
        fileName: fileName || "Signed_Contract_Buyer.pdf",
      };
      const msg = {
        sender: "Buyer",
        text: `Uploaded signed contract (${signDetails.fileName}).`,
        time: timeStr,
      };
      updateContract(id, {
        buyerSigned: true,
        buyerSignDetails: signDetails,
        messages: [...c.messages, msg],
        step: isSupplierSigned ? "completed" : "sign",
      });

      if (onUploadBuyerEsign && fileObj) {
        const targetRfqId = rfq?.rfqId || rfq?.id || activeContractId || id;
        const reader = new FileReader();
        reader.onload = async () => {
          const result = reader.result as string;
          const fileBytes = result.includes(",") ? result.split(",")[1] : result;
          const payload = {
            entityType: "BuyerEsign",
            entityId: targetRfqId,
            assetType: "BuyerEsign",
            fileBytes: fileBytes,
            fileName: fileObj.name || "Signed_Contract_Buyer.pdf",
            contentType: fileObj.type || "application/pdf",
            isSingletonAsset: true,
            id: targetRfqId,
          };
          try {
            await onUploadBuyerEsign(targetRfqId, payload);
            await refreshESigns();
          } catch (err) {
            console.error("Failed to upload buyer esign file:", err);
          }
        };
        reader.readAsDataURL(fileObj);
      }
    }
  };


  const stepOrderLabels = ["Details", "Terms", "Sign", "Completed"];
  const activeStepIdx = activeContract
    ? ["details", "terms", "sign", "completed"].indexOf(activeContract.step)
    : 0;

  // Active contract line items table rows calculation
  const activeLineItemRows = useMemo(() => {
    if (!activeContract) return [];
    const itemIdsToDisplay = (supplierItemsMap[activeContract.supplierId] && supplierItemsMap[activeContract.supplierId].length > 0)
      ? supplierItemsMap[activeContract.supplierId]
      : activeContract.itemIds;

    const suppQuotation =
      effectiveQuotations.find(
        (q: any) => (q.quotationId === activeContract.supplierId || q.supplierId === activeContract.supplierId || q._id === activeContract.supplierId)
      ) || effectiveQuotations[0];

    const isLot = Boolean(rfq?.addLotOption);

    return itemIdsToDisplay.map((itemId, idx) => {
      const item = lineItems.find(
        (x: any) => (x.id || x.itemId || x._id) === itemId
      ) || { description: "—", costCenter: "—", qty: 1, uom: "PCS" };

      const qi = suppQuotation ? resolveQuoteItem(suppQuotation, item) : null;
      const qty = item.quantity || item.qty || 1;

      if (qi) {
        const unitPrice = qi.quotedAmount ?? qi.quotedPrice ?? 0;
        const discount = qi.discount ?? (qi as any)?.discountPercentage ?? 0;
        const tax = qi.tax ?? (qi as any)?.taxPercentage ?? (qi as any)?.gst ?? 0;
        const delivery = qi.deliveryCharge ?? (qi as any)?.deliveryAmount ?? 0;
        const discountType = (qi as any)?.discountType || "PERCENTAGE";
        const taxType = (qi as any)?.taxType || "PERCENTAGE";
        const deliveryType = (qi as any)?.deliveryType || "PERCENTAGE";

        const discAmt = discount > 0 ? Math.round((unitPrice * qty) * (discount / 100)) : 0;
        const taxAmt = tax > 0 ? Math.round((unitPrice * qty - discAmt) * (tax / 100)) : 0;
        const subtotal = qi.subTotal ?? (unitPrice * qty - discAmt + taxAmt + delivery);

        // Each of these is either a flat AMOUNT (show in the RFQ's currency)
        // or a PERCENTAGE (show the raw value with a "%" suffix) depending
        // on its own *Type field - never both.
        const parts = [];
        if (tax > 0) parts.push(taxType === "AMOUNT" ? fmtINR(tax) : `${tax}%`);
        if (discount > 0) parts.push(discountType === "AMOUNT" ? `-${fmtINR(discount)}` : `-${discount}%`);
        if (delivery > 0) parts.push(deliveryType === "AMOUNT" ? fmtINR(delivery) : `${delivery}%`);
        const breakdownStr = parts.length > 0 ? parts.join(" / ") : "—";

        const cc = item.costCenter || item.costCenterCode || "—";
        const code = item.materialCode || item.code || "—";
        const ccCode = cc !== "—" && code !== "—" ? `${cc} / ${code}` : cc !== "—" ? cc : code;

        return {
          idx: idx + 1,
          material: item.description || item.name || "—",
          costCenterCode: ccCode,
          qty,
          uom: item.uom || item.unit || "PCS",
          unitPrice,
          breakdownStr,
          subtotal,
        };
      } else if (isLot && suppQuotation) {
        const tot = suppQuotation.totalPrice || 0;
        const itemShare = itemIdsToDisplay.length > 0 ? tot / itemIdsToDisplay.length : tot;
        const cc = item.costCenter || item.costCenterCode || "—";
        const code = item.materialCode || item.code || "—";
        const ccCode = cc !== "—" && code !== "—" ? `${cc} / ${code}` : cc !== "—" ? cc : code;

        return {
          idx: idx + 1,
          material: item.description || item.name || "—",
          costCenterCode: ccCode,
          qty,
          uom: item.uom || item.unit || "PCS",
          unitPrice: Math.round(itemShare / qty),
          breakdownStr: "Lump Sum (Lot)",
          subtotal: Math.round(itemShare),
        };
      } else {
        const cc = item.costCenter || item.costCenterCode || "—";
        const code = item.materialCode || item.code || "—";
        const ccCode = cc !== "—" && code !== "—" ? `${cc} / ${code}` : cc !== "—" ? cc : code;

        return {
          idx: idx + 1,
          material: item.description || item.name || "—",
          costCenterCode: ccCode,
          qty,
          uom: item.uom || item.unit || "PCS",
          unitPrice: 0,
          breakdownStr: "—",
          subtotal: 0,
        };
      }
    });
  }, [activeContract, lineItems, effectiveQuotations, getQuoteItemForRfqItem, resolveQuoteItem, rfq]);

  // Assembles the explicit, decoupled input the contractPdf module needs from this component's closures
  // (contract state, RFQ, computed totals/rows) - the PDF-drawing logic itself lives in ./ContractCreation/contractPdf.
  const buildContractPdfInput = (
    id: string,
    contract: ContractState,
    buyerSignDetails: SignDetails | null,
    supplierSignDetails: SignDetails | null,
    contractNumberOverride?: string
  ): ContractPdfInput => ({
    contractNumber: contractNumberOverride ?? contract.contractNumber,
    contractName: contractName.trim() || contract.contractNumber,
    supplierName: getSupplierName(contract.supplierId),
    rfqTitle: rfq?.title || rfq?.rfqNo || rfq?.name || "—",
    contractValue: getContractValue(id),
    currency,
    startDate: contract.startDate,
    endDate: contract.endDate,
    lineItemRows: activeLineItemRows,
    buyerTcContent: contract.tcContent,
    buyerTermsDocs,
    supplierTermsDocs: supplierTcDocsForContract,
    contractTemplateDocs,
    buyerSignDetails,
    supplierSignDetails,
    logoDataUrl,
  });

  // Downloads the executed contract (items, merged Terms & Conditions, both signatures) as one real PDF file -
  // the same merged document (with actual T&C PDF pages) that gets attached when the buyer creates the contract.
  const [downloadingContract, setDownloadingContract] = useState(false);
  const [viewingContract, setViewingContract] = useState(false);

  // Builds the merged executed-contract PDF (items, merged Terms & Conditions, both signatures), then either
  // opens it in a new tab (View Contract) or downloads it (Download Contract).
  const handleViewOrDownloadContract = async (preview: boolean) => {
    const bothSigned = buyerBothSigned || (activeContract?.buyerSigned && activeContract?.supplierSigned);
    if (!activeContract || !bothSigned) return;

    const setBusy = preview ? setViewingContract : setDownloadingContract;
    setBusy(true);
    // Open the tab right away, while still inside the click, so the browser doesn't block it after the PDF is built.
    const previewTab = preview ? window.open("", "_blank") : null;
    if (previewTab) previewTab.opener = null;
    try {
      const [effectiveBuyerSignDetails, effectiveSupplierSignDetails] = await Promise.all([
        resolveEffectiveSignDetails(
          activeContract.buyerSignDetails,
          Boolean(activeContract.buyerSigned || rfqBuyerSigned),
          isSupplier ? (rfq as any)?.buyerESignDocuments?.[0] : (rfq as any)?.eSignDocuments?.[0],
          "Buyer"
        ),
        resolveEffectiveSignDetails(
          activeContract.supplierSignDetails,
          Boolean(activeContract.supplierSigned || rfqSupplierSigned),
          !isSupplier ? activeEsignEntry?.attachments?.[0] : (rfq as any)?.eSignDocuments?.[0],
          activeEsignEntry?.supplierName || getSupplierName(activeContract.supplierId)
        ),
      ]);

      const mergedBytes = await buildMergedContractPdfBytes(
        buildContractPdfInput(
          activeContractId,
          activeContract,
          effectiveBuyerSignDetails,
          effectiveSupplierSignDetails,
          activeCreated ? activeCreated.contractNumber || activeContract.contractNumber : "XXXXXXX"
        )
      );
      const contractNumber = activeCreated ? activeCreated.contractNumber || activeContract.contractNumber || "Contract" : "XXXXXXX";
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      if (preview) {
        if (previewTab) {
          previewTab.location.href = url;
        } else {
          window.open(url, "_blank", "noopener,noreferrer");
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${contractNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      previewTab?.close();
      console.error("Failed to generate the contract PDF:", err);
      alert(preview ? "Unable to preview the contract PDF. Please try again." : "Failed to generate the contract PDF. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleViewContract = () => handleViewOrDownloadContract(true);
  const handleDownloadContract = () => handleViewOrDownloadContract(false);

  // Buyer: creates the contract record in the backend (with its approval chain) and stores the result locally.
  // Shared by handleProceedToSigning (the normal path: created as soon as both sides' Terms & Conditions are
  // accepted, before either party signs) and handleCreateContract (a fallback for a contract that reaches
  // "both signed" without having been created yet, e.g. one already in flight before this screen changed).
  // Creating the signed contract makes the backend send it to the buyer's ERP, when the buyer has a contract API
  // (POST_CONTRACT); without one nothing is called. The contract is created either way, so this only reports how the
  // hand-off went, from the created contract: its ERP contract id, or the reason it failed.
  const toastContractErpOutcome = (created: ContractDetails) => {
    if (created.erpContractId) {
      toastService.success(`Contract sent to the ERP. ERP contract ID: ${created.erpContractId}`, 5000);
    } else if (created.erpSyncStatus === "FAILED" || created.erpSyncStatus === "UNKNOWN") {
      toastService.warning("Contract created, but ERP synchronization failed.", 5000);
    }
  };

  const createContractRecord = async (
    id: string,
    attachments: CreateBuyerContractPayload["attachments"],
    options?: { syncWithErp?: boolean }
  ): Promise<boolean> => {
    const contract = contracts[id];
    if (!contract || !rfqId || createdContracts[id]) return Boolean(createdContracts[id]);
    if (!hasContractName()) return false;
    setCreatingContract(true);
    setCreateContractError(null);
    try {
      const res = await createBuyerContract({
        contractName: contractName.trim(),
        rfqId,
        supplierId: resolveSupplierId(contract.supplierId),
        startDate: `${contract.startDate}T00:00:00.000Z`,
        endDate: `${contract.endDate}T00:00:00.000Z`,
        amount: getContractValue(id),
        attachments,
        syncWithErp: options?.syncWithErp,
      });
      if (res.statusCode >= 400) {
        const errorMsg = [res.message || "Failed to create the contract.", "description" in res ? res.description : ""].filter(Boolean).join(" - ");
        setCreateContractError(errorMsg);
        toastService.error(errorMsg, 5000);
        return false;
      }
      let createdContract: ContractDetails | null = null;
      if ("id" in res && res.id) {
        const created = await fetchBuyerContractById(res.id);
        if (!("statusCode" in created)) {
          createdContract = created;
          setCreatedContracts((prev) => ({ ...prev, [id]: created }));
        }
      }
      toastService.success("Contract created successfully.", 5000);
      if (options?.syncWithErp && createdContract) {
        toastContractErpOutcome(createdContract);
      }
      // Refresh the RFQ's contract/terms/e-sign status (GET /api/v1/buyer/rfq-by-id) so the newly created
      // contract shows up without requiring a manual reload.
      await loadLatestContractStatus();
      return true;
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to create the contract.";
      setCreateContractError(errorMsg);
      toastService.error(errorMsg, 5000);
      return false;
    } finally {
      setCreatingContract(false);
    }
  };

  // Buyer: once both parties have signed, create the contract if it wasn't already (see createContractRecord) -
  // with the buyer's Terms & Conditions and the executed contract PDF (items, merged T&C, both signatures) attached.
  const handleCreateContract = async (id: string) => {
    const contract = contracts[id];
    const bothSigned = buyerBothSigned || (contract?.buyerSigned && contract?.supplierSigned);
    if (!contract || !bothSigned) return;
    // A predefined contract ref not in "OPEN" status has already been executed - nothing left to do.
    const existingRef = contractRefs.find((ref) => String(ref.supplierId) === resolveSupplierId(contract.supplierId));
    if (existingRef && existingRef.status !== "OPEN") return;
    if (!hasContractName()) return;
    setCreatingContract(true);
    setCreateContractError(null);
    try {
      const { entityId, entityType } = await getEntityTypeByKey("BUYER");
      const [buyerSignDetails, supplierSignDetails] = await Promise.all([
        resolveEffectiveSignDetails(
          contract.buyerSignDetails,
          Boolean(contract.buyerSigned || rfqBuyerSigned),
          (rfq as any)?.eSignDocuments?.[0],
          "Buyer"
        ),
        resolveEffectiveSignDetails(
          contract.supplierSignDetails,
          Boolean(contract.supplierSigned || rfqSupplierSigned),
          activeEsignEntry?.attachments?.[0],
          activeEsignEntry?.supplierName || getSupplierName(contract.supplierId)
        ),
      ]);
      const mergedPdfBytes = await buildMergedContractPdfBytes(
        buildContractPdfInput(id, contract, buyerSignDetails, supplierSignDetails)
      );
      const pdfAttachment = {
        entityId,
        entityType,
        assetType: "PREDEFINE_CONTRACT_ATTACHMENT",
        fileName: `${contract.contractNumber || "Contract"}.pdf`,
        contentType: "application/pdf",
        isSingletonAsset: false,
        fileBytes: uint8ArrayToBase64(mergedPdfBytes),
      };
      if (existingRef) {
        // The predefined contract already exists (created during "Approvals") and is still OPEN - execute it
        // with the fully-signed PDF rather than creating another one.
        const res = await finalizeBuyerContract({
          predefinedContractId: existingRef.contractId,
          attachment: { asset: pdfAttachment },
        });
        if ("statusCode" in res && res.statusCode >= 400) {
          const errorMsg = [res.message || "Failed to execute the contract.", "description" in res ? res.description : ""].filter(Boolean).join(" - ");
          setCreateContractError(errorMsg);
          toastService.error(errorMsg, 5000);
          return;
        }
        const created = await fetchBuyerContractById(existingRef.contractId);
        if (!("statusCode" in created)) {
          setCreatedContracts((prev) => ({ ...prev, [id]: created }));
        }
        toastService.success("Contract executed successfully.", 5000);
        if (!("statusCode" in created)) {
          toastContractErpOutcome(created);
        }
        await loadLatestContractStatus();
      } else {
        // No record existed yet: it is created now with the fully-signed PDF, so it goes to the ERP right away.
        await createContractRecord(id, [pdfAttachment], { syncWithErp: true });
      }
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to create the contract.";
      setCreateContractError(errorMsg);
      toastService.error(errorMsg, 5000);
    } finally {
      setCreatingContract(false);
    }
  };

  return (
    <div className="bca-contract-workspace">
      {/* Top Back Navigation */}
      <button
        type="button"
        onClick={onBack}
        className="contract-back-btn"
      >
        ← {isSupplier ? "Back to Quotation Summary" : "Back to Bid Comparison & Award"}
      </button>

      {/* Header and Step Chips */}
      <div className="contract-header">
        <div>
          <h1 className="contract-title">
            {isSupplier ? (activeCreated?.contractName || "Contract Review & Execution") : activeCreated?.contractName ? (
              activeCreated.contractName
            ) : contractName ? (
              <>
                {contractName}
                <button
                  type="button"
                  onClick={openContractNameEditor}
                  className="contract-btn contract-btn--soft contract-btn--xs"
                  style={{ marginLeft: "10px", verticalAlign: "middle" }}
                  aria-label="Edit contract name"
                  title="Edit contract name"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              </>
            ) : "Contract Creation"}
          </h1>
          <div className="contract-stepper">
            {stepOrderLabels.map((label, i) => {
              const isActive = i === activeStepIdx;
              const isDone = i < activeStepIdx;
              const isLast = i === stepOrderLabels.length - 1;
              return (
                <React.Fragment key={label}>
                  <div className={`contract-step${isActive ? " contract-step--active" : isDone ? " contract-step--done" : ""}`}>
                    <span className="contract-step-dot">{isDone ? "✓" : i + 1}</span>
                    <span className="contract-step-label">{label}</span>
                  </div>
                  {!isLast && (
                    <span className={`contract-step-connector${isDone ? " contract-step-connector--done" : ""}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        {activeContract && (
          <div className="contract-step-indicator">
            Step {Math.max(activeStepIdx, 0) + 1} of {stepOrderLabels.length}
          </div>
        )}
      </div>

      {!isSupplier && latestLoading && (
        <div className="contract-chat-hint">Loading the latest terms &amp; conditions and e-sign status...</div>
      )}
      {!isSupplier && latestError && (
        <div className="contract-status-msg">{latestError}</div>
      )}
      {contractLoadError && (
        <div className="contract-status-msg">{contractLoadError}</div>
      )}

      {/* Bulk send bar for several awarded suppliers (buyer) */}
      {showBulkSendBar && (
        <>
          <div className="contract-info-bar contract-info-bar--bulk">
            <label className="contract-bulk-label">
              <input
                type="checkbox"
                className="contract-checkbox"
                checked={selectAllSuppliers}
                onChange={() => {
                  setSelectAllSuppliers(!selectAllSuppliers);
                  setSendSelection({});
                }}
              />
              Select All Suppliers
            </label>
            <button
              type="button"
              onClick={handleBulkSend}
              disabled={selectedPendingIds.length === 0 || sendingContract}
              className="contract-btn contract-btn--primary contract-btn--md"
            >
              {sendingContract
                ? "Sending..."
                : selectAllSuppliers
                  ? `Send to All Suppliers (${pendingContractIds.length})`
                  : `Send Selected Suppliers (${selectedPendingIds.length})`}
            </button>
          </div>
          <div className="contract-chat-hint">
            {selectAllSuppliers
              ? "Uncheck to pick individual suppliers to send to below."
              : "Tick the suppliers to send to below."}
          </div>
          {sendContractError && <div className="contract-status-msg">{sendContractError}</div>}
        </>
      )}

      {/* Supplier Tabs */}
      {!isSupplier && awardedSupplierIds.length > 1 && (
        <div className="contract-supplier-tabs">
          {awardedSupplierIds.map((sid) => {
            const c = contracts[sid];
            const name = getSupplierName(sid);
            const val = getContractValue(sid);
            const isSelected = sid === activeContractId;
            let statusText = "Details";
            if (c?.step === "completed") statusText = "Completed ✓";
            else if (c?.step === "sign") statusText = "Awaiting Signature";
            else if (c?.step === "terms" && c.sent) statusText = "Awaiting Supplier Review";
            const showCheck = !selectAllSuppliers && c?.step === "details" && !c?.dateError;

            return (
              <div key={sid} className="contract-inline-group">
                {showCheck && (
                  <input
                    type="checkbox"
                    className="contract-checkbox contract-checkbox--sm"
                    checked={!!sendSelection[sid]}
                    onChange={() => setSendSelection((prev) => ({ ...prev, [sid]: !prev[sid] }))}
                    aria-label={`Send to ${name}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setActiveContractId(sid)}
                  className={`contract-supplier-tab${isSelected ? " contract-supplier-tab--selected" : ""}`}
                >
                  {name} — {fmtINR(val)}
                  <br />
                  <span className="contract-supplier-tab-status">
                    {statusText}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Contract Details Workspace Card */}
      {activeContract && (
        <div className="contract-workspace-card">
          <div className="contract-workspace-title">
            Contract Details {`— ${getSupplierName(activeContract.supplierId)}`}
          </div>

          {/* Details Row Grid */}
          <div className="contract-details-grid">
            <DetailField label="RFQ TITLE">
              <div className="contract-field-value">
                {rfq?.title || rfq?.rfqNo || rfq?.name || "Office IT Equipment Procurement"}
              </div>
            </DetailField>

            <DetailField label="SUPPLIER">
              <div className="contract-field-value">{getSupplierName(activeContract.supplierId)}</div>
            </DetailField>

            {activeCreated && (
              <>
                <DetailField label="CONTRACT NAME">
                  <div className="contract-field-value">{activeCreated.contractName}</div>
                </DetailField>

                <DetailField label="CONTRACT NUMBER">
                  <div className="contract-field-value">{activeCreated.contractNumber}</div>
                </DetailField>
              </>
            )}

            <DetailField label="CONTRACT START DATE">
              <input
                type="date"
                value={activeContract.startDate}
                onChange={(e) => handleStartDateChange(activeContract.supplierId, e.target.value)}
                disabled={Boolean(activeCreated) || (activeContract.buyerSigned && activeContract.supplierSigned)}
                className="contract-date-input"
              />
            </DetailField>

            <DetailField label="CONTRACT END DATE">
              <input
                type="date"
                value={activeContract.endDate}
                onChange={(e) => handleEndDateChange(activeContract.supplierId, e.target.value)}
                disabled={Boolean(activeCreated) || (activeContract.buyerSigned && activeContract.supplierSigned)}
                className="contract-date-input"
              />
              {activeContract.dateError && (
                <div className="contract-field-error">
                  End date cannot be earlier than start date.
                </div>
              )}
            </DetailField>

            <DetailField label="RFQ DESCRIPTION" wide>
              <div className="contract-field-text">
                {rfq?.description || "Procurement of laptops and accessories for the new office."}
              </div>
            </DetailField>

            {contractTemplateDocs.length > 0 && (
              <DetailField label="CONTRACT TEMPLATE" wide>
                {renderTermsDocs(contractTemplateDocs)}
              </DetailField>
            )}
          </div>

          {/* Selected Line Items Section */}
          <h4 className="contract-section-title">
            Selected Line Items
          </h4>

          <div className="contract-table-wrap">
            <table className="contract-table">
              <thead>
                <tr className="contract-table-head-row">
                  <th className="contract-th contract-th--index">#</th>
                  <th className="contract-th">Material</th>
                  <th className="contract-th">Cost Center / Code</th>
                  <th className="contract-th contract-th--center">Qty</th>
                  <th className="contract-th contract-th--center">UOM</th>
                  <th className="contract-th contract-th--right">Unit Price</th>
                  <th className="contract-th contract-th--right">Tax / Disc. / Del.</th>
                  <th className="contract-th contract-th--right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {activeLineItemRows.map((row) => (
                  <tr key={row.idx} className="contract-table-row">
                    <td className="contract-td contract-td--muted">{row.idx}</td>
                    <td className="contract-td contract-td--strong">{row.material}</td>
                    <td className="contract-td contract-td--secondary">{row.costCenterCode}</td>
                    <td className="contract-td contract-td--center">{row.qty}</td>
                    <td className="contract-td contract-td--center">{row.uom}</td>
                    <td className="contract-td contract-td--right contract-td--strong">
                      {fmtINR(row.unitPrice)}
                    </td>
                    <td className="contract-td contract-td--right contract-td--breakdown">
                      {row.breakdownStr}
                    </td>
                    <td className="contract-td contract-td--right contract-td--total">
                      {fmtINR(row.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="contract-total-row">
            <div className="contract-total-box">
              Total Contract Value:{" "}
              <span className="contract-total-value">
                {fmtINR(getContractValue(activeContractId))}
              </span>
            </div>
          </div>

          {/* Terms & Conditions Attachment Card */}
          <div className="contract-subsection-title">
            Terms &amp; Conditions
          </div>

          {/* Acceptance Gate, shown up front so both parties see where things stand before reading through the
              documents below. Buyer role: rfq-by-id returns buyerTermsAndConditionStatuses /
              supplierTermsAndConditionAccepted as per-supplier arrays, matched against the active supplier
              tab (activeSupplierId). Supplier role: rfq-by-id returns these as flat booleans for the single
              buyer-supplier context, used directly. See activeBuyerTermsAccepted / activeSupplierTermsAccepted. */}
          <div className="contract-accept-summary">
            <span className={`contract-accept-status${activeSupplierTermsAccepted || buyerSideTermsResolved ? " contract-accept-status--done" : activeSupplierTermsRejected ? " contract-accept-status--rejected" : " contract-accept-status--pending"}`}>
              <span className="contract-accept-status-icon" aria-hidden="true">
                {activeSupplierTermsAccepted || buyerSideTermsResolved ? "✓" : activeSupplierTermsRejected ? "✕" : "⏳"}
              </span>
              Buyer — {activeSupplierTermsAccepted || buyerSideTermsResolved ? "Accepted" : activeSupplierTermsRejected ? "Rejected" : "Awaiting Acceptance"}
            </span>
            <span className={`contract-accept-status${activeBuyerTermsAccepted ? " contract-accept-status--done" : activeBuyerTermsRejected ? " contract-accept-status--rejected" : " contract-accept-status--pending"}`}>
              <span className="contract-accept-status-icon" aria-hidden="true">
                {activeBuyerTermsAccepted ? "✓" : activeBuyerTermsRejected ? "✕" : "⏳"}
              </span>
              Supplier — {activeBuyerTermsAccepted ? "Accepted" : activeBuyerTermsRejected ? "Rejected" : "Awaiting Acceptance"}
            </span>
          </div>

          <div className="contract-tc-card">
            <div>
              <div className="contract-tc-name">
                Buyer Terms & Conditions
              </div>
              {buyerTermsDocs.length > 0 ? renderTermsDocs(buyerTermsDocs) : (
                <div className="contract-tc-file">
                  Terms_and_Conditions.pdf
                </div>
              )}
              <div className="contract-tc-meta">
                <span
                  className={`contract-tc-updated${activeContract.tcEdited ? " contract-tc-updated--edited" : ""}`}
                >
                  {activeContract.tcEdited
                    ? `Last Updated: ${activeContract.tcLastUpdatedAt}`
                    : "Fetched from RFQ"}
                </span>
                {!isSupplier && activeContract.buyerTcFile && (
                  <span className="contract-tc-updated contract-tc-updated--edited">
                    {" "}· Attached: {activeContract.buyerTcFile.name}
                  </span>
                )}
              </div>
              {showBuyerTermsDecision && supplierTcStatusMsg && (
                <div className={supplierTcStatusMsgClass}>
                  {supplierTcStatusMsg}
                </div>
              )}
            </div>

            <div className="contract-actions">
              {buyerTermsDocs.length === 0 && (
                <button
                  type="button"
                  onClick={() => alert(activeContract.tcContent)}
                  className="contract-btn contract-btn--outline contract-btn--md"
                >
                  Preview
                </button>
              )}
              {!isSupplier && (
                <button
                  type="button"
                  onClick={() => openTcEditor(activeContractId)}
                  disabled={!activeBuyerTermsRejected || (activeContract.buyerSigned && activeContract.supplierSigned)}
                  title={!activeBuyerTermsRejected ? "Available once the supplier rejects the buyer's Terms & Conditions." : undefined}
                  className="contract-btn contract-btn--outline contract-btn--md"
                >
                  Proposed Edits
                </button>
              )}
              {showBuyerTermsDecision && (
                <>
                  <button
                    type="button"
                    onClick={() => handleSupplierAcceptFinal(activeContractId)}
                    disabled={uploadingSupplierTc || activeBuyerTermsAccepted}
                    className={`contract-btn contract-btn--md ${activeBuyerTermsAccepted ? "contract-btn--accepted" : "contract-btn--accept"}`}
                  >
                    {uploadingSupplierTc && !activeBuyerTermsAccepted
                      ? "Submitting..."
                      : activeBuyerTermsAccepted
                        ? "✓ Supplier Accepted"
                        : "Accept"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectBuyerTermsCommentError(null);
                      setShowRejectBuyerTermsComment(true);
                    }}
                    disabled={uploadingSupplierTc || activeBuyerTermsRejected}
                    className={`contract-btn contract-btn--md ${activeBuyerTermsRejected ? "contract-btn--rejected" : "contract-btn--danger"}`}
                  >
                    {uploadingSupplierTc && !activeBuyerTermsRejected
                      ? "Submitting..."
                      : activeBuyerTermsRejected
                        ? "✕ Supplier Rejected"
                        : "Reject"}
                  </button>
                </>
              )}
            </div>
            {/* Supplier: reason for rejecting the buyer's Terms & Conditions - the API requires a comment on
                rejection, so it's collected here before the reject call is sent. */}
            {showBuyerTermsDecision && showRejectBuyerTermsComment && !activeBuyerTermsRejected && (
              <div className="contract-dashed-box contract-dashed-box--inline" style={{ flexBasis: "100%", marginTop: 12 }}>
                <label className="contract-field-label" htmlFor="reject-buyer-terms-comment">
                  REASON FOR REJECTION
                </label>
                <textarea
                  id="reject-buyer-terms-comment"
                  className="contract-tc-textarea"
                  rows={3}
                  value={rejectBuyerTermsComment}
                  onChange={(e) => setRejectBuyerTermsComment(e.target.value)}
                  placeholder="Let the buyer know why you're rejecting their Terms & Conditions..."
                />
                {rejectBuyerTermsCommentError && (
                  <div className="contract-field-error">{rejectBuyerTermsCommentError}</div>
                )}
                <div className="contract-actions" style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={handleSubmitRejectBuyerTermsComment}
                    disabled={uploadingSupplierTc}
                    className="contract-btn contract-btn--md contract-btn--danger"
                  >
                    {uploadingSupplierTc ? "Submitting..." : "Submit Rejection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRejectBuyerTermsComment(false);
                      setRejectBuyerTermsComment("");
                      setRejectBuyerTermsCommentError(null);
                    }}
                    disabled={uploadingSupplierTc}
                    className="contract-btn contract-btn--outline contract-btn--md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Supplier's own Terms & Conditions documents, from the supplier's rfq-by-id */}
          {supplierOwnTcDocs.length > 0 && (
            <div className="contract-tc-card">
              <div>
                <div className="contract-tc-name">
                  Supplier Terms &amp; Conditions
                </div>
                {renderTermsDocs(supplierOwnTcDocs)}
              </div>
            </div>
          )}

          {/* Buyer: send the contract to the supplier (POST /api/v1/buyer/contract). Hidden once this supplier
              has already accepted the buyer's terms (buyerTermsAndConditionStatuses[].buyerTermsAndConditionAccepted
              for the active supplier, i.e. activeBuyerTermsAccepted) — nothing left to send. */}
          {!isSupplier && activeContract.step === "details" && !activeBuyerTermsAccepted && (
            <div>
              <div className="contract-info-bar contract-info-bar--send">
                <div className="contract-send-summary">
                  {contractName.trim() && <span>Contract: {contractName.trim()}</span>}
                  <span>Contract Value: {fmtINR(sendBarIds.reduce((sum, id) => sum + getContractValue(id), 0))}</span>
                  <span>Line Items: {sendBarIds.reduce((sum, id) => sum + (contracts[id]?.itemIds.length ?? 0), 0)}</span>
                  <span>
                    Supplier{sendBarIsBulk ? "s" : ""}: {sendBarIds.map((id) => getSupplierName(id)).join(", ")}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={sendBarIsBulk ? handleBulkSend : () => handleSendToSupplier(activeContractId)}
                  disabled={(!sendBarIsBulk && activeContract.dateError) || sendingContract}
                  className="contract-btn contract-btn--primary contract-btn--md"
                >
                  {sendingContract ? "Sending..." : sendBarIsBulk ? "Send to Suppliers" : "Send to Supplier"}
                </button>
              </div>
              {sendContractError && !showBulkSendBar && <div className="contract-status-msg">{sendContractError}</div>}
            </div>
          )}

          {/* Edit Terms Modal Overlay */}
          {activeContract.tcEditorOpen && (
            <div className="contract-modal-overlay">
              <div className="contract-modal contract-modal--terms">
                <div className="contract-modal-title">
                  {isSupplier ? "Propose Edits & Upload Supplier Terms" : "Edit Terms & Conditions"}
                </div>
                {!isSupplier && (
                  <div className="contract-dashed-box contract-dashed-box--modal">
                    <div className="contract-upload-title">Upload Terms &amp; Conditions Document</div>
                    <div className="contract-help-text">
                      The supplier rejected the current Terms &amp; Conditions. Attach a revised document (PDF/DOCX)
                      to send to the supplier for review.
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setPendingBuyerTcFile(e.target.files[0]);
                          setBuyerTcUploadStatusMsg(null);
                        }
                      }}
                      className="contract-file-input"
                    />
                    {pendingBuyerTcFile && (
                      <div className="contract-selected-file">
                        📄 Selected file: {pendingBuyerTcFile.name} ({(pendingBuyerTcFile.size / 1024).toFixed(1)} KB)
                        {" "}
                        <button
                          type="button"
                          onClick={() => setPendingBuyerTcFile(null)}
                          className="contract-btn contract-btn--outline contract-btn--xs"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    {buyerTcUploadStatusMsg && (
                      <div className={buyerTcUploadStatusMsgClass}>
                        {buyerTcUploadStatusMsg}
                      </div>
                    )}
                  </div>
                )}
                {isSupplier && (
                  <div className="contract-dashed-box contract-dashed-box--modal">
                    <label className="contract-check-label">
                      <input
                        type="checkbox"
                        checked={includeSupplierTc}
                        onChange={(e) => setIncludeSupplierTc(e.target.checked)}
                      />
                      Include Supplier Terms &amp; Conditions Document
                    </label>
                    <div className="contract-help-text">
                      Attach your company's custom terms and conditions document (PDF/DOCX) for buyer review.
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSupplierTcFile(e.target.files[0]);
                          setSupplierTcStatusMsg(null);
                        }
                      }}
                      className="contract-file-input"
                    />
                    {supplierTcFile && (
                      <div className="contract-selected-file">
                        📄 Selected file: {supplierTcFile.name} ({(supplierTcFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                    {supplierTcStatusMsg && (
                      <div className={supplierTcStatusMsgClass}>
                        {supplierTcStatusMsg}
                      </div>
                    )}
                  </div>
                )}
                <div className="contract-modal-actions">
                  <button
                    type="button"
                    onClick={() => closeTcEditor(activeContractId)}
                    className="contract-btn contract-btn--outline contract-btn--modal"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveTcEditor(activeContractId)}
                    disabled={uploadingBuyerTc}
                    className="contract-btn contract-btn--primary contract-btn--modal"
                  >
                    {uploadingBuyerTc ? "Uploading..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Step: Terms Negotiation & Acceptance */}
          {showTermsAcceptanceCard && (
            <div className="contract-step-card">
              {/* Supplier: once the supplier has signed, their T&C choice (own terms or the buyer's) is already
                  final - re-showing this radio/choice prompt during signing would be redundant and misleading. */}
              {isSupplier && !activeContract.supplierSigned && (<>
              <div className="contract-subsection-title contract-subsection-title--tight">
                Buyer Terms Review &amp; Acceptance
              </div>
              <div className="contract-terms-actions">
                {isSupplier ? (
                  <div>
                    {/* Radio Question Prompt */}
                    <div className="contract-panel-heading">
                      Is there any Supplier Terms &amp; Conditions?
                    </div>

                    <div className="contract-radio-group">
                      <label className="contract-radio-label">
                        <input
                          type="radio"
                          name={`hasSupplierTcRadio_${activeContractId}`}
                          value="yes"
                          checked={hasSupplierTcChoice === "yes"}
                          disabled={!activeBuyerTermsAccepted}
                          onChange={() => {
                            setHasSupplierTcChoice("yes");
                            setSupplierTcStatusMsg(null);
                          }}
                        />
                        Yes (Upload Supplier Terms &amp; Conditions)
                      </label>
                      <label className="contract-radio-label">
                        <input
                          type="radio"
                          name={`hasSupplierTcRadio_${activeContractId}`}
                          value="no"
                          checked={hasSupplierTcChoice === "no"}
                          disabled={!activeBuyerTermsAccepted}
                          onChange={() => {
                            setHasSupplierTcChoice("no");
                            setSupplierTcStatusMsg(null);
                          }}
                        />
                        No (Proceed with Buyer Terms &amp; Conditions)
                      </label>
                    </div>
                    {!activeBuyerTermsAccepted && (
                      <div className="contract-upload-help">
                        Accept the buyer's Terms &amp; Conditions above to make this choice.
                      </div>
                    )}

                    {/* IF NO: No supplier terms - confirms termsAndCondition=false so the buyer's flow can proceed;
                        Accept / Reject of the buyer's terms is still in the "Contract Terms & Conditions" card above.
                        Only shown once the buyer's terms have actually been accepted - "no" is the default choice,
                        so without this check the button below would render enabled before that Accept/Reject. */}
                    {activeBuyerTermsAccepted && hasSupplierTcChoice === "no" && (
                      <div className="contract-dashed-box contract-dashed-box--inline">
                        <div className="contract-upload-help">
                          Use Accept or Reject in the Contract Terms &amp; Conditions section above to respond to the buyer's terms.
                        </div>
                        <button
                          type="button"
                          onClick={() => handleProceedWithBuyerTc(activeContractId)}
                          disabled={uploadingSupplierTc || activeTcEntry?.termsAndCondition === false || supplierProceededWithBuyerTc}
                          className={`contract-btn contract-btn--md ${activeTcEntry?.termsAndCondition === false || supplierProceededWithBuyerTc ? "contract-btn--accepted" : "contract-btn--primary"}`}
                        >
                          {uploadingSupplierTc
                            ? "Submitting..."
                            : activeTcEntry?.termsAndCondition === false || supplierProceededWithBuyerTc
                              ? "✓ Proceeding with Buyer T&C"
                              : "Proceed with Buyer T&C"}
                        </button>
                      </div>
                    )}

                    {/* IF YES: Show File Upload Card - upload sends termsAndCondition=true with the document.
                        Also gated on activeBuyerTermsAccepted: rejecting the buyer's terms pre-selects "yes"
                        (see handleSupplierRejectFinal) but must not unlock the upload step by itself - the
                        buyer's terms still need to be accepted first. */}
                    {activeBuyerTermsAccepted && hasSupplierTcChoice === "yes" && (
                      <div className="contract-dashed-box contract-dashed-box--inline">
                        <div className="contract-upload-title">
                          Upload Supplier Terms &amp; Conditions Document
                        </div>
                        <div className="contract-upload-help">
                          Attach your company's custom terms and conditions document (.pdf, .doc, .docx) to submit to the buyer.
                        </div>
                        <div className="contract-upload-row">
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setSupplierTcFile(e.target.files[0]);
                                setSupplierTcStatusMsg(null);
                              }
                            }}
                            className="contract-file-input"
                          />
                          <button
                            type="button"
                            onClick={() => handleUploadSupplierTcFileDirect(activeContractId)}
                            disabled={!supplierTcFile || uploadingSupplierTc}
                            className="contract-btn contract-btn--primary contract-btn--lg"
                          >
                            {uploadingSupplierTc ? "Uploading..." : "Upload & Submit Terms"}
                          </button>
                        </div>
                        {supplierTcFile && (
                          <div className="contract-selected-file">
                            📄 Selected file: {supplierTcFile.name} ({(supplierTcFile.size / 1024).toFixed(1)} KB)
                          </div>
                        )}
                        {supplierTcStatusMsg && (
                          <div className={supplierTcStatusMsgClass}>
                            {supplierTcStatusMsg}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBuyerAcceptFinal(activeContractId)}
                      className={`contract-btn contract-btn--md ${activeContract.buyerFinalAccepted ? "contract-btn--accepted" : "contract-btn--accept"}`}
                    >
                      {activeContract.buyerFinalAccepted ? "✓ Buyer Accepted" : "Accept Terms"}
                    </button>
                  </>
                )}
              </div>
              </>)}

              {/* Buyer: the supplier's own Terms & Conditions. Hidden when the supplier has none (termsAndCondition false);
                  shown disabled until the supplier's terms have been received (termsAndCondition true). */}
              {!isSupplier && activeTcEntry?.termsAndCondition !== false && (() => {
                const termsReceived = activeTcEntry?.termsAndCondition === true;
                const receivedDocs = termsReceived ? activeTcEntry?.attachments || [] : [];
                const termsAccepted = activeTermsAcceptedEntry?.supplierTermsAndConditionAccepted === "ACCEPTED";
                const termsRejected = activeTermsAcceptedEntry?.supplierTermsAndConditionAccepted === "REJECTED";
                return (
                  <div className="contract-tc-card">
                    <div>
                      <div className="contract-tc-name">Supplier Terms Received</div>
                      {receivedDocs.length > 0 ? (
                        renderTermsDocs(receivedDocs)
                      ) : (
                        <div className="contract-tc-doc">
                          <span className="contract-doc-name">No supplier terms received yet</span>
                          <button type="button" disabled className="contract-btn contract-btn--outline contract-btn--xs">
                            Preview
                          </button>
                          <button type="button" disabled className="contract-btn contract-btn--soft contract-btn--xs">
                            Download
                          </button>
                        </div>
                      )}
                      {buyerTermsError && <div className="contract-status-msg">{buyerTermsError}</div>}
                    </div>
                    <div className="contract-actions">
                      <button
                        type="button"
                        onClick={() => handleBuyerAcceptFinal(activeContractId)}
                        disabled={!termsReceived || termsAccepted}
                        className={`contract-btn contract-btn--md ${termsAccepted ? "contract-btn--accepted" : "contract-btn--accept"}`}
                      >
                        {termsAccepted ? "Accepted" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRejectSupplierTermsCommentError(null);
                          setShowRejectSupplierTermsComment(true);
                        }}
                        disabled={!termsReceived || termsAccepted || termsRejected}
                        className={`contract-btn contract-btn--md ${termsRejected ? "contract-btn--rejected" : "contract-btn--danger"}`}
                      >
                        {termsRejected ? "Rejected" : "Reject"}
                      </button>
                    </div>
                    {/* Buyer: reason for rejecting the supplier's Terms & Conditions - the API requires a comment
                        on rejection, so it's collected here before the reject call is sent. */}
                    {showRejectSupplierTermsComment && !termsRejected && (
                      <div className="contract-dashed-box contract-dashed-box--inline" style={{ flexBasis: "100%", marginTop: 12 }}>
                        <label className="contract-field-label" htmlFor="reject-supplier-terms-comment">
                          REASON FOR REJECTION
                        </label>
                        <textarea
                          id="reject-supplier-terms-comment"
                          className="contract-tc-textarea"
                          rows={3}
                          value={rejectSupplierTermsComment}
                          onChange={(e) => setRejectSupplierTermsComment(e.target.value)}
                          placeholder="Let the supplier know why you're rejecting their Terms & Conditions..."
                        />
                        {rejectSupplierTermsCommentError && (
                          <div className="contract-field-error">{rejectSupplierTermsCommentError}</div>
                        )}
                        <div className="contract-actions" style={{ marginTop: 10 }}>
                          <button
                            type="button"
                            onClick={handleSubmitRejectSupplierTermsComment}
                            className="contract-btn contract-btn--md contract-btn--danger"
                          >
                            Submit Rejection
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowRejectSupplierTermsComment(false);
                              setRejectSupplierTermsComment("");
                              setRejectSupplierTermsCommentError(null);
                            }}
                            className="contract-btn contract-btn--outline contract-btn--md"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeContract.step === "terms" && !buyerBothSigned && (
                <div className="contract-step-card-footer">
                  {/* activeContractRef (from the buyer's rfq-by-id "contracts" array) is the source of truth for
                      whether the contract record already exists - it's set synchronously from the RFQ, unlike
                      activeCreated, which needs a separate contract-by-id fetch to resolve (see effect below).
                      Once it exists, "Proceed to Signing" only shows once every approver has approved - while
                      any are still pending, the approval chain (userName + status) shows instead. */}
                  {!isSupplier && !activeContractRef ? (
                    <button
                      type="button"
                      onClick={() => handleSendForApprovals(activeContractId)}
                      disabled={!canProceedToSigning || creatingContract}
                      className="contract-btn contract-btn--primary contract-btn--cta"
                    >
                      {creatingContract ? "Sending for Approvals..." : "Approvals"}
                    </button>
                  ) : approvalsPending ? (
                    renderApprovalChain()
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleProceedToSigning(activeContractId)}
                      disabled={!canProceedToSigning}
                      className="contract-btn contract-btn--primary contract-btn--cta"
                    >
                      Proceed to Signing
                    </button>
                  )}
                  {!isSupplier && createContractError && (
                    <div className="contract-field-error">{createContractError}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Step: Signing */}
          {activeContract.step === "sign" && (
            <div className="contract-step-card">
              <div className="contract-subsection-title">
                Contract Signing
              </div>

              <div className="contract-sign-status-row">
                <div>
                  <div className="contract-sign-label">
                    Buyer Signature
                  </div>
                  <div className={`contract-sign-status${activeContract.buyerSigned || rfqBuyerSigned ? " contract-sign-status--done" : ""}`}>
                    {activeContract.buyerSigned || rfqBuyerSigned ? "Signed ✓" : "Awaiting Signature"}
                  </div>
                </div>

                <div>
                  <div className="contract-sign-label">
                    Supplier Signature
                  </div>
                  <div className={`contract-sign-status${activeContract.supplierSigned || rfqSupplierSigned ? " contract-sign-status--done" : ""}`}>
                    {activeContract.supplierSigned || rfqSupplierSigned ? "Signed ✓" : "Awaiting Signature"}
                  </div>
                  {(activeContract.supplierSigned || rfqSupplierSigned) && activeContract.supplierSignDetails && (
                    <div className="contract-sign-by">
                      By {activeContract.supplierSignDetails.signerName} ({activeContract.supplierSignDetails.signerDesignation})
                    </div>
                  )}
                </div>
              </div>

              {isSupplier && supplierSignBlockedByPendingTcApproval && (
                <div className="contract-upload-help">
                  {activeSupplierTermsRejected
                    ? "The buyer rejected your Terms & Conditions. Signing is disabled until this is resolved."
                    : "Signing is disabled until the buyer approves your submitted Terms & Conditions."}
                </div>
              )}

              {isSupplier && !supplierSignBlockedByPendingTcApproval && supplierSignBlockedByBuyerNotSigned && (
                <div className="contract-upload-help">
                  Signing is disabled until the buyer signs the contract.
                </div>
              )}

              {/* Contract's approval chain, from the buyer's rfq-by-id (contracts[].approvalUsers) - buyer-only.
                  It's the buyer's internal approval workflow; the supplier just sees signing become available
                  once it's done, with no visibility into who's on the chain or that it's still pending. */}
              {!isSupplier && activeApprovalUsers.length > 0 && renderApprovalChain()}

              {/* Buyer Signed Badge & Signature Box */}
              {activeContract.buyerSigned && activeContract.buyerSignDetails && (
                <div className="contract-signature-box contract-signature-box--buyer">
                  <div className="contract-signature-header">
                    <span className="contract-signature-title contract-signature-title--buyer">
                      Buyer E-Signature Verified ✓
                    </span>
                    <span className="contract-signature-time">
                      {activeContract.buyerSignDetails.signedAt}
                    </span>
                  </div>
                  {activeContract.buyerSignDetails.drawnSignatureUrl ? (
                    <div className="contract-signature-image-wrap">
                      <img
                        src={activeContract.buyerSignDetails.drawnSignatureUrl}
                        alt="Handwritten Signature"
                        className="contract-signature-image"
                      />
                    </div>
                  ) : (
                    <div className="contract-signature-text contract-signature-text--buyer">
                      /s/ {activeContract.buyerSignDetails.signerName}
                    </div>
                  )}
                  <div className="contract-signature-caption">
                    {activeContract.buyerSignDetails.signerName} ({activeContract.buyerSignDetails.signerDesignation}) • SILA Procurement
                  </div>
                </div>
              )}

              {/* Supplier Signed Badge & Signature Box */}
              {activeContract.supplierSigned && activeContract.supplierSignDetails && (
                <div className="contract-signature-box contract-signature-box--supplier">
                  <div className="contract-signature-header">
                    <span className="contract-signature-title contract-signature-title--supplier">
                      Supplier E-Signature Verified ✓
                    </span>
                    <span className="contract-signature-time">
                      {activeContract.supplierSignDetails.signedAt}
                    </span>
                  </div>
                  {activeContract.supplierSignDetails.drawnSignatureUrl ? (
                    <div className="contract-signature-image-wrap">
                      <img
                        src={activeContract.supplierSignDetails.drawnSignatureUrl}
                        alt="Handwritten Signature"
                        className="contract-signature-image"
                      />
                    </div>
                  ) : (
                    <div className="contract-signature-text contract-signature-text--supplier">
                      /s/ {activeContract.supplierSignDetails.signerName}
                    </div>
                  )}
                  <div className="contract-signature-caption">
                    {activeContract.supplierSignDetails.signerName} ({activeContract.supplierSignDetails.signerDesignation}) • {getSupplierName(activeContract.supplierId)}
                  </div>
                </div>
              )}

              {/* Action Buttons - opens the E-Sign modal, which offers drawing or uploading a signature (see
                  the eSignMethod choice inside it) rather than a separate "Upload Signed Contract" button. */}
              <div className="contract-btn-group contract-btn-group--wrap">
                {isSupplier ? (
                  <Button
                    variant={activeContract.supplierSigned ? "success" : "primary"}
                    size="sm"
                    onClick={() => openESignModal(activeContractId)}
                    disabled={activeContract.supplierSigned || supplierSignBlocked}
                  >
                    {activeContract.supplierSigned ? "✓ Supplier Signed" : "E-Sign Contract"}
                  </Button>
                ) : (
                  <Button
                    variant={activeContract.buyerSigned ? "success" : "primary"}
                    size="sm"
                    onClick={() => openESignModal(activeContractId)}
                    disabled={activeContract.buyerSigned}
                  >
                    {activeContract.buyerSigned ? "✓ Buyer Signed" : "E-Sign Contract"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Action Step: Completed. Buyer role: also shown once both sides have actually signed per rfq-by-id
              (buyerBothSigned), even if the local step hasn't caught up to "completed". */}
          {(activeContract.step === "completed" || buyerBothSigned) && (
            <div className="contract-completed-card">
              <div className="contract-completed-title">
                Contract Executed Successfully
              </div>
              <div className="contract-completed-summary">
                <div>
                  <div className="contract-completed-label">Contract Number</div>
                  <div className="contract-completed-value">{activeCreated?.contractNumber || activeContract.contractNumber}</div>
                </div>
                <div>
                  <div className="contract-completed-label">Supplier</div>
                  <div className="contract-completed-value">{getSupplierName(activeContract.supplierId)}</div>
                </div>
                <div>
                  <div className="contract-completed-label">Contract Value</div>
                  <div className="contract-completed-value">{fmtINR(getContractValue(activeContractId))}</div>
                </div>
                <div>
                  <div className="contract-completed-label">Start Date</div>
                  <div className="contract-completed-value">{activeContract.startDate}</div>
                </div>
                <div>
                  <div className="contract-completed-label">End Date</div>
                  <div className="contract-completed-value">{activeContract.endDate}</div>
                </div>
              </div>
              <div className="contract-completed-actions">
                {!isSupplier && (
                  <button
                    type="button"
                    onClick={() => handleCreateContract(activeContractId)}
                    disabled={creatingContract || (Boolean(activeCreated) && !activeContractOpen)}
                    className={`contract-btn contract-btn--xl ${activeCreated && !activeContractOpen ? "contract-btn--accepted" : "contract-btn--accept"}`}
                  >
                    {creatingContract
                      ? "Creating..."
                      : activeCreated && !activeContractOpen
                        ? "✓ Contract Created"
                        : "Create Contract"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleViewContract}
                  disabled={viewingContract}
                  className="contract-btn contract-btn--success-outline contract-btn--xl"
                >
                  {viewingContract ? "Preparing PDF..." : "View Contract"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadContract}
                  disabled={downloadingContract}
                  className="contract-btn contract-btn--success contract-btn--xl"
                >
                  {downloadingContract ? "Preparing PDF..." : "Download Contract"}
                </button>
              </div>
              {!isSupplier && createContractError && (
                <div className="contract-field-error">{createContractError}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Buyer: rename the (RFQ-derived) contract name, via the pencil icon next to the contract title. */}
      {!isSupplier && showContractNameModal && !activeContractRef && (
        <div className="contract-modal-overlay">
          <div className="contract-modal contract-modal--terms" role="dialog" aria-modal="true" aria-labelledby="contract-name-title">
            <div className="contract-modal-title contract-modal-title--dark" id="contract-name-title">
              {contractName ? "Edit Contract Name" : "Create Contract"}
            </div>
            <div className="contract-modal-subtitle">
              {contractName ? "Change the name of this contract." : "Add a name for this contract."}
            </div>
            <label className="contract-field-label" htmlFor="contract-name-input">
              CONTRACT NAME
            </label>
            <input
              id="contract-name-input"
              type="text"
              autoFocus
              value={contractNameDraft}
              onChange={(e) => {
                setContractNameDraft(e.target.value);
                setContractNameError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmContractName();
              }}
              placeholder="e.g. Supply Agreement 2026"
              className="contract-date-input"
              aria-invalid={contractNameError ? true : undefined}
            />
            {contractNameError && <div className="contract-field-error">{contractNameError}</div>}
            <div className="contract-modal-actions">
              <button
                type="button"
                onClick={() => setShowContractNameModal(false)}
                className="contract-btn contract-btn--outline contract-btn--modal"
              >
                Cancel
              </button>
              <button type="button" onClick={handleConfirmContractName} className="contract-btn contract-btn--primary contract-btn--cta">
                {contractName ? "Save" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E-Sign Modal Overlay */}
      {eSignModalContractId && (
        <div className="contract-modal-overlay contract-modal-overlay--esign">
          <div className="contract-modal contract-modal--esign">
            <div className="contract-modal-title contract-modal-title--dark">
              E-Sign Contract ({isSupplier ? "Supplier" : "Buyer"})
            </div>
            <div className="contract-esign-subtitle">
              Draw your signature below, or upload an already-signed copy of the contract instead.
            </div>

            {/* Draw vs. upload - both apply this party's signature the same way (confirmApplyESign /
                handleUploadSignedContract), so this replaces a separate "Upload Signed Contract" button. */}
            <div className="contract-radio-group contract-radio-group--esign">
              <label className="contract-radio-label">
                <input
                  type="radio"
                  name={`eSignMethod_${eSignModalContractId}`}
                  value="draw"
                  checked={eSignMethod === "draw"}
                  onChange={() => setESignMethod("draw")}
                />
                Draw Signature
              </label>
              <label className="contract-radio-label">
                <input
                  type="radio"
                  name={`eSignMethod_${eSignModalContractId}`}
                  value="upload"
                  checked={eSignMethod === "upload"}
                  onChange={() => setESignMethod("upload")}
                />
                Upload Signed Document
              </label>
            </div>

            {eSignMethod === "draw" ? (
              <div className="contract-esign-pad">
                <SignaturePad onDraw={setDrawnSignatureData} />
              </div>
            ) : (
              <div className="contract-dashed-box contract-dashed-box--modal">
                <div className="contract-upload-title">Upload Signed Document</div>
                <div className="contract-upload-help">
                  Attach a scanned or exported copy of the contract bearing your signature (.pdf, .png, .jpg, .doc, .docx).
                </div>
                <div className="contract-upload-row">
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.doc,.docx"
                    onChange={(e) => setSignedContractFile(e.target.files?.[0] || null)}
                    className="contract-file-input"
                  />
                </div>
                {signedContractFile && (
                  <div className="contract-selected-file">
                    📄 Selected file: {signedContractFile.name} ({(signedContractFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
            )}

            {/* Declaration Checkbox */}
            <label className="contract-declaration">
              <input
                type="checkbox"
                checked={declarationChecked}
                onChange={(e) => setDeclarationChecked(e.target.checked)}
                className="contract-declaration-checkbox"
              />
              <span>I declare that I am authorized to sign this contract on behalf of {isSupplier ? (supplierName || getSupplierName(eSignModalContractId)) : "Buyer"} and agree to all terms and conditions specified herein.</span>
            </label>

            {/* Actions */}
            <div className="contract-modal-actions contract-modal-actions--flush">
              <Button variant="outline" size="sm" onClick={() => setESignModalContractId(null)}>
                Cancel
              </Button>
              {eSignMethod === "draw" ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => confirmApplyESign(eSignModalContractId)}
                  disabled={!declarationChecked || !drawnSignatureData}
                >
                  Confirm &amp; Apply E-Signature
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!signedContractFile) return;
                    handleUploadSignedContract(eSignModalContractId, signedContractFile.name, signedContractFile);
                    setESignModalContractId(null);
                  }}
                  disabled={!declarationChecked || !signedContractFile}
                >
                  Confirm &amp; Upload Signature
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {canShowChat && !isChatOpen && (
        <button
          type="button"
          className="contract-chat-fab"
          onClick={() => setIsChatOpen(true)}
          title={isSupplier ? "Chat with the buyer" : "Chat with the supplier"}
          aria-label={isSupplier ? "Chat with the buyer" : "Chat with the supplier"}
        >
          <IconChatBubble />
        </button>
      )}

      {isChatOpen && canShowChat && chatCounterparty && chatApi && chatHubParams && (
        <ChatPanel
          role={role}
          onClose={() => setIsChatOpen(false)}
          rfqId={rfqId as string}
          rfqNumber={(rfq as any)?.rfqNumber || (rfq as any)?.rfqNo}
          rfqTitle={rfq?.title || (rfq as any)?.rfqNo || (rfq as any)?.name}
          counterparties={[chatCounterparty]}
          currentUserProfile={currentUserProfile}
          isLoadingCurrentUserProfile={isLoadingCurrentUserProfile}
          api={chatApi}
          hubParams={chatHubParams}
        />
      )}
    </div>
  );
};

export default ContractCreationView;
