import React, { useEffect, useMemo, useState } from "react";
import { Loader, Modal, toastService } from "@vosox/shared-ui";
import { getSuppliers, type SilaSupplier } from "../../../api/silaMe/silaMasterDataApi";
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

/** Create Invoice: PO (supplier → PO → GRN → lines) or Non-PO (GL lines). Both post through FIVE S4-INVOICE POSTING. */
const SilaCreateInvoiceDialog: React.FC<SilaCreateInvoiceDialogProps> = ({ onClose, onCreated }) => {
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
  const [orders, setOrders] = useState<SilaEligiblePurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
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

  useEffect(() => {
    if (creationType !== "PO" || !silaSupplierId || !resolvedCompany) {
      setOrders([]);
      return;
    }
    let active = true;
    setOrdersLoading(true);
    getEligiblePurchaseOrders({
      silaSupplierId,
      companyCode: resolvedCompany,
      propertyId: propertyId || null,
    })
      .then((rows) => active && setOrders(rows))
      .catch((err: unknown) => {
        if (active) {
          setOrders([]);
          toastService.error(err instanceof Error ? err.message : "Could not load purchase orders.");
        }
      })
      .finally(() => active && setOrdersLoading(false));
    return () => { active = false; };
  }, [creationType, silaSupplierId, resolvedCompany, propertyId]);

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
        setSelectedGrns(rows.length === 1 ? [rows[0].id] : []);
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

  const buildRequest = async (): Promise<SilaCreateInvoiceRequest> => {
    const request: SilaCreateInvoiceRequest = {
      creationType,
      propertyId: propertyId || null,
      companyCode: resolvedCompany || null,
      silaSupplierId: silaSupplierId || null,
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
    if (!resolvedCompany) return "Select a property or company code.";
    if (!silaSupplierId && !supplierName.trim()) return "Select a supplier.";
    if (!invoiceNumber.trim()) return "Enter the supplier invoice number.";
    if (!invoiceDate) return "Enter the invoice date.";
    if (!taxDeterminationDate) return "Enter the tax determination date.";
    if (!currency.trim()) return "Enter the currency.";
    if (creationType === "PO") {
      if (!purchaseOrderId) return "Select a purchase order.";
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

        <section className="srcv-stack" aria-labelledby="srcv-create-type">
          <h3 id="srcv-create-type" className="sila-form-section-title">Invoice type</h3>
          <div className="sila-btn-group">
            <button type="button" className={`sila-btn ${creationType === "PO" ? "sila-btn--primary" : "sila-btn--secondary"}`} onClick={() => setCreationType("PO")}>
              PO Invoice
            </button>
            <button type="button" className={`sila-btn ${creationType === "NON_PO" ? "sila-btn--primary" : "sila-btn--secondary"}`} onClick={() => setCreationType("NON_PO")}>
              Non-PO Invoice
            </button>
          </div>
        </section>

        <section className="sila-form-grid">
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
              {suppliers.map((row) => (
                <option key={row.id} value={row.id}>{row.supplierCode} — {row.name}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-number">Supplier invoice number</label>
            <input id="srcv-create-number" className="sila-input" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
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
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-ref">Reference</label>
            <input id="srcv-create-ref" className="sila-input" value={reference} onChange={(event) => setReference(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-create-file">Invoice document</label>
            <input id="srcv-create-file" className="sila-input" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </div>
        </section>

        {creationType === "PO" && (
          <>
            <section className="srcv-stack" aria-labelledby="srcv-create-pos">
              <h3 id="srcv-create-pos" className="sila-form-section-title">Available purchase orders</h3>
              {!silaSupplierId || !resolvedCompany ? (
                <p className="srcv-sub">Select a supplier and company code to see eligible purchase orders.</p>
              ) : ordersLoading ? (
                <Loader size={20} message="Loading purchase orders..." />
              ) : orders.length === 0 ? (
                <p className="srcv-sub">No eligible purchase orders for this supplier and company code.</p>
              ) : (
                <div className="sila-table-wrap">
                  <table className="sila-table">
                    <thead>
                      <tr>
                        <th scope="col">PO</th>
                        <th scope="col">Date</th>
                        <th scope="col">Company</th>
                        <th scope="col">Value</th>
                        <th scope="col">GRNs</th>
                        <th scope="col">Status</th>
                        <th scope="col"><span className="sila-visually-hidden">Select</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td><span className="sila-cell-strong">{order.poNumber}</span></td>
                          <td>{order.orderDate ? formatDate(order.orderDate) : "—"}</td>
                          <td>{order.companyCode || "—"}</td>
                          <td>{formatAmount(order.totalAmount, order.currency)}</td>
                          <td>{order.grnCount}</td>
                          <td><span className={receivingBadgeClass(order.status)}>{receivingLabel(order.status)}</span></td>
                          <td>
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setPurchaseOrderId(order.id)}>
                              {purchaseOrderId === order.id ? "Selected" : "Select"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

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
