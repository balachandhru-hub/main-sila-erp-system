export type ClauseType = 'Standard' | 'Negotiable' | 'Optional';

export interface KeyTermEntry {
  id: number;
  label: string;
  value: string;
}

export interface ContractClauseEntry {
  id: number;
  section: string;
  clauseText: string;
  type: ClauseType;
}

/** One field in a custom section. `type` is a QUESTION_TYPE reference-list key (same field types the
 * onboarding verification templates use), not a fixed enum, so new types show up automatically. */
export interface CustomSectionField {
  id: number;
  label: string;
  type: string;
  options?: string[];
  mandatory: boolean;
}

/** A buyer-defined sub header with its own set of form fields, in addition to the fixed Key Terms and
 * Clause Library sections. */
export interface CustomSection {
  id: number;
  title: string;
  fields: CustomSectionField[];
}

/** A saved contract template. "generated" templates are rendered as a PDF from keyTerms/clauses/customSections;
 * "uploaded" templates use the buyer's own PDF file as-is (fileName/fileDataUrl), skipping the form. */
export interface ContractTemplateRecord {
  id: string;
  templateName: string;
  segmentName: string;
  familyName: string;
  /** Free-text overview of the template, printed under the classification line in the generated PDF. */
  description?: string;
  keyTerms: KeyTermEntry[];
  clauses: ContractClauseEntry[];
  customSections: CustomSection[];
  createdAt: string;
  sourceType: 'generated' | 'uploaded';
  fileName?: string;
  fileDataUrl?: string;
  /** The attachment's asset id, when the list endpoint returned metadata only (no fileBytes) - used to
   * fetch the actual file on demand via fetchBuyerAsset when the buyer downloads it. */
  attachmentId?: string;
}
