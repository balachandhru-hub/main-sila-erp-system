import React from "react";
import type { WeeklyBucketListItem } from "../../api/weeklyBucketApi";
import { formatDateTime } from "../cart/lineFormat";
import { statusBadgeClass, statusLabel } from "./weeklyBucketStatus";

interface WeeklyBucketTableProps {
  rows: WeeklyBucketListItem[];
  /** The bucket being opened, so its button shows progress. */
  openingId: string | null;
  onOpen: (bucketId: string) => void;
}

/** List of weekly buckets, used by the history and by the approvals inbox. */
const WeeklyBucketTable: React.FC<WeeklyBucketTableProps> = ({ rows, openingId, onOpen }) => (
  <div className="sila-table-wrap">
    <table className="sila-table">
      <thead>
        <tr>
          <th scope="col">Code</th>
          <th scope="col">Property</th>
          <th scope="col">Week</th>
          <th scope="col">Status</th>
          <th scope="col">Items</th>
          <th scope="col">Frozen on</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="sila-cell-strong">{row.bucketCode}</td>
            <td>{row.propertyName || row.plantCode || "—"}</td>
            <td>{row.weekNumber} / {row.year}</td>
            <td><span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span></td>
            <td>{row.itemCount}</td>
            <td>{formatDateTime(row.frozenOn)}</td>
            <td>
              <button
                type="button"
                className="sila-btn sila-btn--secondary sila-btn--sm"
                disabled={openingId !== null}
                onClick={() => onOpen(row.id)}
              >
                {openingId === row.id ? "Opening..." : "Open"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default WeeklyBucketTable;
