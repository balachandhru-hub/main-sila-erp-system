import React, { useState } from 'react';
import { getRecipes, type SilaRecipeListItem } from '../../../../remote-buyer/src/api/silaMe/silaRecipeApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

/** Recipe list. Suggestions from stock are on the home screen. */
const RecipesScreen: React.FC = () => {
  const go = useGo();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const { data, loading, error, reload } = useLoad(() => getRecipes({ search: query, limit: 30 }), `recipes-${query}`);
  const items: SilaRecipeListItem[] = data?.items ?? [];

  return (
    <>
      <ScreenHeader title="Recipes" eyebrow="Recipe Management" back backTo="home" />
      <div className="sm-screen">
        <form
          className="sm-field"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery(search.trim());
          }}
        >
          <label htmlFor="sm-recipe-search">Search</label>
          <input
            id="sm-recipe-search"
            className="sm-input"
            value={search}
            placeholder="Code or name"
            onChange={(event) => setSearch(event.target.value)}
          />
        </form>
        {loading && <Loading text="Loading recipes…" />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && items.length === 0 && <Empty text="No recipes" description="Nothing matches this search." />}
        <ul className="sm-list">
          {items.map((recipe) => (
            <li key={recipe.id}>
              <button type="button" className="sm-list-btn" onClick={() => go(`recipes/${recipe.id}`)}>
                <span className="sm-row">
                  <strong>{recipe.name}</strong>
                  <StatusBadge status={recipe.readinessStatus || recipe.status} />
                </span>
                <span className="sm-meta">
                  {recipe.recipeCode}
                  {recipe.menuPrice != null ? ` · menu ${recipe.menuPrice}` : ''}
                  {recipe.marginAmount != null ? ` · margin ${recipe.marginAmount}` : ''}
                  {` · ${recipe.ingredientCount} ingredients`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default RecipesScreen;
