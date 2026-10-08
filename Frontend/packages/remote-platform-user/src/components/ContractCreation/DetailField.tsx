import React from "react";

/** A label with its value (or input) in the contract details grid. `wide` makes it span the full row. */
export const DetailField: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({ label, wide, children }) => (
  <div className={wide ? "contract-field contract-field--wide" : "contract-field"}>
    <div className="contract-field-label">{label}</div>
    {children}
  </div>
);

export default DetailField;
