import React, { useState } from "react";
import { PageHeader } from "@vosox/shared-ui";
import type { SilaRecipeMasterKind } from "../../../api/silaMe/silaRecipeToolsApi";
import SilaRecipeMasterTab from "./SilaRecipeMasterTab";
import "../silaMeTheme.css";
import "./SilaRecipes.css";

interface SilaRecipeMasterDataProps {
  /** Create, edit, delete and Excel import (MANAGE_SILA_MASTER_DATA); viewing and export need VIEW_SILA_RECIPE. */
  canManage: boolean;
}

const TABS: { key: SilaRecipeMasterKind; label: string }[] = [
  { key: "families", label: "Families" },
  { key: "categories", label: "Categories" },
];

/** Recipe master data: recipe families and categories, each with Excel template, export and import. */
const SilaRecipeMasterData: React.FC<SilaRecipeMasterDataProps> = ({ canManage }) => {
  const [tab, setTab] = useState<SilaRecipeMasterKind>("families");

  return (
    <div className="sila-me srec-page">
      <PageHeader className="pud-page-header" title="Recipe master data" />
      <section className="sila-card">
        <div className="sila-tabs" role="tablist" aria-label="Recipe master data">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`srec-tab-${item.key}`}
              className="sila-tab"
              aria-selected={tab === item.key}
              aria-controls={`srec-panel-${item.key}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`srec-panel-${tab}`} aria-labelledby={`srec-tab-${tab}`}>
          <SilaRecipeMasterTab key={tab} kind={tab} canManage={canManage} />
        </div>
      </section>
    </div>
  );
};

export default SilaRecipeMasterData;
