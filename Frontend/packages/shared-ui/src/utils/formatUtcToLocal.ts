// The API returns UTC timestamps, sometimes without a "Z"/offset suffix, which
// JS would otherwise parse as local time. Treat offset-less values as UTC and
// render them in the user's system time zone.
export const formatUtcToLocal = (value?: string | null): string => {
  if (!value) return "—";
  const hasTimeZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasTimeZone ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
};
