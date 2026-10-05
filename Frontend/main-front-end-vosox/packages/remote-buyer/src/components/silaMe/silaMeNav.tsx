import { LayoutGridIcon } from "@vosox/shared-ui";
import { silaMePermissions } from "./silaMePermissions";

/** Who is using the SILA ME add-on; decides the menu and which actions the screens offer. */
export type SilaMeRole = "admin" | "store-manager" | "outlet-manager" | "buyer-user" | "cost-controller";

/** Model key of the SILA ME (hospitality) add-on in the organization's models. */
export const SILA_ME_MODEL_KEY = "SILA_ME";

/** Each SILA ME screen's URL segment (/sila-live-inventory …); merged into the dashboard's nav paths. */
export const SILA_ME_NAV_PATHS = {
  silaDashboard: "sila-dashboard",
  silaLiveInventory: "sila-live-inventory",
  silaTransfers: "sila-transfers",
  silaGoodsIssue: "sila-goods-issue",
  silaAdjustments: "sila-adjustments",
  silaStockCounts: "sila-stock-counts",
  silaEnquiries: "sila-enquiries",
  silaShortageReport: "sila-shortage-report",
  silaPhysicalInventory: "sila-physical-inventory",
  silaAlerts: "sila-alerts",
  silaPurchaseRequests: "sila-purchase-requests",
  silaTransactions: "sila-transactions",
  silaRecipeDashboard: "sila-recipe-dashboard",
  silaRecipes: "sila-recipes",
  silaRecipeApprovals: "sila-recipe-approvals",
  silaSubstitutions: "sila-substitutions",
  silaPos: "sila-pos",
  silaTracker: "sila-transaction-tracker",
  silaPurchaseOrders: "sila-purchase-orders",
  silaGoodsReceipts: "sila-goods-receipts",
  silaInvoices: "sila-invoices",
  silaErpPostings: "sila-erp-postings",
  silaPriceApprovals: "sila-price-approvals",
  silaAuditLog: "sila-audit-log",
  silaLocations: "sila-locations",
  silaMaterials: "sila-materials",
  silaRecipeMasterData: "sila-recipe-master-data",
  silaSuppliers: "sila-suppliers",
  silaCompanyCodes: "sila-company-codes",
  silaPoImport: "sila-po-import",
  silaQuickTransferPolicy: "sila-quick-transfer-policy",
  silaOcrSettings: "sila-ocr-settings",
} as const;

export type SilaMeNavKey = keyof typeof SILA_ME_NAV_PATHS;

export const isSilaMeNav = (key: string): key is SilaMeNavKey => key in SILA_ME_NAV_PATHS;

interface NavLeaf {
  key: SilaMeNavKey;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavLeaf[];
}

const leaf = (show: boolean, key: SilaMeNavKey, label: string): NavLeaf[] => (show ? [{ key, label }] : []);

/** The "SILA ME" sidebar entry for the role; a leaf is shown only when the role may use that screen. */
export const buildSilaMeNavItem = (role: SilaMeRole) => {
  const can = silaMePermissions(role);
  const manager = role === "admin" || role === "store-manager";
  const groups: NavGroup[] = [
    {
      label: "Inventory",
      items: [
        { key: "silaDashboard", label: "Dashboard" },
        { key: "silaLiveInventory", label: "Live Inventory" },
        { key: "silaTransfers", label: "Internal Transfers" },
        ...leaf(can.postGoodsIssue, "silaGoodsIssue", "Goods Issue"),
        ...leaf(can.postAdjustment, "silaAdjustments", "Waste & Adjustments"),
        { key: "silaStockCounts", label: "Stock Count" },
        { key: "silaEnquiries", label: "Shortage & Enquiries" },
        ...leaf(can.approveCount, "silaShortageReport", "Shortage Report"),
        { key: "silaPhysicalInventory", label: "Physical Inventory" },
        { key: "silaAlerts", label: "Alerts" },
        ...leaf(can.requestPurchase, "silaPurchaseRequests", "Purchase Requests"),
        { key: "silaTransactions", label: "Inventory Transactions" },
      ],
    },
    {
      label: "Recipe Management",
      items: [
        { key: "silaRecipeDashboard", label: "Dashboard" },
        { key: "silaRecipes", label: "Recipes" },
        ...leaf(can.approveRecipe, "silaRecipeApprovals", "Recipe Approvals"),
        { key: "silaSubstitutions", label: "Ingredient Substitutions" },
        ...leaf(can.managePos, "silaPos", "POS Integration"),
        ...leaf(can.managePos, "silaTracker", "Transaction Tracker"),
      ],
    },
    {
      label: "Receiving",
      items: [
        { key: "silaPurchaseOrders", label: "Open Purchase Orders" },
        { key: "silaGoodsReceipts", label: "Goods Receipts" },
        { key: "silaInvoices", label: "Invoices" },
        ...leaf(can.manageErpPosting, "silaErpPostings", "ERP Postings"),
      ],
    },
    {
      label: "Control",
      items: [
        ...leaf(can.approvePrice, "silaPriceApprovals", "Price Approvals"),
        ...leaf(can.viewAudit, "silaAuditLog", "Audit Log"),
      ],
    },
    {
      label: "Setup",
      items: manager
        ? [
            { key: "silaLocations", label: "Location Master" },
            { key: "silaMaterials", label: "Material Inventory" },
            { key: "silaRecipeMasterData", label: "Recipe Master Data" },
            { key: "silaSuppliers", label: "Suppliers" },
            { key: "silaCompanyCodes", label: "Company Codes" },
            ...leaf(can.manageMasterData, "silaPoImport", "Purchase Order Import"),
            ...leaf(can.manageMasterData, "silaQuickTransferPolicy", "Quick Transfer Policy"),
            ...leaf(can.manageMasterData, "silaOcrSettings", "Invoice OCR Settings"),
          ]
        : [],
    },
  ];

  return { key: "silaMe", icon: <LayoutGridIcon />, label: "SILA ME", subItems: groups.filter((group) => group.items.length > 0) };
};
