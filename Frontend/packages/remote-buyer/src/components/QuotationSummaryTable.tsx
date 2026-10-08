import React, { useState } from "react";
import { FaMinus, FaPlus } from "react-icons/fa";
import "./QuotationSummaryTable.css";

/* ---------------------------------- RFQ Item / Supplier Quotation Item Types ---------------------------------- */

export interface QuotationSummaryRfqItem {
  id?: string;
  description: string;
  quantity: number;
  uom: string;
  materialCode?: string;
  costCenter?: string;
}

export interface QuotationSummaryQuotationItem {
  // Joins back to rfq.items[].id — this is the RFQ item this quotation line was submitted for.
  supplierRFQItemId?: string;
  buyerRFQItemId?: string;
  quotedPrice?: number | null;
  quotedAmount?: number | null;
  subTotal?: number | null;
  tax?: number | null;
  taxType?: string | null;
  discount?: number | null;
  discountType?: string | null;
  deliveryCharge?: number | null;
  deliveryType?: string | null;
  lineNumber?: number | null;
  rank?: string | null;
}

export interface QuotationSummarySupplierQuotation {
  quotationId?: string | null;
  supplierName?: string | null;
  totalPrice?: number | null;
  isLead?: boolean;
  status?: string | null;
  currency?: string | null;
  rank?: string | null;
  tax?: number | null;
  taxType?: string | null;
  discount?: number | null;
  discountType?: string | null;
  deliveryCharge?: number | null;
  deliveryType?: string | null;
  supplierQuotationItems?: QuotationSummaryQuotationItem[] | null;
}

export interface QuotationSummaryRfq {
  items: QuotationSummaryRfqItem[];
  supplierQuotation?: QuotationSummarySupplierQuotation[] | null;
  addLotOption: boolean;
}

interface QuotationSummaryTableProps {
  rfq: QuotationSummaryRfq;
}

// Maps an RFQ item to the line-level quotation values a given supplier submitted for it.
// The join key is rfq.items[].id === supplierQuotationItems[].supplierRFQItemId.
// No array-index fallback is used, since supplierQuotationItems may be returned in a
// different order than rfq.items.
const getSupplierQuotationItem = (
  quotation: QuotationSummarySupplierQuotation,
  rfqItem: QuotationSummaryRfqItem
): QuotationSummaryQuotationItem | undefined => {
  if (!rfqItem.id) return undefined;
  return (quotation.supplierQuotationItems || []).find(
    (qi) => qi.buyerRFQItemId === rfqItem.id
  );
};

const formatMoney = (value: number | null | undefined, currencyCode?: string | null): string =>
  value === null || value === undefined ? "—" : currencyCode ? `${value} ${currencyCode}` : `${value}`;

const formatRank = (value: string | null | undefined): string =>
  value === null || value === undefined || value === "" ? "—" : value;

// Tax/Discount/Delivery Charge can each be quoted either as a percentage or a flat
// amount (see taxType/discountType/deliveryType). Render accordingly.
const formatTypedValue = (
  value: number | null | undefined,
  type: string | null | undefined,
  currencyCode?: string | null
): string => {
  if (value === null || value === undefined) return "—";
  return type === "PERCENTAGE" ? `${value}%` : currencyCode ? `${value} ${currencyCode}` : `${value}`;
};

const formatTypedDiscount = (
  value: number | null | undefined,
  type: string | null | undefined,
  currencyCode?: string | null
): string => {
  if (value === null || value === undefined) return "—";
  return type === "PERCENTAGE" ? `-${value}%` : currencyCode ? `-${value} ${currencyCode}` : `-${value}`;
};

/* ---------------------------------- Component ---------------------------------- */

