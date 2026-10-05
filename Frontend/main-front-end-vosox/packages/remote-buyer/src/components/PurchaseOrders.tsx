import React, { useState } from 'react';
import { Button, EmptyState, SearchInput, StatusBadge } from '@vosox/shared-ui';

interface PO {
  id: string;
  vendor: string;
  amount: string;
  date: string;
  status: 'Draft' | 'Sent' | 'Completed' | 'Cancelled';
}

export const PurchaseOrders: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [pos, setPOs] = useState<PO[]>([
    { id: 'PO-99120', vendor: 'Global Logistics Corp', amount: '$14,500', date: '2026-06-28', status: 'Sent' },
    { id: 'PO-99121', vendor: 'TechSolutions Ltd', amount: '$23,200', date: '2026-06-25', status: 'Completed' },
    { id: 'PO-99122', vendor: 'Office Supply Depot', amount: '$3,800', date: '2026-06-20', status: 'Completed' },
    { id: 'PO-99123', vendor: 'Prime Builders', amount: '$42,000', date: '2026-06-19', status: 'Draft' },
    { id: 'PO-99124', vendor: 'Apex Consulting Group', amount: '$11,000', date: '2026-06-15', status: 'Cancelled' },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newVendor, setNewVendor] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const handleAddPO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendor || !newAmount) return;

    const newPO: PO = {
      id: `PO-${Math.floor(10000 + Math.random() * 90000)}`,
      vendor: newVendor,
      amount: `$${parseFloat(newAmount).toLocaleString()}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Draft',
    };

    setPOs([newPO, ...pos]);
    setNewVendor('');
    setNewAmount('');
    setShowAddForm(false);
  };

  const filteredPOs = pos.filter(po => {
    const matchesSearch = po.id.toLowerCase().includes(search.toLowerCase()) ||
                          po.vendor.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'All' || po.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="sila-root">
      <div className="sila-page-header">
        <div className="sila-page-header-main">
          <div>
            <h1 className="sila-page-title">Purchase Orders</h1>
            <p className="sila-page-description">Generate, track, and send purchase orders</p>
          </div>
        </div>
        <div className="sila-page-actions">
          <Button
            variant={showAddForm ? 'secondary' : 'primary'}
            onClick={() => setShowAddForm(!showAddForm)}
            aria-expanded={showAddForm}
          >
            {showAddForm ? 'Cancel PO creation' : 'Create New PO'}
          </Button>
        </div>
      </div>

      <div className="sila-card">
        {showAddForm && (
          <>
            <div className="sila-card-header">
              <h3 className="sila-card-title">Create New Purchase Order</h3>
            </div>
            <form className="sila-card-body" onSubmit={handleAddPO}>
              <div className="sila-form-grid">
                <div className="sila-field">
                  <label className="sila-label" htmlFor="po-new-vendor">
                    Vendor Name <span className="sila-required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="po-new-vendor"
                    type="text"
                    className="sila-input"
                    placeholder="e.g. Acme Corp"
                    value={newVendor}
                    onChange={e => setNewVendor(e.target.value)}
                    required
                  />
                </div>
                <div className="sila-field">
                  <label className="sila-label" htmlFor="po-new-amount">
                    Total Amount ($) <span className="sila-required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="po-new-amount"
                    type="number"
                    className="sila-input"
                    placeholder="e.g. 5000"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="sila-form-actions">
                <Button type="submit" variant="primary">Save as Draft</Button>
              </div>
            </form>
          </>
        )}

        {/* Filter and Search Bar */}
        <div className="sila-toolbar">
          <SearchInput
            placeholder="Search PO ID or Vendor..."
            label="Search PO ID or Vendor"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="sila-toolbar-group" role="group" aria-label="Filter by status">
            <span className="sila-label">Status:</span>
            {['All', 'Draft', 'Sent', 'Completed', 'Cancelled'].map(status => (
              <button
                key={status}
                type="button"
                className={`sila-btn sila-btn--sm ${filterStatus === status ? 'sila-btn--primary' : 'sila-btn--ghost'}`}
                aria-pressed={filterStatus === status}
                onClick={() => setFilterStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* PO Table */}
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">PO ID</th>
                <th scope="col">Vendor</th>
                <th scope="col" className="sila-num">Amount</th>
                <th scope="col">Created Date</th>
                <th scope="col">Status</th>
                <th scope="col" className="sila-cell-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOs.length > 0 ? (
                filteredPOs.map(po => (
                  <tr key={po.id}>
                    <td><span className="sila-ref">{po.id}</span></td>
                    <td className="sila-cell-strong">{po.vendor}</td>
                    <td className="sila-num">{po.amount}</td>
                    <td className="sila-cell-muted">{po.date}</td>
                    <td>
                      <StatusBadge status={po.status} label={po.status} />
                    </td>
                    <td className="sila-cell-actions">
                      <div className="sila-btn-group">
                        {po.status === 'Draft' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setPOs(pos.map(p => p.id === po.id ? { ...p, status: 'Sent' } : p));
                            }}
                          >
                            Send
                          </Button>
                        )}
                        {po.status === 'Sent' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setPOs(pos.map(p => p.id === po.id ? { ...p, status: 'Completed' } : p));
                            }}
                          >
                            Complete
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">Audit</Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyState title="No purchase orders found matching the filter criteria." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrders;
