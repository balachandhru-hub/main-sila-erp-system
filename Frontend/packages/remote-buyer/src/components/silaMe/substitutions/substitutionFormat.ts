const LABELS: Record<string, string> = {
  PROPOSED: "Open",
  ACCEPTED: "Accepted",
  DISMISSED: "Dismissed",
};

export const substitutionLabel = (status?: string | null): string => (status ? LABELS[status] ?? status : "—");

export const substitutionBadgeClass = (status?: string | null): string => {
  switch (status) {
    case "PROPOSED":
      return "sila-badge sila-badge--warning";
    case "ACCEPTED":
      return "sila-badge sila-badge--success";
    default:
      return "sila-badge sila-badge--neutral";
  }
};
