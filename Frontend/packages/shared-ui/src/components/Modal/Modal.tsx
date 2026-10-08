import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../Button';
import type { ModalButtonProps, ModalProps } from './Modal.types';
import './Modal.css';

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const IconWarning = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const IconInfo = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-5M12 8h.01" />
  </svg>
);

const VARIANT_ICONS: Partial<Record<NonNullable<ModalProps['variant']>, React.ReactNode>> = {
  info: <IconInfo />,
  warning: <IconWarning />,
  danger: <IconWarning />,
};

const ModalFooterButton: React.FC<ModalButtonProps> = ({ text, ...buttonProps }) => (
  <Button {...buttonProps}>{text}</Button>
);

/** Accessible dialog: portalled to body, focuses on open, restores focus on close. Single reusable Modal for info/warning/danger/confirmation content. */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  headerProps,
  bodyProps,
  footerProps,
  variant = 'default',
  size = 'md',
  style,
}) => {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { heading, subHeading, customHeader, disableVariantStyle: headerIsPlain } = headerProps ?? {};
  const { content, contentDescription, customContent, disableVariantStyle: bodyIsPlain } = bodyProps ?? {};
  const { primaryButton, secondaryButton, disableVariantStyle: footerIsPlain } = footerProps ?? {};
  const hasFooter = Boolean(primaryButton || secondaryButton);
  const hasBodyContent = Boolean(customContent || content || contentDescription || children);

  const isHeaderTinted = variant !== 'default' && !headerIsPlain;
  const isBodyTinted = variant !== 'default' && !bodyIsPlain;
  const isFooterTinted = variant !== 'default' && !footerIsPlain;

  const variantIcon = isHeaderTinted ? VARIANT_ICONS[variant] : undefined;
  /** Only 'danger' has a matching color in the shared Button palette; info/warning keep the button's own/default color. */
  const autoPrimaryVariant = isFooterTinted && variant === 'danger' ? 'danger' : undefined;

  return createPortal(
    <div
      className="sila-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={`sila-modal sila-modal--${size}${isHeaderTinted ? ` sila-modal--${variant}` : ''}`}
        style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={customHeader ? undefined : titleId}
        aria-describedby={hasBodyContent ? bodyId : undefined}
        tabIndex={-1}
      >
        <div className="sila-modal-header">
          {customHeader ?? (
            <div className={`sila-modal-heading-group${subHeading ? '' : ' sila-modal-heading-group--center'}`}>
              {variantIcon && <span className="sila-modal-icon" aria-hidden="true">{variantIcon}</span>}
              <div>
                {heading && <h2 id={titleId} className="sila-modal-title">{heading}</h2>}
                {subHeading && <p className="sila-card-subtitle">{subHeading}</p>}
              </div>
            </div>
          )}
          <button type="button" className="sila-icon-btn" onClick={onClose} aria-label="Close dialog">
            <IconClose />
          </button>
        </div>
        <div id={bodyId} className="sila-modal-body">
          {customContent ?? (
            <>
              {content && <div className="sila-modal-text">{content}</div>}
              {contentDescription && (
                <p className={`sila-modal-description${isBodyTinted ? ` sila-modal-description--${variant}` : ''}`}>
                  {contentDescription}
                </p>
              )}
              {!content && !contentDescription && children}
            </>
          )}
        </div>
        {hasFooter && (
          <div className="sila-modal-footer">
            {secondaryButton && <ModalFooterButton variant="secondary" {...secondaryButton} />}
            {primaryButton && (
              <ModalFooterButton {...(autoPrimaryVariant ? { variant: autoPrimaryVariant } : undefined)} {...primaryButton} />
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
