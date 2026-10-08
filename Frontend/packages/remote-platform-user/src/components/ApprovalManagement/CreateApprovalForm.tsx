import React, { useEffect, useState } from "react";
import "./CreateApprovalForm.css";
import { FaTimes } from "react-icons/fa";
import { toastService, Dropdown } from "@vosox/shared-ui";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "@vosox/shared-ui";
import type { OrganizationUserDto } from "../../dto/networkAdminDto";
import {
  createMasterApprovalFlow,
  fetchApprovalTypes,
  fetchApprovalUsers,
  fetchCurrencies,
  fetchScopeOptions,
  APPROVAL_SCOPE_KINDS,
  SCOPED_APPROVAL_TYPES,
  type CurrencyOption,
  type ScopeOption,
} from "./approvalManagementApi";

interface CreateApprovalFormProps {
  organizationId: string | null;
  onClose: () => void;
  onCreated: () => void;
}

interface FormState {
  approvalCode: string;
  approvalName: string;
  type: string;
  totalAmount: string;
  currency: string;
}

const AMOUNT_APPROVAL_TYPE = "CONTRACT_CREATE";

// Page size used by the async (paginated) Currency Dropdown
const CURRENCY_PAGE_SIZE = 40;

const EMPTY_FORM: FormState = { approvalCode: "", approvalName: "", type: "", totalAmount: "", currency: "" };

const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);

