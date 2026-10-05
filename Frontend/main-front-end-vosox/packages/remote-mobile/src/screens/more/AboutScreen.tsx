import React from 'react';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';

/** What the app can do today (the prototype's "Capability status"). */
const CAPABILITIES: { label: string; status: 'CONNECTED' | 'CLOUD_ONLY' }[] = [
  { label: 'Invoice scan and OCR', status: 'CONNECTED' },
  { label: 'Goods receipt posting', status: 'CONNECTED' },
  { label: 'Live inventory', status: 'CONNECTED' },
  { label: 'Internal transfers (ITO) and quick transfers', status: 'CONNECTED' },
  { label: 'Stock count, recount and photos', status: 'CONNECTED' },
  { label: 'Shortage enquiries', status: 'CONNECTED' },
  { label: 'Purchase requests', status: 'CONNECTED' },
  { label: 'Price and recipe approvals', status: 'CLOUD_ONLY' },
  { label: 'Goods issue, waste and adjustments', status: 'CLOUD_ONLY' },
];

const AboutScreen: React.FC = () => (
  <>
    <ScreenHeader title="About SILA ME" eyebrow="More" back />
    <div className="sm-screen">
      <Card title="SILA ME Mobile">
        <p className="sm-meta">
          SILA Store is the store and outlet app of the SILA ME add-on for VOSOX: receiving, inventory, transfers, stock counts and
          tasks. Sign in with your VOSOX account.
        </p>
      </Card>
      <Card title="Capability status">
        <ul className="sm-list">
          {CAPABILITIES.map((item) => (
            <li key={item.label} className="sm-row">
              <span className="sm-meta">{item.label}</span>
              <StatusBadge
                status={item.status === 'CONNECTED' ? 'ACTIVE' : 'INFO'}
                label={item.status === 'CONNECTED' ? 'Connected' : 'Cloud app'}
              />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  </>
);

export default AboutScreen;
