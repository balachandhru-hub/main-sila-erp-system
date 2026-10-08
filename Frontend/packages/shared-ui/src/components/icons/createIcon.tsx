import React from 'react';

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, 'ref'> & {
  /** Sets both width and height. Each icon has its own default. */
  size?: number;
};

interface IconDefaults {
  size?: number;
  strokeWidth?: number;
}

/**
 * Builds a 24x24 stroke icon. Icons are decorative by default (aria-hidden);
 * any svg prop (className, aria-label, width, ...) can be passed to override.
 */
export const createIcon = (
  displayName: string,
  children: React.ReactNode,
  defaults: IconDefaults = {},
): React.FC<IconProps> => {
  const Icon: React.FC<IconProps> = ({
    size = defaults.size ?? 16,
    strokeWidth = defaults.strokeWidth ?? 2,
    ...props
  }) => (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
  Icon.displayName = displayName;
  return Icon;
};
