import type {
  ChangeEvent,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

export const RESTRICTIONS_KEYS = {
  MAX_LENGTH: "maxLength",
  ONLY_NUMBERS: "onlyNumbers",
  DECIMAL: "decimal",
  PHONE: "phone",
} as const;

export type RestrictionConfig =
  | {
      name: typeof RESTRICTIONS_KEYS.MAX_LENGTH;
      max: number;
    }
  | {
      name: typeof RESTRICTIONS_KEYS.ONLY_NUMBERS;
      allowNegative?: boolean;
    }
  | {
      name: typeof RESTRICTIONS_KEYS.DECIMAL;
      upto: number;
      allowNegative?: boolean;
    }
  | {
      /**
       * International phone characters: digits, a single leading "+",
       * and the separators space, "-", "(" and ")".
       */
      name: typeof RESTRICTIONS_KEYS.PHONE;
    };

export type InputVariant = "default";

export type InputType =
  | InputHTMLAttributes<HTMLInputElement>["type"]
  | "textarea";

export interface InputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "size" | "type" | "onChange"
  > {
  /**
   * Input label
   */
  label?: string;

  /**
   * Displays required indicator (*)
   */
  required?: boolean;

  /**
   * Input type.
   * Use "textarea" to render a textarea.
   */
  type?: InputType;

  /**
   * Error message
   */
  error?: string;

  /**
   * Informational/help text displayed below the field
   */
  infoText?: string;

  /**
   * Optional custom info icon
   */
  infoIcon?: ReactNode;

  /**
   * Optional custom error icon
   */
  errorIcon?: ReactNode;

  /**
   * Textarea specific props
   */
  textareaProps?: Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "onChange" | "value" | "defaultValue" | "disabled" | "id" | "className"
  >;

  /**
   * Built-in input restrictions
   */
  restrictions?: RestrictionConfig[];

  /**
   * Additional CSS class
   */
  className?: string;

  /**
   * Change handler for both input and textarea
   */
  onChange?: (
    event:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLTextAreaElement>
  ) => void;
}