import React, { useState } from 'react';
import { getMenuEngineering, saveMenuEngineering, type MenuItemDetail } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';

const MenuItemsScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('items', { search: query, limit: 40 }),
    can.viewMenuEngineering ? `menu-items-${query}` : null,
  );
  const items = data?.items?.items ?? [];
  const [recipeId, setRecipeId] = useState('');
  const [busy, setBusy] = useState('');

  const act = async (body: Record<string, unknown>) => {
    setBusy(String(body.action ?? 'save'));
    try {
      const result = await saveMenuEngineering(body);
      if (result.savedId && body.action === 'CREATE_RECIPE') go(`recipes/${result.savedId}`);
      else reload();
    } catch (caught: unknown) {
      window.alert(errorText(caught, 'Could not save the menu item.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <ScreenHeader title="Menu Items" eyebrow="Menu Engineering" back backTo="menu" />
      <div className="sm-screen">
        <OfflineBanner />
        <form
          className="sm-field"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <label htmlFor="sm-menu-search">Search</label>
          <input id="sm-menu-search" className="sm-input" value={search} placeholder="Name or code" onChange={(event) => setSearch(event.target.value)} />
        </form>
        {can.manageMenuEngineering && (
          <button type="button" className="sm-btn" onClick={() => go('menu/items/new')}>Create menu item</button>
        )}
        {loading && <Loading text="Loading menu items…" />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && items.length === 0 && <Empty text="No menu items." description="A menu item can exist without a recipe." />}
        <ul className="sm-list">
          {items.map((row: MenuItemDetail) => (
            <li key={row.id}>
              <button type="button" className="sm-list-btn" onClick={() => row.id && go(`menu/items/${row.id}`)}>
                <span className="sm-row">
                  <strong>{row.name}</strong>
                  <StatusBadge status={row.status || row.recipeLinkStatus || 'DRAFT'} />
                </span>
                <span className="sm-meta">
                  {row.menuItemCode} · {row.category || 'No category'} · {row.mealPeriods || 'Meal'}
                  {row.sellingPrice != null ? ` · ${row.sellingPrice} ${row.currency || ''}` : ''}
                  {` · ${row.defaultPortionQty} ${row.portionUom || ''}`}
                  {` · ${row.recipeLinkStatus || 'MENU_ITEM_ONLY'}`}
                </span>
              </button>
              {can.manageMenuEngineering && row.id && (
                <div className="sm-field">
                  <label htmlFor={`sm-link-${row.id}`}>Link existing recipe</label>
                  <select id={`sm-link-${row.id}`} className="sm-input" value={recipeId} onChange={(event) => setRecipeId(event.target.value)}>
                    <option value="">Select recipe</option>
                    {(data?.lookups?.recipes ?? []).map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                    ))}
                  </select>
                  <button type="button" className="sm-btn" disabled={!recipeId || busy !== ''} onClick={() => act({ action: 'LINK_RECIPE', menuItemId: row.id, recipeId })}>
                    Link recipe
                  </button>
                  {can.manageRecipe && (
                    <button type="button" className="sm-btn" disabled={busy !== ''} onClick={() => act({ action: 'CREATE_RECIPE', menuItemId: row.id })}>
                      Create recipe from menu item
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default MenuItemsScreen;
