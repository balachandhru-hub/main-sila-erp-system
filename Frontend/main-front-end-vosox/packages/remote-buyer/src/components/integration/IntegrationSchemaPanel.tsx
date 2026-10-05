import React, { useEffect, useState } from "react";
import { EmptyState, Loader, toastService } from "@vosox/shared-ui";
import {
  discoverIntegrationSchema,
  getIntegrationSchema,
  type IntegrationConfiguration,
  type IntegrationSchema,
  integrationProcessOf,
} from "../../api/integrationsApi";
import { errorMessage, formatDateTime } from "./integrationFormat";
import "./Integration.css";

interface IntegrationSchemaPanelProps {
  configuration: IntegrationConfiguration;
  /** View only: the saved snapshot is shown but the schema cannot be read again. */
  readOnly?: boolean;
}

/** The last metadata snapshot read from the source system: its entities, keys and properties. */
const IntegrationSchemaPanel: React.FC<IntegrationSchemaPanelProps> = ({ configuration, readOnly = false }) => {
  const [schema, setSchema] = useState<IntegrationSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSchema(await getIntegrationSchema(integrationProcessOf(configuration.processType).side, configuration.id));
    } catch (err: unknown) {
      setError(errorMessage(err, "Could not load the schema."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [configuration.id]);

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const discovered = await discoverIntegrationSchema(integrationProcessOf(configuration.processType).side, configuration.id);
      setSchema(discovered);
      setError(null);
      toastService.success(`Schema read: ${discovered.entities.length} entities.`);
    } catch (err: unknown) {
      toastService.error(errorMessage(err, "Schema discovery failed."));
    } finally {
      setDiscovering(false);
    }
  };

  const term = filter.trim().toLowerCase();
  const entities = schema
    ? schema.entities.filter((entity) =>
        !term ||
        entity.name.toLowerCase().includes(term) ||
        (entity.entitySet ?? "").toLowerCase().includes(term) ||
        entity.properties.some((property) => property.name.toLowerCase().includes(term)))
    : [];

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Schema snapshot</h2>
        {!readOnly && (
          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={handleDiscover} disabled={discovering || loading}>
            {discovering ? "Reading schema..." : schema ? "Read schema again" : "Read schema"}
          </button>
        )}
      </div>
      <div className="sila-card-body ops-stack">
        {configuration.protocol !== "ODATA_V4" && (
          <span className="sila-help">
            Schema discovery reads OData V4 metadata. For a REST integration, type the source field names directly in the field mapping.
          </span>
        )}
        {loading ? (
          <Loader size={20} message="Loading schema..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the schema"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : !schema ? (
          <EmptyState
            title="No schema has been read yet"
            description={readOnly ? undefined : "Test the connection, then read the schema to see the fields the source system offers."}
          />
        ) : (
          <>
            <dl className="sila-meta-grid">
              <div className="sila-meta-item"><dt className="sila-meta-label">Metadata URL</dt><dd className="sila-meta-value ops-break">{schema.metadataUrl}</dd></div>
              <div className="sila-meta-item"><dt className="sila-meta-label">Read on</dt><dd className="sila-meta-value">{formatDateTime(schema.discoveredAt)}</dd></div>
              <div className="sila-meta-item"><dt className="sila-meta-label">Entities</dt><dd className="sila-meta-value">{schema.entities.length}</dd></div>
            </dl>
            <div className="sila-field">
              <label className="sila-label" htmlFor="integration-schema-filter">Find an entity or a field</label>
              <input id="integration-schema-filter" className="sila-input" value={filter} onChange={(event) => setFilter(event.target.value)} />
            </div>
            {entities.length === 0 ? (
              <span className="sila-help">No entity matches that filter.</span>
            ) : (
              entities.map((entity) => (
                <details key={entity.name} className="ops-entity">
                  <summary>
                    <span>{entity.name}{entity.entitySet ? ` · ${entity.entitySet}` : ""}</span>
                    <span className="ops-muted">{entity.properties.length} fields</span>
                  </summary>
                  <div className="sila-table-wrap">
                    <table className="sila-table">
                      <thead>
                        <tr>
                          <th scope="col">Field</th>
                          <th scope="col">Type</th>
                          <th scope="col">Key</th>
                          <th scope="col">Can be empty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entity.properties.map((property) => (
                          <tr key={property.name}>
                            <td className="sila-cell-strong">{property.name}</td>
                            <td>{property.type}</td>
                            <td>{entity.keys.includes(property.name) ? "Yes" : "—"}</td>
                            <td>{property.nullable ? "Yes" : "No"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default IntegrationSchemaPanel;
