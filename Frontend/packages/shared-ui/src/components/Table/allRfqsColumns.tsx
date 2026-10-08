import type { TableColumn } from './Table.types';

/** The fields of an RFQ row shown on every "All RFQs" screen. */
export interface AllRfqRow {
  rfqId?: string;
  rfqNumber?: string;
  title?: string;
  organizationName?: string;
  deliveryLocation?: string;
  endDate?: string;
}

const formatClosingDate = (value?: string): string =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

/** Columns for the "All RFQs" table; `pageOffset` is the number of rows on the previous pages (for the S.No). */
export const buildAllRfqsColumns = <TRow extends AllRfqRow>(pageOffset: number): TableColumn<TRow>[] => [
  {
    id: 'sno',
    header: 'S.No',
    align: 'right',
    width: '4rem',
    className: 'sila-cell-muted',
    cell: ({ rowIndex }) => pageOffset + rowIndex + 1,
  },
  {
    id: 'rfqNumber',
    header: 'RFQ Number',
    cell: ({ row }) => <span className="sila-ref">{row.rfqNumber}</span>,
  },
  { id: 'title', header: 'Title', accessorKey: 'title', className: 'sila-cell-strong' },
  { id: 'organizationName', header: 'Organization', accessorKey: 'organizationName' },
  { id: 'deliveryLocation', header: 'Delivery Location', accessorKey: 'deliveryLocation' },
  {
    id: 'endDate',
    header: 'Closing Date',
    className: 'sila-cell-muted',
    cell: ({ row }) => formatClosingDate(row.endDate),
  },
];
