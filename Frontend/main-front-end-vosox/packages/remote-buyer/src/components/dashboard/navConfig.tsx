import React from "react";
import type { RouteNavPaths } from "@vosox/shared-ui";
import {
  FileCheckIcon,
  FilePlusIcon,
  FileTextIcon,
  HomeIcon,
  LayoutGridIcon,
  LayoutTemplateIcon,
  ShieldCheckIcon,
} from "@vosox/shared-ui";
import type { RfqPageView } from "./types";
import { SILA_ME_NAV_PATHS, buildSilaMeNavItem, type SilaMeRole } from "../silaMe/silaMeNav";

// subItems can be a flat leaf or a non-clickable group with nested leaves.
interface NavLeaf {
  key: string;
  label: string;
}
interface NavGroup {
  label: string;
  items: NavLeaf[];
}
type NavSubEntry = NavLeaf | NavGroup;

export interface BuyerNavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  section?: string;
  badge?: number;
  subItems?: NavSubEntry[];
}

/** URL segments of the screens every buyer-side dashboard has (purchasing dashboard, purchase orders, documents). */
export const PURCHASING_NAV_PATHS = {
  purchasing: "purchasing",
  purchaseOrders: "purchase-orders",
  documents: "documents",
} as const;

/** Each section's URL (/dashboard, /rfqs …); see useRouteNav. */
export const BUYER_NAV_PATHS: RouteNavPaths = {
  dashboard: 'dashboard',
  createRFQ: 'create-rfq',
  allRfqs: 'rfqs',
  activeRFQs: 'rfqs',
  product: 'product-catalog',
  models: 'models',
  template: 'templates',
  contractTemplate: 'contract-templates',
  approvalManagement: 'approval-management',
  material: 'material-approvals',
  contract: 'contract-approvals',
  materialService: 'material-service',
  companyProfile: 'company-profile',
  weeklyBucketApprovals: 'weekly-bucket-approvals',
  wishlist: 'wishlist',
  weeklyBucket: 'weekly-bucket',
  cart: 'cart',
  ...PURCHASING_NAV_PATHS,
  ...SILA_ME_NAV_PATHS,
};

/** Role name of the Outlet Manager: a buyer user who also requests products for his outlets. */
export const OUTLET_MANAGER_ROLE = 'OUTLET_MANAGER';

/** Role name of the Store Manager: a buyer user who reviews and freezes the weekly bucket of a property. */
export const STORE_MANAGER_ROLE = 'STORE_MANAGER';

/** Role name of the Cost Controller: a buyer user who watches costs and stock; same menu as a buyer user. */
export const COST_CONTROLLER_ROLE = 'COST_CONTROLLER';

export interface BuyerNavOptions {
  /** Buyer administrator: users, outlets, integration, workflow and every purchasing screen. */
  isAdmin?: boolean;
  isOutletManager?: boolean;
  isStoreManager?: boolean;
  /** Key of the RFQ list in this dashboard ("allRfqs" for buyer users, "activeRFQs" for the administrator). */
  rfqListKey: string;
  /** The "SILA ME" entry, when the organization has the add-on. */
  silaMeItem?: BuyerNavItem | null;
}

const leaf = (key: string, label: string): NavLeaf => ({ key, label });

/**
 * The buyer-side menu, grouped as Dashboard, Sourcing, Purchasing, Approvals, SILA ME, Add-ons and Settings.
 * Only the grouping differs by role; every role keeps exactly the screens it had:
 * - Wishlist and Cart: administrator and outlet manager. Weekly Bucket: administrator, outlet and store manager.
 * - Invitations, Users, Outlets, Integration, Workflow & Configuration: administrator only.
 */
export const buildBuyerNavItems = ({
  isAdmin = false,
  isOutletManager = false,
  isStoreManager = false,
  rfqListKey,
  silaMeItem = null,
}: BuyerNavOptions): BuyerNavItem[] => {
  const requestsProducts = isAdmin || isOutletManager;
  const usesWeeklyBucket = requestsProducts || isStoreManager;

  const sourcing: NavLeaf[] = [
    leaf("createRFQ", "Create RFQ"),
    leaf(rfqListKey, "RFQs"),
    ...(isAdmin ? [leaf("invitations", "Invitations")] : []),
  ];

  const purchasing: NavLeaf[] = [
    leaf("purchasing", "Purchasing Dashboard"),
    leaf("product", "Product Catalog"),
    ...(requestsProducts ? [leaf("wishlist", "Wishlist")] : []),
    ...(usesWeeklyBucket ? [leaf("weeklyBucket", "Weekly Bucket")] : []),
    ...(requestsProducts ? [leaf("cart", "Cart")] : []),
    leaf("purchaseOrders", "Purchase Orders"),
  ];

  const settings: NavLeaf[] = [
    ...(isAdmin ? [leaf("userList", "Users")] : []),
    leaf("approvalManagement", "Approval Management"),
    leaf("template", "Templates"),
    leaf("contractTemplate", "Contract Templates"),
    ...(isAdmin
      ? [
          leaf("apiConfiguration", "Integration"),
          leaf("workflowConfiguration", "Workflow & Configuration"),
          leaf("outlets", "Outlets & Properties"),
        ]
      : []),
    leaf("materialService", "Item Master (Material & Service)"),
    leaf("documents", "Documents"),
  ];

  return [
    { key: "dashboard", icon: <HomeIcon />, label: "Dashboard" },
    { key: "sourcing", icon: <FilePlusIcon />, label: "Sourcing", subItems: sourcing },
    { key: "purchasingGroup", icon: <FileCheckIcon />, label: "Purchasing", subItems: purchasing },
    {
      key: "approvals",
      icon: <ShieldCheckIcon />,
      label: "Approvals",
      subItems: [leaf("material", "Material"), leaf("contract", "Contract"), leaf("weeklyBucketApprovals", "Weekly Bucket")],
    },
    ...(silaMeItem ? [silaMeItem] : []),
    { key: "models", icon: <LayoutGridIcon />, label: "Add-ons" },
    { key: "settings", icon: <LayoutTemplateIcon />, label: "Settings", subItems: settings },
  ];
};

/**
 * Buyer user / outlet manager / store manager / cost controller menu, plus a "View RFQ" entry while an RFQ's
 * detail page is open. When the organization has the SILA ME add-on, its menu follows Approvals.
 */
export const buildHeaderNavItems = (
  rfqPageView: RfqPageView,
  rfqNumber: string | undefined,
  isOutletManager = false,
  isStoreManager = false,
  silaMeRole: SilaMeRole | null = null,
): BuyerNavItem[] => {
  const items = buildBuyerNavItems({
    isOutletManager,
    isStoreManager,
    rfqListKey: "allRfqs",
    silaMeItem: silaMeRole ? buildSilaMeNavItem(silaMeRole) : null,
  });

  if (rfqPageView === "rfqDetail") {
    const sourcingIndex = items.findIndex((i) => i.key === "sourcing");
    const rfqLabel = rfqNumber ? `View RFQ (${rfqNumber})` : "View RFQ";
    items.splice(sourcingIndex + 1, 0, { key: "rfqDetail", icon: <FileTextIcon />, label: rfqLabel });
  }

  return items;
};
