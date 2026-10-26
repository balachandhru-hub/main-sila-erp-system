import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { CLOUD_LATER, formatMoney, formatWhen, labelOf } from '../format';
import { loadAnalytics, loadRfqDetail, loadRfqs, loadSupplierContext, PAGE_SIZE, type SupplierRfqRow } from '../live';
import { BusinessCard, ChipRow, EmptyState, ErrorNote, Loading, PageHeader, Pager, SearchField, StatusBadge, toneOfStatus } from '../ui';

const RFQ_VIEWS = [
  { id: 'open', label: 'Open' },
  { id: 'closing', label: 'Closing soon' },
  { id: 'submitted', label: 'Submitted' },
  { id: 'awarded', label: 'Awarded' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'all', label: 'All' },
];

const statusFor = (view: string): string | undefined => {
  if (view === 'open') return 'LIVE';
  if (view === 'awarded') return 'AWARDED';
  if (view === 'frozen') return 'Freezing';
  return undefined;
};

export const SalesHub: React.FC = () => {
  const go = useGo();
  return (
    <>
      <PageHeader eyebrow="Sales" title="Sales" intro="RFQ and e-auction use the existing Cloud sourcing services." />
      <div className="sp-screen">
        <button type="button" className="sp-action" onClick={() => go('supplier/sales/rfq')}>
          <strong>RFQ</strong>
          <span>Live</span>
        </button>
        <button type="button" className="sp-action" onClick={() => go('supplier/sales/auction')}>
          <strong>E-Auction</strong>
          <span>Live</span>
        </button>
      </div>
    </>
  );
};

const useDebounced = (value: string): string => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
};

export const RfqListScreen: React.FC = () => {
  const go = useGo();
  const [params] = useSearchParams();
  const initial = params.get('view') || 'open';
  const [view, setView] = useState(RFQ_VIEWS.some((item) => item.id === initial) ? initial : 'open');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const query = useDebounced(search);
  const context = useLoad(loadSupplierContext, 'rfq-context');
  const analytics = useLoad(loadAnalytics, view === 'closing' || view === 'submitted' ? `rfq-analytics-${view}` : null);
  const paged = view !== 'closing' && view !== 'submitted';
  const list = useLoad(
    () => loadRfqs({
      supplierId: context.data!.supplierId,
      index: page * PAGE_SIZE,
      limit: PAGE_SIZE,
      status: statusFor(view),
      search: query,
    }),
    context.data && paged ? `rfq-${context.data.supplierId}-${view}-${query}-${page}` : null,
  );

  useEffect(() => {
    setPage(0);
  }, [view, query]);

  const schedule = (analytics.data?.upcomingDeadlines ?? []).filter((item) => (view === 'submitted' ? item.quotationSubmitted : true));

  return (
    <>
      <PageHeader eyebrow="Sales" title="RFQ" intro="Invitations from the Cloud RFQ service." back={() => go('supplier/sales')} />
      <div className="sp-screen">
        <SearchField value={search} onChange={setSearch} placeholder="RFQ number or title" />
        <ChipRow options={RFQ_VIEWS} value={view} onChange={setView} />
        {context.error && <ErrorNote message={context.error} onRetry={context.reload} />}
        {(list.loading || analytics.loading || context.loading) && <Loading />}
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {analytics.error && <ErrorNote message={analytics.error} onRetry={analytics.reload} />}
        {paged && list.data && list.data.length === 0 && <EmptyState title="No RFQs" text="Nothing matched this view." />}
        {paged && list.data?.map((row) => (
          <RfqCard key={row.rfqId || row.number} row={row} onOpen={() => go(`supplier/sales/rfq/${row.rfqId}`)} />
        ))}
        {paged && list.data && <Pager page={page} hasNext={list.data.length === PAGE_SIZE} onPage={setPage} />}
        {!paged && analytics.data && schedule.length === 0 && (
          <EmptyState title="No data" text="The Cloud closing schedule has no RFQ in this view." />
        )}
        {!paged && schedule.map((item) => (
          <BusinessCard
            key={item.buyerRfqId}
            title={item.rfqNumber || item.title}
            meta={item.title}
            status={item.quotationSubmitted ? 'Submitted' : 'Open'}
            lines={[
              { label: 'Customer', value: item.buyerName },
              { label: 'Closing', value: formatWhen(item.endDate) },
            ]}
            onOpen={() => go(`supplier/sales/rfq/${item.buyerRfqId}`)}
          />
        ))}
        <p className="sp-note">New, closed and not-awarded are counts on the Cloud dashboard. The RFQ list itself can be filtered by open, awarded and frozen.</p>
      </div>
    </>
  );
};

