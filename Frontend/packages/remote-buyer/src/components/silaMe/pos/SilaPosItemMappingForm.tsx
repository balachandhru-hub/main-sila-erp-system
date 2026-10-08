import React, { useEffect, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  saveItemMapping,
  searchPosRecipes,
  type SilaPosItemMapping,
  type SilaPosRecipeOption,
} from "../../../api/silaMe/silaPosMasterApi";
import { errorText, posLabel } from "./posFormat";

interface SilaPosItemMappingFormProps {
  sourceId: string;
  /** null creates a new mapping. */
  mapping: SilaPosItemMapping | null;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit dialog of a POS item → recipe mapping, with a recipe search. */
const SilaPosItemMappingForm: React.FC<SilaPosItemMappingFormProps> = ({ sourceId, mapping, onClose, onSaved }) => {
  const [code, setCode] = useState(mapping?.posItemCode ?? "");
  const [description, setDescription] = useState(mapping?.posItemDescription ?? "");
  const [recipe, setRecipe] = useState<SilaPosRecipeOption | null>(
    mapping ? { id: mapping.recipeId, recipeCode: mapping.recipeCode ?? "", name: mapping.recipeName ?? "", status: mapping.recipeStatus ?? "" } : null,
  );
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<SilaPosRecipeOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      searchPosRecipes(search)
        .then((rows) => {
          if (active) setOptions(rows);
        })
        .catch((err: unknown) => {
          if (active) setSearchError(errorText(err, "Could not load the recipes."));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const handleSave = async () => {
    if (!code.trim()) {
      toastService.error("Enter the POS item code.");
      return;
    }
    if (!recipe) {
      toastService.error("Select the recipe.");
      return;
    }
    setSaving(true);
    try {
      await saveItemMapping(sourceId, mapping?.id ?? null, {
        posItemCode: code.trim(),
        posItemDescription: description.trim() || null,
        recipeId: recipe.id,
      });
      toastService.success(mapping ? "Item mapping updated." : "Item mapping created.");
      onSaved();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not save the item mapping."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      headerProps={{ heading: mapping ? "Edit item mapping" : "New item mapping" }}
      footerProps={{
        secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: saving },
        primaryButton: { text: mapping ? "Save" : "Create", onClick: handleSave, loading: saving },
      }}
    >
      <form
        className="sila-root sila-me srec-stack"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="spos-im-code">POS item code<span className="sila-required">*</span></label>
            <input id="spos-im-code" className="sila-input" maxLength={100} value={code} onChange={(event) => setCode(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="spos-im-description">POS item description</label>
            <input
              id="spos-im-description"
              className="sila-input"
              maxLength={200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <div className="sila-field">
          <span className="sila-label">Recipe<span className="sila-required">*</span></span>
          <span className="sila-cell-strong">{recipe ? `${recipe.recipeCode} ${recipe.name}` : "No recipe selected"}</span>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="spos-im-search">Find a recipe</label>
          <input
            id="spos-im-search"
            className="sila-input"
            type="search"
            placeholder="Recipe code, name or POS code"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {searchError && <span className="sila-error-text">{searchError}</span>}
        </div>
        <div className="sila-table-wrap srec-search-results">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Recipe</th>
                <th scope="col">POS code</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sila-visually-hidden">Select</span></th>
              </tr>
            </thead>
            <tbody>
              {options.length === 0 ? (
                <tr>
                  <td colSpan={4} className="sila-cell-muted">{searching ? "Searching..." : "No recipes found."}</td>
                </tr>
              ) : (
                options.map((option) => (
                  <tr key={option.id}>
                    <td>
                      <span className="sila-cell-strong">{option.recipeCode}</span>
                      <span className="srec-sub">{option.name}</span>
                    </td>
                    <td>{option.posCode || "—"}</td>
                    <td>{posLabel(option.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        aria-label={`Select recipe ${option.recipeCode}`}
                        disabled={recipe?.id === option.id}
                        onClick={() => setRecipe(option)}
                      >
                        {recipe?.id === option.id ? "Selected" : "Select"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </form>
    </Modal>
  );
};

export default SilaPosItemMappingForm;
