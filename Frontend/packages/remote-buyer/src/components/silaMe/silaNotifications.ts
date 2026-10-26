import { getReceivingDashboard, type SilaReceivingDashboard } from "../../api/silaMe/silaReceivingApi";

export interface SilaInboxItem {
  key: string;
  kind: "approval" | "attention";
  title: string;
  detail: string;
  status?: string | null;
  invoiceId?: string | null;
  creditMemoId?: string | null;
  goodsReceiptId?: string | null;
  purchaseOrderId?: string | null;
  transferId?: string | null;
}

const TTL_MS = 20_000;
let cache: { at: number; key: string; items: SilaInboxItem[] } | null = null;

const line = (...parts: Array<string | null | undefined>): string => parts.filter((part) => part && String(part).trim()).join(" · ");

/** Approvals first, then attention rows the dashboard already scoped to this user. */
export const inboxItemsFromDashboard = (data: SilaReceivingDashboard | null | undefined): SilaInboxItem[] => {
  const items: SilaInboxItem[] = [];
  const seen = new Set<string>();
  for (const row of data?.approvals ?? []) {
    const key = row.creditMemoId || row.invoiceId || row.transferId || row.document;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      kind: "approval",
      title: row.document,
      detail: line(row.type, row.supplierName, row.age),
      status: row.status,
      invoiceId: row.invoiceId,
      creditMemoId: row.creditMemoId,
      purchaseOrderId: row.purchaseOrderId,
      goodsReceiptId: row.goodsReceiptId,
      transferId: row.transferId,
    });
  }
  for (const row of data?.exceptions ?? []) {
    const key = row.creditMemoId || row.invoiceId || row.goodsReceiptId || row.purchaseOrderId || row.document;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      key,
      kind: "attention",
      title: row.document,
      detail: line(row.exception, row.supplierName, row.age),
      status: row.status,
      invoiceId: row.invoiceId,
      creditMemoId: row.creditMemoId,
      purchaseOrderId: row.purchaseOrderId,
      goodsReceiptId: row.goodsReceiptId,
    });
  }
  return items;
};

export const loadInboxItems = async (locationId?: string): Promise<SilaInboxItem[]> => {
  const key = locationId || "";
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.items;
  const items = inboxItemsFromDashboard(await getReceivingDashboard({ locationId }));
  cache = { at: Date.now(), key, items };
  return items;
};

export const rememberInboxItems = (items: SilaInboxItem[], locationId?: string): void => {
  cache = { at: Date.now(), key: locationId || "", items };
};

export const mobilePathForInbox = (item: SilaInboxItem): string => {
  if (item.creditMemoId) return `receive/credit-memos/${item.creditMemoId}`;
  if (item.invoiceId) return `receive/invoices/${item.invoiceId}`;
  if (item.transferId) return "inventory/transfers?tab=to-approve";
  if (item.goodsReceiptId) return `receive/grns/${item.goodsReceiptId}`;
  if (item.purchaseOrderId) return `receive/pos/${item.purchaseOrderId}`;
  return "tasks?tab=approvals";
};

export const cloudKeyForInbox = (item: SilaInboxItem): "silaCreditMemos" | "silaInvoices" | "silaTransfers" | "silaGoodsReceipts" | "silaPurchaseOrders" => {
  if (item.creditMemoId) return "silaCreditMemos";
  if (item.invoiceId) return "silaInvoices";
  if (item.transferId) return "silaTransfers";
  if (item.goodsReceiptId) return "silaGoodsReceipts";
  return "silaPurchaseOrders";
};
