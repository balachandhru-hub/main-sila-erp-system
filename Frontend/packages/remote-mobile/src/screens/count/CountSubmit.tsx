import React, { useState } from 'react';
import { submitStockCount, type SilaStockCountDetail } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { errorText } from '../../useLoad';

interface CountSubmitProps {
  count: SilaStockCountDetail;
  onSubmitted: () => void;
}

/** Submits the count; when lines are left uncounted, offers to count them as zero. */
const CountSubmit: React.FC<CountSubmitProps> = ({ count, onSubmitted }) => {
  const [confirming, setConfirming] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const submit = async (countMissingAsZero: boolean) => {
    setSaving(true);
    setNotice(null);
    try {
      await submitStockCount(count.id, countMissingAsZero);
      setConfirming(false);
      onSubmitted();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  };

  const start = () => {
    if (count.remainingItems > 0) setConfirming(true);
    else void submit(false);
  };

  return (
    <section className="sm-section" aria-label="Submit count">
      <Notice notice={notice} />
      {confirming ? (
        <div className="sm-notice sm-notice--warning sm-section" role="alertdialog" aria-label="Uncounted items">
          <p>
            {count.remainingItems} item{count.remainingItems === 1 ? ' is' : 's are'} not counted yet. Count them as zero and submit?
          </p>
          <div className="sm-grid-2">
            <button type="button" className="sm-btn" disabled={saving} onClick={() => setConfirming(false)}>
              Keep counting
            </button>
            <button type="button" className="sm-btn sm-btn--primary" disabled={saving} onClick={() => submit(true)}>
              {saving ? 'Submitting…' : 'Count as zero'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="sm-btn sm-btn--success sm-btn--block" disabled={saving} onClick={start}>
          {saving ? 'Submitting…' : 'Submit count'}
        </button>
      )}
    </section>
  );
};

export default CountSubmit;
