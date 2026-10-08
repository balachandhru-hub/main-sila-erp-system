import React, { useEffect, useState } from "react";
import { EmptyState, Loader, toastService } from "@vosox/shared-ui";
import {
  INTEGRATION_NULL_POLICIES,
  getIntegrationMappings,
  getIntegrationSchema,
  getIntegrationTargetFields,
  saveIntegrationMappings,
  type IntegrationConfiguration,
  type IntegrationMapping,
  type IntegrationMappingWrite,
  type IntegrationTargetField,
  integrationProcessOf,
} from "../../api/integrationsApi";
import { blank, errorMessage, formatDateTime } from "./integrationFormat";
import "./Integration.css";

interface IntegrationMappingEditorProps {
  configuration: IntegrationConfiguration;
  /** View only: the mappings are shown but cannot be changed. */
  readOnly?: boolean;
}

interface MappingRow {
  /** Stable key for the row while it is edited. */
  key: string;
  sourceField: string;
  targetField: string;
  transformation: string;
  nullPolicy: string;
  defaultValue: string;
  isValidated: boolean;
}

let rowSequence = 0;
const nextKey = (): string => {
  rowSequence += 1;
  return `mapping-${rowSequence}`;
};

const toRow = (mapping: IntegrationMapping): MappingRow => ({
  key: nextKey(),
  sourceField: mapping.sourceField,
  targetField: mapping.targetField,
  transformation: mapping.transformation || "NONE",
  nullPolicy: mapping.nullPolicy,
  defaultValue: mapping.defaultValue ?? "",
  isValidated: mapping.isValidated,
});

/** Target fields this process writes: suppliers for a supplier pull, purchase orders otherwise. */
const isRelevant = (field: IntegrationTargetField, processType: string): boolean => {
  if (processType.includes("SUPPLIER")) return field.targetField.startsWith("Supplier.");
  if (processType.includes("PO")) return field.targetField.startsWith("PurchaseOrder");
  return true;
};

