import React, { useState } from "react";
import type { SilaMeNavKey, SilaMeRole } from "./silaMeNav";
import { silaMePermissions } from "./silaMePermissions";
import SilaInventoryDashboard from "./inventory/SilaInventoryDashboard";
import SilaLiveInventory from "./inventory/SilaLiveInventory";
import SilaInventoryTransactions from "./inventory/SilaInventoryTransactions";
import SilaLocationMaster from "./inventory/SilaLocationMaster";
import SilaMaterialInventory from "./inventory/SilaMaterialInventory";
import SilaPurchaseRequests from "./inventory/SilaPurchaseRequests";
import SilaQuickTransferPolicy from "./inventory/SilaQuickTransferPolicy";
import SilaTransfers from "./movements/SilaTransfers";
import SilaGoodsIssue from "./movements/SilaGoodsIssue";
import SilaStockAdjustments from "./movements/SilaStockAdjustments";
import SilaStockCounts from "./stockCount/SilaStockCounts";
import SilaShortageEnquiries from "./stockCount/SilaShortageEnquiries";
import SilaAlerts from "./stockCount/SilaAlerts";
import SilaShortageReport from "./control/SilaShortageReport";
import SilaPhysicalInventoryRequests from "./control/SilaPhysicalInventoryRequests";
import SilaAuditLog from "./control/SilaAuditLog";
import SilaRecipeDashboard from "./recipes/SilaRecipeDashboard";
import SilaRecipes from "./recipes/SilaRecipes";
import SilaRecipeApprovals from "./recipes/SilaRecipeApprovals";
import SilaRecipeMasterData from "./recipes/SilaRecipeMasterData";
import SilaSubstitutions from "./substitutions/SilaSubstitutions";
import SilaPosIntegration from "./pos/SilaPosIntegration";
import SilaTransactionTracker from "./pos/SilaTransactionTracker";
import SilaPurchaseOrdersOpen from "./receiving/SilaPurchaseOrdersOpen";
import SilaGoodsReceipts from "./receiving/SilaGoodsReceipts";
import SilaInvoices from "./receiving/SilaInvoices";
import SilaErpPostings from "./receiving/SilaErpPostings";
import SilaSuppliers from "./receiving/SilaSuppliers";
import SilaCompanyCodes from "./receiving/SilaCompanyCodes";
import SilaPoImport from "./receiving/SilaPoImport";
import SilaOcrSettings from "./receiving/SilaOcrSettings";
import SilaPriceApprovals from "./materials/SilaPriceApprovals";

interface SilaMeWorkspaceProps {
  navKey: SilaMeNavKey;
  role: SilaMeRole;
  /** Opens another SILA ME screen. */
  onNavigate: (key: SilaMeNavKey) => void;
}

/**
 * The SILA ME (hospitality add-on) screens. The role decides which actions a screen offers (silaMePermissions);
 * every action is authorised again by the API.
 */
