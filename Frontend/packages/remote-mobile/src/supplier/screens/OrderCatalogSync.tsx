import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { PurchaseOrderListItem } from '../../../../remote-buyer/src/api/purchaseOrderApi';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { CLOUD_LATER, formatMoney, formatWhen, labelOf } from '../format';
import {
  addCatalogProduct,
  loadCatalog,
  loadCatalogDetail,
  loadCatalogImage,
  loadCustomerOrders,
  loadSupplierContext,
  loadSync,
  loadSyncHistory,
  PAGE_SIZE,
  runSupplierSync,
  saveCatalogPrice,
  saveCatalogStock,
} from '../live';
import {
  BusinessCard,
  ChipRow,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  LaterButton,
  Loading,
  NotConnected,
  PageHeader,
  Pager,
  SearchField,
  StatusBadge,
  toneOfStatus,
} from '../ui';

export const OrdersHub: React.FC = () => {
  const go = useGo();
  return (
    <>
      <PageHeader eyebrow="Orders" title="Orders" intro="Customer purchase orders are live. Sales orders are not connected yet." />
      <div className="sp-screen">
        <button type="button" className="sp-action" onClick={() => go('supplier/orders/customer-pos')}>
          <strong>Customer purchase orders</strong>
          <span>Live</span>
        </button>
        <button type="button" className="sp-action" onClick={() => go('supplier/orders/sales-orders')}>
          <strong>Sales orders</strong>
          <span>Not connected</span>
        </button>
      </div>
    </>
  );
};

export const CustomerPoScreen: React.FC = () => {
  const go = useGo();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const orders = useLoad(() => loadCustomerOrders(page * PAGE_SIZE, PAGE_SIZE), `po-${page}`);
  const statuses = useMemo(() => {
    const values = Array.from(new Set((orders.data ?? []).map((order) => order.status).filter(Boolean)));
    return [{ id: 'ALL', label: 'All' }, ...values.map((value) => ({ id: value, label: labelOf(value) }))];
  }, [orders.data]);
  const filtered = (orders.data ?? []).filter((order) => {
    const haystack = `${order.poNumber} ${order.buyerName ?? ''} ${order.plantCode ?? ''}`.toLowerCase();
    const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
    return matchesSearch && (status === 'ALL' || order.status === status);
  });
  return (
    <>
      <PageHeader eyebrow="Orders" title="Customer purchase orders" intro="Orders buyers have placed with this supplier." back={() => go('supplier/orders')} />
      <div className="sp-screen">
        <SearchField value={search} onChange={setSearch} placeholder="PO number or customer" />
        <ChipRow options={statuses} value={status} onChange={setStatus} />
        {orders.loading && <Loading />}
        {orders.error && <ErrorNote message={orders.error} onRetry={orders.reload} />}
        {orders.data && filtered.length === 0 && <EmptyState title="No purchase orders" text="Nothing on this page matches the filter." />}
        {filtered.map((order) => (
          <PoCard key={order.id} order={order} onOpen={() => go(`supplier/orders/customer-pos/${order.id}`)} />
        ))}
        {orders.data && <Pager page={page} hasNext={orders.data.length === PAGE_SIZE} onPage={setPage} />}
        <p className="sp-note">The customer PO API returns the latest page. Search filters that page. Acknowledge, accept, reject and process are not on this API.</p>
        <div className="sp-row">
          <LaterButton label="Acknowledge" />
          <LaterButton label="Accept" />
          <LaterButton label="Reject" />
        </div>
      </div>
    </>
  );
};

const PoCard: React.FC<{ order: PurchaseOrderListItem; onOpen: () => void }> = ({ order, onOpen }) => (
  <BusinessCard
    title={order.poNumber}
    status={order.status}
    lines={[
      { label: 'Customer', value: order.buyerName || '—' },
      { label: 'PO date', value: formatWhen(order.orderDate) },
      { label: 'Amount', value: formatMoney(order.totalAmount, order.currency) },
      { label: 'Items', value: String(order.itemCount) },
      { label: 'Fulfilment', value: order.supplierErpSyncStatus || '—' },
    ]}
    onOpen={onOpen}
  />
);