const RfqCard: React.FC<{ row: SupplierRfqRow; onOpen: () => void }> = ({ row, onOpen }) => (
  <BusinessCard
    title={row.number || row.title}
    meta={row.title}
    status={row.queriedStatus || undefined}
    lines={[
      { label: 'Customer', value: row.customer },
      { label: 'Closing', value: formatWhen(row.endDate) },
      { label: 'Location', value: row.location },
    ]}
    onOpen={onOpen}
  />
);

export const RfqDetailScreen: React.FC = () => {
  const { rfqId = '' } = useParams();
  const go = useGo();
  const detail = useLoad(() => loadRfqDetail(rfqId), rfqId ? `rfq-detail-${rfqId}` : null);
  const data = detail.data;
  const quote = data?.supplierQuotation?.[0];
  return (
    <>
      <PageHeader eyebrow="RFQ" title={data?.title || 'RFQ'} back={() => go('supplier/sales/rfq')} />
      <div className="sp-screen">
        {detail.loading && <Loading />}
        {detail.error && <ErrorNote message={detail.error} onRetry={detail.reload} />}
        {data && (
          <>
            <div className="sp-row">
              <StatusBadge value={labelOf(data.status)} tone={toneOfStatus(data.status)} />
              <StatusBadge value={quote ? labelOf(quote.status) : 'No response'} tone={quote ? 'info' : 'muted'} />
            </div>
            <dl className="sp-facts">
              <div><dt>Customer</dt><dd>{data.buyerName || '—'}</dd></div>
              <div><dt>Issue</dt><dd>{formatWhen(data.startDate)}</dd></div>
              <div><dt>Closing</dt><dd>{formatWhen(data.endDate)}</dd></div>
              <div><dt>Location</dt><dd>{data.deliveryLocation || '—'}</dd></div>
              <div><dt>Response</dt><dd>{quote ? labelOf(quote.status) : 'Not submitted'}</dd></div>
              <div><dt>Quoted total</dt><dd>{quote ? formatMoney(quote.totalPrice) : '—'}</dd></div>
            </dl>
            <p>{data.description}</p>
            <h2 className="sp-eyebrow">Items</h2>
            {(data.items || []).length === 0 && <EmptyState title="No items" text="This RFQ did not return line items." />}
            {(data.items || []).map((item, index) => (
              <article key={item.id || item.buyerRFQItemId || String(index)} className="sp-card">
                <h2>{item.description || item.materialCode || `Item ${index + 1}`}</h2>
                <p className="sp-meta">{item.quantity} {item.uom} · {item.materialCode}</p>
              </article>
            ))}
            <p className="sp-note">{CLOUD_LATER} Quotation submit, edit and award rules stay in the Cloud RFQ workspace so this screen does not create a second bidding engine.</p>
            <a className="sp-btn" href="/rfqs">Open the Cloud RFQ workspace</a>
          </>
        )}
      </div>
    </>
  );
};

const AUCTION_VIEWS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'live', label: 'Live' },
  { id: 'completed', label: 'Completed' },
];

