import React, { useMemo } from 'react';
import { Dropdown, type DropdownValue } from '@vosox/shared-ui';
import type { SilaLocation } from '../../../remote-buyer/src/api/silaMe/silaInventoryApi';

interface LocationPickerProps {
  label: string;
  locations: SilaLocation[];
  value: string;
  onChange: (locationId: string) => void;
  /** Text of the empty option; omit to require a selection. */
  placeholder?: string;
  disabled?: boolean;
}

export const locationText = (location: SilaLocation): string =>
  `${location.locationName} (${location.locationCode})${location.propertyName ? ` · ${location.propertyName}` : ''}`;

const LocationPicker: React.FC<LocationPickerProps> = ({ label, locations, value, onChange, placeholder, disabled }) => {
  const options = useMemo(
    () => locations.map((location) => ({ name: locationText(location), value: location.id })),
    [locations],
  );
  const selected = options.find((option) => option.value === value) ?? null;
  const required = placeholder === undefined;

  return (
    <div className="sm-field">
      <Dropdown
        label={label}
        isRequired={required}
        isDisable={disabled}
        isClearable={!required}
        placeholder={placeholder ?? 'Select…'}
        options={options}
        value={selected}
        onChange={(next: DropdownValue | null) => onChange(next?.value ?? '')}
      />
    </div>
  );
};

export default LocationPicker;