export const CustomerPoDetail: React.FC = () => {
  const { poId = '' } = useParams();
  const go = useGo();
  const orders = useLoad(() => loadCustomerOrders(0, 100), 'po-detail-page');
  const order = orders.data?.find((item) => item.id === poId) ?? null;
  return (
    <>
      <PageHeader eyebrow="Customer PO" title={order?.poNumber || 'Purchase order'} back={() => go('supplier/orders/customer-pos')} />
      <div className="sp-screen">
        {orders.loading && <Loading />}
        {orders.error && <ErrorNote message={orders.error} onRetry={orders.reload} />}
        {!orders.loading && !order && !orders.error && <EmptyState title="Not in the latest page" text="Open the order from the list. There is no single-order API for the supplier." />}
        {order && (
          <dl className="sp-facts">
            <div><dt>Customer</dt><dd>{order.buyerName || '—'}</dd></div>
            <div><dt>Status</dt><dd>{order.status}</dd></div>
            <div><dt>PO date</dt><dd>{formatWhen(order.orderDate)}</dd></div>
            <div><dt>Amount</dt><dd>{formatMoney(order.totalAmount, order.currency)}</dd></div>
            <div><dt>Currency</dt><dd>{order.currency || '—'}</dd></div>
            <div><dt>Items</dt><dd>{String(order.itemCount)}</dd></div>
            <div><dt>Plant</dt><dd>{order.plantCode || '—'}</dd></div>
            <div><dt>Supplier ERP</dt><dd>{order.supplierErpSalesOrderNumber || order.supplierErpSyncStatus || '—'}</dd></div>
          </dl>
        )}
        <p className="sp-note">Line quantities are counted, not listed. {CLOUD_LATER}</p>
        <LaterButton label="Process" />
      </div>
    </>
  );
};

export const CatalogScreen: React.FC = () => {
  const go = useGo();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const catalog = useLoad(loadCatalog, 'catalog');
  const context = useLoad(loadSupplierContext, adding ? 'catalog-org' : null);
  const categories = useMemo(() => {
    const values = Array.from(new Set((catalog.data ?? []).map((item) => item.catalogType || item.segmentTitle).filter(Boolean)));
    return [{ id: 'ALL', label: 'All' }, ...values.map((value) => ({ id: value, label: labelOf(value) }))];
  }, [catalog.data]);
  const filtered = (catalog.data ?? []).filter((item) => {
    const haystack = `${item.catalogName} ${item.description} ${item.segmentTitle}`.toLowerCase();
    const matches = !search.trim() || haystack.includes(search.trim().toLowerCase());
    const group = item.catalogType || item.segmentTitle;
    return matches && (category === 'ALL' || group === category);
  });
  const slice = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => setPage(0), [search, category]);
  return (
    <>
      <PageHeader eyebrow="Catalog" title="Product catalog" intro="Products from the Cloud catalog." />
      <div className="sp-screen">
        <div className="sp-row">
          <SearchField value={search} onChange={setSearch} placeholder="Product name" />
          <button type="button" className="sp-btn" onClick={() => setAdding(true)}>Add product</button>
        </div>
        <ChipRow options={categories} value={category} onChange={setCategory} />
        {catalog.loading && <Loading />}
        {catalog.error && <ErrorNote message={catalog.error} onRetry={catalog.reload} />}
        {catalog.data && slice.length === 0 && <EmptyState title="No products" text="The catalog is empty or the filter matches nothing." />}
        {slice.map((item) => (
          <BusinessCard
            key={item.id}
            title={item.catalogName}
            meta={item.segmentTitle || item.catalogType}
            status={item.catalogType}
            lines={[
              { label: 'Price', value: formatMoney(item.price, item.currency) },
              { label: 'UOM', value: item.unitOfMeasure },
              { label: 'Category', value: item.familyTitle || item.segmentTitle || '—' },
            ]}
            onOpen={() => go(`supplier/catalog/${item.id}`)}
          />
        ))}
        <Pager page={page} hasNext={(page + 1) * PAGE_SIZE < filtered.length} onPage={setPage} />
        <p className="sp-note">Activate and deactivate are not a Cloud catalog action. Pictures are shown on the product. Replacing a picture stays in Cloud so existing images are not removed.</p>
        {adding && (
          <AddProduct
            organizationId={context.data?.organizationId || ''}
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              catalog.reload();
            }}
          />
        )}
      </div>
    </>
  );
};

