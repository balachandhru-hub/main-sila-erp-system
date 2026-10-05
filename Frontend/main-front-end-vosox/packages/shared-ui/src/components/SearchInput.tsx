import React from 'react';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** Accessible name; defaults to the placeholder. */
  label?: string;
  containerClassName?: string;
}

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const SearchInput: React.FC<SearchInputProps> = ({ label, placeholder = 'Search…', containerClassName = '', className = '', ...rest }) => (
  <div className={`sila-search ${containerClassName}`.trim()} role="search">
    <span className="sila-search-icon"><IconSearch /></span>
    <input
      type="search"
      className={`sila-input ${className}`.trim()}
      placeholder={placeholder}
      aria-label={label ?? placeholder}
      {...rest}
    />
  </div>
);

export default SearchInput;
