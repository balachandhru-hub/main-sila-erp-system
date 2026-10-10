import React from 'react';
import { useParams } from 'react-router-dom';
import { getGoodsIssue } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import ScreenHeader from '../../components/ScreenHeader';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate } from '../../format';
import { useLoad } from '../../useLoad';

const GoodsIssueDetailScreen: React.FC = () => {
  const { goodsIssueId = '' } = useParams();
  const { data, loading, error, reload } = useLoad(() => getGoodsIssue(goodsIssueId), goodsIssueId ? `gi-${goodsIssueId}` : null);

  return (
    <>
      <ScreenHeader title={data?.issueNumber ?? 'Goods issue'} eyebrow="Inventory" back />
      <div className="sm-screen">
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <p className="sm-meta">
              {data.fromLocationName ?? '—'} → {data.toLocationName ?? '—'} · {formatDate(data.issuedOn)}
              {data.bucketCode ? ` · bucket ${data.bucketCode}` : ''}
            </p>
            {data.comment && <p>{data.comment}</p>}
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

export default GoodsIssueDetailScreen;
