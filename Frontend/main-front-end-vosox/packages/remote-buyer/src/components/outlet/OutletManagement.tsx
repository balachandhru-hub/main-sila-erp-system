import React, { useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import type { MasterApprovalFlowDto } from "../../api/Buyerapi";
import { createOutlet, getOutlets, updateOutlet, type Outlet, type OutletWrite } from "../../api/outletApi";
import { getProperties, getWeeklyBucketApprovalFlows, type Property } from "../../api/propertyApi";
import PropertyPanel from "./PropertyPanel";

interface OutletManagementProps {
  buyerId: string;
}

interface OutletForm {
  outletName: string;
  outletCode: string;
  propertyId: string;
  storageLocation: string;
}

const EMPTY_FORM: OutletForm = { outletName: "", outletCode: "", propertyId: "", storageLocation: "" };

const blank = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

/**
 * Buyer administrator screen: the properties of the organization (with the approval flow of their weekly
 * bucket) and the outlets, each a storage location of one property.
 */
const OutletManagement: React.FC<OutletManagementProps> = ({ buyerId }) => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [flows, setFlows] = useState<MasterApprovalFlowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // null = list only; "new" = create form; otherwise the outlet being edited.
  const [editing, setEditing] = useState<Outlet | "new" | null>(null);
  const [form, setForm] = useState<OutletForm>(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [outletRows, propertyRows, flowRows] = await Promise.all([
        getOutlets(),
        getProperties(),
        getWeeklyBucketApprovalFlows(buyerId),
      ]);
      setOutlets(outletRows);
      setProperties(propertyRows);
      setFlows(flowRows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load outlets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (buyerId) load();
  }, [buyerId]);

  const setField = (field: keyof OutletForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing("new");
  };

  const openEdit = (outlet: Outlet) => {
    setForm({
      outletName: outlet.outletName,
      outletCode: outlet.outletCode ?? "",
      propertyId: outlet.propertyId ?? "",
      storageLocation: outlet.storageLocation ?? "",
    });
    setEditing(outlet);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!form.outletName.trim()) {
      toastService.error("Enter an outlet name.");
      return;
    }
    if (!form.propertyId) {
      toastService.error("Select the property of the outlet.");
      return;
    }

    // Fields this form does not edit keep their saved values.
    const existing = editing === "new" ? null : editing;
    const payload: OutletWrite = {
      outletName: form.outletName.trim(),
      outletCode: blank(form.outletCode),
      description: existing?.description ?? null,
      externalShipTo: existing?.externalShipTo ?? null,
      addressLine1: existing?.addressLine1 ?? null,
      city: existing?.city ?? null,
      country: existing?.country ?? null,
      propertyId: form.propertyId,
      storageLocation: blank(form.storageLocation),
    };

    setSaving(true);
    try {
      if (existing) {
        await updateOutlet(existing.id, payload);
        toastService.success("Outlet updated.");
      } else {
        await createOutlet(payload);
        toastService.success("Outlet created.");
      }
      setEditing(null);
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the outlet.");
    } finally {
      setSaving(false);
    }
  };

  if (!buyerId || loading) return <Loader size={24} message="Loading outlets..." />;
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Couldn't load outlets"
        description={error}
        action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
      />
    );
  }

  return (
    <>
      <PageHeader className="pud-page-header" title="Outlets" />

      <PropertyPanel properties={properties} flows={flows} onSaved={load} />

      {editing && (
        <form className="sila-card" onSubmit={handleSubmit}>
          <div className="sila-card-header">
            <h2 className="sila-card-title">{editing === "new" ? "New outlet" : "Edit outlet"}</h2>
          </div>
          <div className="sila-card-body">
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="outlet-name">Outlet name<span className="sila-required">*</span></label>
                <input id="outlet-name" className="sila-input" value={form.outletName} onChange={(event) => setField("outletName", event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="outlet-code">Outlet code</label>
                <input id="outlet-code" className="sila-input" value={form.outletCode} onChange={(event) => setField("outletCode", event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="outlet-property">Property<span className="sila-required">*</span></label>
                <select id="outlet-property" className="sila-select" value={form.propertyId} onChange={(event) => setField("propertyId", event.target.value)}>
                  <option value="">Select a property</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.propertyName}{property.plantCode ? ` (${property.plantCode})` : ""}
                    </option>
                  ))}
                </select>
                {properties.length === 0 && <span className="sila-help">Create a property first.</span>}
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="outlet-storage">Storage location</label>
                <input id="outlet-storage" className="sila-input" value={form.storageLocation} onChange={(event) => setField("storageLocation", event.target.value)} />
              </div>
            </div>
          </div>
          <div className="sila-card-footer">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
            <button type="submit" className="sila-btn sila-btn--primary" disabled={saving}>
              {saving ? "Saving..." : editing === "new" ? "Create outlet" : "Save outlet"}
            </button>
          </div>
        </form>
      )}

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Outlets</h2>
          {!editing && (
            <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={openCreate}>
              New outlet
            </button>
          )}
        </div>
        {outlets.length === 0 ? (
          <EmptyState title="No outlets yet" />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Outlet</th>
                  <th scope="col">Code</th>
                  <th scope="col">Property</th>
                  <th scope="col">Storage location</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((outlet) => (
                  <tr key={outlet.id}>
                    <td className="sila-cell-strong">{outlet.outletName}</td>
                    <td>{outlet.outletCode || "—"}</td>
                    <td>
                      {outlet.propertyName
                        ? `${outlet.propertyName}${outlet.plantCode ? ` (${outlet.plantCode})` : ""}`
                        : <span className="sila-badge sila-badge--warning">Not assigned</span>}
                    </td>
                    <td>{outlet.storageLocation || "—"}</td>
                    <td>
                      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => openEdit(outlet)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default OutletManagement;
