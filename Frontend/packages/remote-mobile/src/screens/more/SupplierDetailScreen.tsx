import React from 'react';
import { useParams } from 'react-router-dom';
import { getSupplier } from '../../../../remote-buyer/src/api/silaMe/silaMasterDataApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { formatDateTime } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

/** A Supplier Master row; its open purchase orders are one tap away. */
const SupplierDetailScreen: React.FC = () => {
  const { supplierId = '' } = useParams();
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getSupplier(supplierId), supplierId || null);

  return (
    <>
      <ScreenHeader title={data?.name ?? 'Supplier'} eyebrow="Supplier" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <Card aside={<StatusBadge status={data.status} />}>
              <dl className="sm-kv">
                <dt>Supplier ID</dt>
                <dd>{data.supplierCode}</dd>
                <dt>TRN</dt>
                <dd>{data.taxNumber || '—'}</dd>
                <dt>Country</dt>
                <dd>{data.country || '—'}</dd>
                <dt>Also known as</dt>
                <dd>{data.aliases.length > 0 ? data.aliases.join(', ') : '—'}</dd>
                <dt>Updated</dt>
                <dd>{formatDateTime(data.updatedOn)}</dd>
              </dl>
            </Card>
            <button
              type="button"
              className="sm-btn sm-btn--block"
              onClick={() => go(`receive/pos?search=${encodeURIComponent(data.name)}`)}
            >
              Open purchase orders of this supplier
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default SupplierDetailScreen;
