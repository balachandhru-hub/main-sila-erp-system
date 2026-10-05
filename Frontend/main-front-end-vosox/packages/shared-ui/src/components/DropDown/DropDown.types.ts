import type {
  CSSProperties,
} from "react";
 
export interface DropdownOption {
  name: string;
  value?: string;
  [key: string]: unknown;
}
 
export interface DropdownValue {
  name: string;
  value: string;
}
 
export interface DropdownLoadParams {
  search: string;
  page: number;
  params?: Record<string, unknown>;
}
 
export interface DropdownLoadResult {
  options: DropdownOption[];
  hasMore?: boolean;
  total?: number;
}
 
export type DropdownLoadOptions = (
  params: DropdownLoadParams
) => Promise<DropdownLoadResult>;
 
export interface DropdownBaseProps {
  /**
   * Dropdown label
   */
  label?: string;

  /**
   * Keep `label` as the field's accessible name but don't render it visually.
   * Useful for compact filter bars where a visible label would break the layout.
   */
  hideLabel?: boolean;

  /**
   * Displays required indicator (*)
   */
  isRequired?: boolean;
 
  /**
   * Normal dropdown options.
   *
   * If value is not provided,
   * name will be used as value.
   */
  options?: DropdownOption[];
 
  /**
   * Enable async dropdown
   */
  isAsync?: boolean;
 
  /**
   * Async option loader
   */
  loadOptions?: DropdownLoadOptions;
 
  /**
   * Additional params sent to loadOptions.
   *
   * Example:
   * {
   *   limit: 10,
   *   countryId: "IN"
   * }
   */
  params?: Record<string, unknown>;
 
  /**
   * Debounce delay for async search
   */
  debounceDelay?: number;
 
  /**
   * Placeholder text
   */
  placeholder?: string;
 
  /**
   * Error message
   */
  error?: string;
 
  /**
   * Informational/help text
   */
  infoText?: string;
 
  /**
   * Show clear (X) button
   */
  isClearable?: boolean;
 
  /**
   * Allow multiple selections
   */
  isMulti?: boolean;
 
  /**
   * Disable dropdown
   */
  isDisable?: boolean;
 
  /**
   * Values used to reset this dropdown.
   *
   * When any value changes:
   * - selected value is cleared
   * - search is cleared
   * - async options are cleared
   * - pagination is reset
   *
   * Example:
   * cacheUniques={[
   *   country?.value,
   *   organization?.value
   * ]}
   */
  cacheUniques?: Array<
    string | number | null | undefined
  >;
 
  /**
   * Additional CSS class
   */
  className?: string;
 
  /**
   * Inline styles
   */
  style?: CSSProperties;
}
 
export interface DropdownSingleProps
  extends DropdownBaseProps {
  isMulti?: false;
 
  value?: DropdownValue | null;
 
  onChange?: (
    value: DropdownValue | null
  ) => void;
}
 
export interface DropdownMultiProps
  extends DropdownBaseProps {
  isMulti: true;
 
  value?: DropdownValue[];
 
  onChange?: (
    value: DropdownValue[]
  ) => void;
}
 
export type DropdownProps =
  | DropdownSingleProps
  | DropdownMultiProps;