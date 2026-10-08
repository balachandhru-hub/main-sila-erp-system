import React, { useState } from 'react';
import {
  updateInvoice,
  type SilaInvoiceDetail,
  type SilaInvoiceOcrFields,
  type SilaOpenPurchaseOrder,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { parseQty } from '../../components/QtyInput';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';
import InvoiceItemsCard from './InvoiceItemsCard';
import PoPicker from './PoPicker';
import SupplierMatch, { type MatchedSupplier } from './SupplierMatch';

interface InvoiceReviewFormProps {
  invoice: SilaInvoiceDetail;
  /** Fields of the newest OCR reading (what was read, before corrections). */
  ocr: SilaInvoiceOcrFields | null;
}

/** yyyy-mm-dd part of an ISO date, for the date input. */
const dateInput = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '');

const matchedOf = (invoice: SilaInvoiceDetail): MatchedSupplier | null =>
  invoice.silaSupplierId || invoice.supplierId
    ? { supplierId: invoice.supplierId ?? null, silaSupplierId: invoice.silaSupplierId ?? null, supplierCode: invoice.supplierCode ?? null, name: invoice.supplierName ?? '—' }
    : null;

type Field = 'number' | 'date' | 'currency' | 'gross';

/** Supplier, invoice fields and purchase order of a scanned invoice; saving leads to Finalize GRN. */
const InvoiceReviewForm: React.FC<InvoiceReviewFormProps> = ({ invoice, ocr }) => {
  const go = useGo();
  const [supplier, setSupplier] = useState<MatchedSupplier | null>(() => matchedOf(invoice));
  const [invoiceNumber, setInvoiceNumber] = useState<string>(invoice.invoiceNumber ?? '');
  const [invoiceDate, setInvoiceDate] = useState<string>(dateInput(invoice.invoiceDate));
  const [currency, setCurrency] = useState<string>(invoice.currency ?? '');
  const [gross, setGross] = useState<string>(invoice.grossAmount !== null && invoice.grossAmount !== undefined ? String(invoice.grossAmount) : '');
  const [po, setPo] = useState<{ id: string; poNumber: string; auto: boolean } | null>(
    invoice.purchaseOrderId ? { id: invoice.purchaseOrderId, poNumber: invoice.poNumber ?? '', auto: false } : null,
  );
  const [missing, setMissing] = useState<Field[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const ocrPo = ocr?.poNumber ?? null;

  const selectPo = (order: SilaOpenPurchaseOrder, auto = false) => {
    setPo({ id: order.id, poNumber: order.poNumber, auto });
    if (!supplier) setSupplier({ supplierId: order.supplierId, silaSupplierId: null, supplierCode: null, name: order.supplierName ?? '—' });
    if (!currency && order.currency) setCurrency(order.currency);
  };

  const save = async () => {
    const grossAmount = parseQty(gross);
    const absent: Field[] = [];
    if (!invoiceNumber.trim()) absent.push('number');
    if (!invoiceDate) absent.push('date');
    if (!currency.trim()) absent.push('currency');
    if (grossAmount === null) absent.push('gross');
    setMissing(absent);
    if (!supplier) {
      setNotice({ tone: 'error', text: 'Select the supplier from Supplier Master before continuing.' });
      return;
    }
    if (absent.length > 0) {
      setNotice({ tone: 'error', text: 'Invoice number, date, currency and gross amount are required.' });
      return;
    }
    if (!po) {
      setNotice({ tone: 'error', text: 'Select an eligible open purchase order.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await updateInvoice(invoice.id, {
        invoiceNumber: invoiceNumber.trim(),
        supplierId: supplier.supplierId,
        silaSupplierId: supplier.silaSupplierId,
        supplierName: supplier.name,
        invoiceDate,
        currency: currency.trim().toUpperCase(),
        grossAmount,
        purchaseOrderId: po.id,
        items: invoice.items,
      });
      go(`receive/grn/new?poId=${encodeURIComponent(po.id)}&invoiceId=${encodeURIComponent(invoice.id)}`);
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'The invoice could not be saved. Please retry.') });
      setSaving(false);
    }
  };

  const label = (text: string, field: Field) => (
    <>
      {text}
      {missing.includes(field) && <span className="sm-required"> · required</span>}
    </>
  );
  const inputClass = (field: Field) => `sm-input${missing.includes(field) ? ' sm-input--invalid' : ''}`;

  return (
    <>
      <SupplierMatch
        invoiceId={invoice.id}
        ocrName={ocr?.supplierName ?? null}
        ocrTaxNumber={ocr?.supplierTaxNumber ?? null}
        matched={supplier}
        disabled={saving}
        onMatched={(next) => {
          setSupplier(next);
          setPo(null);
        }}
      />

      <section className="sm-card" aria-labelledby="sm-invoice-fields">
        <h2 id="sm-invoice-fields" className="sm-label">
          Invoice
        </h2>
        <div className="sm-field">
          <label htmlFor="sm-inv-number">{label('Invoice number', 'number')}</label>
          <input id="sm-inv-number" className={inputClass('number')} placeholder="Invoice number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
        </div>
        <div className="sm-grid-2">
          <div className="sm-field">
            <label htmlFor="sm-inv-date">{label('Invoice date', 'date')}</label>
            <input id="sm-inv-date" className={inputClass('date')} type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
          </div>
          <div className="sm-field">
            <label htmlFor="sm-inv-currency">{label('Currency', 'currency')}</label>
            <input id="sm-inv-currency" className={inputClass('currency')} maxLength={3} placeholder="AED" autoCapitalize="characters" value={currency} onChange={(event) => setCurrency(event.target.value)} />
          </div>
        </div>
        <div className="sm-field">
          <label htmlFor="sm-inv-gross">{label('Gross amount', 'gross')}</label>
          <input id="sm-inv-gross" className={inputClass('gross')} type="number" inputMode="decimal" min={0} step="any" placeholder="0.00" value={gross} onChange={(event) => setGross(event.target.value)} />
        </div>
      </section>

      <section className="sm-card" aria-label="Purchase order">
        <p className="sm-meta">
          {ocrPo ? `OCR PO ${ocrPo}${po && po.poNumber.replace(/\W/g, '').toUpperCase() === ocrPo.replace(/\W/g, '').toUpperCase() ? '  · MATCHED' : ''}` : 'OCR PO not read — choose the open PO of this supplier.'}
        </p>
        {!supplier ? (
          <p className="sm-meta">Resolve the supplier to load eligible open purchase orders.</p>
        ) : (
          <PoPicker
            supplierId={supplier.supplierId}
            initialSearch={ocrPo ?? ''}
            ocrPoNumber={ocrPo}
            selectedId={po?.id ?? null}
            onSelect={selectPo}
          />
        )}
        {po && (
          <p className="sm-meta">
            Selected {po.poNumber} · <span className="sm-eyebrow">{po.auto ? 'Matched automatically' : 'Selected'}</span>
          </p>
        )}
      </section>

      <InvoiceItemsCard items={invoice.items} currency={currency || invoice.currency || null} />

      <Notice notice={notice} />
      <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'SAVE AND CONTINUE'}
      </button>
    </>
  );
};

export default InvoiceReviewForm;
