import type { WeeklyBucketListItem } from "../../../api/weeklyBucketApi";
import { formatCount } from "./attentionSources";

/** What the user does with the weekly bucket: adds requests, reviews it (administrator) or freezes it (store manager). */
export type BucketRole = "requester" | "reviewer" | "freezer" | null;

export interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  navKey: string;
}

interface SuggestionInput {
  buckets: WeeklyBucketListItem[] | null;
  bucketRole: BucketRole;
  invoicesToReview: number;
  hasSilaMe: boolean;
}

const bucketActions = (bucket: WeeklyBucketListItem | undefined, role: BucketRole): SuggestedAction[] => {
  if (!role) return [];
  const where = bucket?.propertyName ? ` for ${bucket.propertyName}` : "";
  if (!bucket || bucket.status === "PO_CREATED" || bucket.status === "APPROVED") {
    return role === "freezer"
      ? []
      : [{
          id: "bucket-start",
          label: "Start this week's requests",
          description: "Pick products from the catalog and add them to the weekly bucket.",
          navKey: "product",
        }];
  }
  if (bucket.status === "OPEN") {
    const lines = `${bucket.itemCount} line${bucket.itemCount === 1 ? "" : "s"}`;
    if (role === "freezer") {
      return [{ id: "bucket-freeze", label: `Review and freeze ${bucket.bucketCode}`, description: `${lines}${where} are waiting to be frozen.`, navKey: "weeklyBucket" }];
    }
    if (role === "reviewer") {
      return [{ id: "bucket-review", label: `Review ${bucket.bucketCode}`, description: `${lines}${where}: check stock, final quantities and materials.`, navKey: "weeklyBucket" }];
    }
    return [{ id: "bucket-add", label: `Add this week's requests to ${bucket.bucketCode}`, description: `${lines}${where} so far.`, navKey: "weeklyBucket" }];
  }
  if (bucket.status === "PO_FAILED" && role !== "requester") {
    return [{ id: "bucket-retry", label: `Retry purchase orders of ${bucket.bucketCode}`, description: "The ERP did not accept the purchase orders.", navKey: "weeklyBucket" }];
  }
  return [];
};

/** Next steps the user most likely has to take, from the state of their weekly bucket and invoices. */
export const buildSuggestedActions = ({ buckets, bucketRole, invoicesToReview, hasSilaMe }: SuggestionInput): SuggestedAction[] => {
  // Nothing is suggested about the bucket when the buckets could not be read.
  const actions = buckets ? bucketActions(buckets[0], bucketRole) : [];
  if (hasSilaMe && invoicesToReview > 0) {
    actions.push({
      id: "invoices-review",
      label: `Review ${formatCount(invoicesToReview)} invoice${invoicesToReview === 1 ? "" : "s"} read by OCR`,
      description: "Check the extracted fields, then receive the goods.",
      navKey: "silaInvoices",
    });
  }
  if (actions.length === 0) {
    actions.push(
      { id: "rfq-create", label: "Create an RFQ", description: "Source a new requirement from your suppliers.", navKey: "createRFQ" },
      { id: "catalog-browse", label: "Browse the product catalog", description: "Find products from your suppliers' catalogs.", navKey: "product" },
    );
  }
  return actions;
};
