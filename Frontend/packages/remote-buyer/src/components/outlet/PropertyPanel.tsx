import React, { useState } from "react";
import { EmptyState, toastService } from "@vosox/shared-ui";
import type { MasterApprovalFlowDto } from "../../api/Buyerapi";
import { createProperty, updateProperty, type Property, type PropertyWrite } from "../../api/propertyApi";

interface PropertyPanelProps {
  properties: Property[];
  /** Approval flows of type WEEKLY_BUCKET. */
  flows: MasterApprovalFlowDto[];
  /** A property was created or changed. */
  onSaved: () => void;
}

interface PropertyForm {
  companyCode: string;
  plantCode: string;
  propertyName: string;
  masterApprovalFlowId: string;
}

const EMPTY_FORM: PropertyForm = { companyCode: "", plantCode: "", propertyName: "", masterApprovalFlowId: "" };

/** Properties (plants) of the organization and the approval flow each one's weekly bucket uses. */
const PropertyPanel: React.FC<PropertyPanelProps> = ({ properties, flows, onSaved }) => {
  // null = list only; "new" = create form; otherwise the property being edited.
  const [editing, setEditing] = useState<Property | "new" | null>(null);
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const setField = (field: keyof PropertyForm, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing("new");
  };

  const openEdit = (property: Property) => {
    setForm({
      companyCode: property.companyCode ?? "",
      plantCode: property.plantCode ?? "",
      propertyName: property.propertyName ?? "",
      masterApprovalFlowId: property.masterApprovalFlowId ?? "",
    });
    setEditing(property);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    if (!form.companyCode.trim() || !form.plantCode.trim() || !form.propertyName.trim()) {
      toastService.error("Enter the company code, plant code and property name.");
      return;
    }

    const payload: PropertyWrite = {
      companyCode: form.companyCode.trim(),
      plantCode: form.plantCode.trim(),
      propertyName: form.propertyName.trim(),
      masterApprovalFlowId: form.masterApprovalFlowId || null,
    };

    setSaving(true);
    try {
      if (editing === "new") {
        await createProperty(payload);
        toastService.success("Property created.");
      } else {
        await updateProperty(editing.id, payload);
        toastService.success("Property updated.");
      }
      setEditing(null);
      onSaved();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the property.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {editing && (
        <form className="sila-card" onSubmit={handleSubmit}>
          <div className="sila-card-header">
            <h2 className="sila-card-title">{editing === "new" ? "New property" : "Edit property"}</h2>
          </div>
          <div className="sila-card-body">
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="property-name">Property name<span className="sila-required">*</span></label>
                <input id="property-name" className="sila-input" value={form.propertyName} onChange={(event) => setField("propertyName", event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="property-plant">Plant code<span className="sila-required">*</span></label>
                <input id="property-plant" className="sila-input" value={form.plantCode} onChange={(event) => setField("plantCode", event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="property-company">Company code<span className="sila-required">*</span></label>
                <input id="property-company" className="sila-input" value={form.companyCode} onChange={(event) => setField("companyCode", event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="property-flow">Weekly Bucket approval flow</label>
                <select id="property-flow" className="sila-select" value={form.masterApprovalFlowId} onChange={(event) => setField("masterApprovalFlowId", event.target.value)}>
                  <option value="">No approval flow</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id}>{flow.approvalName || flow.approvalCode}</option>
                  ))}
                </select>
                {flows.length === 0 && (
                  <span className="sila-help">Create an approval flow of type WEEKLY_BUCKET in Approval Management first.</span>
                )}
              </div>
            </div>
          </div>
          <div className="sila-card-footer">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</button>
            <button type="submit" className="sila-btn sila-btn--primary" disabled={saving}>
              {saving ? "Saving..." : editing === "new" ? "Create property" : "Save property"}
            </button>
          </div>
        </form>
      )}

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Properties</h2>
          {!editing && (
            <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={openCreate}>
              New property
            </button>
          )}
        </div>
        {properties.length === 0 ? (
          <EmptyState title="No properties yet" />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Plant code</th>
                  <th scope="col">Company code</th>
                  <th scope="col">Weekly Bucket approval flow</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td className="sila-cell-strong">{property.propertyName}</td>
                    <td>{property.plantCode || "—"}</td>
                    <td>{property.companyCode || "—"}</td>
                    <td>
                      {property.approvalName || (
                        <span className="sila-badge sila-badge--warning">Not assigned</span>
                      )}
                    </td>
                    <td>
                      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => openEdit(property)}>
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

export default PropertyPanel;