const AddProduct: React.FC<{ organizationId: string; onClose: () => void; onSaved: () => void }> = ({ organizationId, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [uom, setUom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await addCatalogProduct({
        organizationId,
        catalogName: name.trim(),
        description: description.trim(),
        price: Number(price),
        currency: currency.trim(),
        unitOfMeasure: uom.trim(),
        catalogType: 'CATALOG',
      });
      onSaved();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not add the product.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="sp-sheet" role="presentation">
      <button type="button" className="sp-sheet__backdrop" aria-label="Close" onClick={onClose} />
      <div className="sp-dialog" role="dialog" aria-label="Add product">
        <h2>Add product</h2>
        <p className="sp-note">Creates a catalog product through the existing Cloud catalog. A picture can be added in Cloud.</p>
        <label className="sp-field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="sp-field"><span>Description</span><input value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <label className="sp-field"><span>Price</span><input value={price} inputMode="decimal" onChange={(event) => setPrice(event.target.value)} /></label>
        <label className="sp-field"><span>Currency</span><input value={currency} onChange={(event) => setCurrency(event.target.value)} /></label>
        <label className="sp-field"><span>UOM</span><input value={uom} onChange={(event) => setUom(event.target.value)} /></label>
        {error && <ErrorNote message={error} />}
        <div className="sp-row">
          <button type="button" className="sp-btn sp-btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="sp-btn" onClick={save} disabled={busy || !name.trim() || !price}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

export const CatalogDetailScreen: React.FC = () => {
  const { catalogId = '' } = useParams();
  const go = useGo();
  const detail = useLoad(() => loadCatalogDetail(catalogId), catalogId ? `catalog-${catalogId}` : null);
  const item = detail.data;
  const image = useLoad(
    () => loadCatalogImage(item!.asset?.[0]?.id || ''),
    item?.asset?.[0]?.id ? `img-${item.asset[0].id}` : null,
  );
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [stock, setStock] = useState('');
  const [discount, setDiscount] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!item) return;
    setPrice(item.price == null ? '' : String(item.price));
    setDescription(item.description || '');
    setSku(item.sku || '');
    setStock(item.availableStock == null ? '' : String(item.availableStock));
    setDiscount(item.discountPercent == null ? '' : String(item.discountPercent));
  }, [item]);
  const savePrice = async () => {
    if (!item) return;
    setError(null);
    try {
      await saveCatalogPrice(item, Number(price), description);
      setNotice('Price saved.');
      detail.reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not save the price.');
    }
  };
  const saveStock = async () => {
    if (!item) return;
    setError(null);
    try {
      await saveCatalogStock(item.catalogId, {
        sku: sku.trim(),
        availableStock: stock === '' ? null : Number(stock),
        discountPercent: discount === '' ? null : Number(discount),
      });
      setNotice('Availability saved.');
      detail.reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not save availability.');
    }
  };
  return (
    <>
      <PageHeader eyebrow="Catalog" title={item?.catalogName || 'Product'} back={() => go('supplier/catalog')} />
      <div className="sp-screen">
        {detail.loading && <Loading />}
        {detail.error && <ErrorNote message={detail.error} onRetry={detail.reload} />}
        {item && (
          <>
            {image.data && <img className="sp-photo" src={image.data} alt="" />}
            {!image.data && <p className="sp-note">No product image is stored.</p>}
            <dl className="sp-facts">
              <div><dt>Price</dt><dd>{formatMoney(item.price, item.currency)}</dd></div>
              <div><dt>UOM</dt><dd>{item.unitOfMeasure || '—'}</dd></div>
              <div><dt>Category</dt><dd>{item.segmentTitle || item.catalogType}</dd></div>
              <div><dt>Available</dt><dd>{item.availableStock == null ? '—' : String(item.availableStock)}</dd></div>
            </dl>
            <label className="sp-field"><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
            <label className="sp-field"><span>Price</span><input value={price} inputMode="decimal" onChange={(event) => setPrice(event.target.value)} /></label>
            <button type="button" className="sp-btn" onClick={savePrice}>Update price</button>
            <label className="sp-field"><span>SKU</span><input value={sku} onChange={(event) => setSku(event.target.value)} /></label>
            <label className="sp-field"><span>Available</span><input value={stock} inputMode="decimal" onChange={(event) => setStock(event.target.value)} /></label>
            <label className="sp-field"><span>Discount %</span><input value={discount} inputMode="decimal" onChange={(event) => setDiscount(event.target.value)} /></label>
            <button type="button" className="sp-btn sp-btn--secondary" onClick={saveStock}>Update availability</button>
            {notice && <p className="sp-note">{notice}</p>}
            {error && <ErrorNote message={error} />}
          </>
        )}
      </div>
    </>
  );
};

