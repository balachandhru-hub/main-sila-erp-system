import React from 'react';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';

const TOPICS: { title: string; text: string }[] = [
  {
    title: 'Receiving',
    text: 'Scan the supplier invoice, check the fields the scan read, pick the purchase order and enter the accepted quantity of each line. Posting the goods receipt adds the stock to the receiving store and sends it to the ERP.',
  },
  {
    title: 'Transfers (ITO)',
    text: 'Raise an ITO to request stock from another location: the source approves, dispatches, and you confirm what you received. A quick transfer moves the stock at once and only needs the receiver to confirm.',
  },
  {
    title: 'Stock count',
    text: 'Scan or search each material and enter the full units plus any open units; add a photo when it helps the reviewer. Saving a count never changes the inventory; the store manager approves the count. In a blind count the system quantity stays hidden. When the cost controller asks for a recount, only the lines marked Recount requested can be counted again.',
  },
  {
    title: 'Live stock and purchase requests',
    text: 'Open a material, enter the quantity you need and SILA ME recommends what to do: request a transfer, take it with a quick transfer, raise a purchase request, or ask for a physical inventory. Your purchase requests are under Inventory › Purchase requests.',
  },
  {
    title: 'Tasks and alerts',
    text: 'Tasks lists the counts and recounts waiting for you, the shortage enquiries you must answer (also when the reviewer asks for more information), physical inventories scheduled at your locations, transfers to approve and goods receipts the ERP refused. Price and recipe approvals are shown with their count and are decided in the SILA ME cloud app. Alerts show low stock, variances and transfer discrepancies at your locations.',
  },
];

const HelpScreen: React.FC = () => (
  <>
    <ScreenHeader title="Help" eyebrow="More" back />
    <div className="sm-screen">
      {TOPICS.map((topic) => (
        <Card key={topic.title} title={topic.title}>
          <p className="sm-meta">{topic.text}</p>
        </Card>
      ))}
    </div>
  </>
);

export default HelpScreen;
