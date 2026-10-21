import React from 'react';

type IconProps = { className?: string; title?: string };

const Svg: React.FC<IconProps & { children: React.ReactNode; viewBox?: string }> = ({
  className,
  title,
  children,
  viewBox = '0 0 24 24',
}) => (
  <svg
    className={className}
    viewBox={viewBox}
    width="1em"
    height="1em"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden={title ? undefined : true}
    role={title ? 'img' : undefined}
  >
    {title ? <title>{title}</title> : null}
    {children}
  </svg>
);

export const IconHome = (props: IconProps) => (
  <Svg {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 10v10h14V10" />
  </Svg>
);

export const IconReceive = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M4 21h16" />
  </Svg>
);

export const IconInventory = (props: IconProps) => (
  <Svg {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Svg>
);

export const IconTasks = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 11.5 11 13.5 15.5 9" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </Svg>
);

export const IconMore = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </Svg>
);

export const IconScan = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 4H5a1 1 0 0 0-1 1v2" />
    <path d="M17 4h2a1 1 0 0 1 1 1v2" />
    <path d="M7 20H5a1 1 0 0 1-1-1v-2" />
    <path d="M17 20h2a1 1 0 0 0 1-1v-2" />
    <path d="M8 12h8" />
  </Svg>
);

export const IconSuppliers = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 21V8l5-4 5 4v13" />
    <path d="M10 21v-6h4v6" />
  </Svg>
);

export const IconTransfer = (props: IconProps) => (
  <Svg {...props}>
    <path d="M7 7h12" />
    <path d="m15 3 4 4-4 4" />
    <path d="M17 17H5" />
    <path d="m9 13-4 4 4 4" />
  </Svg>
);

export const IconCount = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 11.5 11 13.5 15.5 9" />
    <path d="M8 4h8l1 3H7l1-3Z" />
    <path d="M6 7h12v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7Z" />
  </Svg>
);

export const IconQuickTransfer = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h12" />
    <path d="m13 7 5 5-5 5" />
  </Svg>
);

export const IconRecipes = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 4h9a3 3 0 0 1 3 3v13H8a2 2 0 0 0-2 2V4Z" />
    <path d="M10 8h6" />
    <path d="M10 12h6" />
    <path d="M10 16h4" />
  </Svg>
);

export const IconApprovals = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export type MobileIconName =
  | 'home'
  | 'receive'
  | 'inventory'
  | 'tasks'
  | 'more'
  | 'scan'
  | 'suppliers'
  | 'transfer'
  | 'count'
  | 'quickTransfer'
  | 'recipes'
  | 'approvals'
  | 'purchaseOrders';

const ICONS: Record<MobileIconName, React.FC<IconProps>> = {
  home: IconHome,
  receive: IconReceive,
  inventory: IconInventory,
  tasks: IconTasks,
  more: IconMore,
  scan: IconScan,
  suppliers: IconSuppliers,
  transfer: IconTransfer,
  count: IconCount,
  quickTransfer: IconQuickTransfer,
  recipes: IconRecipes,
  approvals: IconApprovals,
  purchaseOrders: IconMore,
};

/** Stroke icons that always inherit SILA blue via currentColor. */
export const MobileIcon: React.FC<IconProps & { name: MobileIconName }> = ({ name, ...props }) => {
  const Icon = ICONS[name];
  return <Icon {...props} />;
};
