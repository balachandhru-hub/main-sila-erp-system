import React, { useEffect, useState } from "react";
import { toastService } from "@vosox/shared-ui";
import "./CartSection.css";

interface QuantityInputProps {
  value: number;
  /** Accessible name, e.g. "Quantity of Olive oil". */
  label: string;
  disabled?: boolean;
  /** Called when the user leaves the field (or presses Enter) with a changed, valid quantity. */
  onCommit: (quantity: number) => void;
}

/** Quantity field of a saved line: the change is sent when the user leaves the field, not on every keystroke. */
const QuantityInput: React.FC<QuantityInputProps> = ({ value, label, disabled = false, onCommit }) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const quantity = Number(draft);
    if (draft.trim() === "" || !(quantity > 0)) {
      toastService.error("Enter a quantity greater than zero.");
      setDraft(String(value));
      return;
    }
    if (quantity !== value) onCommit(quantity);
  };

  return (
    <input
      className="sila-input cart-qty"
      type="number"
      min="0"
      step="any"
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
};

export default QuantityInput;
