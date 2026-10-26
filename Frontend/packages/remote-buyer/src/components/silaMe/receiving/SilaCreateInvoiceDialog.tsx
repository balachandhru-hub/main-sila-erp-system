import React, { useEffect, useMemo, useState } from "react";
import { Loader, Modal, toastService } from "@vosox/shared-ui";
import { getSuppliers, type SilaSupplier } from "../../../api/silaMe/silaMasterDataApi";
import SilaCreditMemoDialog from "./SilaCreditMemoDialog";
import {
  createInvoiceDraft,
  getCreateInvoiceMasters,
  getEligibleGoodsReceipts,
  getEligiblePurchaseOrders,
  prepareCreateInvoice,
  type SilaCreateInvoiceLine,
  type SilaCreateInvoiceMasters,
  type SilaCreateInvoiceRequest,
  type SilaEligibleGoodsReceipt,
  type SilaEligiblePurchaseOrder,
} from "../../../api/silaMe/silaReceivingApi";
import { formatDate } from "../../cart/lineFormat";
import { formatAmount, parseNumber, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced } from "./usePagedList";

interface SilaCreateInvoiceDialogProps {
  onClose: () => void;
  onCreated: (invoiceId: string) => void;
  onCreditMemoDone?: () => void;
}

type CreationType = "PO" | "NON_PO";

interface NonPoLine {
  key: string;
  description: string;
  glAccount: string;
  amount: string;
  taxCode: string;
  costCenter: string;
  profitCenter: string;
  internalOrder: string;
  wbsElement: string;
  businessArea: string;
  assignmentReference: string;
  lineText: string;
}

const today = (): string => new Date().toISOString().slice(0, 10);

const emptyNonPoLine = (): NonPoLine => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  description: "",
  glAccount: "",
  amount: "",
  taxCode: "",
  costCenter: "",
  profitCenter: "",
  internalOrder: "",
  wbsElement: "",
  businessArea: "",
  assignmentReference: "",
  lineText: "",
});

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const comma = text.indexOf(",");
      resolve(comma >= 0 ? text.slice(comma + 1) : text);
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });

