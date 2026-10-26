import React, { useState } from 'react';
import { getMenuEngineering, saveMenuEngineering } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { errorText, useLoad } from '../../useLoad';

const today = (): string => new Date().toISOString().slice(0, 10);

export const PosSalesScreen: React.FC = () => {
  const { can } = useAccess();
  const date = today();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('pos-sales', { dateFrom: date, dateTo: date }),
    can.viewMenuEngineering ? `menu-pos-${date}` : null,
  );
  const sales = data?.posSales;

  return (
    <>
      <ScreenHeader title="POS Sales" eyebrow="Menu Engineering" back backTo="menu" />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading text="Loading POS sales…" />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {sales && (
          <div className="sm-grid-2">
            <div className="sm-stat"><span className="sm-muted">Qty sold</span><strong>{sales.qtySold}</strong></div>
            <div className="sm-stat"><span className="sm-muted">Revenue</span><strong>{sales.revenue}</strong></div>
            <div className="sm-stat"><span className="sm-muted">Unmapped</span><strong>{sales.unmappedCount}</strong></div>
            <div className="sm-stat"><span className="sm-muted">Sync</span><strong>{sales.syncStatus || '—'}</strong></div>
          </div>
        )}
        <p className="sm-meta">Last sync {sales?.lastSync || '—'}</p>
        {(sales?.rows ?? []).length === 0 && !loading && <Empty text="No POS sales available for this period." />}
        <ul className="sm-list">
          {(sales?.rows ?? []).map((row) => (
            <li key={row.id} className="sm-list-btn">
              <span className="sm-row"><strong>{row.posCode}</strong><StatusBadge status={row.status} /></span>
              <span className="sm-meta">{row.quantity} · {row.menuItemName || 'Unmapped'} · {row.businessDate.slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export const PosMappingScreen: React.FC = () => {
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('pos-mappings', { limit: 80 }),
    can.viewMenuEngineering ? 'menu-mapping' : null,
  );
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');

  const map = async (id: string, posCode?: string | null) => {
    const menuItemId = choice[id];
    if (!menuItemId) {
      window.alert('Select a menu item. AI suggestions are not applied until you confirm.');
      return;
    }
    setBusy(id);
    try {
      await saveMenuEngineering({ action: 'UPSERT_MAPPING', mapping: { id, posCode, menuItemId } });
      reload();
    } catch (caught: unknown) {
      window.alert(errorText(caught, 'Could not save the POS mapping.'));
    } finally {
      setBusy('');
    }
  };

  const rows = data?.posMappings?.items ?? [];

  return (
    <>
      <ScreenHeader title="POS Mapping" eyebrow="Menu Engineering" back backTo="menu" intro="Unmapped POS items must be confirmed by a person." />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading text="Loading mappings…" />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {rows.length === 0 && !loading && <Empty text="No unmapped POS items." />}
        <ul className="sm-list">
          {rows.map((row) => (
            <li key={row.id} className="sm-list-btn">
              <span className="sm-row"><strong>{row.posCode}</strong><StatusBadge status={row.status} /></span>
              <span className="sm-meta">{row.posDescription || row.outletName || '—'}{row.suggestedMenuItemName ? ` · Suggested ${row.suggestedMenuItemName}` : ''}</span>
              {can.manageMenuEngineering && (
                <>
                  <label className="sm-field">
                    Menu item
                    <select className="sm-input" value={choice[row.id] ?? row.menuItemId ?? ''} onChange={(e) => setChoice({ ...choice, [row.id]: e.target.value })}>
                      <option value="">Select</option>
                      {(data?.items?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <button type="button" className="sm-btn" disabled={busy === row.id} onClick={() => map(row.id, row.posCode)}>
                    Confirm mapping
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};
