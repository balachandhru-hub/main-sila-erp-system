import React from "react";
import type { SilaShortageGroup, SilaShortageLine } from "../../../api/silaMe/silaControlApi";
import { formatDate } from "../../cart/lineFormat";
import { formatMoney, formatQty, scBadgeClass, scLabel } from "../stockCount/stockCountFormat";
import { categoryLabel } from "./controlFormat";

interface ShortageGroupTableProps {
  title: string;
  groups: SilaShortageGroup[];
  label: (name: string) => string;
  /** Total shortage value of the report, for each group's share. */
  totalValue?: number;
}

/** Share of the total, e.g. 12.5%. */
const percentOf = (value: number, total?: number): string =>
  total && total > 0 ? `${((value / total) * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : "—";

/** Shortage totals grouped by location or by justification. */
export const ShortageGroupTable: React.FC<ShortageGroupTableProps> = ({ title, groups, label, totalValue }) => (
  <section className="sila-card">
    <div className="sila-card-header">
      <h2 className="sila-card-title">{title}</h2>
    </div>
    {groups.length === 0 ? (
      <div className="sila-card-body"><span className="sc-sub">No shortages.</span></div>
    ) : (
      <div className="sila-table-wrap">
        <table className="sila-table">
          <thead>
            <tr>
              <th scope="col">{title.replace(/^By /, "")}</th>
              <th scope="col" className="sila-num">Lines</th>
              <th scope="col" className="sila-num">Shortage value</th>
              <th scope="col" className="sila-num">Share</th>
              <th scope="col" className="sila-num">Posted value</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.key}>
                <td>{label(group.name)}</td>
                <td className="sila-num">{group.lines}</td>
                <td className="sila-num">{formatMoney(group.shortageValue)}</td>
                <td className="sila-num">{percentOf(group.shortageValue, totalValue)}</td>
                <td className="sila-num">{formatMoney(group.postedValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

interface ShortageLinesTableProps {
  lines: SilaShortageLine[];
  onOpenCount?: (stockCountId: string) => void;
}

/** One page of shortage lines with their enquiry and review. */
export const ShortageLinesTable: React.FC<ShortageLinesTableProps> = ({ lines, onOpenCount }) => (
  <div className="sila-table-wrap">
    <table className="sila-table">
      <thead>
        <tr>
          <th scope="col">Count</th>
          <th scope="col">Property</th>
          <th scope="col">Location</th>
          <th scope="col">Manager</th>
          <th scope="col">Material</th>
          <th scope="col" className="sila-num">System</th>
          <th scope="col" className="sila-num">Physical</th>
          <th scope="col" className="sila-num">Shortage</th>
          <th scope="col">UOM</th>
          <th scope="col" className="sila-num">Value</th>
          <th scope="col">Justification</th>
          <th scope="col">Enquiry</th>
          <th scope="col">Review</th>
          <th scope="col">Posted</th>
          <th scope="col">SAP</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.stockCountItemId}>
            <td>
              {onOpenCount ? (
                <button
                  type="button"
                  className="sctl-link"
                  aria-label={`Open stock count ${line.countNumber}`}
                  onClick={() => onOpenCount(line.stockCountId)}
                >
                  {line.countNumber}
                </button>
              ) : (
                <span className="sila-cell-strong">{line.countNumber}</span>
              )}
              <span className="sc-sub">{formatDate(line.submittedOn)} · {scLabel(line.countStatus)}</span>
            </td>
            <td>{line.propertyName || "—"}</td>
            <td>{line.locationName || "—"}</td>
            <td>{line.manager || "—"}</td>
            <td>
              <span className="sila-cell-strong">{line.materialName}</span>
              <span className="sc-sub">{line.materialCode}</span>
            </td>
            <td className="sila-num">{formatQty(line.systemQty)}</td>
            <td className="sila-num">{formatQty(line.countedQty)}</td>
            <td className="sila-num">{formatQty(line.shortageQty)}</td>
            <td>{line.uom}</td>
            <td className="sila-num">{formatMoney(line.shortageValue)}</td>
            <td>
              {categoryLabel(line.justificationCategory)}
              {line.response && <span className="sc-sub sctl-comment">{line.response}</span>}
            </td>
            <td>
              {line.enquiryStatus ? <span className={scBadgeClass(line.enquiryStatus)}>{scLabel(line.enquiryStatus)}</span> : "—"}
              {line.enquiryNumber && <span className="sc-sub">{line.enquiryNumber}</span>}
            </td>
            <td>
              {line.reviewStatus ? <span className={scBadgeClass(line.reviewStatus)}>{scLabel(line.reviewStatus)}</span> : "—"}
              {line.reviewComment && <span className="sc-sub sctl-comment">{line.reviewComment}</span>}
            </td>
            <td>{line.posted ? "Yes" : "No"}</td>
            <td>
              {line.sapStatus ? <span className={scBadgeClass(line.sapStatus)}>{scLabel(line.sapStatus)}</span> : "—"}
              {line.sapMaterialDocument && <span className="sc-sub">{line.sapMaterialDocument}</span>}
              {line.sapError && <span className="sc-sub sc-error-text">{line.sapError}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
