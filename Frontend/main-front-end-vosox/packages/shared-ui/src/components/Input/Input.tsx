import {
  useState,
  type FC,
  type ChangeEvent,
} from "react";
import {
  FaEye,
  FaEyeSlash,
  FaInfoCircle,
  FaExclamationCircle,
} from "react-icons/fa";

import type { InputProps } from "./Input.types";
import { RESTRICTIONS_KEYS } from "./Input.types";

import "./Input.css";

const Input: FC<InputProps> = ({
  label,
  required = false,
  error,
  infoText,
  infoIcon,
  errorIcon,
  textareaProps,
  restrictions = [],
  className = "",
  type = "text",
  id,
  value,
  defaultValue,
  onChange,
  disabled = false,
  ...rest
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const isTextarea = type === "textarea";

  const inputType =
    type === "password" && showPassword
      ? "text"
      : type;

  const inputId =
    id ||
    `sila-input-${label
      ?.toLowerCase()
      .replace(/\s+/g, "-")}`;

  const hasError = Boolean(error);

  /**
   * Apply restrictions directly to the value.
   */
  const applyRestrictions = (value: string): string => {
    let result = value;

    for (const restriction of restrictions) {
      switch (restriction.name) {
        case RESTRICTIONS_KEYS.MAX_LENGTH:
          result = result.slice(0, restriction.max);
          break;

        case RESTRICTIONS_KEYS.ONLY_NUMBERS: {
          const allowNegative =
            restriction.allowNegative ?? false;

          if (allowNegative) {
            result = result
              .replace(/[^\d-]/g, "")
              .replace(/^-+/g, "-");

            result = result.replace(
              /(\d)-+/g,
              "$1"
            );
          } else {
            result = result.replace(/[^\d]/g, "");
          }

          break;
        }

        case RESTRICTIONS_KEYS.DECIMAL: {
          const allowNegative =
            restriction.allowNegative ?? false;

          if (allowNegative) {
            result = result
              .replace(/[^\d.-]/g, "")
              .replace(/^-+/g, "-");

            result = result.replace(
              /(\d)-+/g,
              "$1"
            );
          } else {
            result = result.replace(/[^\d.]/g, "");
          }

          const firstDot = result.indexOf(".");

          if (firstDot !== -1) {
            const integerPart =
              result.slice(0, firstDot);

            const decimalPart =
              result
                .slice(firstDot + 1)
                .replace(/\./g, "")
                .slice(0, restriction.upto);

            result =
              `${integerPart}.${decimalPart}`;
          }

          break;
        }

        case RESTRICTIONS_KEYS.PHONE:
          result = result
            .replace(/[^\d+\-\s()]/g, "")
            .replace(/(?!^)\+/g, "");
          break;

        default:
          break;
      }
    }

    return result;
  };

  const handleInputChange = (
    event:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLTextAreaElement>
  ) => {
    const restrictedValue = applyRestrictions(
      event.target.value
    );

    if (event.target.value !== restrictedValue) {
      event.target.value = restrictedValue;
    }

    onChange?.(event);
  };

  const containerClasses = [
    "sila-input-group",
    hasError ? "sila-input-group--error" : "",
    disabled ? "sila-input-group--disabled" : "",
    isTextarea ? "sila-input-group--textarea" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div className="sila-input__field-wrapper">

        {isTextarea ? (
          <textarea
            {...textareaProps}
            id={inputId}
            className="sila-input__field sila-input__textarea"
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            onChange={handleInputChange}
            aria-invalid={hasError}
            aria-describedby={
              error
                ? `${inputId}-error`
                : infoText
                  ? `${inputId}-info`
                  : undefined
            }
          />
        ) : (
          <input
            id={inputId}
            className="sila-input__field"
            type={inputType}
            disabled={disabled}
            value={value}
            defaultValue={defaultValue}
            onChange={handleInputChange}
            aria-invalid={hasError}
            aria-describedby={
              error
                ? `${inputId}-error`
                : infoText
                  ? `${inputId}-info`
                  : undefined
            }
            {...rest}
          />
        )}

        {label && (
          <label
            htmlFor={inputId}
            className="sila-input__label"
          >
            {label}

            {required && (
              <span className="sila-input__required">
                *
              </span>
            )}
          </label>
        )}

        {type === "password" && !isTextarea && (
          <button
            type="button"
            className="sila-input__password-toggle"
            onClick={() =>
              setShowPassword((previous) => !previous)
            }
            disabled={disabled}
            aria-label={
              showPassword
                ? "Hide password"
                : "Show password"
            }
          >
            {showPassword ? (
              <FaEyeSlash />
            ) : (
              <FaEye />
            )}
          </button>
        )}
      </div>

      {error ? (
        <div
          id={`${inputId}-error`}
          className="sila-input__message sila-input__message--error"
          role="alert"
        >
          {errorIcon ?? <FaExclamationCircle />}

          <span title={String(error)}>
            {error}
          </span>
        </div>
      ) : infoText ? (
        <div
          id={`${inputId}-info`}
          className="sila-input__message sila-input__message--info"
        >
          {infoIcon ?? <FaInfoCircle />}

          <span title={String(infoText)}>
            {infoText}
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default Input;