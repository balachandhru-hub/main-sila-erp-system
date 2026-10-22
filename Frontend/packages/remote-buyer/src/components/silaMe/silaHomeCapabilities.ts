import type { SilaMePermissions } from "./silaMePermissions";

/**
 * Access-driven Home composition. Built from application access (SILA ME) and existing
 * role → permission templates. The API remains authoritative for every action.
 */
export interface SilaHomeCapabilities {
  hasSilaMe: boolean;
  viewReceiving: boolean;
  receive: boolean;
  supervisor: boolean;
  viewInvoices: boolean;
  processInvoices: boolean;
  viewCreditMemos: boolean;
  processCreditMemos: boolean;
  viewInventory: boolean;
  manageErpPosting: boolean;
  viewAudit: boolean;
  approveTransfer: boolean;
  approveCount: boolean;
  approveRecipe: boolean;
  approvePrice: boolean;
}

export type SilaHomePersona = "self" | "receiver" | "receiving-supervisor";

const NONE: SilaHomeCapabilities = {
  hasSilaMe: false,
  viewReceiving: false,
  receive: false,
  supervisor: false,
  viewInvoices: false,
  processInvoices: false,
  viewCreditMemos: false,
  processCreditMemos: false,
  viewInventory: false,
  manageErpPosting: false,
  viewAudit: false,
  approveTransfer: false,
  approveCount: false,
  approveRecipe: false,
  approvePrice: false,
};

/** Receiver template: receiving + invoice/credit-memo processing. No ERP management / audit / inventory. */
const RECEIVER: SilaHomeCapabilities = {
  ...NONE,
  hasSilaMe: true,
  viewReceiving: true,
  receive: true,
  viewInvoices: true,
  processInvoices: true,
  viewCreditMemos: true,
  processCreditMemos: true,
};

/** Receiving supervisor template: receiver plus workbench, ERP retry and audit. */
const SUPERVISOR: SilaHomeCapabilities = {
  ...RECEIVER,
  supervisor: true,
  manageErpPosting: true,
  viewAudit: true,
  approveTransfer: true,
};

export const silaHomeCapabilities = (hasSilaMe: boolean, can: SilaMePermissions): SilaHomeCapabilities => {
  if (!hasSilaMe) return NONE;
  const viewInventory = can.manageTransfer || can.manageCount || can.postGoodsIssue || can.postAdjustment || can.initiateCount || can.requestPurchase;
  return {
    hasSilaMe: true,
    viewReceiving: true,
    receive: can.postGrn,
    supervisor: can.manageErpPosting || can.viewAudit,
    viewInvoices: true,
    processInvoices: can.postGrn,
    viewCreditMemos: true,
    processCreditMemos: can.postGrn,
    viewInventory,
    manageErpPosting: can.manageErpPosting,
    viewAudit: can.viewAudit,
    approveTransfer: can.approveTransfer,
    approveCount: can.approveCount,
    approveRecipe: can.approveRecipe,
    approvePrice: can.approvePrice,
  };
};

export const silaHomePersonaCapabilities = (actual: SilaHomeCapabilities, persona: SilaHomePersona): SilaHomeCapabilities => {
  if (persona === "receiver") return RECEIVER;
  if (persona === "receiving-supervisor") return SUPERVISOR;
  return actual;
};

export const implementedHomePersonas: { id: Exclude<SilaHomePersona, "self">; label: string }[] = [
  { id: "receiver", label: "Receiver" },
  { id: "receiving-supervisor", label: "Receiving Supervisor" },
];
