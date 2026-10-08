import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getEnquiry,
  respondEnquiry,
  SILA_JUSTIFICATION_CATEGORIES,
} from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { formatQty, silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { formatDateTime, formatMoney } from '../../format';
import { errorText, useLoad } from '../../useLoad';

/** Statuses in which the location (still) has to answer. */
const OPEN_STATUSES = ['SENT', 'MORE_INFORMATION_REQUIRED'];

const categoryLabel = (value: string | null | undefined): string =>
  SILA_JUSTIFICATION_CATEGORIES.find((category) => category.value === value)?.label ?? silaLabel(value);

/** Shortage enquiry: the location justifies the shortage, and answers again when more information is requested. */
const EnquiryScreen: React.FC = () => {
  const { enquiryId = '' } = useParams();
  const { data, loading, error, reload } = useLoad(() => getEnquiry(enquiryId), enquiryId || null);
  const [category, setCategory] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const moreInfo = data?.status === 'MORE_INFORMATION_REQUIRED';
  const chosen = category || (moreInfo ? data?.justificationCategory ?? '' : '');

  const send = async () => {
    if (!chosen || !text.trim()) {
      setNotice({ tone: 'error', text: 'Choose a category and explain what happened.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await respondEnquiry(enquiryId, chosen, text.trim());
      setText('');
      setNotice({ tone: 'success', text: 'Justification submitted. Inventory was not changed.' });
      reload();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'Justification was not submitted.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Justification" eyebrow="Shortage enquiry" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <section className="sm-section" aria-label="Material">
              <strong className="sm-title">{data.locationName ?? '—'}</strong>
              <strong className="sm-title">{data.materialName}</strong>
              <span className="sm-meta">
                Material {data.materialCode} · {data.enquiryNumber}
                {data.countNumber ? ` · count ${data.countNumber}` : ''}
              </span>
            </section>
            <Card aside={<StatusBadge status={data.status} />}>
              <strong className="sm-title">
                Shortage {formatQty(data.shortageQty)} {data.uom}
              </strong>
              <span className="sm-meta">{data.shortageValue !== null && data.shortageValue !== undefined ? formatMoney(data.shortageValue) : '—'}</span>
              <span className="sm-meta">Raised {formatDateTime(data.dateCreated)}</span>
            </Card>

            {moreInfo && (
              <p className="sm-notice sm-notice--warning">
                More information requested{data.reviewComment ? `: “${data.reviewComment}”` : '.'} Answer below.
              </p>
            )}

            {data.response && (
              <Card title="Previous response">
                <strong>{categoryLabel(data.justificationCategory)}</strong>
                <p className="sm-meta">{data.response}</p>
                {data.respondedOn && <p className="sm-meta">{formatDateTime(data.respondedOn)}</p>}
                {data.reviewComment && !moreInfo && <p className="sm-meta">Review: {data.reviewComment}</p>}
              </Card>
            )}

            <Notice notice={notice} />

            {OPEN_STATUSES.includes(data.status) && (
              <section className="sm-section" aria-labelledby="sm-respond">
                <h2 id="sm-respond">{moreInfo ? 'Your additional information' : 'Reason'}</h2>
                <div className="sm-tabs sm-tabs--wrap" role="radiogroup" aria-label="Reason category">
                  {SILA_JUSTIFICATION_CATEGORIES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={chosen === option.value}
                      aria-pressed={chosen === option.value}
                      className="sm-tab"
                      disabled={saving}
                      onClick={() => setCategory(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="sm-textarea"
                  aria-label="What happened?"
                  placeholder="What happened?"
                  maxLength={2000}
                  value={text}
                  disabled={saving}
                  onChange={(event) => setText(event.target.value)}
                />
                <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={saving || !text.trim()} onClick={send}>
                  {saving ? 'Submitting…' : 'Submit justification'}
                </button>
              </section>
            )}

            {data.events.length > 0 && (
              <section className="sm-section" aria-labelledby="sm-enquiry-events">
                <h2 id="sm-enquiry-events">History</h2>
                <ol className="sm-timeline">
                  {data.events.map((event, index) => (
                    <li key={`${event.dateCreated}-${index}`}>
                      <strong>{silaLabel(event.action)}</strong>
                      <p className="sm-meta">{formatDateTime(event.dateCreated)}</p>
                      {event.comment && <p className="sm-meta">{event.comment}</p>}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default EnquiryScreen;
