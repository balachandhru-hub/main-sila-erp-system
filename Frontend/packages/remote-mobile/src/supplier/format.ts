export const formatWhen = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDay = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatMoney = (amount?: number | null, currency?: string | null): string => {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const formatted = Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${formatted} ${currency}` : formatted;
};

export const labelOf = (value?: string | null): string => {
  if (!value) return '—';
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split('_')
    .join(' ');
};

export const CLOUD_LATER = 'This capability will be available once the Cloud service is connected.';
