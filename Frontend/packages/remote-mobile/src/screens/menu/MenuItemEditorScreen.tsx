import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getMenuEngineering, saveMenuEngineering, type MenuItemDetail } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import ScreenHeader from '../../components/ScreenHeader';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';

const blank = (): Partial<MenuItemDetail> => ({
  name: '',
  description: '',
  category: '',
  mealPeriods: '',
  sellingPrice: undefined,
  currency: 'AED',
  defaultPortionQty: 1,
  portionUom: '',
  status: 'DRAFT',
});

const MenuItemEditorScreen: React.FC = () => {
  const { itemId = 'new' } = useParams();
  const go = useGo();
  const { can } = useAccess();
  const isNew = itemId === 'new';
  const existing = useLoad(
    () => getMenuEngineering('item', { menuItemId: itemId }),
    !isNew && can.viewMenuEngineering ? `menu-item-${itemId}` : null,
  );
  const [item, setItem] = useState<Partial<MenuItemDetail>>(blank());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing.data?.item) setItem(existing.data.item);
  }, [existing.data?.item]);

  const save = async () => {
    if (!item.name?.trim()) {
      window.alert('Enter the menu item name.');
      return;
    }
    setSaving(true);
    try {
      await saveMenuEngineering({ action: 'UPSERT_ITEM', item });
      go('menu/items');
    } catch (caught: unknown) {
      window.alert(errorText(caught, 'Could not save the menu item.'));
    } finally {
      setSaving(false);
    }
  };

  const set = (change: Partial<MenuItemDetail>) => setItem((current) => ({ ...current, ...change }));

  return (
    <>
      <ScreenHeader title={isNew ? 'Create menu item' : item.name || 'Menu item'} eyebrow="Menu Engineering" back backTo="menu/items" />
      <div className="sm-screen">
        <OfflineBanner />
        {existing.loading && <Loading />}
        {existing.error && <ErrorNotice message={existing.error} onRetry={existing.reload} />}
        {!can.manageMenuEngineering && <Empty text="You can view this menu item." description="Editing needs Menu Engineering manage permission." />}
        <p className="sm-meta">Recipe is optional. Selling price belongs to the menu item.</p>
        <label className="sm-field">Name<input className="sm-input" value={item.name ?? ''} onChange={(e) => set({ name: e.target.value })} disabled={!can.manageMenuEngineering} /></label>
        <label className="sm-field">Description<input className="sm-input" value={item.description ?? ''} onChange={(e) => set({ description: e.target.value })} disabled={!can.manageMenuEngineering} /></label>
        <label className="sm-field">Category<input className="sm-input" value={item.category ?? ''} onChange={(e) => set({ category: e.target.value })} disabled={!can.manageMenuEngineering} /></label>
        <label className="sm-field">Meal periods<input className="sm-input" value={item.mealPeriods ?? ''} onChange={(e) => set({ mealPeriods: e.target.value })} disabled={!can.manageMenuEngineering} /></label>
        <label className="sm-field">Selling price<input className="sm-input" type="number" value={item.sellingPrice ?? ''} onChange={(e) => set({ sellingPrice: Number(e.target.value) || undefined })} disabled={!can.manageMenuEngineering} /></label>
        <label className="sm-field">Portion qty<input className="sm-input" type="number" value={item.defaultPortionQty ?? 1} onChange={(e) => set({ defaultPortionQty: Number(e.target.value) || 1 })} disabled={!can.manageMenuEngineering} /></label>
        <label className="sm-field">Portion UOM<input className="sm-input" value={item.portionUom ?? ''} onChange={(e) => set({ portionUom: e.target.value })} disabled={!can.manageMenuEngineering} /></label>
        {item.costState && <p className="sm-meta">Cost: {item.costState}{item.recipeName ? ` · ${item.recipeName}` : ''}</p>}
        {can.manageMenuEngineering && (
          <button type="button" className="sm-btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save menu item'}</button>
        )}
      </div>
    </>
  );
};

export default MenuItemEditorScreen;
