import React from "react";
import { ChartCard } from "@vosox/shared-ui";
import type { SilaStockHealth } from "../../../api/silaMe/silaInventoryControlApi";

interface SilaStockHealthCardProps {
  health: SilaStockHealth;
  /** Month (1-12) whose stocking-level overrides were applied. */
  month: number;
}

type HealthCount = "healthy" | "low" | "out" | "excess";

const SEGMENTS: { key: HealthCount; label: string; className: string }[] = [
  { key: "healthy", label: "Healthy", className: "sinv-health-seg--healthy" },
  { key: "low", label: "Low Stock", className: "sinv-health-seg--low" },
  { key: "out", label: "Out of Stock", className: "sinv-health-seg--out" },
  { key: "excess", label: "Excess Stock", className: "sinv-health-seg--excess" },
];

/** Stocked materials by health against their stocking levels, as a segmented meter. */
const SilaStockHealthCard: React.FC<SilaStockHealthCardProps> = ({ health, month }) => {
  const total = health.healthy + health.low + health.out + health.excess;
  const monthName = new Date(2000, Math.max(0, month - 1), 1).toLocaleString(undefined, { month: "long" });

  return (
    <ChartCard title="Stock Health" subtitle={`Levels of ${monthName}`} empty={total === 0} emptyText="No stocking levels are set yet.">
      <div className="sinv-health">
        <div className="sinv-health-bar" role="img" aria-label={SEGMENTS.map((segment) => `${segment.label} ${health[segment.key]}`).join(", ")}>
          {SEGMENTS.filter((segment) => health[segment.key] > 0).map((segment) => (
            <span key={segment.key} className={`sinv-health-seg ${segment.className}`} style={{ flexGrow: health[segment.key] }} />
          ))}
        </div>
        <ul className="sinv-health-legend">
          {SEGMENTS.map((segment) => (
            <li key={segment.key} className="sinv-health-legend-item">
              <span className={`sinv-health-swatch ${segment.className}`} aria-hidden="true" />
              <span>{segment.label}</span>
              <span className="sila-cell-strong">{health[segment.key]}</span>
            </li>
          ))}
        </ul>
        {health.nearExpiryNote && (
          <p className="sinv-sub">
            Near expiry: {health.nearExpiryConfigured ? health.nearExpiryNote : `Not configured (${health.nearExpiryNote.toLowerCase()})`}
          </p>
        )}
      </div>
    </ChartCard>
  );
};

export default SilaStockHealthCard;
