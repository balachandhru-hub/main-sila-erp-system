import React from "react";
import { priceStatusLabel, priceStatusTone } from "./materialFormat";

interface SilaPriceStatusBadgeProps {
  /** APPROVED | MISSING | PENDING_APPROVAL | REJECTED */
  status: string | null | undefined;
}

/** Price status of a material or a price change request. */
const SilaPriceStatusBadge: React.FC<SilaPriceStatusBadgeProps> = ({ status }) => (
  <span className={`sila-badge sila-badge--${priceStatusTone(status)}`}>{priceStatusLabel(status)}</span>
);

export default SilaPriceStatusBadge;
