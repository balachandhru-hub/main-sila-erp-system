import React, { useId } from 'react';
import type { SilaLocation } from '../../../remote-buyer/src/api/silaMe/silaInventoryApi';

interface LocationPickerProps {
  label: string;
  locations: SilaLocation[];
  value: string;
  onChange: (locationId: string) => void;
  /** Text of the empty option; omit to have no empty option. */
  placeholder?: string;
  disabled?: boolean;
}

export const locationText = (location: SilaLocation): string =>
  `${location.locationName} (${location.locationCode})${location.propertyName ? ` · ${location.propertyName}` : ''}`;

const LocationPicker: React.FC<LocationPickerProps> = ({ label, locations, value, onChange, placeholder, disabled }) => {
  const id = useId();
  return (
    <div className="sm-field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        className="sm-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {locationText(location)}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LocationPicker;
