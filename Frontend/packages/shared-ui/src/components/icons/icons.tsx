import { createIcon } from './createIcon';

/* Shared stroke icons. Default sizes match how each icon is most commonly used; pass `size` to change. */

/* ---- Navigation / sections (18px) ---- */

export const HomeIcon = createIcon(
  'HomeIcon',
  <>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </>,
  { size: 18 },
);

export const BuildingIcon = createIcon(
  'BuildingIcon',
  <>
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
  </>,
  { size: 18 },
);

export const LayoutGridIcon = createIcon(
  'LayoutGridIcon',
  <>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </>,
  { size: 18 },
);

export const MoreHorizontalIcon = createIcon(
  'MoreHorizontalIcon',
  <>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </>,
  { size: 18 },
);

export const LayoutTemplateIcon = createIcon(
  'LayoutTemplateIcon',
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18" />
    <path d="M9 3v18" />
  </>,
  { size: 18 },
);

/* ---- Files (18px) ---- */

export const FileIcon = createIcon(
  'FileIcon',
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </>,
  { size: 18 },
);

export const FileTextIcon = createIcon(
  'FileTextIcon',
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h8M8 9h2" />
  </>,
  { size: 18 },
);

export const FilePlusIcon = createIcon(
  'FilePlusIcon',
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M12 12v6M9 15h6" />
  </>,
  { size: 18 },
);

export const FileCheckIcon = createIcon(
  'FileCheckIcon',
  <>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="m9 15 2 2 4-4" />
  </>,
  { size: 18 },
);

/* ---- Actions (16-18px) ---- */

export const CloseIcon = createIcon(
  'CloseIcon',
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>,
  { size: 18, strokeWidth: 2.5 },
);

export const ArrowLeftIcon = createIcon('ArrowLeftIcon', <path d="M19 12H5M12 19l-7-7 7-7" />, { size: 18 });

export const SearchIcon = createIcon(
  'SearchIcon',
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </>,
  { size: 18 },
);

export const FilterIcon = createIcon(
  'FilterIcon',
  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  { size: 18 },
);

export const EyeIcon = createIcon(
  'EyeIcon',
  <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const MessageSquareIcon = createIcon(
  'MessageSquareIcon',
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
);

export const SendIcon = createIcon(
  'SendIcon',
  <>
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </>,
);

export const ExternalLinkIcon = createIcon(
  'ExternalLinkIcon',
  <>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </>,
);

export const LoaderIcon = createIcon(
  'LoaderIcon',
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </>,
);

export const CheckIcon = createIcon('CheckIcon', <path d="M20 6 9 17l-5-5" />, { strokeWidth: 2.5 });

export const ChevronLeftIcon = createIcon('ChevronLeftIcon', <polyline points="15 18 9 12 15 6" />);

export const ChevronRightIcon = createIcon('ChevronRightIcon', <polyline points="9 18 15 12 9 6" />);

/* ---- Small inline glyphs (14px) ---- */

export const CalendarIcon = createIcon(
  'CalendarIcon',
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
  { size: 14 },
);

export const MapPinIcon = createIcon(
  'MapPinIcon',
  <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>,
  { size: 14 },
);

export const GlobeIcon = createIcon(
  'GlobeIcon',
  <>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </>,
  { size: 14 },
);

export const ShieldCheckIcon = createIcon(
  'ShieldCheckIcon',
  <>
    <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z" />
    <path d="m9 12 2 2 4-4" />
  </>,
  { size: 14 },
);

/* ---- Decorative (20px) ---- */

export const SparklesIcon = createIcon(
  'SparklesIcon',
  <>
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4M3 5h4M19 3v4M17 5h4M5 19v4M3 21h4M19 19v4M17 21h4" />
  </>,
  { size: 20 },
);
