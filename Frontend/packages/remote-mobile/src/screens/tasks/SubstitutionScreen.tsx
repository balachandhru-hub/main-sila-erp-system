import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { dismissSubstitution, getSubstitution } from '../../../../remote-buyer/src/api/silaMe/silaSubstitutionApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { formatDateTime } from '../../format';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import SubstitutionReviewPanel from './SubstitutionReviewPanel';
import './substitution.css';

const MAX_REASON = 500;

/**
 * Recipe change suggestion raised by the system (never the bartender): "Yes / No", then review and submit — the changed
 * recipe goes through recipe approval.
 */
const SubstitutionScreen: React.FC = () => {
  const { proposalId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getSubstitution(proposalId), proposalId || null);
  const [stage, setStage] = useState<'ask' | 'review' | 'dismiss'>('ask');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const dismiss = async () => {
    if (!reason.trim()) {
      setNotice({ tone: 'error', text: 'Say why the suggestion is not used.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await dismissSubstitution(proposalId, reason);
      setStage('ask');
      setNotice({ tone: 'success', text: 'Suggestion dismissed.' });
      reload();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  };

  const proposal = data?.proposal;
  const open = proposal?.status === 'PROPOSED';
  const best = data?.suggestions.find((x) => x.replacesMaterialId === proposal?.ingredientMaterialId && x.isRecommended);

  return (
    <>
      <ScreenHeader title={proposal?.proposalNumber ?? 'Recipe change'} eyebrow="Tasks" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        <Notice notice={notice} />
        {data && proposal && stage === 'review' && open && (
          <SubstitutionReviewPanel
            detail={data}
            onCancel={() => setStage('ask')}
            onDone={(result) => {
              setStage('ask');
              setNotice({ tone: 'success', text: `Version ${result.version} of ${result.recipeCode} sent for approval.` });
              reload();
            }}
          />
        )}
        {data && proposal && stage !== 'review' && (
          <>
            <Card title={`${data.recipeCode} ${data.recipeName}`} aside={<StatusBadge status={proposal.status} />}>
              <p>
                <strong>
                  {open
                    ? `The system suggests replacing ${proposal.ingredientName} with ${best?.description ?? proposal.suggestedName}.`
                    : `${proposal.ingredientName}: ${proposal.status.toLowerCase()}${proposal.decidedOn ? ` on ${formatDateTime(proposal.decidedOn)}` : ''}.`}
                </strong>
              </p>
              <p className="sm-muted">{proposal.reason}</p>
              {proposal.createdVersion ? <p>Version {proposal.createdVersion} was sent for approval.</p> : null}
              <dl className="sm-kv">
                <dt>Outlet</dt>
                <dd>{proposal.locationName ?? '—'}</dd>
                <dt>Property</dt>
                <dd>{proposal.propertyName ?? '—'}</dd>
                {best && (
                  <>
                    <dt>New line</dt>
                    <dd>
                      {formatQty(best.quantity)} {best.uom} {best.description}
                    </dd>
                  </>
                )}
              </dl>
            </Card>

            {open && data.hasPendingVersion && (
              <p className="sm-notice sm-notice--warning" role="status">
                Version {data.latestVersion} of this recipe is already {data.recipeStatus === 'DRAFT' ? 'being edited' : 'waiting for approval'}. Review this
                suggestion after it is decided.
              </p>
            )}

            {open && stage === 'ask' && (
              <div className="sm-grid-2">
                <button type="button" className="sm-btn sm-btn--block" onClick={() => setStage('dismiss')}>
                  No
                </button>
                <button
                  type="button"
                  className="sm-btn sm-btn--primary sm-btn--block"
                  disabled={data.hasPendingVersion || data.suggestions.length === 0}
                  onClick={() => setStage('review')}
                >
                  Yes
                </button>
              </div>
            )}

            {open && stage === 'dismiss' && (
              <section className="sm-section" aria-labelledby="sm-sub-dismiss">
                <h2 id="sm-sub-dismiss">Keep the recipe as it is</h2>
                <div className="sm-field">
                  <label htmlFor="sm-sub-reason">Why is the suggestion not used?</label>
                  <textarea
                    id="sm-sub-reason"
                    className="sm-textarea"
                    maxLength={MAX_REASON}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </div>
                <button type="button" className="sm-btn sm-btn--danger sm-btn--block" disabled={saving} onClick={dismiss}>
                  {saving ? 'Dismissing…' : 'Dismiss suggestion'}
                </button>
                <button type="button" className="sm-btn sm-btn--block" disabled={saving} onClick={() => setStage('ask')}>
                  Back
                </button>
              </section>
            )}

            {!open && (
              <button type="button" className="sm-btn sm-btn--block" onClick={() => go('tasks')}>
                Back to tasks
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default SubstitutionScreen;