const SilaMeWorkspace: React.FC<SilaMeWorkspaceProps> = ({ navKey, role, onNavigate }) => {
  const can = silaMePermissions(role);
  // Screens that open a specific record in another screen pass it through here.
  const [countToOpen, setCountToOpen] = useState<string | null>(null);
  const [recipeToOpen, setRecipeToOpen] = useState<string | null>(null);
  const [newRecipe, setNewRecipe] = useState(false);
  const [liveSearch, setLiveSearch] = useState<string | undefined>(undefined);

  const openCount = (stockCountId: string) => {
    setCountToOpen(stockCountId);
    onNavigate("silaStockCounts");
  };

  switch (navKey) {
    case "silaDashboard":
      return (
        <SilaInventoryDashboard
          canTransfer={can.manageTransfer}
          canRequestPurchase={can.requestPurchase}
          onNavigate={(key, query) => {
            setLiveSearch(key === "silaLiveInventory" ? query : undefined);
            onNavigate(key);
          }}
        />
      );
    case "silaLiveInventory":
      return <SilaLiveInventory canTransfer={can.manageTransfer} canRequestPurchase={can.requestPurchase} initialSearch={liveSearch} />;
    case "silaTransactions":
      return <SilaInventoryTransactions />;
    case "silaTransfers":
      return <SilaTransfers canApprove={can.approveTransfer} />;
    case "silaGoodsIssue":
      return <SilaGoodsIssue />;
    case "silaAdjustments":
      return <SilaStockAdjustments />;
    case "silaStockCounts":
      return <SilaStockCounts canApprove={can.approveCount} initialCountId={countToOpen} />;
    case "silaEnquiries":
      return <SilaShortageEnquiries canReview={can.approveCount} />;
    case "silaShortageReport":
      return <SilaShortageReport onOpenCount={openCount} />;
    case "silaPhysicalInventory":
      return <SilaPhysicalInventoryRequests canRequest={can.manageCount} canSchedule={can.approveCount} onOpenCount={openCount} />;
    case "silaAlerts":
      return (
        <SilaAlerts onCountRequested={openCount} onPhysicalInventoryRequested={() => onNavigate("silaPhysicalInventory")} />
      );
    case "silaPurchaseRequests":
      return <SilaPurchaseRequests canAddToBucket={role === "admin" || role === "store-manager"} />;
    case "silaRecipeDashboard":
      return (
        <SilaRecipeDashboard
          onOpenRecipes={() => onNavigate("silaRecipes")}
          onOpenRecipe={(recipeId) => {
            setRecipeToOpen(recipeId);
            onNavigate("silaRecipes");
          }}
          onOpenApprovals={can.approveRecipe ? () => onNavigate("silaRecipeApprovals") : undefined}
          onOpenPosTransactions={can.managePos ? () => onNavigate("silaTracker") : undefined}
          onNewRecipe={can.manageRecipe ? () => {
            setNewRecipe(true);
            onNavigate("silaRecipes");
          } : undefined}
        />
      );
    case "silaRecipes":
      return (
        <SilaRecipes
          canManage={can.manageRecipe}
          canRequestPrice={can.manageMasterData}
          openRecipeId={recipeToOpen}
          startNew={newRecipe}
        />
      );
    case "silaRecipeApprovals":
      return <SilaRecipeApprovals />;
    case "silaSubstitutions":
      return <SilaSubstitutions canDecide={can.manageRecipe} />;
    case "silaPos":
      return <SilaPosIntegration canManage={can.managePos} />;
    case "silaTracker":
      return <SilaTransactionTracker />;
    case "silaPurchaseOrders":
      return <SilaPurchaseOrdersOpen />;
    case "silaGoodsReceipts":
      return <SilaGoodsReceipts canPost={can.postGrn} />;
    case "silaInvoices":
      return <SilaInvoices canPost={can.postGrn} />;
    case "silaErpPostings":
      return <SilaErpPostings canReprocess={can.manageErpPosting} />;
    case "silaPriceApprovals":
      return <SilaPriceApprovals />;
    case "silaAuditLog":
      return <SilaAuditLog />;
    case "silaLocations":
      return <SilaLocationMaster canManage={can.manageLocation} />;
    case "silaMaterials":
      return <SilaMaterialInventory canManage={can.manageLocation} canManageMasterData={can.manageMasterData} />;
    case "silaRecipeMasterData":
      return <SilaRecipeMasterData canManage={can.manageMasterData} />;
    case "silaSuppliers":
      return <SilaSuppliers canManage={can.manageMasterData} />;
    case "silaCompanyCodes":
      return <SilaCompanyCodes canManage={can.manageMasterData} />;
    case "silaPoImport":
      return <SilaPoImport canManage={can.manageMasterData} />;
    case "silaQuickTransferPolicy":
      return <SilaQuickTransferPolicy canManage={can.manageMasterData} />;
    case "silaOcrSettings":
      return <SilaOcrSettings canManage={can.manageMasterData} />;
    default:
      return null;
  }
};

export default SilaMeWorkspace;
