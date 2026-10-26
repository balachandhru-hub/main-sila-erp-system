import type { SilaMePermissions } from "./silaMePermissions";

/**
 * Home composition from application access and existing permission flags.
 * Capabilities decide which sections appear. The API remains authoritative for every action.
 * Role / persona is a starting presentation only.
 */
export interface SilaHomeCapabilities {
  hasSilaMe: boolean;
  receiving: boolean;
  invoice: boolean;
  creditMemo: boolean;
  inventory: boolean;
  purchasing: boolean;
  recommendation: boolean;
  approvals: boolean;
  erp: boolean;
  audit: boolean;
  admin: boolean;
  receive: boolean;
  processInvoices: boolean;
  processCreditMemos: boolean;
  approveInvoices: boolean;
  approveCreditMemos: boolean;
  supervisor: boolean;
  approveTransfer: boolean;
  approveCount: boolean;
  approveRecipe: boolean;
  approvePrice: boolean;
  /** Aliases used by existing Home / PWA screens. */
  viewReceiving: boolean;
  viewInvoices: boolean;
  viewCreditMemos: boolean;
  viewInventory: boolean;
}

export type SilaHomePersona =
  | "self"
  | "receiver"
  | "receiving-supervisor"
  | "store-manager"
  | "inventory-controller"
  | "purchasing-officer"
  | "purchasing-director"
  | "ap-processor"
  | "financial-controller"
  | "property-gm"
  | "customer-admin";

export type SilaHomeSection =
  | "kpis"
  | "tasks"
  | "approvals"
  | "attention"
  | "quick"
  | "receiving"
  | "invoices"
  | "creditMemos"
  | "recommendations"
  | "inventory"
  | "activity";

const NONE: SilaHomeCapabilities = {
  hasSilaMe: false,
  receiving: false,
  invoice: false,
  creditMemo: false,
  inventory: false,
  purchasing: false,
  recommendation: false,
  approvals: false,
  erp: false,
  audit: false,
  admin: false,
  receive: false,
  processInvoices: false,
  processCreditMemos: false,
  approveInvoices: false,
  approveCreditMemos: false,
  supervisor: false,
  approveTransfer: false,
  approveCount: false,
  approveRecipe: false,
  approvePrice: false,
  viewReceiving: false,
  viewInvoices: false,
  viewCreditMemos: false,
  viewInventory: false,
};

const withAccess = (partial: Partial<SilaHomeCapabilities>): SilaHomeCapabilities => {
  const next = { ...NONE, hasSilaMe: true, ...partial };
  next.viewReceiving = next.receiving;
  next.viewInvoices = next.invoice;
  next.viewCreditMemos = next.creditMemo;
  next.viewInventory = next.inventory;
  return next;
};

/** Receiver preview: receiving only. Invoice / CM appear when those permissions are assigned to the signed-in user. */
const RECEIVER = withAccess({
  receiving: true,
  receive: true,
});

const SUPERVISOR = withAccess({
  receiving: true,
  receive: true,
  supervisor: true,
  approvals: true,
  erp: true,
  audit: true,
  approveTransfer: true,
});

const STORE_MANAGER = withAccess({
  receiving: true,
  receive: true,
  supervisor: true,
  invoice: true,
  processInvoices: true,
  creditMemo: true,
  processCreditMemos: true,
  inventory: true,
  purchasing: true,
  recommendation: true,
  approvals: true,
  erp: true,
  approveTransfer: true,
  approveCount: true,
  approveRecipe: true,
  approvePrice: true,
});

const INVENTORY_CONTROLLER = withAccess({
  inventory: true,
  purchasing: true,
  recommendation: true,
  approvals: true,
  approveTransfer: true,
  approveCount: true,
});

const PURCHASING_OFFICER = withAccess({
  purchasing: true,
  recommendation: true,
  inventory: true,
  approvals: true,
});

const PURCHASING_DIRECTOR = withAccess({
  purchasing: true,
  recommendation: true,
  inventory: true,
  approvals: true,
  erp: true,
  audit: true,
  supervisor: true,
});

const AP_PROCESSOR = withAccess({
  invoice: true,
  processInvoices: true,
  creditMemo: true,
  processCreditMemos: true,
});

const FINANCIAL_CONTROLLER = withAccess({
  invoice: true,
  creditMemo: true,
  approvals: true,
  approveInvoices: true,
  approveCreditMemos: true,
  audit: true,
});

const PROPERTY_GM = withAccess({
  receiving: true,
  invoice: true,
  creditMemo: true,
  approvals: true,
  inventory: true,
});

const CUSTOMER_ADMIN = withAccess({
  admin: true,
  audit: true,
  erp: true,
  approvals: true,
  receiving: true,
  invoice: true,
  creditMemo: true,
  inventory: true,
});

