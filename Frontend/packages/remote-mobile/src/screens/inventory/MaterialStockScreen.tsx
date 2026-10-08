import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatQty, getLiveInventoryDetail } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { useMyLocation } from '../../location';
import { formatMoney } from '../../format';
import { useLoad } from '../../useLoad';
import MaterialDecision from './MaterialDecision';
import NearbyStock from './NearbyStock';

/** Live inventory of one material: stock at my location, the recommendation for what I need, and stock nearby. */
const MaterialStockScreen: React.FC = () => {
  const { materialId = '' } = useParams();
  const { locations: myLocations, location: myLocation } = useMyLocation();
  const stockLocations = myLocations.filter((location) => location.locationType !== 'VENUE');
  const [chosenLocationId, setCurrentLocationId] = useState<string>('');
  const currentLocationId = chosenLocationId || myLocation?.id || '';
  const [requiredQty, setRequiredQty] = useState<string>('');
  const [appliedQty, setAppliedQty] = useState<number>(0);

  // The recommendation is asked again shortly after the quantity stops changing.
  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedQty(Math.max(Number(requiredQty) || 0, 0)), 500);
    return () => window.clearTimeout(timer);
  }, [requiredQty]);

  const { data, loading, error, reload } = useLoad(
    () => getLiveInventoryDetail(materialId, { requiredQty: appliedQty || undefined, currentLocationId: currentLocationId || undefined }),
    materialId ? `${materialId}-${currentLocationId}-${appliedQty}` : null,
  );

  const here = data?.locations.find((row) => row.locationId === (data.currentLocationId ?? currentLocationId));

  return (
    <>
      <ScreenHeader title={data?.materialCode ?? 'Material'} eyebrow="Live inventory" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <Card title={data.description}>
              <p className="sm-meta">
                {data.materialCode} · {data.baseUom}
                {data.unitCost !== null && data.unitCost !== undefined ? ` · ${formatMoney(data.unitCost, data.currency)} per ${data.baseUom}` : ''}
              </p>
              <div className="sm-chips">
                <span className="sm-badge">On hand {formatQty(here?.onHandQty ?? 0)}</span>
                <span className="sm-badge">Available {formatQty(data.localAvailable ?? here?.onHandQty ?? 0)}</span>
                <span className="sm-badge">Incoming {formatQty(here?.inTransitQty ?? 0)}</span>
              </div>
              <p className="sm-meta">
                {here ? `At ${here.locationName}. ` : ''}All my properties: on hand {formatQty(data.onHandQty)}, in transit {formatQty(data.inTransitQty)}.
              </p>
            </Card>

            <MaterialDecision
              detail={data}
              locations={stockLocations}
              currentLocationId={currentLocationId}
              requiredQty={requiredQty}
              onCurrentLocationChange={setCurrentLocationId}
              onRequiredQtyChange={setRequiredQty}
            />
            {loading && <p className="sm-muted" role="status">Updating…</p>}

            <NearbyStock detail={data} currentLocationId={data.currentLocationId ?? currentLocationId} myLocations={stockLocations} />
          </>
        )}
      </div>
    </>
  );
};

export default MaterialStockScreen;
