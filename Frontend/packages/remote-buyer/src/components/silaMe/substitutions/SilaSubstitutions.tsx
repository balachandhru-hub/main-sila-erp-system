import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, Pagination, toastService } from "@vosox/shared-ui";
import {
  generateSubstitutions,
  getSubstitutions,
  type SilaSubstitutionListItem,
  type SilaSubstitutionStatus,
} from "../../../api/silaMe/silaSubstitutionApi";
import { formatDateTime } from "../../cart/lineFormat";
import SilaSubstitutionDetailView from "./SilaSubstitutionDetailView";
import { substitutionBadgeClass, substitutionLabel } from "./substitutionFormat";
import "./SilaSubstitutions.css";

interface SilaSubstitutionsProps {
  /** MANAGE_SILA_RECIPE: accept, dismiss and run the check now. */
  canDecide: boolean;
}

const PAGE_SIZE = 25;

const TABS: { key: SilaSubstitutionStatus | ""; label: string }[] = [
  { key: "PROPOSED", label: "Open" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "DISMISSED", label: "Dismissed" },
  { key: "", label: "All" },
];

/**
 * Recipe change suggestions raised by the system when an ingredient is short across the property. Opening one asks
 * "Yes / No"; yes leads to the review where suggestions are dragged onto the ingredients they replace.
 */
const SilaSubstitutions: React.FC<SilaSubstitutionsProps> = ({ canDecide }) => {
  const [tab, setTab] = useState<SilaSubstitutionStatus | "">("PROPOSED");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SilaSubstitutionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSubstitutions({ status: tab, index: page - 1, limit: PAGE_SIZE });
      setRows(result.items);
      setTotal(result.total);
    } catch (err: unknown) {
      setRows([]);
      setTotal(0);
      setError(err instanceof Error ? err.message : "Could not load the suggestions.");
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    load();
  }, [load]);

  const checkNow = async () => {
    setChecking(true);
    try {
      const result = await generateSubstitutions();
      toastService.success(
        result.created > 0
          ? `${result.created} new suggestion(s) from ${result.recipesChecked} recipe(s).`
          : `No new shortage found in ${result.recipesChecked} recipe(s).`,
      );
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "The check failed.");
    } finally {
      setChecking(false);
    }
  };

  if (openId) {
    return (
      <SilaSubstitutionDetailView
        proposalId={openId}
        canDecide={canDecide}
        onBack={() => setOpenId(null)}
        onChanged={load}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="ssub-page">
      <PageHeader
        className="pud-page-header"
        title="Recipe change suggestions"
        actions={
          canDecide ? (
            <button type="button" className="sila-btn sila-btn--secondary" onClick={checkNow} disabled={checking}>
              {checking ? "Checking..." : "Check stock now"}
            </button>
          ) : undefined
        }
      />

      <section className="sila-card">
        <div className="sila-tabs" role="tablist" aria-label="Suggestion lists">
          {TABS.map((item) => (
            <button
              key={item.label}
              type="button"
              role="tab"
              className="sila-tab"
              aria-selected={tab === item.key}
              onClick={() => {
                setTab(item.key);
                setPage(1);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loader size={24} message="Loading suggestions..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the suggestions"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No suggestions" description={tab === "PROPOSED" ? "Every recipe ingredient is in stock in its property." : undefined} />
        ) : (
          <>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Suggestion</th>
                    <th scope="col">Recipe</th>
                    <th scope="col">Short ingredient</th>
                    <th scope="col">Suggested</th>
                    <th scope="col">Outlet / property</th>
                    <th scope="col">Status</th>
                    <th scope="col">Raised</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="sila-cell-strong">{row.proposalNumber}</td>
                      <td>
                        {row.recipeCode}
                        <span className="ssub-sub">{row.recipeName}</span>
                      </td>
                      <td>
                        {row.ingredientName}
                        <span className="ssub-sub">{row.ingredientCode}</span>
                      </td>
                      <td>
                        {row.suggestedName}
                        <span className="ssub-sub">{row.suggestedCode}</span>
                      </td>
                      <td>
                        {row.locationName || "—"}
                        <span className="ssub-sub">{row.propertyName || "—"}</span>
                      </td>
                      <td>
                        <span className={substitutionBadgeClass(row.status)}>{substitutionLabel(row.status)}</span>
                        {row.createdVersion ? <span className="ssub-sub">Version {row.createdVersion}</span> : null}
                      </td>
                      <td>{formatDateTime(row.dateCreated)}</td>
                      <td>
                        <button
                          type="button"
                          className="sila-btn sila-btn--secondary sila-btn--sm"
                          aria-label={`Open ${row.proposalNumber}`}
                          onClick={() => setOpenId(row.id)}
                        >
                          {row.status === "PROPOSED" && canDecide ? "Review" : "Open"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="ssub-pager">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPrevious={() => setPage(Math.max(1, page - 1))}
                  onNext={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={loading}
                />
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default SilaSubstitutions;