const PERSONA_CAPS: Record<Exclude<SilaHomePersona, "self">, SilaHomeCapabilities> = {
  receiver: RECEIVER,
  "receiving-supervisor": SUPERVISOR,
  "store-manager": STORE_MANAGER,
  "inventory-controller": INVENTORY_CONTROLLER,
  "purchasing-officer": PURCHASING_OFFICER,
  "purchasing-director": PURCHASING_DIRECTOR,
  "ap-processor": AP_PROCESSOR,
  "financial-controller": FINANCIAL_CONTROLLER,
  "property-gm": PROPERTY_GM,
  "customer-admin": CUSTOMER_ADMIN,
};

export const implementedHomePersonas: { id: Exclude<SilaHomePersona, "self">; label: string }[] = [
  { id: "receiver", label: "Receiver" },
  { id: "receiving-supervisor", label: "Receiving Supervisor" },
  { id: "store-manager", label: "Store Manager" },
  { id: "inventory-controller", label: "Inventory Controller" },
  { id: "purchasing-officer", label: "Purchasing Officer" },
  { id: "purchasing-director", label: "Purchasing Director" },
  { id: "ap-processor", label: "AP Processor" },
  { id: "financial-controller", label: "Financial Controller" },
  { id: "property-gm", label: "Property GM" },
  { id: "customer-admin", label: "Customer Admin" },
];

export const personaLabel = (persona: SilaHomePersona): string =>
  implementedHomePersonas.find((row) => row.id === persona)?.label ?? "Your Home";

export const silaHomeCapabilities = (hasSilaMe: boolean, can: SilaMePermissions): SilaHomeCapabilities => {
  if (!hasSilaMe) return NONE;
  const receiving = can.viewReceiving || can.postGrn;
  const invoice = can.viewInvoice || can.processInvoice || can.approveInvoice;
  const creditMemo = can.viewCreditMemo || can.processCreditMemo || can.approveCreditMemo;
  const inventory = can.viewInventory || can.manageTransfer || can.manageCount || can.postGoodsIssue || can.postAdjustment || can.initiateCount || can.requestPurchase;
  const recommendation = can.requestPurchase;
  const approvals = can.approveTransfer || can.approveCount || can.approveRecipe || can.approvePrice || can.approveInvoice || can.approveCreditMemo;
  return {
    hasSilaMe: true,
    receiving,
    invoice,
    creditMemo,
    inventory,
    purchasing: recommendation,
    recommendation,
    approvals,
    erp: can.manageErpPosting,
    audit: can.viewAudit,
    admin: can.manageLocation || can.manageMasterData,
    receive: can.postGrn,
    processInvoices: can.processInvoice,
    processCreditMemos: can.processCreditMemo,
    approveInvoices: can.approveInvoice,
    approveCreditMemos: can.approveCreditMemo,
    supervisor: can.manageErpPosting || can.viewAudit,
    approveTransfer: can.approveTransfer,
    approveCount: can.approveCount,
    approveRecipe: can.approveRecipe,
    approvePrice: can.approvePrice,
    viewReceiving: receiving,
    viewInvoices: invoice,
    viewCreditMemos: creditMemo,
    viewInventory: inventory,
  };
};

export const silaHomePersonaCapabilities = (actual: SilaHomeCapabilities, persona: SilaHomePersona): SilaHomeCapabilities => {
  if (persona === "self") return actual;
  return PERSONA_CAPS[persona] ?? actual;
};

/** Cloud row order. Persona changes emphasis only; missing capabilities still hide their section. */
export const silaHomeSectionOrder = (persona: SilaHomePersona): SilaHomeSection[] => {
  if (persona === "purchasing-officer" || persona === "purchasing-director") {
    return ["kpis", "recommendations", "tasks", "approvals", "attention", "inventory", "quick", "activity"];
  }
  if (persona === "ap-processor") {
    return ["kpis", "tasks", "invoices", "creditMemos", "approvals", "attention", "quick", "activity"];
  }
  if (persona === "financial-controller") {
    return ["kpis", "approvals", "attention", "invoices", "creditMemos", "activity"];
  }
  if (persona === "inventory-controller") {
    return ["kpis", "tasks", "attention", "recommendations", "inventory", "approvals", "quick", "activity"];
  }
  if (persona === "property-gm") {
    return ["kpis", "attention", "approvals", "receiving", "invoices", "creditMemos", "activity"];
  }
  if (persona === "customer-admin") {
    return ["kpis", "attention", "approvals", "quick", "activity"];
  }
  return ["kpis", "tasks", "approvals", "attention", "receiving", "invoices", "creditMemos", "recommendations", "inventory", "quick", "activity"];
};

/** PWA action-first order. */
export const silaHomeMobileSectionOrder = (persona: SilaHomePersona): SilaHomeSection[] => {
  if (persona === "purchasing-officer" || persona === "purchasing-director") {
    return ["tasks", "approvals", "attention", "quick", "recommendations", "inventory", "activity"];
  }
  if (persona === "ap-processor" || persona === "financial-controller") {
    return ["tasks", "approvals", "attention", "quick", "invoices", "creditMemos", "activity"];
  }
  return ["tasks", "approvals", "attention", "quick", "receiving", "invoices", "creditMemos", "recommendations", "inventory", "activity"];
};
