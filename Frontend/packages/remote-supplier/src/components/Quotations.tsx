import React, { useState } from 'react';
import { Button, EmptyState, StatusBadge } from '@vosox/shared-ui';
import './Quotations.css';

interface RFQ {
  id: string;
  title: string;
  client: string;
  deadline: string;
  myBid: string | null;
  status: 'Open' | 'Submitted' | 'Closed';
}

export const Quotations: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [rfqs, setRFQs] = useState<RFQ[]>([
    { id: 'RFQ-8801', title: 'Supply of Office Laptops (50 Units)', client: 'Vortex Tech', deadline: '2026-07-15', myBid: null, status: 'Open' },
    { id: 'RFQ-8802', title: 'Network Switch Replacements', client: 'Financial Corp', deadline: '2026-07-20', myBid: '$18,500', status: 'Submitted' },
    { id: 'RFQ-8803', title: 'Cloud Data Migration Services', client: 'Retail Giant', deadline: '2026-07-22', myBid: null, status: 'Open' },
    { id: 'RFQ-8804', title: 'Cybersecurity Threat Monitoring', client: 'Gov Agency', deadline: '2026-06-30', myBid: '$41,200', status: 'Closed' },
    { id: 'RFQ-8805', title: 'Helpdesk Software Support License', client: 'Media Networks', deadline: '2026-07-02', myBid: '$5,900', status: 'Submitted' },
  ]);

  const [activeRFQId, setActiveRFQId] = useState<string | null>(null);
  const [bidValue, setBidValue] = useState('');

  const handleSubmitBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRFQId || !bidValue) return;

    setRFQs(rfqs.map(rfq => {
      if (rfq.id === activeRFQId) {
        return {
          ...rfq,
          myBid: `$${parseFloat(bidValue).toLocaleString()}`,
          status: 'Submitted'
        };
      }
      return rfq;
    }));

    setBidValue('');
    setActiveRFQId(null);
  };

  const filteredRFQs = rfqs.filter(rfq => {
    const matchesSearch = rfq.title.toLowerCase().includes(search.toLowerCase()) || 
                          rfq.client.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterStatus === 'All' || 
                          (filterStatus === 'Submitted' && rfq.myBid !== null) || 
                          (filterStatus === 'Open' && rfq.myBid === null && rfq.status === 'Open') ||
                          (filterStatus === 'Closed' && rfq.status === 'Closed');
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="qtn-page">
      <div className="sila-page-header">
        <div className="sila-page-header-main">
          <div>
            <h1 className="sila-page-title">Quotations & Bids</h1>
            <p className="sila-page-description">Respond to buyer RFQs and check bid history</p>
          </div>
        </div>
      </div>

      {activeRFQId && (
        <section className="sila-card" aria-labelledby="quotations-proposal-title">
          <div className="sila-card-header">
            <h2 className="sila-card-title" id="quotations-proposal-title">
              Submit Proposal for <span className="sila-ref">{activeRFQId}</span>
            </h2>
          </div>
          <form onSubmit={handleSubmitBid} className="sila-card-body sila-form-grid">
            <div className="sila-field">
              <label className="sila-label" htmlFor="quotations-project-title">Project Title</label>
              <input
                id="quotations-project-title"
                className="sila-input"
                value={rfqs.find(r => r.id === activeRFQId)?.title ?? ''}
                readOnly
              />
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="quotations-bid-price">
                Your Bid Price ($)<span className="sila-required" aria-hidden="true">*</span>
              </label>
              <input
                id="quotations-bid-price"
                type="number"
                className="sila-input"
                placeholder="e.g. 15000"
                value={bidValue}
                onChange={e => setBidValue(e.target.value)}
                required
              />
            </div>
            <div className="sila-field sila-field--full">
              <div className="sila-form-actions">
                <Button type="submit" variant="primary">Submit Bid</Button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Filter and Search Bar + RFQ List */}
      <section className="sila-card">
        <div className="sila-toolbar">
          <div className="sila-search">
            <input
              type="text"
              className="sila-input"
              placeholder="Search RFQ or Client..."
              aria-label="Search RFQ or client"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="sila-toolbar-group" role="group" aria-label="Filter by status">
            <span className="sila-help">Status:</span>
            {['All', 'Open', 'Submitted', 'Closed'].map(status => (
              <button
                key={status}
                type="button"
                className={`sila-btn sila-btn--sm ${filterStatus === status ? 'sila-btn--primary' : 'sila-btn--secondary'}`}
                aria-pressed={filterStatus === status}
                onClick={() => setFilterStatus(status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">RFQ ID</th>
                <th scope="col">RFQ Title</th>
                <th scope="col">Client</th>
                <th scope="col">Deadline</th>
                <th scope="col" className="sila-num">Your Bid</th>
                <th scope="col">Status</th>
                <th scope="col" className="sila-cell-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRFQs.length > 0 ? (
                filteredRFQs.map(rfq => (
                  <tr key={rfq.id}>
                    <td><span className="sila-ref">{rfq.id}</span></td>
                    <td className="sila-cell-strong">{rfq.title}</td>
                    <td>{rfq.client}</td>
                    <td>{rfq.deadline}</td>
                    <td className="sila-num">{rfq.myBid || <span className="sila-cell-muted">--</span>}</td>
                    <td>
                      <StatusBadge status={rfq.myBid ? 'Submitted' : rfq.status} />
                    </td>
                    <td className="sila-cell-actions">
                      {rfq.status === 'Open' && !rfq.myBid ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            setActiveRFQId(rfq.id);
                          }}
                        >
                          Place Bid
                        </Button>
                      ) : rfq.myBid ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setActiveRFQId(rfq.id);
                            setBidValue(rfq.myBid ? rfq.myBid.replace(/[\$,]/g, '') : '');
                          }}
                        >
                          Modify Bid
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" disabled={true}>Closed</Button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState title="No quotations found matching the filter criteria." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Quotations;
