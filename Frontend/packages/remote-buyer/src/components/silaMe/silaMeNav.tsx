import { FileCheckIcon, HomeIcon, LayoutGridIcon } from "@vosox/shared-ui";
import { silaMePermissions } from "./silaMePermissions";
import { silaHomeCapabilities, type SilaHomeCapabilities } from "./silaHomeCapabilities";

/** Who is using the SILA ME add-on; decides the menu and which actions the screens offer. */
export type SilaMeRole = "admin" | "store-manager" | "outlet-manager" | "buyer-user" | "cost-controller" | "fnb-director" | "finance-manager" | "ap-processor";

/** Model key of the SILA ME (hospitality) add-on in the organization's models. */
export const SILA_ME_MODEL_KEY = "SILA_ME";

/** Each SILA ME screen's URL segment (/sila-live-inventory …); merged into the dashboard's nav paths. */
export const SILA_ME_NAV_PATHS = {
  silaDashboard: "sila-dashboard",
  silaInventoryDashboard: "sila-inventory-dashboard",
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
  silaRecommendations: "sila-recommendations",
  silaTransactions: "sila-transactions",
  silaRecipeDashboard: "sila-recipe-dashboard",
  silaRecipes: "sila-recipes",
  silaRecipeApprovals: "sila-recipe-approvals",
  silaSubstitutions: "sila-substitutions",
  silaPos: "sila-pos",
  silaTracker: "sila-transaction-tracker",
  silaMeTracker: "sila-me-transactions",
  silaReceivingDashboard: "sila-receiving-dashboard",
  silaPurchaseOrders: "sila-purchase-orders",
  silaGoodsReceipts: "sila-goods-receipts",
  silaInvoices: "sila-invoices",
  silaCreditMemos: "sila-credit-memos",
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
  silaApprovalFlows: "sila-approval-flows",
  silaMenuDashboard: "sila-menu-dashboard",
  silaMenuItems: "sila-menu-items",
  silaMenuPlanning: "sila-menu-planning",
  silaMenuPortions: "sila-menu-portions",
  silaMenuDemand: "sila-menu-demand",
  silaMenuPosSales: "sila-menu-pos-sales",
  silaMenuPosMapping: "sila-menu-pos-mapping",
  silaMenuPerformance: "sila-menu-performance",
  silaMenuConsumption: "sila-menu-consumption",
  silaMenuCost: "sila-menu-cost",
  silaMenuRecommendations: "sila-menu-recommendations",
  silaMenuIntelligence: "sila-menu-intelligence",
  silaMenuWhatIf: "sila-menu-what-if",
  silaMenuSetup: "sila-menu-setup",
} as const;

export type SilaMeNavKey = keyof typeof SILA_ME_NAV_PATHS;

export const isSilaMeNav = (key: string): key is SilaMeNavKey => key in SILA_ME_NAV_PATHS;

interface NavLeaf {
  key: SilaMeNavKey;
  label: string;
}

interface NavChildGroup {
  label: string;
  items: NavLeaf[];
}

type NavChild = NavLeaf | NavChildGroup;

interface NavGroup {
  label: string;
  items: NavChild[];
}

type NavEntry = NavLeaf | NavGroup;

export const isSilaMeNavGroup = (entry: NavEntry): entry is NavGroup => "items" in entry;

const leaf = (show: boolean, key: SilaMeNavKey, label: string): NavLeaf[] => (show ? [{ key, label }] : []);