export const SyncScreen: React.FC = () => {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sync = useLoad(loadSync, 'sync');
  const history = useLoad(() => loadSyncHistory(selected!), selected ? `sync-history-${selected}` : null);
  const run = async () => {
    if (!confirmId) return;
    setBusy(true);
    setError(null);
    try {
      await runSupplierSync(confirmId);
      setConfirmId(null);
      sync.reload();
      history.reload();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'The sync could not be started.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader eyebrow="Sync" title="Sync" intro="Supplier integrations and their Cloud run history." />
      <div className="sp-screen">
        {sync.loading && <Loading />}
        {sync.error && <ErrorNote message={sync.error} onRetry={sync.reload} />}
        {sync.data && sync.data.length === 0 && <EmptyState title="No integrations" text="No supplier sync is configured in Cloud." />}
        {sync.data?.map((row) => (
          <article key={row.configuration.id} className="sp-card">
            <div className="sp-row">
              <h2>{row.configuration.name}</h2>
              <StatusBadge value={row.execution?.status || row.configuration.status} tone={toneOfStatus(row.execution?.status || row.configuration.status)} />
            </div>
            <dl className="sp-facts">
              <div><dt>Source</dt><dd>{row.configuration.systemName || row.configuration.protocol}</dd></div>
              <div><dt>Target</dt><dd>{labelOf(row.configuration.processType)}</dd></div>
              <div><dt>Last sync</dt><dd>{formatWhen(row.execution?.completedAt || row.configuration.lastSuccessfulRunAt)}</dd></div>
              <div><dt>Records</dt><dd>{row.execution ? String(row.execution.recordsRead) : '—'}</dd></div>
              <div><dt>Success</dt><dd>{row.execution ? String(row.execution.recordsCreated + row.execution.recordsUpdated) : '—'}</dd></div>
              <div><dt>Failed</dt><dd>{row.execution ? String(row.execution.recordsFailed) : '—'}</dd></div>
            </dl>
            {row.execution?.errorMessageSafe && <p className="sp-note">{row.execution.errorMessageSafe}</p>}
            <div className="sp-row">
              <button type="button" className="sp-btn sp-btn--secondary" onClick={() => setSelected(row.configuration.id)}>History</button>
              {row.canRun ? (
                <button type="button" className="sp-btn" onClick={() => setConfirmId(row.configuration.id)}>Sync now</button>
              ) : (
                <span className="sp-note">This integration is not a manual pull.</span>
              )}
            </div>
          </article>
        ))}
        {selected && history.loading && <Loading text="Loading history…" />}
        {history.error && <ErrorNote message={history.error} onRetry={history.reload} />}
        {history.data?.map((runRow) => (
          <article key={runRow.id} className="sp-card">
            <div className="sp-row">
              <strong>{formatWhen(runRow.startedAt)}</strong>
              <StatusBadge value={runRow.status} tone={toneOfStatus(runRow.status)} />
            </div>
            <p className="sp-meta">{runRow.trigger} · {runRow.recordsRead} read · {runRow.recordsFailed} failed</p>
          </article>
        ))}
        {error && <ErrorNote message={error} />}
        {confirmId && (
          <ConfirmDialog
            title="Run sync"
            text="This starts the existing Cloud pull for the selected supplier integration."
            confirmLabel="Sync now"
            busy={busy}
            onCancel={() => setConfirmId(null)}
            onConfirm={run}
          />
        )}
      </div>
    </>
  );
};

export const CustomersScreen: React.FC = () => {
  const go = useGo();
  const orders = useLoad(() => loadCustomerOrders(0, 100), 'customers');
  const customers = useMemo(() => {
    const map = new Map<string, { name: string; orders: number }>();
    (orders.data ?? []).forEach((order) => {
      const name = order.buyerName || 'Customer';
      const current = map.get(name) ?? { name, orders: 0 };
      current.orders += 1;
      map.set(name, current);
    });
    return Array.from(map.values());
  }, [orders.data]);
  return (
    <>
      <PageHeader eyebrow="Customers" title="Customers" intro="Names come from customer purchase orders. There is no separate customer master in this phase." />
      <div className="sp-screen">
        {orders.loading && <Loading />}
        {orders.error && <ErrorNote message={orders.error} onRetry={orders.reload} />}
        {orders.data && customers.length === 0 && <EmptyState title="No customers" text="No customer purchase orders were returned." />}
        {customers.map((customer) => (
          <BusinessCard
            key={customer.name}
            title={customer.name}
            lines={[
              { label: 'Open orders on this page', value: String(customer.orders) },
              { label: 'VMI', value: 'Not connected' },
            ]}
            onOpen={() => go(`supplier/customers/${encodeURIComponent(customer.name)}`)}
          />
        ))}
      </div>
    </>
  );
};

export const CustomerDetailScreen: React.FC = () => {
  const { customerId = '' } = useParams();
  const name = decodeURIComponent(customerId);
  const go = useGo();
  const [tab, setTab] = useState('overview');
  const tabs = ['Overview', 'Contacts', 'Orders', 'Inventory / VMI', 'Shipments', 'Invoices', 'Payments', 'Activity'];
  return (
    <>
      <PageHeader eyebrow="Customer" title={name || 'Customer'} back={() => go('supplier/customers')} />
      <div className="sp-screen">
        <ChipRow options={tabs.map((label) => ({ id: label, label }))} value={tab === 'overview' ? 'Overview' : tab} onChange={setTab} />
        {tab === 'Overview' || tab === 'overview' ? (
          <div className="sp-card">
            <dl className="sp-facts">
              <div><dt>Customer</dt><dd>{name}</dd></div>
              <div><dt>Code</dt><dd>—</dd></div>
              <div><dt>Location</dt><dd>—</dd></div>
              <div><dt>Contact</dt><dd>—</dd></div>
            </dl>
            <p className="sp-note">Only the name is known from purchase orders. Contacts and balances are not connected.</p>
          </div>
        ) : (
          <NotConnected title={tab} />
        )}
      </div>
    </>
  );
};