/** Maps source fields of the external system to the controlled target fields, with a transformation and an empty-value rule. */
const IntegrationMappingEditor: React.FC<IntegrationMappingEditorProps> = ({ configuration, readOnly = false }) => {
  const side = integrationProcessOf(configuration.processType).side;
  const [targets, setTargets] = useState<IntegrationTargetField[]>([]);
  const [sourceFields, setSourceFields] = useState<string[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const applyMappings = (mappings: IntegrationMapping[]) => {
    setRows(mappings.map(toRow));
    const latest = mappings.map((mapping) => mapping.updatedAt).sort().pop();
    setLastSaved(latest ?? null);
    setDirty(false);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [targetRows, mappingRows] = await Promise.all([
        getIntegrationTargetFields(side, configuration.processType),
        getIntegrationMappings(side, configuration.id),
      ]);
      setTargets(targetRows);
      applyMappings(mappingRows);
      // Source field suggestions come from the schema snapshot; mapping still works without one.
      const schema = await getIntegrationSchema(side, configuration.id).catch(() => null);
      const names = new Set<string>();
      schema?.entities.forEach((entity) => entity.properties.forEach((property) => names.add(property.name)));
      setSourceFields(Array.from(names).sort());
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not load the field mappings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [configuration.id, configuration.processType]);

  const targetByName = (name: string): IntegrationTargetField | undefined =>
    targets.find((target) => target.targetField === name);

  const transformationsFor = (name: string): string[] => {
    const allowed = targetByName(name)?.allowedTransformations ?? [];
    return allowed.length > 0 ? allowed : ["NONE"];
  };

  const updateRow = (key: string, changes: Partial<MappingRow>) => {
    setDirty(true);
    setRows((current) => current.map((row) => {
      if (row.key !== key) return row;
      const next: MappingRow = { ...row, ...changes, isValidated: false };
      // A transformation the new target does not allow falls back to none.
      if (changes.targetField !== undefined && !transformationsFor(next.targetField).includes(next.transformation)) {
        next.transformation = "NONE";
      }
      return next;
    }));
  };

  const addRow = (targetField?: string) => {
    setDirty(true);
    setRows((current) => [
      ...current,
      {
        key: nextKey(),
        sourceField: "",
        targetField: targetField ?? targets.find((target) => isRelevant(target, configuration.processType))?.targetField ?? targets[0]?.targetField ?? "",
        transformation: "NONE",
        nullPolicy: "IGNORE_NULL",
        defaultValue: "",
        isValidated: false,
      },
    ]);
  };

  const removeRow = (key: string) => {
    setDirty(true);
    setRows((current) => current.filter((row) => row.key !== key));
  };

  const missingRequired = targets.filter((target) =>
    target.required && isRelevant(target, configuration.processType) && !rows.some((row) => row.targetField === target.targetField));

  const addMissingRequired = () => {
    setDirty(true);
    setRows((current) => [
      ...current,
      ...missingRequired.map((target) => ({
        key: nextKey(),
        sourceField: "",
        targetField: target.targetField,
        transformation: "NONE",
        nullPolicy: "IGNORE_NULL",
        defaultValue: "",
        isValidated: false,
      })),
    ]);
  };

  const handleSave = async () => {
    if (rows.some((row) => !row.sourceField.trim() || !row.targetField)) {
      toastService.error("Every mapping needs a source field and a target field.");
      return;
    }
    if (rows.some((row) => /\s/.test(row.sourceField.trim()))) {
      toastService.error("A source field name cannot contain spaces.");
      return;
    }
    if (rows.some((row) => row.nullPolicy === "DEFAULT_VALUE" && !row.defaultValue.trim())) {
      toastService.error("Enter the default value for every mapping that uses one.");
      return;
    }
    const duplicates = rows.filter((row, index) => rows.findIndex((other) => other.targetField === row.targetField) !== index);
    if (duplicates.length > 0) {
      toastService.error(`${duplicates[0].targetField} is mapped more than once.`);
      return;
    }
    const payload: IntegrationMappingWrite[] = rows.map((row) => ({
      sourceField: row.sourceField.trim(),
      targetField: row.targetField,
      transformation: row.transformation,
      nullPolicy: row.nullPolicy,
      defaultValue: row.nullPolicy === "DEFAULT_VALUE" ? blank(row.defaultValue) : null,
    }));
    setSaving(true);
    try {
      applyMappings(await saveIntegrationMappings(side, configuration.id, payload));
      toastService.success("Field mappings validated and saved.");
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "The field mappings could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  const areas = Array.from(new Set(targets.map((target) => target.area)));

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Field mapping</h2>
        <span className="ops-muted">{lastSaved ? `Last saved ${formatDateTime(lastSaved)}` : "Not saved yet"}</span>
      </div>
      {loading ? (
        <Loader size={20} message="Loading field mappings..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the field mappings"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : (
        <>
          <div className="sila-card-body ops-stack">
            <span className="sila-help">
              Each row copies one field of the source system into one target field. Saving replaces all mappings of this integration
              and validates them. {sourceFields.length > 0
                ? `${sourceFields.length} source fields from the schema snapshot are suggested while typing.`
                : "Read the schema on the Schema tab to get source field suggestions."}
            </span>
            {missingRequired.length > 0 && (
              <div className="sila-alert sila-alert--warning" role="status">
                <div>
                  <div className="sila-alert-title">{missingRequired.length} required target field{missingRequired.length === 1 ? " is" : "s are"} not mapped</div>
                  <div className="ops-break">{missingRequired.map((target) => target.targetField).join(", ")}</div>
                </div>
                {!readOnly && <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={addMissingRequired}>Add rows</button>}
              </div>
            )}
          </div>
          {rows.length === 0 ? (
            <EmptyState title="No field mappings yet" description={readOnly ? undefined : "Add a mapping for each field the integration should read."} />
          ) : (
            <div className="sila-table-wrap">
              <datalist id="integration-source-fields">
                {sourceFields.map((name) => <option key={name} value={name} />)}
              </datalist>
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Source field</th>
                    <th scope="col">Target field</th>
                    <th scope="col">Transformation</th>
                    <th scope="col">Empty values</th>
                    <th scope="col">Default value</th>
                    <th scope="col">State</th>
                    {!readOnly && <th scope="col">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const target = targetByName(row.targetField);
                    return (
                      <tr key={row.key}>
                        <td>
                          <input
                            className="sila-input ops-cell-input ops-cell-input--wide"
                            list="integration-source-fields"
                            aria-label={`Source field of mapping ${index + 1}`}
                            value={row.sourceField}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.key, { sourceField: event.target.value })}
                          />
                        </td>
                        <td>
                          <select
                            className="sila-select ops-cell-input ops-cell-input--wide"
                            aria-label={`Target field of mapping ${index + 1}`}
                            value={row.targetField}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.key, { targetField: event.target.value })}
                          >
                            {!target && row.targetField && <option value={row.targetField}>{row.targetField} (unknown)</option>}
                            {areas.map((area) => (
                              <optgroup key={area} label={area}>
                                {targets.filter((item) => item.area === area).map((item) => (
                                  <option key={item.targetField} value={item.targetField}>
                                    {item.targetField}{item.required ? " *" : ""}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                          {target && <div className="sila-help">{target.dataType}{target.required ? " · required" : ""}</div>}
                        </td>
                        <td>
                          <select
                            className="sila-select ops-cell-input"
                            aria-label={`Transformation of mapping ${index + 1}`}
                            value={row.transformation}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.key, { transformation: event.target.value })}
                          >
                            {transformationsFor(row.targetField).map((name) => <option key={name} value={name}>{name}</option>)}
                          </select>
                        </td>
                        <td>
                          <select
                            className="sila-select ops-cell-input"
                            aria-label={`Empty value rule of mapping ${index + 1}`}
                            value={row.nullPolicy}
                            disabled={readOnly}
                            onChange={(event) => updateRow(row.key, { nullPolicy: event.target.value })}
                          >
                            {INTEGRATION_NULL_POLICIES.map((policy) => <option key={policy.value} value={policy.value}>{policy.label}</option>)}
                          </select>
                        </td>
                        <td>
                          <input
                            className="sila-input ops-cell-input"
                            aria-label={`Default value of mapping ${index + 1}`}
                            value={row.defaultValue}
                            disabled={readOnly || row.nullPolicy !== "DEFAULT_VALUE"}
                            onChange={(event) => updateRow(row.key, { defaultValue: event.target.value })}
                          />
                        </td>
                        <td>
                          {row.isValidated
                            ? <span className="sila-badge sila-badge--success">Validated</span>
                            : <span className="sila-badge sila-badge--neutral">Not saved</span>}
                        </td>
                        {!readOnly && (
                          <td>
                            <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={() => removeRow(row.key)}>Remove</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!readOnly && (
            <div className="sila-card-footer">
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => addRow()} disabled={saving || targets.length === 0}>Add mapping</button>
              <button type="button" className="sila-btn sila-btn--secondary" onClick={load} disabled={saving || !dirty}>Discard changes</button>
              <button type="button" className="sila-btn sila-btn--primary" onClick={handleSave} disabled={saving || !dirty || rows.length === 0}>
                {saving ? "Saving..." : "Save and validate"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default IntegrationMappingEditor;