const QuotationSummaryTable: React.FC<QuotationSummaryTableProps> = ({ rfq }) => {
  const [expandedRfqItems, setExpandedRfqItems] = useState<Set<string>>(new Set());
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  const toggleRfqItemExpanded = (rowKey: string) => {
    setExpandedRfqItems((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const toggleSummaryExpanded = () => setIsSummaryExpanded((prev) => !prev);

  if (!rfq.items || rfq.items.length === 0) {
    return null;
  }

  const allSuppliers: QuotationSummarySupplierQuotation[] = rfq.supplierQuotation || [];
  const quotedSuppliers: QuotationSummarySupplierQuotation[] = allSuppliers.filter(
    (q) => q.quotationId || q.totalPrice !== null
  );
  const showSupplierColumns = quotedSuppliers.length > 0;

  // Line numbers come from the supplier's quotation lines, not the RFQ items themselves,
  // so pull them from the lead supplier's quote (falling back to the first quoted supplier)
  // to both display and order the rows.
  const lineNumberSourceSupplier = quotedSuppliers.find((q) => q.isLead) || quotedSuppliers[0];
  const getItemLineNumber = (rfqItem: QuotationSummaryRfqItem): number | undefined =>
    lineNumberSourceSupplier ? getSupplierQuotationItem(lineNumberSourceSupplier, rfqItem)?.lineNumber ?? undefined : undefined;

  const displayItems = lineNumberSourceSupplier
    ? [...rfq.items].sort((a, b) => {
        const lnA = getItemLineNumber(a);
        const lnB = getItemLineNumber(b);
        if (lnA === undefined && lnB === undefined) return 0;
        if (lnA === undefined) return 1;
        if (lnB === undefined) return -1;
        return lnA - lnB;
      })
    : rfq.items;
  const isLotEnabled = rfq.addLotOption === true;
  const showLLColumn = !isLotEnabled;
  const supplierGroupColSpan = showLLColumn ? 3 : 2;
  // Base columns: Expand, Material Info, LN, Code, Qty.
  const BASE_COLUMN_COUNT = 5;
  // Column widths live in QuotationSummaryTable.css; the table only reports how many suppliers it shows.
  const quotedTableClass = [
    "qst-items-table",
    showSupplierColumns && "qst-items-table--quoted",
    showSupplierColumns && showLLColumn && "qst-items-table--with-ll",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="qst-root">
      <div className="qst-section-title qst-summary-title">Quotation Summary</div>
      <div className="qst-table-container qst-table-scroll">
        <table
          className={quotedTableClass}
          style={showSupplierColumns ? ({ '--qst-suppliers': quotedSuppliers.length } as React.CSSProperties) : undefined}
        >
          {showSupplierColumns && (
            <colgroup>
              <col className="qst-col--expand" />
              <col className="qst-col--material" />
              <col className="qst-col--ln" />
              <col className="qst-col--code" />
              <col className="qst-col--qty" />
              {quotedSuppliers.map((quote, sIdx) => (
                <React.Fragment key={`col-${quote.quotationId || sIdx}`}>
                  <col className="qst-col--rate" />
                  <col className="qst-col--amount" />
                  {showLLColumn && <col className="qst-col--ll" />}
                </React.Fragment>
              ))}
            </colgroup>
          )}
          <thead>
            {showSupplierColumns ? (
              <>
                <tr>
                  <th colSpan={BASE_COLUMN_COUNT} className="qst-supplier-name-label">Supplier Name</th>
                  {quotedSuppliers.map((quote, sIdx) => (
                    <th key={quote.quotationId || sIdx} colSpan={supplierGroupColSpan} className="qst-supplier-group-header">
                      <div className="qst-supplier-group-name">
                        {quote.supplierName || `Supplier ${sIdx + 1}`}
                      </div>
                    </th>
                  ))}
                </tr>
                {isLotEnabled && (
                  <tr>
                    <th colSpan={BASE_COLUMN_COUNT} className="qst-supplier-name-label">Rank</th>
                    {quotedSuppliers.map((quote, sIdx) => (
                      <th key={quote.quotationId || sIdx} colSpan={supplierGroupColSpan} className="qst-supplier-rank-header">
                        <span className="qst-supplier-rank-badge">{formatRank(quote.rank)}</span>
                      </th>
                    ))}
                  </tr>
                )}
                <tr>
                  <th className="qst-expand-header"><span className="sila-visually-hidden">Expand</span></th>
                  <th>Material Info</th>
                  <th className="qst-align-right">LN</th>
                  <th>Code</th>
                  <th className="qst-align-right">Qty</th>
                  {quotedSuppliers.map((quote, sIdx) => (
                    <React.Fragment key={quote.quotationId || sIdx}>
                      <th className="qst-sub-header">Rate</th>
                      <th className="qst-sub-header">Amount</th>
                      {showLLColumn && <th className="qst-sub-header">Rank</th>}
                    </React.Fragment>
                  ))}
                </tr>
              </>
            ) : (
              <tr>
                <th>Material Info</th>
                <th className="qst-align-right">LN</th>
                <th>Code</th>
                <th className="qst-align-right">Qty</th>
              </tr>
            )}
          </thead>
          <tbody>
            {displayItems.map((item, idx) => {
              const rowKey = item.id || `${idx}`;
              const isExpanded = expandedRfqItems.has(rowKey);
              const lineNumber = getItemLineNumber(item) ?? idx + 1;

              return (
                <React.Fragment key={rowKey}>
                  <tr>
                    {showSupplierColumns && (
                      <td className="qst-expand-cell">
                        <button
                          type="button"
                          className="qst-expand-toggle"
                          onClick={() => toggleRfqItemExpanded(rowKey)}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Collapse item details" : "Expand item details"}
                        >
                          {isExpanded ? <FaMinus aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                        </button>
                      </td>
                    )}
                    <td>
                      <div className="qst-item-desc">{item.description}</div>
                      {item.costCenter && (
                        <div className="qst-item-meta">
                          Cost Center: {item.costCenter}
                        </div>
                      )}
                    </td>
                    <td className="qst-ll-cell">{lineNumber}</td>
                    <td>
                      <span className="sila-ref qst-item-code">
                        {item.materialCode || "N/A"}
                      </span>
                    </td>
                    <td className="qst-align-right">
                      {item.quantity} <span className="qst-uom">{item.uom}</span>
                    </td>
                    {showSupplierColumns && quotedSuppliers.map((quote, sIdx) => {
                      const matchedItem = getSupplierQuotationItem(quote, item);
                      return (
                        <React.Fragment key={quote.quotationId || sIdx}>
                          <td className="qst-rate-cell">{formatMoney(matchedItem?.quotedPrice, quote.currency)}</td>
                          <td className="qst-amount-cell">{formatMoney(matchedItem?.quotedAmount, quote.currency)}</td>
                          {showLLColumn && (
                            <td className="qst-ll-cell">{formatRank(matchedItem?.rank)}</td>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tr>

                  {isExpanded && showSupplierColumns && (
                    <tr className="qst-expanded-row">
                      <td></td>
                      <td colSpan={4} className="qst-expanded-label-cell">Item Details</td>
                      {quotedSuppliers.map((quote, sIdx) => {
                        const matchedItem = getSupplierQuotationItem(quote, item);
                        return (
                          <td key={quote.quotationId || sIdx} colSpan={supplierGroupColSpan} className="qst-expanded-detail-cell">
                            <div className="qst-expanded-detail-grid">
                              <span>Tax:</span>
                              <span>{formatTypedValue(matchedItem?.tax, matchedItem?.taxType, quote.currency)}</span>
                              <span>Discount:</span>
                              <span className="qst-negative">{formatTypedDiscount(matchedItem?.discount, matchedItem?.discountType, quote.currency)}</span>
                              <span>Delivery Charge:</span>
                              <span>{formatTypedValue(matchedItem?.deliveryCharge, matchedItem?.deliveryType, quote.currency)}</span>
                              <span>Subtotal:</span>
                              <span>{formatMoney(matchedItem?.subTotal, quote.currency)}</span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          {showSupplierColumns && isLotEnabled && (
            <tfoot>
              <tr className="qst-total-quote-row">
                <td className="qst-expand-cell">
                  <button
                    type="button"
                    className="qst-expand-toggle"
                    onClick={toggleSummaryExpanded}
                    aria-expanded={isSummaryExpanded}
                    aria-label={isSummaryExpanded ? "Collapse summary" : "Expand summary"}
                  >
                    {isSummaryExpanded ? <FaMinus aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                  </button>
                </td>
                <td colSpan={BASE_COLUMN_COUNT - 1}></td>
                {quotedSuppliers.map((quote, sIdx) => (
                  <td key={quote.quotationId || sIdx} colSpan={supplierGroupColSpan} className="qst-total-quote-cell">
                    <span className="qst-total-quote-label">Total Quote</span>
                    <span className="qst-total-quote-amount">{formatMoney(quote.totalPrice ?? 0, quote.currency)}</span>
                  </td>
                ))}
              </tr>
              {isSummaryExpanded && (
                <tr className="qst-summary-row">
                  <td colSpan={BASE_COLUMN_COUNT}></td>
                  {quotedSuppliers.map((quote, sIdx) => (
                    <td key={quote.quotationId || sIdx} colSpan={supplierGroupColSpan} className="qst-summary-cell">
                      <div className="qst-summary-grid">
                        <span className="qst-summary-item-label">Subtotal:</span>
                        <span className="qst-summary-item-value">{formatMoney(quote.totalPrice, quote.currency)}</span>
                        <span className="qst-summary-item-label">Discount:</span>
                        <span className="qst-summary-item-value qst-summary-item-negative">
                          {formatTypedDiscount(quote.discount, quote.discountType, quote.currency)}
                        </span>
                        <span className="qst-summary-item-label">Tax:</span>
                        <span className="qst-summary-item-value">{formatTypedValue(quote.tax, quote.taxType, quote.currency)}</span>
                        <span className="qst-summary-item-label">Delivery Charge:</span>
                        <span className="qst-summary-item-value">
                          {formatTypedValue(quote.deliveryCharge, quote.deliveryType, quote.currency)}
                        </span>
                      </div>
                    </td>
                  ))}
                </tr>
              )}
            </tfoot>
          )}
          {showSupplierColumns && !isLotEnabled && (
            <tfoot>
              <tr className="qst-total-quote-row">
                <td colSpan={BASE_COLUMN_COUNT}></td>
                {quotedSuppliers.map((quote, sIdx) => (
                  <td key={quote.quotationId || sIdx} colSpan={supplierGroupColSpan} className="qst-total-quote-cell">
                    <span className="qst-total-quote-label">Total Quote</span>
                    <span className="qst-total-quote-amount">{formatMoney(quote.totalPrice ?? 0, quote.currency)}</span>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default QuotationSummaryTable;