/** The "SILA ME" sidebar entry for the role; a leaf is shown only when the role may use that screen. */
export const buildSilaMeNavItem = (role: SilaMeRole, access?: SilaHomeCapabilities) => {
  const can = silaMePermissions(role);
  const home = access ?? silaHomeCapabilities(true, can);
  const setup = home.admin || can.manageLocation || can.manageMasterData;
  const entries: NavEntry[] = [
    { key: "silaDashboard", label: "SILA ME" },
    {
      label: "Inventory",
      items: home.viewInventory ? [
        { key: "silaInventoryDashboard", label: "Dashboard" },
        { key: "silaLiveInventory", label: "Live Inventory" },
        { key: "silaTransfers", label: "Internal Transfers" },
        ...leaf(can.postGoodsIssue, "silaGoodsIssue", "Goods Issue"),
        ...leaf(can.postAdjustment, "silaAdjustments", "Waste & Adjustments"),
        { key: "silaStockCounts", label: "Stock Count" },
        { key: "silaEnquiries", label: "Shortage & Enquiries" },
        ...leaf(can.approveCount, "silaShortageReport", "Shortage Report"),
        { key: "silaPhysicalInventory", label: "Physical Inventory" },
        { key: "silaAlerts", label: "Alerts" },
        ...leaf(home.recommendation, "silaRecommendations", "Recommendations"),
        ...leaf(can.requestPurchase, "silaPurchaseRequests", "Purchase Requests"),
        { key: "silaTransactions", label: "Inventory Transactions" },
      ] : [],
    },
    {
      label: "Menu Engineering",
      items: (home.hasSilaMe && (can.viewMenuEngineering || can.manageMenuEngineering || can.manageRecipe)) ? [
        { key: "silaMenuDashboard", label: "Dashboard" },
        { key: "silaMenuItems", label: "Menu Items" },
        { key: "silaMenuPlanning", label: "Menu Planning" },
        { key: "silaMenuPortions", label: "Portion Planning" },
        { key: "silaMenuDemand", label: "Demand Planning" },
        { key: "silaMenuPosSales", label: "POS Sales" },
        { key: "silaMenuPosMapping", label: "POS Mapping" },
        { key: "silaMenuPerformance", label: "Menu Performance" },
        { key: "silaMenuConsumption", label: "Consumption Analysis" },
        { key: "silaMenuCost", label: "Cost & Margin Analysis" },
        ...leaf(can.requestPurchase || can.viewMenuEngineering, "silaMenuRecommendations", "Purchase Recommendations"),
        { key: "silaMenuIntelligence", label: "AI Menu Intelligence" },
        { key: "silaMenuWhatIf", label: "What-If Simulation" },
        ...leaf(setup || can.manageMenuEngineering, "silaMenuSetup", "Setup"),
      ] : [],
    },
    {
      label: "Recipe Management",
      items: [
        { key: "silaRecipeDashboard", label: "Dashboard" },
        { key: "silaRecipes", label: "Recipes" },
        ...leaf(can.approveRecipe, "silaRecipeApprovals", "Recipe Approvals"),
        { key: "silaSubstitutions", label: "Ingredient Substitutions" },
        ...leaf(can.managePos, "silaPos", "POS Integration"),
      ],
    },
    {
      label: "Receiving",
      items: home.viewReceiving ? [
        { key: "silaReceivingDashboard", label: "Dashboard" },
        { key: "silaPurchaseOrders", label: "Open Purchase Orders" },
        { key: "silaGoodsReceipts", label: "Goods Receipts" },
      ] : [],
    },
    {
      label: "Accounts Payable",
      items: [
        ...leaf(home.viewInvoices, "silaInvoices", "Invoices"),
        ...leaf(home.viewCreditMemos, "silaCreditMemos", "Credit Memos"),
      ],
    },
    {
      label: "Setup",
      items: [
        ...(setup
          ? [
              { key: "silaLocations" as const, label: "Location Master" },
              { key: "silaMaterials" as const, label: "Material Inventory" },
              { key: "silaRecipeMasterData" as const, label: "Recipe Master Data" },
              { key: "silaSuppliers" as const, label: "Suppliers" },
              { key: "silaCompanyCodes" as const, label: "Company Codes" },
              ...leaf(can.manageMasterData, "silaPoImport", "Purchase Order Import"),
              ...leaf(can.manageMasterData, "silaQuickTransferPolicy", "Quick Transfer Policy"),
              ...leaf(can.manageMasterData, "silaOcrSettings", "Invoice OCR Settings"),
              { key: "silaApprovalFlows" as const, label: "Approval flow" },
              ...leaf(can.manageErpPosting, "silaMeTracker", "SILA ME Transactions"),
            ]
          : []),
        ...leaf(can.approvePrice, "silaPriceApprovals", "Price Approvals"),
        ...leaf(can.viewAudit, "silaAuditLog", "Audit Log"),
      ],
    },
  ];

  return {
    key: "silaMe",
    icon: <LayoutGridIcon />,
    label: "SILA ME - Hospitality",
    subItems: entries.filter((entry) => !isSilaMeNavGroup(entry) || entry.items.length > 0),
  };
};

/**
 * The SILA ME site menu. SILA ME opens the add-on dashboard. Purchasing Dashboard returns to purchasing.
 */
export const buildSilaMeModuleNav = (role: SilaMeRole, access?: SilaHomeCapabilities) => {
  const sections = (buildSilaMeNavItem(role, access).subItems ?? []).flatMap((entry) =>
    isSilaMeNavGroup(entry)
      ? [{ key: `sila-section-${entry.label}`, icon: <LayoutGridIcon />, label: entry.label, subItems: entry.items }]
      : [{ key: entry.key, icon: <HomeIcon />, label: entry.label }],
  );
  return [
    { key: "dashboard", icon: <HomeIcon />, label: "Purchasing Home" },
    { key: "purchasing", icon: <FileCheckIcon />, label: "Purchasing Dashboard" },
    ...sections,
  ];
};
