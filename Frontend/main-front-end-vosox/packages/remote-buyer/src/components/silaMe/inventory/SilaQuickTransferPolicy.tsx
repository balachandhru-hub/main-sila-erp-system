import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import {
  getQuickTransferPolicy,
  saveQuickTransferPolicy,
  type SilaQuickTransferPolicy as Policy,
} from "../../../api/silaMe/silaInventoryControlApi";
import "../silaMeTheme.css";
import "./SilaInventory.css";

interface SilaQuickTransferPolicyProps {
  /** MANAGE_SILA_MASTER_DATA: the form is read-only without it. */
  canManage?: boolean;
}

type FlagField =
  | "enabled"
  | "skipManagerApproval"
  | "outletToOutletAllowed"
  | "sourceConfirmationRequired"
  | "destinationConfirmationRequired"
  | "managerNotification";

type TypesField = "allowedSourceTypes" | "allowedDestinationTypes";

const LOCATION_TYPES = [
  { value: "STORE", label: "Store" },
  { value: "OUTLET", label: "Outlet" },
];

const FLAGS: { field: FlagField; label: string; help: string }[] = [
  { field: "enabled", label: "Quick transfers enabled", help: "Users may raise quick transfers." },
  { field: "skipManagerApproval", label: "Skip manager approval", help: "A quick transfer needs no approval of the source location." },
  { field: "outletToOutletAllowed", label: "Outlet to outlet allowed", help: "Quick transfers may go from one outlet to another outlet." },
  {
    field: "sourceConfirmationRequired",
    label: "Source confirms collected stock",
    help: "Stock recorded as already collected waits until the source confirms the handover.",
  },
  {
    field: "destinationConfirmationRequired",
    label: "Destination confirms receipt",
    help: "A dispatched quick transfer waits until the destination receives it. Off: the stock is posted to the destination at once.",
  },
  { field: "managerNotification", label: "Notify the source managers", help: "Every quick transfer raises an alert for the source location." },
];

/** The organization's quick-transfer policy. */
const SilaQuickTransferPolicy: React.FC<SilaQuickTransferPolicyProps> = ({ canManage = true }) => {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [maximum, setMaximum] = useState("");
  const [maximumValue, setMaximumValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getQuickTransferPolicy();
      setPolicy(data);
      setMaximum(data.maximumQuantity === null || data.maximumQuantity === undefined ? "" : String(data.maximumQuantity));
      setMaximumValue(data.maximumValue === null || data.maximumValue === undefined ? "" : String(data.maximumValue));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the quick-transfer policy.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!policy) return;
    const value = maximum.trim() === "" ? null : Number(maximum);
    if (value !== null && (Number.isNaN(value) || value <= 0)) {
      toastService.error("Enter a maximum greater than zero, or leave it empty for no limit.");
      return;
    }
    const valueLimit = maximumValue.trim() === "" ? null : Number(maximumValue);
    if (valueLimit !== null && (Number.isNaN(valueLimit) || valueLimit <= 0)) {
      toastService.error("Enter a maximum value greater than zero, or leave it empty for no limit.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveQuickTransferPolicy({ ...policy, maximumQuantity: value, maximumValue: valueLimit });
      setPolicy(saved);
      toastService.success("Quick-transfer policy saved.");
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the quick-transfer policy.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sila-me sinv-page">
      <PageHeader
        className="pud-page-header"
        title="Quick Transfer Policy"
        description="Limits and confirmation rules for inventory quick transfers."
      />
      {loading ? (
        <Loader size={24} message="Loading the policy..." />
      ) : error || !policy ? (
        <EmptyState
          variant="error"
          title="Couldn't load the policy"
          description={error ?? undefined}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : (
        <section className="sila-card">
          <form
            className="sila-card-body sinv-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
            }}
          >
            {FLAGS.map((flag) => (
              <div key={flag.field} className="sila-field">
                <label className="sila-choice" htmlFor={`sinv-policy-${flag.field}`}>
                  <input
                    id={`sinv-policy-${flag.field}`}
                    type="checkbox"
                    checked={policy[flag.field] ?? (flag.field === "destinationConfirmationRequired")}
                    disabled={!canManage || saving}
                    onChange={(event) => setPolicy({ ...policy, [flag.field]: event.target.checked })}
                  />
                  {flag.label}
                </label>
                <span className="sila-help">{flag.help}</span>
              </div>
            ))}
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-policy-maximum">Maximum quantity per line</label>
              <input
                id="sinv-policy-maximum"
                className="sila-input sinv-qty-input"
                type="number"
                min={0}
                step="any"
                value={maximum}
                disabled={!canManage || saving}
                onChange={(event) => setMaximum(event.target.value)}
              />
              <span className="sila-help">In the base unit of the material. Empty means no limit.</span>
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-policy-maximum-value">Maximum value per transfer</label>
              <input
                id="sinv-policy-maximum-value"
                className="sila-input sinv-qty-input"
                type="number"
                min={0}
                step="any"
                value={maximumValue}
                disabled={!canManage || saving}
                onChange={(event) => setMaximumValue(event.target.value)}
              />
              <span className="sila-help">Quantity x unit cost of all lines. Empty means no limit.</span>
            </div>
            {(["allowedSourceTypes", "allowedDestinationTypes"] as TypesField[]).map((field) => (
              <fieldset key={field} className="sila-field">
                <legend className="sila-label">{field === "allowedSourceTypes" ? "Allowed source types" : "Allowed destination types"}</legend>
                <div className="sinv-inline">
                  {LOCATION_TYPES.map((type) => {
                    const selected = policy[field] ?? [];
                    // Empty means every type is allowed.
                    const checked = selected.length === 0 || selected.includes(type.value);
                    return (
                      <label key={type.value} className="sila-choice">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canManage || saving}
                          onChange={(event) => {
                            const current = selected.length === 0 ? LOCATION_TYPES.map((item) => item.value) : selected;
                            const next = event.target.checked
                              ? Array.from(new Set([...current, type.value]))
                              : current.filter((value) => value !== type.value);
                            if (next.length === 0) {
                              toastService.error("Keep at least one location type.");
                              return;
                            }
                            setPolicy({ ...policy, [field]: next.length === LOCATION_TYPES.length ? [] : next });
                          }}
                        />
                        {type.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <p className="sila-help">Quick transfers stay within one property: moving stock across properties is never allowed.</p>
            {canManage && (
              <div className="sila-form-actions">
                <button type="submit" className="sila-btn sila-btn--primary" disabled={saving}>
                  {saving ? "Saving..." : "Save policy"}
                </button>
              </div>
            )}
          </form>
        </section>
      )}
    </div>
  );
};

export default SilaQuickTransferPolicy;