export const AuctionListScreen: React.FC = () => {
  const go = useGo();
  const [view, setView] = useState('live');
  const [page, setPage] = useState(0);
  const context = useLoad(loadSupplierContext, 'auction-context');
  const analytics = useLoad(loadAnalytics, view === 'upcoming' ? 'auction-upcoming' : null);
  const list = useLoad(
    () => loadRfqs({
      supplierId: context.data!.supplierId,
      index: page * PAGE_SIZE,
      status: view === 'completed' ? 'AWARDED' : 'LIVE',
      limit: PAGE_SIZE,
    }),
    context.data && view !== 'upcoming' ? `auction-${context.data.supplierId}-${view}-${page}` : null,
  );
  useEffect(() => setPage(0), [view]);
  const upcoming = analytics.data?.upcomingDeadlines ?? [];
  return (
    <>
      <PageHeader eyebrow="Sales" title="E-Auction" intro="Live and awarded events from the Cloud RFQ service." back={() => go('supplier/sales')} />
      <div className="sp-screen">
        <ChipRow options={AUCTION_VIEWS} value={view} onChange={setView} />
        {(list.loading || analytics.loading) && <Loading />}
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {analytics.error && <ErrorNote message={analytics.error} onRetry={analytics.reload} />}
        {view !== 'upcoming' && list.data && list.data.length === 0 && <EmptyState title="No auctions" text="Nothing is in this Cloud status." />}
        {view !== 'upcoming' && list.data?.map((row) => (
          <BusinessCard
            key={row.rfqId}
            title={row.number || row.title}
            meta={row.title}
            status={view === 'live' ? 'LIVE' : 'AWARDED'}
            lines={[
              { label: 'Customer', value: row.customer },
              { label: 'Ends', value: formatWhen(row.endDate) },
            ]}
            onOpen={() => go(`supplier/sales/auction/${row.rfqId}`)}
          />
        ))}
        {view !== 'upcoming' && list.data && <Pager page={page} hasNext={list.data.length === PAGE_SIZE} onPage={setPage} />}
        {view === 'upcoming' && upcoming.length === 0 && analytics.data && <EmptyState title="No upcoming events" text="The Cloud closing schedule is empty." />}
        {view === 'upcoming' && upcoming.map((item) => (
          <BusinessCard
            key={item.buyerRfqId}
            title={item.rfqNumber || item.title}
            meta={item.title}
            status={item.quotationSubmitted ? 'Submitted' : 'Scheduled'}
            lines={[
              { label: 'Customer', value: item.buyerName },
              { label: 'Closes', value: formatWhen(item.endDate) },
            ]}
            onOpen={() => go(`supplier/sales/auction/${item.buyerRfqId}`)}
          />
        ))}
        <p className="sp-note">Current position is shown on the event. Placing a bid stays in the Cloud auction, which already applies rank, lot and OTP rules.</p>
      </div>
    </>
  );
};

export const AuctionDetailScreen: React.FC = () => {
  const { rfqId = '' } = useParams();
  const go = useGo();
  const detail = useLoad(() => loadRfqDetail(rfqId), rfqId ? `auction-${rfqId}` : null);
  const data = detail.data;
  const quote = data?.supplierQuotation?.[0];
  const rank = useMemo(() => {
    const value = quote?.rank;
    return value == null || value === '' ? '—' : String(value);
  }, [quote]);
  return (
    <>
      <PageHeader eyebrow="E-Auction" title={data?.title || 'Auction'} back={() => go('supplier/sales/auction')} />
      <div className="sp-screen">
        {detail.loading && <Loading />}
        {detail.error && <ErrorNote message={detail.error} onRetry={detail.reload} />}
        {data && (
          <>
            <div className="sp-row">
              <StatusBadge value={labelOf(data.status)} tone={toneOfStatus(data.status)} />
              <StatusBadge value={`Position ${rank}`} tone="info" />
            </div>
            <dl className="sp-facts">
              <div><dt>Customer</dt><dd>{data.buyerName || '—'}</dd></div>
              <div><dt>Starts</dt><dd>{formatWhen(data.startDate)}</dd></div>
              <div><dt>Ends</dt><dd>{formatWhen(data.endDate)}</dd></div>
              <div><dt>Your quote</dt><dd>{quote ? formatMoney(quote.totalPrice) : 'No bid yet'}</dd></div>
              <div><dt>Bid status</dt><dd>{quote ? labelOf(quote.status) : '—'}</dd></div>
            </dl>
            {(data.items || []).map((item, index) => (
              <article key={item.id || String(index)} className="sp-card">
                <h2>{item.description || `Line ${index + 1}`}</h2>
                <p className="sp-meta">{item.quantity} {item.uom}</p>
              </article>
            ))}
            <p className="sp-note">{CLOUD_LATER} A bid is submitted from the Cloud e-auction so OTP and lot rules are not copied here.</p>
            <a className="sp-btn" href="/rfqs">Open the Cloud e-auction</a>
          </>
        )}
      </div>
    </>
  );
};
