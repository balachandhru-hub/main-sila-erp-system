import React, { useState } from 'react';
import {
  addStockCountItem,
  countStockCountItem,
  type SilaCountMethod,
  type SilaStockCountItemResult,
} from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import QtyInput, { parseQty } from '../../components/QtyInput';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { errorText } from '../../useLoad';
import CountPhotoButton from './CountPhotoButton';

/** The material being counted: a sheet line (itemId) or a material not on the sheet yet. */
export interface CountTarget {
  itemId: string | null;
  materialId: string;
  materialCode: string;
  materialName: string;
  uoms: string[];
  countedQty?: number | null;
  systemQty?: number | null;
  method: SilaCountMethod;
  /** Photos already attached to the line. */
  photoCount?: number;
  /** The cost controller sent the line back; his comment explains why. */
  recountRequested?: boolean;
  reviewComment?: string | null;
}

interface CountLineFormProps {
  stockCountId: string;
  target: CountTarget;
  /** The system quantity is hidden (blind count). */
  blind: boolean;
  location: string;
  onPhotoAdded: () => void;
  onSaved: (result: SilaStockCountItemResult) => void;
  onClose: () => void;
}

/** Open units default to ML when the material has it (bottles), otherwise the last unit. */
const defaultOpenUom = (uoms: string[]): string => (uoms.includes('ML') ? 'ML' : uoms[uoms.length - 1] ?? '');

const CountLineForm: React.FC<CountLineFormProps> = ({ stockCountId, target, blind, location, onPhotoAdded, onSaved, onClose }) => {
  const [fullQty, setFullQty] = useState<string>('');
  const [fullUom, setFullUom] = useState<string>(target.uoms[0] ?? '');
  const [openQty, setOpenQty] = useState<string>('');
  const [openUom, setOpenUom] = useState<string>(defaultOpenUom(target.uoms));
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const save = async () => {
    const full = parseQty(fullQty);
    const open = openQty.trim() === '' ? null : parseQty(openQty);
    if (full === null || (openQty.trim() !== '' && open === null)) {
      setNotice({ tone: 'error', text: 'Enter the full quantity (0 or more); open quantity is optional.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    const request = {
      fullQty: full,
      fullUom: fullUom || null,
      openQty: open,
      openUom: open !== null ? openUom || null : null,
      method: target.method,
    };
    try {
      const result = target.itemId
        ? await countStockCountItem(stockCountId, target.itemId, request)
        : await addStockCountItem(stockCountId, { ...request, materialId: target.materialId });
      onSaved(result);
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sm-card" aria-labelledby="sm-count-line">
      <h2 id="sm-count-line" className="sm-card__title">
        {target.materialName}
      </h2>
      <p className="sm-meta">
        {target.materialCode} · {location} · {target.uoms[0] ?? ''}
        {!target.itemId && ' · not on the count sheet, it will be added'}
        {target.countedQty !== null && target.countedQty !== undefined && ` · counted so far ${formatQty(target.countedQty)}`}
      </p>
      {target.recountRequested && (
        <p className="sm-notice sm-notice--warning">Recount requested{target.reviewComment ? `: ${target.reviewComment}` : '.'}</p>
      )}
      {blind || target.systemQty === null || target.systemQty === undefined ? (
        <p className="sm-meta">Blind count. Enter what is physically there.</p>
      ) : (
        <p className="sm-meta">
          System {formatQty(target.systemQty)} {target.uoms[0] ?? ''}
        </p>
      )}
      <QtyInput label={`Full ${fullUom}`} value={fullQty} onChange={setFullQty} uoms={target.uoms} uom={fullUom} onUomChange={setFullUom} />
      <QtyInput label="Open quantity (optional)" value={openQty} onChange={setOpenQty} uoms={target.uoms} uom={openUom} onUomChange={setOpenUom} />
      {target.itemId && (
        <CountPhotoButton stockCountId={stockCountId} itemId={target.itemId} existing={target.photoCount ?? 0} disabled={saving} onAdded={onPhotoAdded} />
      )}
      <Notice notice={notice} />
      <div className="sm-grid-2">
        <button type="button" className="sm-btn" disabled={saving} onClick={onClose}>
          Close
        </button>
        <button type="button" className="sm-btn sm-btn--primary" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save and scan next'}
        </button>
      </div>
    </section>
  );
};

export default CountLineForm;
