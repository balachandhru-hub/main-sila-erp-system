import { useState, type FC, type KeyboardEvent, type UIEvent } from "react";
import Input from "../Input/Input";
import type { SuggestInputProps } from "./SuggestInput.types";
import "./SuggestInput.css";

/**
 * The shared Input with a suggestion list below it. The list opens only while the user types;
 * it never has to be used, so a manually entered value is always accepted.
 */
const SuggestInput: FC<SuggestInputProps> = ({
  id,
  value,
  suggestions,
  loading = false,
  hasMore = false,
  disabled = false,
  onType,
  onSelect,
  onLoadMore,
  ...inputProps
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const listId = `${id}-suggestions`;
  const showList = open && !disabled && (loading || suggestions.length > 0);

  const choose = (suggestion: string) => {
    onSelect(suggestion);
    setOpen(false);
    setActiveIndex(-1);
  };

  // Ask for the next page once the list is scrolled to within 60px of its bottom.
  const handleListScroll = (e: UIEvent<HTMLUListElement>) => {
    if (!onLoadMore || !hasMore || loading) return;
    const list = e.currentTarget;
    if (list.scrollHeight - list.scrollTop - list.clientHeight <= 60) {
      onLoadMore();
    }
  };

  const handleKeyDown =(e: KeyboardEvent<HTMLInputElement>) => {
    // Enter must not submit the surrounding form.
    if (e.key === "Enter") {
      e.preventDefault();
      if (showList && activeIndex >= 0 && suggestions[activeIndex]) {
        choose(suggestions[activeIndex]);
      }
    } else if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="sila-suggest">
      <Input
        {...inputProps}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          setOpen(true);
          setActiveIndex(-1);
          onType(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
      />
      {showList && (
        <ul id={listId} className="sila-suggest-list" role="listbox" onScroll={handleListScroll}>
          {loading && suggestions.length === 0 && (
            <li className="sila-suggest-status">Searching...</li>
          )}
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={index === activeIndex}
              className={`sila-suggest-option${index === activeIndex ? " is-active" : ""}`}
              // mousedown (not click) so the input's blur does not close the list first
              onMouseDown={(e) => {
                e.preventDefault();
                choose(suggestion);
              }}
            >
              {suggestion}
            </li>
          ))}
          {loading && suggestions.length > 0 && (
            <li className="sila-suggest-status">Loading more...</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SuggestInput;