/** Create Invoice: PO number first fills supplier, company, amounts and GRNs. One attachment is required. */
const SilaCreateInvoiceDialog: React.FC<SilaCreateInvoiceDialogProps> = ({ onClose, onCreated, onCreditMemoDone }) => {
  const [documentKind, setDocumentKind] = useState<"INVOICE" | "CREDIT_MEMO">("INVOICE");
  const [creationType, setCreationType] = useState<CreationType>("PO");
  const [masters, setMasters] = useState<SilaCreateInvoiceMasters | null>(null);
  const [mastersError, setMastersError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const supplierTerm = useDebounced(supplierSearch);
  const [suppliers, setSuppliers] = useState<SilaSupplier[]>([]);
  const [silaSupplierId, setSilaSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [postingDate, setPostingDate] = useState(today);
  const [taxDeterminationDate, setTaxDeterminationDate] = useState(today);
  const [currency, setCurrency] = useState("AED");
  const [grossAmount, setGrossAmount] = useState("");
  const [netAmount, setNetAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [poSearch, setPoSearch] = useState("");
  const poTerm = useDebounced(poSearch);
  const [poOpen, setPoOpen] = useState(false);
  const [orders, setOrders] = useState<SilaEligiblePurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [receipts, setReceipts] = useState<SilaEligibleGoodsReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(false);
  const [selectedGrns, setSelectedGrns] = useState<string[]>([]);
  const [nonPoLines, setNonPoLines] = useState<NonPoLine[]>([emptyNonPoLine()]);
  const [saving, setSaving] = useState(false);

  const resolvedCompany = useMemo(() => {
    if (companyCode.trim()) return companyCode.trim();
    const property = masters?.properties.find((row) => row.id === propertyId);
    return property?.companyCode?.trim() || "";
  }, [companyCode, propertyId, masters]);

  useEffect(() => {
    let active = true;
    getCreateInvoiceMasters()
      .then((data) => active && setMasters(data))
      .catch((err: unknown) => active && setMastersError(err instanceof Error ? err.message : "Could not load masters."));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getSuppliers(supplierTerm, "ACTIVE", { index: 0, limit: 40 })
      .then((rows) => active && setSuppliers(rows))
      .catch(() => active && setSuppliers([]));
    return () => { active = false; };
  }, [supplierTerm]);

  const applyPurchaseOrder = (order: SilaEligiblePurchaseOrder) => {
    setPurchaseOrderId(order.id);
    setPoSearch(order.poNumber);
    setPoOpen(false);
    if (order.companyCode) setCompanyCode(order.companyCode);
    const property = masters?.properties.find((row) => row.companyCode && row.companyCode === order.companyCode);
    if (property) setPropertyId(property.id);
    setSupplierName(order.supplierName || "");
    setSupplierSearch(order.supplierName || order.supplierCode || "");
    setSilaSupplierId(order.silaSupplierId || "");
    setSelectedSupplierId(order.supplierId || "");
    if (order.currency) setCurrency(order.currency);
    if (order.totalAmount != null) setGrossAmount(String(order.totalAmount));
    setReference((current) => current || order.poNumber);
  };

  useEffect(() => {
    if (creationType !== "PO") return undefined;
    let active = true;
    setOrdersLoading(true);
    getEligiblePurchaseOrders({ search: poTerm.trim() || null })
      .then((rows) => {
        if (!active) return;
        setOrders(rows);
        const exact = rows.filter((row) => row.poNumber.toLowerCase() === poTerm.trim().toLowerCase());
        if (exact.length === 1 && purchaseOrderId !== exact[0].id) applyPurchaseOrder(exact[0]);
      })
      .catch((err: unknown) => {
        if (active) {
          setOrders([]);
          if (poTerm.trim()) toastService.error(err instanceof Error ? err.message : "Could not load purchase orders.");
        }
      })
      .finally(() => active && setOrdersLoading(false));
    return () => { active = false; };
  }, [creationType, poTerm]);

  useEffect(() => {
    if (!purchaseOrderId) {
      setReceipts([]);
      setSelectedGrns([]);
      return;
    }
    let active = true;
    setReceiptsLoading(true);
    getEligibleGoodsReceipts(purchaseOrderId)
      .then((rows) => {
        if (!active) return;
        setReceipts(rows);
        setSelectedGrns(rows.map((row) => row.id));
      })
      .catch((err: unknown) => {
        if (active) {
          setReceipts([]);
          toastService.error(err instanceof Error ? err.message : "Could not load goods receipts.");
        }
      })
      .finally(() => active && setReceiptsLoading(false));
    return () => { active = false; };
  }, [purchaseOrderId]);

  const selectedSupplier = suppliers.find((row) => row.id === silaSupplierId);

  const poLines = useMemo((): SilaCreateInvoiceLine[] => {
    const chosen = receipts.filter((row) => selectedGrns.includes(row.id));
    let lineNumber = 0;
    const lines: SilaCreateInvoiceLine[] = [];
    for (const receipt of chosen) {
      for (const line of receipt.lines) {
        lineNumber += 1;
        const qty = line.remainingQuantity;
        const amount = line.unitPrice == null ? null : Math.round(qty * line.unitPrice * 100) / 100;
        lines.push({
          lineNumber,
          description: line.description,
          quantity: qty,
          unitPrice: line.unitPrice,
          amount,
          uom: line.uom,
          taxCode: line.taxCode,
          purchaseOrderItemId: line.purchaseOrderItemId,
          goodsReceiptItemId: line.id,
        });
      }
    }
    return lines;
  }, [receipts, selectedGrns]);

  useEffect(() => {
    if (creationType !== "PO" || !purchaseOrderId) return;
    const net = poLines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
    setNetAmount(net ? String(net) : "");
    const order = orders.find((row) => row.id === purchaseOrderId);
    if (order?.totalAmount != null && selectedGrns.length === receipts.length && receipts.length > 0) {
      setGrossAmount(String(order.totalAmount));
    } else if (net) {
      setGrossAmount(String(net));
    }
  }, [creationType, purchaseOrderId, poLines, orders, selectedGrns, receipts.length]);

  const buildRequest = async (): Promise<SilaCreateInvoiceRequest> => {
    const request: SilaCreateInvoiceRequest = {
      creationType,
      propertyId: propertyId || null,
      companyCode: resolvedCompany || null,
      silaSupplierId: silaSupplierId || null,
      supplierId: selectedSupplierId || null,
      supplierName: supplierName || selectedSupplier?.name || null,
      invoiceNumber: invoiceNumber.trim() || null,
      invoiceDate: invoiceDate || null,
      postingDate: postingDate || null,
      taxDeterminationDate: taxDeterminationDate || null,
      currency: currency.trim() || null,
      grossAmount: parseNumber(grossAmount),
      netAmount: parseNumber(netAmount),
      taxAmount: parseNumber(taxAmount),
      reference: reference.trim() || null,
      purchaseOrderId: creationType === "PO" ? purchaseOrderId || null : null,
      goodsReceiptIds: creationType === "PO" ? selectedGrns : [],
      lines: creationType === "PO"
        ? poLines
        : nonPoLines.map((line, index) => ({
          lineNumber: index + 1,
          description: line.description.trim() || line.glAccount.trim(),
          amount: parseNumber(line.amount),
          quantity: 1,
          unitPrice: parseNumber(line.amount),
          taxCode: line.taxCode.trim() || null,
          glAccount: line.glAccount.trim() || null,
          costCenter: line.costCenter.trim() || null,
          profitCenter: line.profitCenter.trim() || null,
          internalOrder: line.internalOrder.trim() || null,
          wbsElement: line.wbsElement.trim() || null,
          businessArea: line.businessArea.trim() || null,
          assignmentReference: line.assignmentReference.trim() || null,
          debitCreditCode: "S",
          lineText: line.lineText.trim() || line.description.trim() || null,
        })),
    };
    if (file) {
      request.fileName = file.name;
      request.contentType = file.type || "application/pdf";
      request.content = await fileToBase64(file);
    }
    return request;
  };

  const validate = (): string | null => {
    if (!file) return "Upload one invoice attachment (PDF, JPEG or PNG).";
    if (!resolvedCompany) return "Select a property or company code.";
    if (!silaSupplierId && !selectedSupplierId && !supplierName.trim()) return "Select a supplier.";
    if (!invoiceNumber.trim()) return "Supplier Reference is required.";
    if (!invoiceDate) return "Enter the invoice date.";
    if (!taxDeterminationDate) return "Enter the tax determination date.";
    if (!currency.trim()) return "Enter the currency.";
    if (creationType === "PO") {
      if (!purchaseOrderId) return "Select a purchase order from the dropdown.";
      if (selectedGrns.length === 0) return "Select at least one goods receipt.";
      if (poLines.length === 0) return "No invoiceable quantities remain on the selected goods receipts.";
    } else {
      if (nonPoLines.length === 0) return "Add at least one Non-PO line.";
      for (const line of nonPoLines) {
        if (!line.glAccount.trim()) return "Each Non-PO line needs a GL account.";
        if (!line.taxCode.trim()) return "Each Non-PO line needs a tax code.";
        if (parseNumber(line.amount) == null || (parseNumber(line.amount) ?? 0) <= 0) return "Each Non-PO line needs an amount.";
      }
    }
    return null;
  };

  const handleSave = async (submitAfter: boolean) => {
    const problem = validate();
    if (problem) {
      toastService.error(problem);
      return;
    }
    setSaving(true);
    try {
      const request = await buildRequest();
      const id = await createInvoiceDraft(request);
      const prepared = await prepareCreateInvoice(id, request);
      toastService.success(submitAfter
        ? "Invoice prepared. Open it to submit for approval and posting."
        : "Invoice draft prepared with posting data.");
      onCreated(prepared.id);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not create the invoice.");
    } finally {
      setSaving(false);
    }
  };

  const toggleGrn = (id: string) => {
    setSelectedGrns((current) => current.includes(id) ? current.filter((row) => row !== id) : [...current, id]);
  };

  if (documentKind === "CREDIT_MEMO") {
    return (
      <SilaCreditMemoDialog
        showKindToggle
        canProcess
        onSelectInvoice={() => setDocumentKind("INVOICE")}
        onClose={onClose}
        onChanged={onCreditMemoDone}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: "Create Invoice" }}
      footerProps={{
        primaryButton: { text: saving ? "Saving..." : "Submit invoice", onClick: () => handleSave(true), loading: saving, disabled: saving },
        secondaryButton: { text: "Save draft", onClick: () => handleSave(false), disabled: saving },
      }}
    >
      <div className="sila-root sila-me srcv-dialog">
        {mastersError && <p className="srcv-error" role="alert">{mastersError}</p>}
        {!masters && !mastersError && <Loader size={20} message="Loading masters..." />}

        <section className="srcv-stack" aria-labelledby="srcv-create-kind">
          <h3 id="srcv-create-kind" className="sila-form-section-title">Document</h3>
          <div className="sila-btn-group">
            <button type="button" className="sila-btn sila-btn--primary">Invoice</button>
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setDocumentKind("CREDIT_MEMO")}>Credit Memo</button>
          </div>
        </section>

        <section className="srcv-stack" aria-labelledby="srcv-create-type">
          <h3 id="srcv-create-type" className="sila-form-section-title">Invoice type</h3>
          <div className="sila-btn-group">
            <button type="button" className={`sila-btn ${creationType === "PO" ? "sila-btn--primary" : "sila-btn--secondary"}`} onClick={() => setCreationType("PO")}>
              PO Invoice
            </button>
            <button type="button" className={`sila-btn ${creationType === "NON_PO" ? "sila-btn--primary" : "sila-btn--secondary"}`} onClick={() => {
              setCreationType("NON_PO");
              setPurchaseOrderId("");
              setOrders([]);
              setReceipts([]);
              setSelectedGrns([]);
            }}>
              Non-PO Invoice
            </button>
          </div>
        </section>

        {creationType === "PO" && (
          <section className="srcv-stack" aria-labelledby="srcv-create-po-number">
            <h3 id="srcv-create-po-number" className="sila-form-section-title">Purchase order</h3>
            <p className="srcv-sub">Search the dropdown by PO number, supplier ID / code, or creation date. Selecting a PO fills supplier, company, amounts, tax codes and GRNs.</p>
            <div className="sila-field sila-field--full srcv-combo">
              <label className="sila-label" htmlFor="srcv-create-po">PO number</label>
              <input
                id="srcv-create-po"
                className="sila-input"
                role="combobox"
                aria-expanded={poOpen}
                aria-controls="srcv-create-po-list"
                aria-autocomplete="list"
                value={poSearch}
                autoComplete="off"
                placeholder="Search PO, supplier ID or creation date"
                onFocus={() => setPoOpen(true)}
                onChange={(event) => {
                  setPoSearch(event.target.value);
                  setPoOpen(true);
                  if (purchaseOrderId) setPurchaseOrderId("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setPoOpen(false);
                  if (event.key === "Enter" && orders.length === 1) {
                    event.preventDefault();
                    applyPurchaseOrder(orders[0]);
                  }
                }}
                onBlur={() => window.setTimeout(() => setPoOpen(false), 150)}
              />
              {poOpen && (
                <ul id="srcv-create-po-list" className="srcv-combo__list" role="listbox">
                  {ordersLoading && <li className="srcv-combo__empty">Searching…</li>}
                  {!ordersLoading && orders.length === 0 && (
                    <li className="srcv-combo__empty">No eligible purchase orders match that search.</li>
                  )}
                  {orders.map((order) => (
                    <li key={order.id} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={purchaseOrderId === order.id}
                        className={`srcv-combo__option${purchaseOrderId === order.id ? " srcv-combo__option--selected" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => applyPurchaseOrder(order)}
                      >
                        <strong>{order.poNumber}</strong>
                        <span>
                          {order.supplierCode || order.supplierId || "—"}
                          {order.supplierName ? ` · ${order.supplierName}` : ""}
                          {` · ${formatDate(order.orderDate || order.createdOn)}`}
                          {order.companyCode ? ` · ${order.companyCode}` : ""}
                          {order.grnCount ? ` · ${order.grnCount} GRN` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {purchaseOrderId && (
              <p className="srcv-sub">
                Selected {poSearch}
                {supplierName ? ` · ${supplierName}` : ""}
                {companyCode ? ` · ${companyCode}` : ""}
              </p>
            )}
          </section>
        )}

        <section className="sila-form-grid">
          <div className="sila-field sila-field--full">
            <label className="sila-label" htmlFor="srcv-create-file">Invoice attachment (required)</label>
            <input
              id="srcv-create-file"
              className="sila-input"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <p className="srcv-sub">{file ? file.name : "One PDF, JPEG or PNG is required."}</p>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-property">Property</label>
            <select id="srcv-create-property" className="sila-select" value={propertyId} onChange={(event) => {
              setPropertyId(event.target.value);
              const property = masters?.properties.find((row) => row.id === event.target.value);
              if (property?.companyCode) setCompanyCode(property.companyCode);
            }}>
              <option value="">Select property</option>
              {(masters?.properties || []).map((row) => (
                <option key={row.id} value={row.id}>{row.propertyName} ({row.companyCode})</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-company">Company code</label>
            <select id="srcv-create-company" className="sila-select" value={companyCode} onChange={(event) => setCompanyCode(event.target.value)}>
              <option value="">Select company code</option>
              {(masters?.companyCodes || []).map((row) => (
                <option key={row.id} value={row.code}>{row.code}{row.name ? ` — ${row.name}` : ""}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-supplier-search">Supplier</label>
            <input id="srcv-create-supplier-search" className="sila-input" type="search" placeholder="Search suppliers" value={supplierSearch} onChange={(event) => setSupplierSearch(event.target.value)} />
            <select
              className="sila-select"
              aria-label="Supplier"
              value={silaSupplierId}
              onChange={(event) => {
                setSilaSupplierId(event.target.value);
                const chosen = suppliers.find((row) => row.id === event.target.value);
                setSupplierName(chosen?.name || "");
                setCurrency(chosen?.currency || currency);
              }}
            >
              <option value="">Select supplier</option>
              {silaSupplierId && !suppliers.some((row) => row.id === silaSupplierId) && (
                <option value={silaSupplierId}>{supplierName || "Supplier from the purchase order"}</option>
              )}
              {suppliers.map((row) => (
                <option key={row.id} value={row.id}>{row.supplierCode} — {row.name}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-number">Supplier Reference <span aria-hidden="true">*</span></label>
            <input id="srcv-create-number" className="sila-input" required value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-date">Invoice date</label>
            <input id="srcv-create-date" className="sila-input" type="date" value={invoiceDate} onChange={(event) => {
              setInvoiceDate(event.target.value);
              if (!taxDeterminationDate || taxDeterminationDate === invoiceDate) setTaxDeterminationDate(event.target.value);
            }} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-tax-date">Tax determination date</label>
            <input id="srcv-create-tax-date" className="sila-input" type="date" value={taxDeterminationDate} onChange={(event) => setTaxDeterminationDate(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-posting-date">Posting date</label>
            <input id="srcv-create-posting-date" className="sila-input" type="date" value={postingDate} onChange={(event) => setPostingDate(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-currency">Currency</label>
            <input id="srcv-create-currency" className="sila-input" value={currency} onChange={(event) => setCurrency(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-gross">Gross amount</label>
            <input id="srcv-create-gross" className="sila-input" inputMode="decimal" value={grossAmount} onChange={(event) => setGrossAmount(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-net">Net amount</label>
            <input id="srcv-create-net" className="sila-input" inputMode="decimal" value={netAmount} onChange={(event) => setNetAmount(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-tax">Tax amount</label>
            <input id="srcv-create-tax" className="sila-input" inputMode="decimal" value={taxAmount} onChange={(event) => setTaxAmount(event.target.value)} />
            {creationType === "PO" && poLines.some((line) => line.taxCode) && (
              <p className="srcv-sub">Tax codes from the PO / GRN: {[...new Set(poLines.map((line) => line.taxCode).filter(Boolean))].join(", ")}</p>
            )}
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-ref">Reference</label>
            <input id="srcv-create-ref" className="sila-input" value={reference} onChange={(event) => setReference(event.target.value)} />
          </div>
        </section>

        {creationType === "PO" && (
          <>
            {purchaseOrderId && (
              <section className="srcv-stack" aria-labelledby="srcv-create-grns">
                <h3 id="srcv-create-grns" className="sila-form-section-title">Available GRNs</h3>
                {receiptsLoading ? (
                  <Loader size={20} message="Loading goods receipts..." />
                ) : receipts.length === 0 ? (
                  <p className="srcv-sub">No eligible goods receipts remain for this purchase order.</p>
                ) : (
                  <div className="sila-table-wrap">
                    <table className="sila-table">
                      <thead>
                        <tr>
                          <th scope="col">Select</th>
                          <th scope="col">GRN</th>
                          <th scope="col">SAP material document</th>
                          <th scope="col">Date</th>
                          <th scope="col">Received</th>
                          <th scope="col">Invoiced</th>
                          <th scope="col">Remaining</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.map((receipt) => (
                          <tr key={receipt.id}>
                            <td>
                              <input type="checkbox" checked={selectedGrns.includes(receipt.id)} onChange={() => toggleGrn(receipt.id)} aria-label={`Select ${receipt.grnNumber}`} />
                            </td>
                            <td>{receipt.grnNumber}</td>
                            <td>{receipt.erpReference || "—"}</td>
                            <td>{formatDate(receipt.receivedOn)}</td>
                            <td>{receipt.receivedQuantity}</td>
                            <td>{receipt.invoicedQuantity}</td>
                            <td>{receipt.remainingQuantity}</td>
                            <td>
                              <span className={receivingBadgeClass(receipt.status)}>{receivingLabel(receipt.status)}</span>
                              {receipt.invoiceStatus && <span className="srcv-sub">{receivingLabel(receipt.invoiceStatus)}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {poLines.length > 0 && (
              <section className="srcv-stack" aria-labelledby="srcv-create-lines">
                <h3 id="srcv-create-lines" className="sila-form-section-title">Invoice lines</h3>
                <div className="sila-table-wrap">
                  <table className="sila-table">
                    <thead>
                      <tr>
                        <th scope="col">Line</th>
                        <th scope="col">Description</th>
                        <th scope="col">Invoice qty</th>
                        <th scope="col">UOM</th>
                        <th scope="col">Price</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poLines.map((line) => (
                        <tr key={`${line.goodsReceiptItemId}-${line.lineNumber}`}>
                          <td>{line.lineNumber}</td>
                          <td>{line.description}</td>
                          <td>{line.quantity}</td>
                          <td>{line.uom || "—"}</td>
                          <td>{formatAmount(line.unitPrice, currency)}</td>
                          <td>{formatAmount(line.amount, currency)}</td>
                          <td>{line.taxCode || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {creationType === "NON_PO" && (
          <section className="srcv-stack" aria-labelledby="srcv-create-nonpo">
            <h3 id="srcv-create-nonpo" className="sila-form-section-title">Non-PO lines</h3>
            {nonPoLines.map((line, index) => (
              <div className="sila-form-grid" key={line.key}>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-desc-${line.key}`}>Description</label>
                  <input id={`srcv-np-desc-${line.key}`} className="sila-input" value={line.description} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, description: event.target.value };
                    setNonPoLines(next);
                  }} />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-gl-${line.key}`}>GL account</label>
                  <select id={`srcv-np-gl-${line.key}`} className="sila-select" value={line.glAccount} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, glAccount: event.target.value };
                    setNonPoLines(next);
                  }}>
                    <option value="">Select GL account</option>
                    {(masters?.glAccounts || []).map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                  {(masters?.glAccounts || []).length === 0 && (
                    <input className="sila-input" placeholder="GL account" value={line.glAccount} onChange={(event) => {
                      const next = [...nonPoLines];
                      next[index] = { ...line, glAccount: event.target.value };
                      setNonPoLines(next);
                    }} />
                  )}
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-amt-${line.key}`}>Amount</label>
                  <input id={`srcv-np-amt-${line.key}`} className="sila-input" inputMode="decimal" value={line.amount} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, amount: event.target.value };
                    setNonPoLines(next);
                  }} />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-tax-${line.key}`}>Tax code</label>
                  <select id={`srcv-np-tax-${line.key}`} className="sila-select" value={line.taxCode} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, taxCode: event.target.value };
                    setNonPoLines(next);
                  }}>
                    <option value="">Select tax code</option>
                    {(masters?.taxCodes || []).map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                  {(masters?.taxCodes || []).length === 0 && (
                    <input className="sila-input" placeholder="Tax code" value={line.taxCode} onChange={(event) => {
                      const next = [...nonPoLines];
                      next[index] = { ...line, taxCode: event.target.value };
                      setNonPoLines(next);
                    }} />
                  )}
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-cc-${line.key}`}>Cost center</label>
                  <select id={`srcv-np-cc-${line.key}`} className="sila-select" value={line.costCenter} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, costCenter: event.target.value };
                    setNonPoLines(next);
                  }}>
                    <option value="">Optional</option>
                    {(masters?.costCenters || []).map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-pc-${line.key}`}>Profit center</label>
                  <select id={`srcv-np-pc-${line.key}`} className="sila-select" value={line.profitCenter} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, profitCenter: event.target.value };
                    setNonPoLines(next);
                  }}>
                    <option value="">Optional</option>
                    {(masters?.profitCenters || []).map((code) => <option key={code} value={code}>{code}</option>)}
                  </select>
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-io-${line.key}`}>Internal order</label>
                  <input id={`srcv-np-io-${line.key}`} className="sila-input" value={line.internalOrder} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, internalOrder: event.target.value };
                    setNonPoLines(next);
                  }} />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor={`srcv-np-wbs-${line.key}`}>WBS</label>
                  <input id={`srcv-np-wbs-${line.key}`} className="sila-input" value={line.wbsElement} onChange={(event) => {
                    const next = [...nonPoLines];
                    next[index] = { ...line, wbsElement: event.target.value };
                    setNonPoLines(next);
                  }} />
                </div>
              </div>
            ))}
            <div className="sila-btn-group">
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setNonPoLines((rows) => [...rows, emptyNonPoLine()])}>
                Add line
              </button>
              {nonPoLines.length > 1 && (
                <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setNonPoLines((rows) => rows.slice(0, -1))}>
                  Remove last line
                </button>
              )}
            </div>
          </section>
        )}

      </div>
    </Modal>
  );
};

export default SilaCreateInvoiceDialog;
