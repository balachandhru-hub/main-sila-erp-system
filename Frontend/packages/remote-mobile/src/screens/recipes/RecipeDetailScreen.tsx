import React from 'react';
import { useParams } from 'react-router-dom';
import { searchLiveInventory } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { getRecipe } from '../../../../remote-buyer/src/api/silaMe/silaRecipeApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { useMyLocation } from '../../location';
import { useLoad } from '../../useLoad';

/** One recipe and whether its ingredients are in stock at the working location. */
const RecipeDetailScreen: React.FC = () => {
  const { recipeId = '' } = useParams();
  const { location } = useMyLocation();
  const recipe = useLoad(() => getRecipe(recipeId), recipeId || null);
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
