import React from "react";
import { Button, Table } from "@vosox/shared-ui";
import type { TableColumn, TableProps } from "@vosox/shared-ui";
import type { WeeklyBucketListItem } from "../../api/weeklyBucketApi";
import { formatDateTime } from "../cart/lineFormat";
import { statusBadgeClass, statusLabel } from "./weeklyBucketStatus";

interface WeeklyBucketTableProps
  extends Partial<Omit<TableProps<WeeklyBucketListItem>, "columns" | "data" | "getRowId">> {
  rows: WeeklyBucketListItem[];
  /** The bucket being opened, so its button shows progress. */
  openingId: string | null;
  onOpen: (bucketId: string) => void;
}

/** List of weekly buckets, used by the history and by the approvals inbox. Loading, error, empty and pager come from Table. */
const WeeklyBucketTable: React.FC<WeeklyBucketTableProps> = ({ rows, openingId, onOpen, ...tableProps }) => {
  const columns: TableColumn<WeeklyBucketListItem>[] = [
    { id: "code", header: "Code", accessorKey: "bucketCode", className: "sila-cell-strong" },
    { id: "property", header: "Property", cell: ({ row }) => row.propertyName || row.plantCode || "—" },
    { id: "week", header: "Week", cell: ({ row }) => `${row.weekNumber} / ${row.year}` },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <span className={statusBadgeClass(row.status)}>{statusLabel(row.status)}</span>,
    },
    { id: "items", header: "Items", accessorKey: "itemCount" },
    { id: "frozenOn", header: "Frozen on", cell: ({ row }) => formatDateTime(row.frozenOn) },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={openingId !== null}
          onClick={() => onOpen(row.id)}
        >
          {openingId === row.id ? "Opening..." : "Open"}
        </Button>
      ),
    },
  ];

  return <Table<WeeklyBucketListItem> columns={columns} data={rows} getRowId={(row) => row.id} {...tableProps} />;
};

export default WeeklyBucketTable;
