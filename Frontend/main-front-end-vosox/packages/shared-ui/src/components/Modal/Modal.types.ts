import type { CSSProperties, ReactNode } from 'react';
import type { ButtonProps } from '../Button';

export type ModalVariant = 'default' | 'info' | 'warning' | 'danger';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalHeaderProps {
  /** Default header title. Ignored when customHeader is provided. */
  heading?: ReactNode;
  /** Optional line under the heading. Ignored when customHeader is provided. */
  subHeading?: ReactNode;
  /** Replaces the default heading/subHeading with fully custom header content. */
  customHeader?: ReactNode;
  /** Keeps the header neutral even when the modal has a non-default variant. */
  disableVariantStyle?: boolean;
}

/** Default body content. Ignored when customContent is provided. */
export interface ModalBodyProps {
  /** Main body content. */
  content?: ReactNode;
  /** Secondary line below content, e.g. a destructive-action warning. Colored by the modal variant. */
  contentDescription?: ReactNode;
  /** Replaces the default content/contentDescription with fully custom body content. */
  customContent?: ReactNode;
  /** Keeps contentDescription neutral even when the modal has a non-default variant. */
  disableVariantStyle?: boolean;
}

/** Button config for a footer slot: reuses the shared Button's own props (variant, loading, disabled, etc). */
export interface ModalButtonProps extends Omit<ButtonProps, 'children'> {
  text: string;
}

export interface ModalFooterProps {
  primaryButton?: ModalButtonProps;
  secondaryButton?: ModalButtonProps;
  /** Keeps primaryButton's own/default color even when the modal has a non-default variant. */
  disableVariantStyle?: boolean;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Body content. Ignored when bodyProps (content/contentDescription/customContent) is provided. */
  children?: ReactNode;
  headerProps?: ModalHeaderProps;
  bodyProps?: ModalBodyProps;
  footerProps?: ModalFooterProps;
  /** Visual treatment communicating the purpose of the modal. */
  variant?: ModalVariant;
  size?: ModalSize;
  /** Inline style on the modal panel. Use to override the default width, e.g. { maxWidth: 900 }. */
  style?: CSSProperties;
}
