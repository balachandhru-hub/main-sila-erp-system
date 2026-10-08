import React, { useMemo, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import type { WeeklyBucketDetail, WeeklyBucketItem } from "../../api/weeklyBucketApi";
import type { CreatePurchaseOrderRequest } from "../../api/purchaseOrderApi";
import { isExcludedOnFreeze } from "./weeklyBucketStatus";

interface QuickPoDialogProps {
  bucket: WeeklyBucketDetail;
  submitting: boolean;
  onSubmit: (requests: CreatePurchaseOrderRequest[]) => void;
  onClose: () => void;
}

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  items: WeeklyBucketItem[];
}

const todayPlus = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Asks for the ERP details the bucket does not hold, then creates one purchase order per supplier. */
const QuickPoDialog: React.FC<QuickPoDialogProps> = ({ bucket, submitting, onSubmit, onClose }) => {
  const [purchasingOrganization, setPurchasingOrganization] = useState("");
  const [purchasingGroup, setPurchasingGroup] = useState("");
  const [purchaseOrderType, setPurchaseOrderType] = useState("NB");
  const [deliveryDate, setDeliveryDate] = useState(todayPlus(7));
  const [supplierCodes, setSupplierCodes] = useState<Record<string, string>>({});

  const groups = useMemo(() => {
    const bySupplier = new Map<string, SupplierGroup>();
    bucket.items
      .filter((item) => !isExcludedOnFreeze(item))
      .forEach((item) => {
        const group = bySupplier.get(item.supplierId) ?? { supplierId: item.supplierId, supplierName: item.supplierName || "Supplier", items: [] };
        group.items.push(item);
        bySupplier.set(item.supplierId, group);
      });
    return Array.from(bySupplier.values());
  }, [bucket.items]);

  const handleSubmit = () => {
    const missing: string[] = [];
    if (!purchasingOrganization.trim()) missing.push("Purchasing organization");
    if (!purchasingGroup.trim()) missing.push("Purchasing group");
    if (!purchaseOrderType.trim()) missing.push("Purchase order type");
    if (!deliveryDate) missing.push("Delivery date");
    groups.forEach((group) => {
      if (!(supplierCodes[group.supplierId] ?? "").trim()) missing.push(`Supplier code for ${group.supplierName}`);
    });
    if (missing.length > 0) {
      toastService.error(`Please fill in: ${missing.join(", ")}.`);
      return;
    }
    const unmapped = groups.flatMap((group) => group.items).filter((item) => !item.materialCode);
    if (unmapped.length > 0) {
      toastService.error(`Map a material first: ${unmapped.map((item) => item.productName).join(", ")}.`);
      return;
    }

    onSubmit(
      groups.map((group) => ({
        supplierId: group.supplierId,
        supplierCode: supplierCodes[group.supplierId].trim(),
        companyCode: bucket.companyCode ?? "",
        plantCode: bucket.plantCode ?? "",
        currency: group.items.find((item) => item.currency)?.currency ?? "",
        purchasingOrganization: purchasingOrganization.trim(),
        purchasingGroup: purchasingGroup.trim(),
        purchaseOrderType: purchaseOrderType.trim(),
        deliveryDate,
        lines: group.items.map((item) => ({
          materialCode: item.materialCode ?? "",
          description: item.description || item.productName,
          quantity: item.approvedQuantity ?? item.requestedQuantity,
          unitOfMeasure: item.unitOfMeasure ?? "",
          unitPrice: item.price ?? 0,
        })),
      })),
    );
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      headerProps={{ heading: "Quick PO", subHeading: `Bucket ${bucket.bucketCode}. One purchase order is created per supplier.` }}
      footerProps={{
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: submitting },
        primaryButton: { text: "Create purchase orders", onClick: handleSubmit, loading: submitting, disabled: groups.length === 0 },
      }}
    >
      <div className="sila-root wb-dialog">
        {groups.length === 0 && <span className="sila-help">There are no lines to order.</span>}
        <div className="sila-field">
          <label className="sila-label" htmlFor="qpo-org">Purchasing organization<span className="sila-required" aria-hidden="true">*</span></label>
          <input id="qpo-org" className="sila-input" value={purchasingOrganization} disabled={submitting} onChange={(event) => setPurchasingOrganization(event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="qpo-group">Purchasing group<span className="sila-required" aria-hidden="true">*</span></label>
          <input id="qpo-group" className="sila-input" value={purchasingGroup} disabled={submitting} onChange={(event) => setPurchasingGroup(event.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="qpo-type">Purchase order type<span className="sila-required" aria-hidden="true">*</span></label>
          <input id="qpo-type" className="sila-input" value={purchaseOrderType} disabled={submitting} onChange={(event) => setPurchaseOrderType(event.target.value)} />
          <span className="sila-help">For example NB</span>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="qpo-date">Delivery date<span className="sila-required" aria-hidden="true">*</span></label>
          <input id="qpo-date" className="sila-input" type="date" value={deliveryDate} disabled={submitting} onChange={(event) => setDeliveryDate(event.target.value)} />
        </div>
        {groups.map((group) => (
          <div className="sila-field" key={group.supplierId}>
            <label className="sila-label" htmlFor={`qpo-supplier-${group.supplierId}`}>
              Supplier code — {group.supplierName} ({group.items.length} {group.items.length === 1 ? "line" : "lines"})
              <span className="sila-required" aria-hidden="true">*</span>
            </label>
            <input
              id={`qpo-supplier-${group.supplierId}`}
              className="sila-input"
              value={supplierCodes[group.supplierId] ?? ""}
              disabled={submitting}
              onChange={(event) => setSupplierCodes((current) => ({ ...current, [group.supplierId]: event.target.value }))}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default QuickPoDialog;
