import React from "react";
import { EmptyState, Loader, Pagination } from "@vosox/shared-ui";
import type { PagedList } from "./usePagedList";

interface PagedListBodyProps<T> {
  list: PagedList<T>;
  /** e.g. "goods receipts" */
  noun: string;
  emptyTitle: string;
  /** Optional line under the empty-state title. */
  emptyDescription?: string;
  children: React.ReactNode;
}

/** Loading, error and empty states of a paged list, else the table and the pager. */
const PagedListBody = <T,>({ list, noun, emptyTitle, emptyDescription, children }: PagedListBodyProps<T>): React.ReactElement => {
  if (list.loading) return <Loader size={24} message={`Loading ${noun}...`} />;
  if (list.error) {
    return (
      <EmptyState
        variant="error"
        title={`Couldn't load the ${noun}`}
        description={list.error}
        action={<button type="button" className="sila-btn sila-btn--secondary" onClick={list.reload}>Try again</button>}
      />
    );
  }
  if (list.rows.length === 0 && list.page === 1) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <>
      {children}
      <Pagination
        page={list.page}
        hasNext={list.hasNext}
        onPrevious={() => list.setPage(Math.max(1, list.page - 1))}
        onNext={() => list.setPage(list.page + 1)}
        disabled={list.loading}
      />
    </>
  );
};

export default PagedListBody;
