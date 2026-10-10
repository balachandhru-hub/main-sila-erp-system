import React from 'react';
import { useParams } from 'react-router-dom';
import { silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { getAdjustment } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import ScreenHeader from '../../components/ScreenHeader';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useLoad } from '../../useLoad';

const AdjustmentDetailScreen: React.FC = () => {
  const { adjustmentId = '' } = useParams();
  const { data, loading, error, reload } = useLoad(() => getAdjustment(adjustmentId), adjustmentId ? `adj-${adjustmentId}` : null);

  return (
    <>
      <ScreenHeader title={data?.adjustmentNumber ?? 'Adjustment'} eyebrow="Inventory" back />
      <div className="sm-screen">
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <p className="sm-meta">
              {silaLabel(data.adjustmentType)} · {data.locationName ?? '—'} · {formatDate(data.postedOn)}
            </p>
            {data.reason && <p>{data.reason}</p>}
            <ul className="sm-list">
              {data.items.map((item) => (
                <li key={item.id} className="sm-card">
                  <strong>{item.materialName}</strong>
                  <span className="sm-meta">
                    {item.materialCode} · {item.quantity} {item.uom}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
};

export default AdjustmentDetailScreen;
