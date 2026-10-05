import React from 'react';
import type { SilaStockCountDetail } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';

/** Progress of a count; the result counters are hidden while a blind count hides system quantities. */
const CountCounters: React.FC<{ count: SilaStockCountDetail }> = ({ count }) => {
  const showResult = !count.blindCount || count.canSeeSystemQty;
  const counters: { label: string; value: number }[] = [
    { label: 'Counted', value: count.countedItems },
    { label: 'Left', value: count.remainingItems },
  ];
  if (showResult) {
    counters.push(
      { label: 'Match', value: count.matchedItems },
      { label: 'Short', value: count.shortageItems },
      { label: 'Plus', value: count.surplusItems },
    );
  }

  return (
    <div className="sm-grid-3" aria-label="Count progress">
      {counters.map((counter) => (
        <div key={counter.label} className="sm-stat sm-stat--small">
          <strong>{counter.value}</strong>
          <span className="sm-muted">{counter.label}</span>
        </div>
      ))}
    </div>
  );
};

export default CountCounters;
