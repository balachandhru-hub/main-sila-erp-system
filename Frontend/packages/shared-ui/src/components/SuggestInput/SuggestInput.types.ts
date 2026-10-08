import type { InputProps } from "../Input/Input.types";

/**
 * Everything the shared Input takes (label, required, error, infoText, placeholder, disabled, maxLength, className, ...)
 * is passed through to it; only the pieces SuggestInput controls itself are replaced.
 */
export interface SuggestInputProps
  extends Omit<
    InputProps,
    "value" | "onChange" | "type" | "textareaProps" | "restrictions" | "onKeyDown" | "onBlur" | "onSelect" | "role"
  > {
  /** Needed to link the suggestion list to the input. */
  id: string;
  value: string;
  suggestions: string[];
  loading?: boolean;
  /** More suggestions can be fetched: when the list is scrolled near its bottom, `onLoadMore` is called. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** The user typed: the value is whatever they entered, whether or not it is one of the suggestions. */
  onType: (value: string) => void;
  /** The user picked a suggestion. */
  onSelect: (value: string) => void;
}
