import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, Pagination, toastService } from "@vosox/shared-ui";
import { getLocations, searchMaterials, type SilaLocation, type SilaMaterial } from "../../../api/silaMe/silaInventoryApi";
import {
  getPosTransactions,
  reprocessPosTransaction,
  type SilaPosTransaction,
  type SilaPosTransactionPage,
} from "../../../api/silaMe/silaPosApi";
import SilaPosTransactionDetail from "./SilaPosTransactionDetail";
import SilaTransactionRow from "./SilaTransactionRow";
import { POS_POSTING_STATUSES, POS_STATUSES, posLabel } from "./posFormat";
import "../silaMeTheme.css";
import "../recipes/SilaRecipes.css";

const PAGE_SIZE = 25;

/** POS sales with their processing steps, failure messages and reprocess; a sale opens its detail. */
const SilaTransactionTracker: React.FC = () => {
  const [status, setStatus] = useState("");
  const [postingStatus, setPostingStatus] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialOptions, setMaterialOptions] = useState<SilaMaterial[]>([]);
  const [materialId, setMaterialId] = useState("");
  const [materialLabel, setMaterialLabel] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [businessDate, setBusinessDate] = useState("");
  const [outletLocationId, setOutletLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SilaPosTransactionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<SilaLocation[]>([]);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await getPosTransactions({
          status,
          postingStatus,
          materialId,
          businessDate,
          outletLocationId,
          search: appliedSearch,
          index: (page - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        }),
      );
    } catch (err: unknown) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load the POS transactions.");
    } finally {
      setLoading(false);
    }
  }, [status, postingStatus, materialId, businessDate, outletLocationId, appliedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Outlets for the filter; the tracker still works without them.
  useEffect(() => {
    let active = true;
    getLocations()
      .then((locations) => {
        if (active) setOutlets(locations.filter((location) => location.locationType === "OUTLET"));
      })
      .catch((err: unknown) => {
        if (active) toastService.error(err instanceof Error ? err.message : "Could not load the outlets.");
      });
    return () => {
      active = false;
    };
  }, []);

  // Materials for the material filter, searched as the user types.
  useEffect(() => {
    if (!materialSearch.trim()) {
      setMaterialOptions([]);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      searchMaterials(materialSearch)
        .then((materials) => {
          if (active) setMaterialOptions(materials.slice(0, 50));
        })
        .catch((err: unknown) => {
          if (active) toastService.error(err instanceof Error ? err.message : "Could not load the materials.");
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [materialSearch]);

  const handleReprocess = async (transaction: SilaPosTransaction) => {
    setReprocessingId(transaction.id);
    try {
      await reprocessPosTransaction(transaction.id);
      toastService.success(
        transaction.failedStep === "POST"
          ? "The SAP posting is queued again."
          : `Transaction ${transaction.sourceTransactionId} reprocessed.`,
      );
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reprocess the transaction.");
    } finally {
      setReprocessingId(null);
    }
  };

  const changeFilter = (apply: () => void) => {
    apply();
    setPage(1);
  };

  if (openId) {
    return (
      <SilaPosTransactionDetail
        transactionId={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  const rows = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title="Transaction tracker"
        description="Step 1 updates SILA inventory from the sales file or POS API. Step 2 posts the consumption to the ERP (SAP). Reprocess only failed rows; open a transaction for its timeline and ERP posting."
      />
      <section className="sila-card">
        <div className="srec-filters">
          <div className="sila-field srec-grow">
            <label className="sila-label" htmlFor="strk-search">Search</label>
            <input
              id="strk-search"
              className="sila-input"
              type="search"
              placeholder="POS code or transaction id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="strk-date">Business date</label>
            <input id="strk-date" className="sila-input" type="date" value={businessDate} onChange={(e) => changeFilter(() => setBusinessDate(e.target.value))} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="strk-outlet">Outlet</label>
            <select id="strk-outlet" className="sila-select" value={outletLocationId} onChange={(e) => changeFilter(() => setOutletLocationId(e.target.value))}>
              <option value="">All outlets</option>
              {outlets.map((outlet) => (
                <option key={outlet.id} value={outlet.id}>{outlet.locationName} ({outlet.locationCode})</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="strk-status">Status</label>
            <select id="strk-status" className="sila-select" value={status} onChange={(e) => changeFilter(() => setStatus(e.target.value))}>
              <option value="">All</option>
              {POS_STATUSES.map((code) => (
                <option key={code} value={code}>{posLabel(code)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="strk-posting">SAP posting</label>
            <select id="strk-posting" className="sila-select" value={postingStatus} onChange={(e) => changeFilter(() => setPostingStatus(e.target.value))}>
              <option value="">All</option>
              {POS_POSTING_STATUSES.map((code) => (
                <option key={code} value={code}>{posLabel(code)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="strk-material-search">Material</label>
            <input
              id="strk-material-search"
              className="sila-input"
              type="search"
              placeholder="Find a material"
              value={materialSearch}
              onChange={(e) => setMaterialSearch(e.target.value)}
            />
            <select
              id="strk-material"
              aria-label="Material filter"
              className="sila-select"
              value={materialId}
              onChange={(e) => {
                const label = e.target.selectedOptions[0]?.text ?? "";
                changeFilter(() => {
                  setMaterialId(e.target.value);
                  setMaterialLabel(e.target.value ? label : "");
                });
              }}
            >
              <option value="">All materials</option>
              {materialId && !materialOptions.some((material) => material.id === materialId) && (
                <option value={materialId}>{materialLabel}</option>
              )}
              {materialOptions.map((material) => (
                <option key={material.id} value={material.id}>{material.materialCode} {material.description}</option>
              ))}
            </select>
          </div>
        </div>

        {loading && !data ? (
          <Loader size={24} message="Loading transactions..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load transactions"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title={status || postingStatus || materialId || businessDate || outletLocationId || appliedSearch ? "No POS transactions match" : "No POS consumption yet"} />
        ) : (
          <>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">POS txn / line</th>
                    <th scope="col">Location</th>
                    <th scope="col">POS code / recipe</th>
                    <th scope="col" className="srec-num">Qty</th>
                    <th scope="col">Step 1 · SILA inventory</th>
                    <th scope="col">Step 2 · ERP</th>
                    <th scope="col">Status</th>
                    <th scope="col">Message</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((transaction) => (
                    <SilaTransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      reprocessing={reprocessingId === transaction.id}
                      disabled={reprocessingId !== null}
                      onReprocess={handleReprocess}
                      onOpen={(transaction) => setOpenId(transaction.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
              summary={`${data?.total ?? 0} transaction${data?.total === 1 ? "" : "s"}`}
              disabled={loading}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default SilaTransactionTracker;
