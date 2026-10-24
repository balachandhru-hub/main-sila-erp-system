import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { searchLiveInventory } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { getMenuEngineering, saveMenuEngineering } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import { getRecipe } from '../../../../remote-buyer/src/api/silaMe/silaRecipeApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useMyLocation } from '../../location';
import { errorText, useLoad } from '../../useLoad';

/** One recipe and whether its ingredients are in stock at the working location. */
const RecipeDetailScreen: React.FC = () => {
  const { recipeId = '' } = useParams();
  const { can } = useAccess();
  const { location } = useMyLocation();
  const recipe = useLoad(() => getRecipe(recipeId), recipeId || null);
  const menuItems = useLoad(
    () => getMenuEngineering('items', { search: recipe.data?.name, limit: 30 }),
    can.viewMenuEngineering && recipe.data?.name ? `recipe-menu-${recipe.data.name}` : null,
  );
  const [menuItemId, setMenuItemId] = useState('');
  const [linking, setLinking] = useState(false);
  const linked = (menuItems.data?.items?.items ?? []).find((row) => row.linkedRecipeId === recipeId);
  const stock = useLoad(
    () => (location ? searchLiveInventory('', location.id) : Promise.resolve([])),
    location ? `recipe-stock-${location.id}` : null,
  );
  const onHand = new Map((stock.data ?? []).map((row) => [row.materialId.toLowerCase(), row.onHandQty]));

  return (
    <>
      <ScreenHeader title={recipe.data?.name ?? 'Recipe'} eyebrow={recipe.data?.recipeCode ?? 'Recipe'} back backTo="recipes" />
      <div className="sm-screen">
        {recipe.loading && !recipe.data && <Loading />}
        {recipe.error && <ErrorNotice message={recipe.error} onRetry={recipe.reload} />}
        {recipe.data && (
          <>
            <div className="sm-row">
              <span className="sm-meta">
                {recipe.data.servingQty} {recipe.data.servingUom}
                {recipe.data.menuPrice != null ? ` · menu ${recipe.data.menuPrice}` : ''}
                {recipe.data.totalCost ? ` · cost ${recipe.data.totalCost}` : ''}
              </span>
              <StatusBadge status={recipe.data.readinessStatus || recipe.data.status} />
            </div>
            {can.manageMenuEngineering && (
              <section className="sm-section">
                <h2>Link menu item</h2>
                {linked && <p className="sm-meta">Linked to {linked.name} ({linked.menuItemCode})</p>}
                <label className="sm-field">
                  Menu item
                  <select className="sm-input" value={menuItemId} onChange={(event) => setMenuItemId(event.target.value)}>
                    <option value="">Select</option>
                    {(menuItems.data?.items?.items ?? []).map((row) => (
                      <option key={row.id} value={row.id}>{row.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="sm-btn"
                  disabled={!menuItemId || linking}
                  onClick={async () => {
                    setLinking(true);
                    try {
                      await saveMenuEngineering({ action: 'LINK_RECIPE', menuItemId, recipeId });
                      menuItems.reload();
                    } catch (caught: unknown) {
                      window.alert(errorText(caught, 'Could not link the menu item.'));
                    } finally {
                      setLinking(false);
                    }
                  }}
                >
                  Link menu item
                </button>
              </section>
            )}
            <ul className="sm-list">
              {recipe.data.ingredients.map((ingredient) => {
                const qty = ingredient.materialId ? onHand.get(ingredient.materialId.toLowerCase()) : undefined;
                const short = ingredient.materialId != null && (qty ?? 0) <= 0;
                return (
                  <li key={ingredient.id} className="sm-list-btn">
                    <span className="sm-row">
                      <strong>{ingredient.itemName}</strong>
                      <span className="sm-meta">{ingredient.quantity} {ingredient.uom}</span>
                    </span>
                    <span className="sm-meta">
                      {ingredient.itemCode}
                      {ingredient.materialId == null
                        ? ''
                        : qty === undefined
                          ? ' · not at this location'
                          : ` · ${qty} on hand${short ? ' · short' : ''}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
};

export default RecipeDetailScreen;
