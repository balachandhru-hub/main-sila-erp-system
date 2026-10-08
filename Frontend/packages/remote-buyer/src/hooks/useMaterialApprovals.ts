import { useEffect, useState } from "react";
import type { PendingMaterialApproval } from "../../../remote-platform-user/src/components/Material/materialApi";

/** Selected material approval; MaterialTable loads its own list and KPI counts. */
export const useMaterialApprovals = (activeNav: string) => {
  const [selectedMaterial, setSelectedMaterial] = useState<PendingMaterialApproval | null>(null);

  useEffect(() => {
    if (activeNav !== "material") return;
    setSelectedMaterial(null);
  }, [activeNav]);

  const handleMaterialApprovalSubmitted = () => setSelectedMaterial(null);

  return {
    selectedMaterial,
    setSelectedMaterial,
    handleMaterialApprovalSubmitted,
  };
};
