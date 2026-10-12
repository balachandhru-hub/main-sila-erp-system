import React, { useMemo } from "react";
import { Dropdown, type DropdownValue } from "@vosox/shared-ui";
import type { SilaLocation } from "../../api/silaMe/silaInventoryApi";

export interface SilaSelectOption {
  value: string;
  label: string;
}

interface SilaSearchableSelectProps {
  label: string;
  value: string;
  options: SilaSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  /** Allow clearing back to empty (filters / optional fields). Default true when not required. */
  clearable?: boolean;
  hideLabel?: boolean;
  className?: string;
  infoText?: string;
}

/** Searchable single-select used for locations, outlets, venues and properties. */
const SilaSearchableSelect: React.FC<SilaSearchableSelectProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  required = false,
  disabled = false,
  clearable,
  hideLabel = false,
  className = "",
  infoText,
}) => {
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const canClear = clearable ?? !required;

  return (
    <Dropdown
      label={label}
      hideLabel={hideLabel}
      isRequired={required}
      isDisable={disabled}
      isClearable={canClear}
      placeholder={placeholder}
      className={className}
      infoText={infoText}
      options={options.map((option) => ({ name: option.label, value: option.value }))}
      value={selected ? { name: selected.label, value: selected.value } : null}
      onChange={(next: DropdownValue | null) => onChange(next?.value ?? "")}
    />
  );
};

export const silaLocationLabel = (location: Pick<SilaLocation, "locationName" | "locationCode" | "propertyName">): string =>
  `${location.locationName} (${location.locationCode})${location.propertyName ? ` — ${location.propertyName}` : ""}`;

export const silaLocationOptions = (locations: SilaLocation[]): SilaSelectOption[] =>
  locations.map((location) => ({ value: location.id, label: silaLocationLabel(location) }));

export default SilaSearchableSelect;
