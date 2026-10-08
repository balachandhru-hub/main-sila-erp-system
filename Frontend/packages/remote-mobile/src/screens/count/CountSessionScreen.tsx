import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getStockCount, type SilaStockCountItem } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import MaterialPicker, { materialUoms } from '../../components/MaterialPicker';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import BarcodeEntry from './BarcodeEntry';
import CountCounters from './CountCounters';
import CountLineForm, { type CountTarget } from './CountLineForm';
import CountSheet from './CountSheet';
import CountSubmit from './CountSubmit';

const toTarget = (item: SilaStockCountItem, method: CountTarget['method']): CountTarget => ({
  itemId: item.id,
  materialId: item.materialId,
  materialCode: item.materialCode,
  materialName: item.materialName,
  uoms: item.uoms,
  countedQty: item.countedQty,
  systemQty: item.systemQty,
  method,
  photoCount: (item.photos ?? []).length,
  recountRequested: item.recountRequested,
  reviewComment: item.reviewComment,
});

const CountSessionScreen: React.FC = () => {
  const { stockCountId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getStockCount(stockCountId), stockCountId || null);
  const [target, setTarget] = useState<CountTarget | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const editable = data?.status === 'IN_PROGRESS';
  // A submitted count sent back for recount (same rule as the backend): only lines marked for recount are counted.
  const reopened = editable && Boolean(data?.submittedOn);
  const recountLeft = (data?.items ?? []).filter((item) => item.recountRequested).length;
  const blind = Boolean(data?.blindCount && !data?.canSeeSystemQty);

  const openTarget = (next: CountTarget) => {
    if (reopened && !next.recountRequested) {
      setNotice({ tone: 'warning', text: `${next.materialName} is not marked for recount. Count only the lines marked Recount requested.` });
      return;
    }
    setNotice(null);
    setTarget(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <ScreenHeader title={data?.locationName ?? 'Stock count'} eyebrow={data?.countNumber ?? 'Stock count'} back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <div className="sm-row">
              <span className="sm-meta">
                {silaLabel(data.countType)} count · {data.totalItems} materials
                {data.blindCount ? ' · blind count' : ''}
              </span>
              <StatusBadge status={reopened ? 'RECOUNT_REQUESTED' : data.status} label={reopened ? 'Recount' : undefined} />
            </div>
            {reopened && (
              <p className="sm-notice sm-notice--warning">
                Recount requested: {recountLeft} line{recountLeft === 1 ? '' : 's'} to count again. The other lines stay as counted.
              </p>
            )}
            <CountCounters count={data} />
            <Notice notice={notice} />

            {editable && target && (
              <CountLineForm
                key={`${target.itemId ?? target.materialId}`}
                stockCountId={data.id}
                target={target}
                blind={blind}
                location={data.locationName ?? '—'}
                onPhotoAdded={reload}
                onClose={() => setTarget(null)}
                onSaved={(result) => {
                  setTarget(null);
                  setNotice({ tone: 'success', text: result.message || 'Saved. Inventory was not changed.' });
                  reload();
                }}
              />
            )}

            {editable && !target && (
              <>
                <BarcodeEntry
                  stockCountId={data.id}
                  onFound={(found) =>
                    found.item
                      ? openTarget(toTarget(found.item, 'BARCODE'))
                      : reopened
                        ? setNotice({ tone: 'warning', text: `${found.materialName} is not on this count; during a recount only marked lines are counted.` })
                        : openTarget({
                            itemId: null,
                            materialId: found.materialId,
                            materialCode: found.materialCode,
                            materialName: found.materialName,
                            uoms: [found.baseUom],
                            method: 'BARCODE',
                          })
                  }
                />
                {!reopened && (
                  <MaterialPicker
                    label="Search material"
                    onPick={(material) => {
                      const onSheet = data.items.find((item) => item.materialId === material.id);
                      openTarget(
                        onSheet
                          ? toTarget(onSheet, 'SEARCH')
                          : {
                              itemId: null,
                              materialId: material.id,
                              materialCode: material.materialCode,
                              materialName: material.description,
                              uoms: materialUoms(material),
                              method: 'SEARCH',
                            },
                      );
                    }}
                  />
                )}
              </>
            )}

            <CountSheet items={data.items} editable={editable} reopened={reopened} onOpen={(item) => openTarget(toTarget(item, 'MANUAL'))} />

            {editable && <CountSubmit count={data} onSubmitted={reload} />}
            <button type="button" className="sm-btn sm-btn--block" onClick={() => go('tasks')}>
              Shortage tasks
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default CountSessionScreen;