const IconArrow = ({ up }: { up?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
  </svg>
);

const CreateApprovalForm: React.FC<CreateApprovalFormProps> = ({ organizationId, onClose, onCreated }) => {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [users, setUsers] = useState<OrganizationUserDto[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DropdownValue | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<DropdownValue | null>(null);
  const [selectedApprover, setSelectedApprover] = useState<DropdownValue | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<OrganizationUserDto[]>([]);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "users" | "scope", string>>>({});
  const [scopeKind, setScopeKind] = useState("ALL");
  const [scopeValue, setScopeValue] = useState("");
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  // ---- Async loader for the Type Dropdown (reference-list API has no paging or search, so search client-side) ----
  const loadTypeOptions = async ({ search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    try {
      const types = await fetchApprovalTypes();
      if (!types.some((type) => type.key.toUpperCase() === "WEEKLY_BUCKET")) {
        types.push({
          id: "WEEKLY_BUCKET",
          key: "WEEKLY_BUCKET",
          type: "APPROVAL_TYPE",
          description: "Weekly Bucket",
        });
      }
      if (!types.some((type) => type.key.toUpperCase() === "RECIPE")) {
        types.push({
          id: "RECIPE",
          key: "RECIPE",
          type: "APPROVAL_TYPE",
          description: "Recipe approval",
        });
      }
      if (!types.some((type) => type.key.toUpperCase() === "MATERIAL_PRICE")) {
        types.push({
          id: "MATERIAL_PRICE",
          key: "MATERIAL_PRICE",
          type: "APPROVAL_TYPE",
          description: "Material price approval",
        });
      }
      const term = search.trim().toLowerCase();
      return {
        options: types
          .filter((t) => !term || t.key.toLowerCase().includes(term))
          .map((t) => ({ name: t.key, value: t.key })),
        hasMore: false,
      };
    } catch (err: any) {
      toastService.error(err?.message || "Failed to load approval types");
      return { options: [], hasMore: false };
    }
  };

  // ---- Async paginated loader for the Currency Dropdown (server has no search param, so search client-side) ----
  // `index` is an offset: 0, then 0 + 40, then 0 + 40 + 40, ...
  const loadCurrencyOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const toOption = (c: CurrencyOption) => ({ name: c.currencyName, value: c.currencyName });
    const term = search.trim().toLowerCase();
    try {
      if (term) {
        // Page through every currency so a match on a later page isn't missed, then filter here
        const matches: CurrencyOption[] = [];
        let index = 0;
        let items: CurrencyOption[];
        do {
          items = await fetchCurrencies(index, CURRENCY_PAGE_SIZE);
          matches.push(...items.filter((c) => c.currencyName.toLowerCase().includes(term)));
          index += items.length;
        } while (items.length === CURRENCY_PAGE_SIZE);
        return { options: matches.map(toOption), hasMore: false };
      }
      const items = await fetchCurrencies(page * CURRENCY_PAGE_SIZE, CURRENCY_PAGE_SIZE);
      return { options: items.map(toOption), hasMore: items.length === CURRENCY_PAGE_SIZE };
    } catch (err: any) {
      toastService.error(err?.message || "Failed to load currencies");
      return { options: [], hasMore: false };
    }
  };

  // ---- Async loader for the Approver Dropdown (loads on open, filters out already-selected users) ----
  const loadApproverOptions = async ({ search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!organizationId) {
      setUsersError("Organization information is not available. Please log in again.");
      return { options: [], hasMore: false };
    }
    try {
      const fetchedUsers = await fetchApprovalUsers(organizationId);
      setUsers(fetchedUsers);
      setUsersError(null);
      const term = search.trim().toLowerCase();
      const available = fetchedUsers.filter(
        (u) =>
          !selectedUsers.some((s) => s.userId === u.userId) &&
          (!term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
      );
      return {
        options: available.map((u) => ({ name: `${u.name} — ${u.email}`, value: u.userId })),
        hasMore: false,
      };
    } catch (err: any) {
      setUsersError(err?.message || "Failed to load users.");
      return { options: [], hasMore: false };
    }
  };

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleTypeChange = (val: DropdownValue | null) => {
    setSelectedType(val);
    setField("type", val?.value || "");
  };

  const handleCurrencyChange = (val: DropdownValue | null) => {
    setSelectedCurrency(val);
    setField("currency", val?.value || "");
  };

  const addUser = () => {
    const user = users.find((u) => u.userId === selectedApprover?.value);
    if (!user) return;
    setSelectedUsers((prev) => [...prev, user]);
    setSelectedApprover(null);
    setErrors((prev) => ({ ...prev, users: undefined }));
  };

  const removeUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  const moveUser = (index: number, direction: -1 | 1) => {
    setSelectedUsers((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const requiresAmount = form.type === AMOUNT_APPROVAL_TYPE;
  const scoped = SCOPED_APPROVAL_TYPES.includes(form.type.toUpperCase());

  // Options of the scope value (properties, SILA locations or company codes) for the chosen scope kind.
  useEffect(() => {
    setScopeValue("");
    setErrors((prev) => ({ ...prev, scope: undefined }));
    if (!scoped || scopeKind === "ALL") {
      setScopeOptions([]);
      return undefined;
    }
    let active = true;
    setScopeLoading(true);
    fetchScopeOptions(scopeKind)
      .then((options) => active && setScopeOptions(options))
      .catch((err: any) => {
        if (active) {
          setScopeOptions([]);
          toastService.error(err?.message || "Failed to load the scope options");
        }
      })
      .finally(() => active && setScopeLoading(false));
    return () => {
      active = false;
    };
  }, [scopeKind, scoped]);

  const validate = () => {
    const next: typeof errors = {};
    if (!form.approvalCode.trim()) next.approvalCode = "Approval code is required";
    if (!form.approvalName.trim()) next.approvalName = "Approval name is required";
    if (!form.type) next.type = "Select an approval type";
    if (requiresAmount) {
      if (form.totalAmount === "" || Number(form.totalAmount) < 0 || Number.isNaN(Number(form.totalAmount))) {
        next.totalAmount = "Enter a valid amount";
      }
      if (!form.currency) next.currency = "Select a currency";
    }
    if (scoped && scopeKind !== "ALL" && !scopeValue) next.scope = "Select where the approval flow applies";
    if (selectedUsers.length === 0) next.users = "Add at least one approver";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await createMasterApprovalFlow({
        approvalCode: form.approvalCode.trim(),
        approvalName: form.approvalName.trim(),
        type: form.type,
        totalAmount: requiresAmount ? Number(form.totalAmount) : 0,
        currency: requiresAmount ? form.currency : "",
        scopeKind: scoped ? scopeKind : null,
        scopeId: scoped && scopeKind !== "ALL" && scopeKind !== "COMPANY_CODE" ? scopeValue : null,
        scopeCode: scoped && scopeKind === "COMPANY_CODE" ? scopeValue : null,
        users: selectedUsers.map((u, i) => ({ userId: u.userId, order: i + 1 })),
      });
      toastService.success("Approval flow created successfully");
      onCreated();
    } catch (err: any) {
      toastService.error(err.message || "Failed to create approval flow");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="apf-overlay" onClick={() => !submitting && onClose()}>
      <form
        className="apf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apf-modal-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="apf-modal-header">
          <div>
            <h2 className="apf-modal-title" id="apf-modal-title">Create Approval</h2>
            <p className="apf-modal-subtitle">Define the approval flow and the order in which users approve.</p>
          </div>
          <button type="button" className="apf-close" onClick={onClose} disabled={submitting} aria-label="Close">
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <div className="apf-modal-body">
          <div className="apf-section-label">Approval Details</div>
          <div className="apf-grid">
            <label className="apf-field">
              <span className="apf-label">Approval Code <em aria-hidden="true">*</em></span>
              <input
                className={`apf-input ${errors.approvalCode ? "apf-input-error" : ""}`}
                aria-required="true"
                aria-invalid={!!errors.approvalCode}
                value={form.approvalCode}
                onChange={(e) => setField("approvalCode", e.target.value)}
                placeholder="e.g. APR-001"
              />
              {errors.approvalCode && <span className="apf-error">{errors.approvalCode}</span>}
            </label>

            <label className="apf-field">
              <span className="apf-label">Approval Name <em aria-hidden="true">*</em></span>
              <input
                className={`apf-input ${errors.approvalName ? "apf-input-error" : ""}`}
                aria-required="true"
                aria-invalid={!!errors.approvalName}
                value={form.approvalName}
                onChange={(e) => setField("approvalName", e.target.value)}
                placeholder="e.g. Purchasing Team Approval"
              />
              {errors.approvalName && <span className="apf-error">{errors.approvalName}</span>}
            </label>

            <div className="apf-field">
              <Dropdown
                label="Type"
                isRequired
                placeholder="Select type"
                isAsync
                loadOptions={loadTypeOptions}
                value={selectedType}
                onChange={handleTypeChange}
                error={errors.type}
              />
            </div>

            {requiresAmount && (
              <div className="apf-field">
                <span className="apf-label" id="apf-amount-label">Total Amount <em aria-hidden="true">*</em></span>
                <div className="apf-amount">
                  <input
                    type="number"
                    min={0}
                    className={`apf-input apf-input-number ${errors.totalAmount ? "apf-input-error" : ""}`}
                    aria-labelledby="apf-amount-label"
                    aria-required="true"
                    aria-invalid={!!errors.totalAmount}
                    value={form.totalAmount}
                    onChange={(e) => setField("totalAmount", e.target.value)}
                    placeholder="0.00"
                  />
                  <Dropdown
                    placeholder="Currency"
                    isAsync
                    loadOptions={loadCurrencyOptions}
                    value={selectedCurrency}
                    onChange={handleCurrencyChange}
                    className="apf-currency"
                  />
                </div>
                {(errors.totalAmount || errors.currency) && (
                  <span className="apf-error">{errors.totalAmount || errors.currency}</span>
                )}
              </div>
            )}
          </div>

          {scoped && (
            <div className="apf-grid apf-section-gap">
              <label className="apf-field">
                <span className="apf-label">Applies to</span>
                <select className="apf-input" value={scopeKind} onChange={(e) => setScopeKind(e.target.value)}>
                  {APPROVAL_SCOPE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind === "ALL" ? "All" : kind === "COMPANY_CODE" ? "Company code" : kind.charAt(0) + kind.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </label>
              {scopeKind !== "ALL" && (
                <label className="apf-field">
                  <span className="apf-label">Scope <em aria-hidden="true">*</em></span>
                  <select
                    className={`apf-input ${errors.scope ? "apf-input-error" : ""}`}
                    aria-required="true"
                    aria-invalid={!!errors.scope}
                    value={scopeValue}
                    disabled={scopeLoading}
                    onChange={(e) => {
                      setScopeValue(e.target.value);
                      setErrors((prev) => ({ ...prev, scope: undefined }));
                    }}
                  >
                    <option value="">{scopeLoading ? "Loading..." : scopeOptions.length === 0 ? "Nothing to select" : "Select"}</option>
                    {scopeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  {errors.scope && <span className="apf-error">{errors.scope}</span>}
                </label>
              )}
            </div>
          )}

          <div className="apf-section-label apf-section-gap" id="apf-users-label">
            Users
            {selectedUsers.length > 0 && <span className="apf-count">{selectedUsers.length}</span>}
          </div>

          <div className="apf-user-picker">
            <Dropdown
              placeholder="Select a user"
              isAsync
              loadOptions={loadApproverOptions}
              cacheUniques={[selectedUsers.map((u) => u.userId).join(",")]}
              value={selectedApprover}
              onChange={setSelectedApprover}
              error={errors.users}
            />
            <button
              type="button"
              className="apf-add-btn sila-btn sila-btn--primary sila-btn--icon"
              onClick={addUser}
              disabled={!selectedApprover}
              title="Add user"
              aria-label="Add user"
            >
              <IconPlus />
            </button>
          </div>
          {usersError && <span className="apf-error" role="alert">{usersError}</span>}
          {errors.users && <span className="apf-error" role="alert">{errors.users}</span>}

          {selectedUsers.length === 0 ? (
            <div className="apf-users-empty">
              Select a user and click <strong>+</strong> to add approvers. They approve in the order listed.
            </div>
          ) : (
            <ol className="apf-users">
              {selectedUsers.map((u, i) => (
                <li key={u.userId} className="apf-user-card">
                  <span className="apf-order" aria-label={`Step ${i + 1}`}>{i + 1}</span>
                  <div className="apf-user-info">
                    <div className="apf-user-top">
                      <span className="apf-user-name">{u.name}</span>
                      {u.roleName && <span className="apf-role">{u.roleName}</span>}
                    </div>
                    <span className="apf-user-email">{u.email}</span>
                  </div>
                  <div className="apf-user-actions">
                    <button type="button" onClick={() => moveUser(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">
                      <IconArrow up />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveUser(i, 1)}
                      disabled={i === selectedUsers.length - 1}
                      aria-label="Move down"
                      title="Move down"
                    >
                      <IconArrow />
                    </button>
                    <button
                      type="button"
                      className="apf-remove"
                      onClick={() => removeUser(u.userId)}
                      aria-label="Remove user"
                      title="Remove"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="apf-modal-footer">
          <button type="button" className="apf-btn apf-btn-secondary sila-btn sila-btn--secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="apf-btn apf-btn-primary sila-btn sila-btn--primary" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateApprovalForm;
