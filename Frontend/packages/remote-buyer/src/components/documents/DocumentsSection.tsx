import React, { useState } from "react";
import { PageHeader } from "@vosox/shared-ui";
import InvoiceDocuments from "./InvoiceDocuments";
import ContractDocuments from "./ContractDocuments";
import "./Documents.css";

type DocumentTab = "invoices" | "contracts";

interface DocumentsSectionProps {
  /** The organization has the SILA ME add-on: its supplier invoices are listed too. */
  hasSilaMe: boolean;
  onNavigate: (navKey: string) => void;
}

/** Settings → Documents: the documents the organization holds (SILA ME invoices, contract attachments). */
const DocumentsSection: React.FC<DocumentsSectionProps> = ({ hasSilaMe, onNavigate }) => {
  const [tab, setTab] = useState<DocumentTab>(hasSilaMe ? "invoices" : "contracts");
  const tabs: { key: DocumentTab; label: string }[] = [
    ...(hasSilaMe ? [{ key: "invoices" as const, label: "Supplier invoices" }] : []),
    { key: "contracts", label: "Contract attachments" },
  ];
  // The add-on can load after the first render; fall back to a tab that exists.
  const activeTab: DocumentTab = tab === "invoices" && !hasSilaMe ? "contracts" : tab;

  return (
    <div className="doc-page">
      <PageHeader title="Documents" description="Files your organization holds, with their processing status." />
      <section className="sila-card">
        <div className="sila-tabs" role="tablist" aria-label="Document types">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              className="sila-tab"
              aria-selected={activeTab === item.key}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="doc-body" role="tabpanel">
          {activeTab === "invoices" ? (
            <InvoiceDocuments onOpenInvoices={() => onNavigate("silaInvoices")} />
          ) : (
            <ContractDocuments />
          )}
        </div>
      </section>
    </div>
  );
};

export default DocumentsSection;
