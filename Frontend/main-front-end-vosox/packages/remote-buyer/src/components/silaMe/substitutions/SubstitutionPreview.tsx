import React from "react";
import {
  previewSubstitution,
  type SilaSubstitutionDetail,
  type SilaSubstitutionSuggestion,
} from "../../../api/silaMe/silaSubstitutionApi";
import { formatCost, formatPercent } from "../recipes/recipeFormat";

interface SubstitutionPreviewProps {
  detail: SilaSubstitutionDetail;
  /** Chosen suggestion per replaced ingredient material id. */
  chosen: Record<string, SilaSubstitutionSuggestion>;
}

/** Live recipe cost and the cost % / margin % per outlet: now and with the chosen replacements. */
const SubstitutionPreview: React.FC<SubstitutionPreviewProps> = ({ detail, chosen }) => {
  const preview = previewSubstitution(detail, chosen);
  const delta = preview.totalCost - detail.totalCost;

  return (
    <section className="sila-card" aria-label="Cost and margin preview">
      <div className="sila-card-header">
        <h2 className="sila-card-title">
          Recipe cost {formatCost(detail.totalCost, detail.currency)} → {formatCost(preview.totalCost, detail.currency)}{" "}
          {delta !== 0 && (
            <span className={delta > 0 ? "ssub-delta-up" : "ssub-delta-down"}>
              ({delta > 0 ? "+" : ""}
              {formatCost(delta)})
            </span>
          )}
        </h2>
      </div>
      {preview.outlets.length > 0 && (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Outlet</th>
                <th scope="col" className="ssub-num">Menu price</th>
                <th scope="col" className="ssub-num">Cost % now</th>
                <th scope="col" className="ssub-num">Cost % new</th>
                <th scope="col" className="ssub-num">Margin % now</th>
                <th scope="col" className="ssub-num">Margin % new</th>
              </tr>
            </thead>
            <tbody>
              {preview.outlets.map((outlet, index) => {
                const current = detail.outlets[index];
                return (
                  <tr key={outlet.outletLocationId}>
                    <td>
                      {outlet.locationName}
                      <span className="ssub-sub">{outlet.locationCode}</span>
                    </td>
                    <td className="ssub-num">{formatCost(outlet.menuPrice, outlet.currency)}</td>
                    <td className="ssub-num">{formatPercent(current?.costPercent)}</td>
                    <td className="ssub-num">{formatPercent(outlet.costPercent)}</td>
                    <td className="ssub-num">{formatPercent(current?.marginPercent)}</td>
                    <td className="ssub-num">{formatPercent(outlet.marginPercent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default SubstitutionPreview;
