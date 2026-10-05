import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  FaPlus as Plus,
  FaTimes as Times,
  FaTrash as Trash2,
  FaDownload as Download,
  FaUpload as UploadIcon,
  FaFilePdf as PdfIcon,
  FaFileContract as ContractIcon,
  FaEdit as Edit2,
} from 'react-icons/fa';
import {
  toastService,
  EmptyState,
  Loader,
  PageHeader,
  Dropdown,
  StatusBadge,
} from '@vosox/shared-ui';
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult, DropdownOption } from '@vosox/shared-ui';
import './ContractTemplate.css';
import {
  fetchSegments,
  fetchFamilies,
  fetchDropdownReferenceList,
  type ReferenceListItemDto,
} from '../../../remote-buyer/src/api/masterdataApi';
import {
  createContractTemplate,
  updateContractTemplate,
  fetchBuyerAsset,
  type ContractTemplateAttachmentDto,
  type CreateContractTemplatePayload,
} from '../../../remote-buyer/src/api/Buyerapi';
import { fetchContractTemplates } from '../api/contractTemplateApi';
import { useNetworkAdminAuthStore } from '../store/useAuthStore';
import type {
  ClauseType,
  ContractClauseEntry,
  ContractTemplateRecord,
  CustomSection,
  CustomSectionField,
  KeyTermEntry,
} from './ContractTemplate.types';
import {
  dataUrlToBase64,
  downloadDataUrl,
  generateContractTemplatePdf,
  slugifyTemplateName,
  toPdfDataUrl,
} from './contractTemplatePdf';
import { resolveMimeType } from './ContractCreation/contractFormatters';

type CreationMode = 'form' | 'upload';

interface PreviewDoc {
  dataUrl: string;
  fileName: string;
  contentType: string;
}

const SEGMENT_PAGE_SIZE = 40;
const FAMILY_PAGE_SIZE = 40;

const CLAUSE_TYPE_OPTIONS: DropdownOption[] = [
  { name: 'Standard', value: 'Standard' },
  { name: 'Negotiable', value: 'Negotiable' },
  { name: 'Optional', value: 'Optional' },
];

interface ContractTemplateFormData {
  templateName: string;
  segment: DropdownValue | null;
  family: DropdownValue | null;
  description: string;
  keyTerms: KeyTermEntry[];
  clauses: ContractClauseEntry[];
  customSections: CustomSection[];
}

let nextRowId = 1;
const newRowId = () => nextRowId++;

const defaultKeyTerms = (): KeyTermEntry[] => [
  { id: newRowId(), label: 'Payment Terms', value: '' },
  { id: newRowId(), label: 'Duration', value: '' },
  { id: newRowId(), label: 'Pricing', value: '' },
];

const defaultClauses = (): ContractClauseEntry[] => [
  { id: newRowId(), section: 'Scope & Term', clauseText: 'Contract duration and renewal basis.', type: 'Standard' },
  { id: newRowId(), section: 'Pricing', clauseText: 'Unit pricing fixed for contract term.', type: 'Negotiable' },
];

const emptyFormData = (): ContractTemplateFormData => ({
  templateName: '',
  segment: null,
  family: null,
  description: '',
  keyTerms: defaultKeyTerms(),
  clauses: defaultClauses(),
  customSections: [],
});

const isOptionsFieldType = (key: string) => key === 'RADIO_BUTTON' || key === 'CHECK_BOX';

/** Buyer admin "Configuration" screen for defining contract templates: name, UNSPSC classification, the Key
 * Terms summary shown to buyers/suppliers, and the full Clause Library only approvers see. Creating a
 * template generates its contract document as a PDF (sharing/distribution is wired up separately). */
export default function ContractTemplate() {
  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.userRole === 'BUYER_ADMINISTRATOR';

  const [templates, setTemplates] = useState<ContractTemplateRecord[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<ContractTemplateFormData>(emptyFormData());
  const [creationMode, setCreationMode] = useState<CreationMode>('form');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null);
  const [pendingRecord, setPendingRecord] = useState<ContractTemplateRecord | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<ContractTemplateRecord | null>(null);
  const [fieldTypes, setFieldTypes] = useState<ReferenceListItemDto[]>([]);
  const [loadingFieldTypes, setLoadingFieldTypes] = useState(false);
  const [fieldTypesError, setFieldTypesError] = useState<string | null>(null);

  const loadFieldTypes = async (): Promise<ReferenceListItemDto[]> => {
    setLoadingFieldTypes(true);
    setFieldTypesError(null);
    try {
      const result = await fetchDropdownReferenceList(['QUESTION_TYPE']);
      if (!Array.isArray(result)) {
        setFieldTypesError(result.message || 'Failed to load field types');
        return [];
      }
      setFieldTypes(result);
      return result;
    } catch (err: any) {
      setFieldTypesError(err?.message || 'Failed to load field types');
      return [];
    } finally {
      setLoadingFieldTypes(false);
    }
  };

  useEffect(() => {
    loadFieldTypes();
  }, []);

  const getFieldTypeLabel = (key: string) => fieldTypes.find((ft) => ft.key === key)?.description || key;

  const loadFieldTypeOptions = async ({ search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const types = fieldTypes.length > 0 ? fieldTypes : await loadFieldTypes();
    const searchTerm = search.trim().toLowerCase();
    return {
      options: types
        .filter((ft) => !searchTerm || ft.description.toLowerCase().includes(searchTerm))
        .map((ft) => ({ name: ft.description, value: ft.key })),
      hasMore: false,
    };
  };

  useEffect(() => {
    let cancelled = false;
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      setTemplatesError(null);
      try {
        const result = await fetchContractTemplates();
        if (cancelled) return;
        if (!Array.isArray(result)) {
          setTemplatesError(result.message || 'Failed to load contract templates');
          return;
        }
        setTemplates(result);
      } catch (err: any) {
        if (!cancelled) setTemplatesError(err?.message || 'Failed to load contract templates');
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    };
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSegmentOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const pageIndex = page * SEGMENT_PAGE_SIZE;
    const result = await fetchSegments(pageIndex, SEGMENT_PAGE_SIZE, search || undefined);
    if (!Array.isArray(result)) return { options: [], hasMore: false };
    return {
      options: result.map((seg: any) => ({ name: seg.title, value: String(seg.segment) })),
      hasMore: result.length === SEGMENT_PAGE_SIZE,
    };
  };

  const loadFamilyOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!formData.segment) return { options: [], hasMore: false };
    const pageIndex = page * FAMILY_PAGE_SIZE;
    const result = await fetchFamilies(Number(formData.segment.value), { pageIndex, pageSize: FAMILY_PAGE_SIZE });
    if (!Array.isArray(result)) return { options: [], hasMore: false };
    const searchTerm = search.trim().toLowerCase();
    const options = result
      .filter((fam: any) => !searchTerm || fam.title.toLowerCase().includes(searchTerm))
      .map((fam: any) => ({ name: fam.title, value: String(fam.family) }));
    return { options, hasMore: result.length === FAMILY_PAGE_SIZE };
  };

  const handleCreateNew = () => {
    setFormData(emptyFormData());
    setCreationMode('form');
    setUploadedFile(null);
    setEditingTemplateId(null);
    setEditingOriginal(null);
    setShowCreateForm(true);
  };

  const handleOpenEdit = (template: ContractTemplateRecord) => {
    setFormData({
      templateName: template.templateName,
      segment: null,
      family: null,
      description: template.description || '',
      keyTerms: defaultKeyTerms(),
      clauses: defaultClauses(),
      customSections: [],
    });
    setCreationMode(template.sourceType === 'uploaded' ? 'upload' : 'form');
    setUploadedFile(null);
    setEditingTemplateId(template.id);
    setEditingOriginal(template);
    setPreviewDoc(null);
    setPendingRecord(null);
    setCreateError(null);
    setShowCreateForm(true);
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setFormData(emptyFormData());
    setCreationMode('form');
    setUploadedFile(null);
    setPreviewDoc(null);
    setPendingRecord(null);
    setCreateError(null);
    setEditingTemplateId(null);
    setEditingOriginal(null);
  };

  const handleBackToEdit = () => {
    setPreviewDoc(null);
    setPendingRecord(null);
    setCreateError(null);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toastService.error('Please upload a PDF file');
      e.target.value = '';
      return;
    }
    setUploadedFile(file);
  };

  const handleSegmentChange = (value: DropdownValue | null) => {
    setFormData((prev) => ({ ...prev, segment: value, family: null }));
  };

  const handleAddKeyTerm = () => {
    setFormData((prev) => ({
      ...prev,
      keyTerms: [...prev.keyTerms, { id: newRowId(), label: '', value: '' }],
    }));
  };

  const handleKeyTermChange = (id: number, field: 'label' | 'value', value: string) => {
    setFormData((prev) => ({
      ...prev,
      keyTerms: prev.keyTerms.map((term) => (term.id === id ? { ...term, [field]: value } : term)),
    }));
  };

  const handleRemoveKeyTerm = (id: number) => {
    setFormData((prev) => ({ ...prev, keyTerms: prev.keyTerms.filter((term) => term.id !== id) }));
  };

  const handleAddClause = () => {
    setFormData((prev) => ({
      ...prev,
      clauses: [...prev.clauses, { id: newRowId(), section: '', clauseText: '', type: 'Standard' }],
    }));
  };

  const handleClauseChange = (id: number, field: 'section' | 'clauseText' | 'type', value: string) => {
    setFormData((prev) => ({
      ...prev,
      clauses: prev.clauses.map((clause) => (clause.id === id ? { ...clause, [field]: value } : clause)),
    }));
  };

  const handleRemoveClause = (id: number) => {
    setFormData((prev) => ({ ...prev, clauses: prev.clauses.filter((clause) => clause.id !== id) }));
  };

  const handleAddSection = () => {
    setFormData((prev) => ({
      ...prev,
      customSections: [...prev.customSections, { id: newRowId(), title: '', fields: [] }],
    }));
  };

  const handleSectionTitleChange = (sectionId: number, title: string) => {
    setFormData((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section) =>
        section.id === sectionId ? { ...section, title } : section
      ),
    }));
  };

  const handleRemoveSection = (sectionId: number) => {
    setFormData((prev) => ({
      ...prev,
      customSections: prev.customSections.filter((section) => section.id !== sectionId),
    }));
  };

  const handleAddSectionField = (sectionId: number) => {
    setFormData((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: [
                ...section.fields,
                { id: newRowId(), label: '', type: fieldTypes[0]?.key || '', mandatory: false },
              ],
            }
          : section
      ),
    }));
  };

  const handleSectionFieldChange = (
    sectionId: number,
    fieldId: number,
    changes: Partial<Pick<CustomSectionField, 'label' | 'type' | 'mandatory'>>
  ) => {
    setFormData((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) => (field.id === fieldId ? { ...field, ...changes } : field)),
            }
          : section
      ),
    }));
  };

  const handleSectionFieldOptionsChange = (sectionId: number, fieldId: number, optionsText: string) => {
    setFormData((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              fields: section.fields.map((field) =>
                field.id === fieldId
                  ? { ...field, options: optionsText ? optionsText.split(',').map((opt) => opt.trim()) : undefined }
                  : field
              ),
            }
          : section
      ),
    }));
  };

  const handleRemoveSectionField = (sectionId: number, fieldId: number) => {
    setFormData((prev) => ({
      ...prev,
      customSections: prev.customSections.map((section) =>
        section.id === sectionId
          ? { ...section, fields: section.fields.filter((field) => field.id !== fieldId) }
          : section
      ),
    }));
  };

  /** Builds the record and its PDF, then shows the Preview screen - nothing is sent to the server yet.
   * Segment/Family only apply on create: the update API has no segmentId field, so segment can't change
   * once a template exists. */
  const handlePreview = () => {
    if (!formData.templateName.trim()) {
      toastService.error('Please enter a template name');
      return;
    }
    if (!editingTemplateId) {
      if (!formData.segment) {
        toastService.error('Please select a segment');
        return;
      }
      if (!formData.family) {
        toastService.error('Please select a family');
        return;
      }
    }

    if (creationMode === 'upload') {
      if (!uploadedFile) {
        if (editingOriginal?.fileDataUrl) {
          // Keep the existing file - only the name is changing.
          const record: ContractTemplateRecord = {
            ...editingOriginal,
            templateName: formData.templateName.trim(),
          };
          setPendingRecord(record);
          setPreviewDoc({
            dataUrl: editingOriginal.fileDataUrl,
            fileName: editingOriginal.fileName || `${slugifyTemplateName(record.templateName)}.pdf`,
            contentType: 'application/pdf',
          });
          return;
        }
        toastService.error('Please upload a PDF template file');
        return;
      }

      setPreparingPreview(true);
      const reader = new FileReader();
      reader.onload = () => {
        const record: ContractTemplateRecord = {
          id: editingTemplateId || String(Date.now()),
          templateName: formData.templateName.trim(),
          segmentName: editingOriginal?.segmentName ?? formData.segment?.name ?? '',
          familyName: editingOriginal?.familyName ?? formData.family?.name ?? '',
          keyTerms: [],
          clauses: [],
          customSections: [],
          createdAt: new Date().toISOString(),
          sourceType: 'uploaded',
          fileName: uploadedFile.name,
          fileDataUrl: reader.result as string,
        };
        setPendingRecord(record);
        setPreviewDoc({ dataUrl: reader.result as string, fileName: uploadedFile.name, contentType: 'application/pdf' });
        setPreparingPreview(false);
      };
      reader.onerror = () => {
        toastService.error('Failed to read the uploaded PDF file');
        setPreparingPreview(false);
      };
      reader.readAsDataURL(uploadedFile);
      return;
    }

    setPreparingPreview(true);
    try {
      const record: ContractTemplateRecord = {
        id: editingTemplateId || String(Date.now()),
        templateName: formData.templateName.trim(),
        segmentName: editingOriginal?.segmentName ?? formData.segment?.name ?? '',
        familyName: editingOriginal?.familyName ?? formData.family?.name ?? '',
        description: formData.description.trim(),
        keyTerms: formData.keyTerms.filter((term) => term.label.trim() && term.value.trim()),
        clauses: formData.clauses.filter((clause) => clause.section.trim() && clause.clauseText.trim()),
        customSections: formData.customSections
          .filter((section) => section.title.trim() || section.fields.length > 0)
          .map((section) => ({
            ...section,
            fields: section.fields.filter((field) => field.label.trim()),
          })),
        createdAt: new Date().toISOString(),
        sourceType: 'generated',
      };

      const doc = generateContractTemplatePdf(record);
      const fileName = `${slugifyTemplateName(record.templateName)}-contract-template.pdf`;
      setPendingRecord(record);
      setPreviewDoc({ dataUrl: doc.output('datauristring'), fileName, contentType: 'application/pdf' });
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to generate the contract template PDF');
    } finally {
      setPreparingPreview(false);
    }
  };

  /** The ENTITY_TYPE reference list's "BUYER" row id - that row's id is the entityId every buyer-owned
   * asset attachment uses, the same lookup ContractCreationView.tsx does for terms/e-sign uploads. */
  const resolveBuyerEntityId = async (): Promise<string> => {
    const result = await fetchDropdownReferenceList(['ENTITY_TYPE']);
    if (!Array.isArray(result)) return '';
    return result.find((entity) => entity.key === 'BUYER')?.id || '';
  };

  /** Sends the previewed template + its PDF attachment to the backend - POST when creating, PUT when
   * editing (the update endpoint has no segmentId, so segment is fixed once a template exists). */
  const handleConfirmSubmit = async () => {
    if (!previewDoc || !pendingRecord) return;
    if (!editingTemplateId && !formData.segment) return;

    setCreatingTemplate(true);
    setCreateError(null);
    try {
      const buyerEntityId = await resolveBuyerEntityId();
      const attachment: ContractTemplateAttachmentDto = {
        entityType: 'BUYER',
        entityId: buyerEntityId,
        assetType: 'CONTRACT_TEMPLATE',
        fileBytes: dataUrlToBase64(previewDoc.dataUrl),
        fileName: previewDoc.fileName,
        contentType: previewDoc.contentType,
        isSingletonAsset: true,
      };

      if (editingTemplateId) {
        await updateContractTemplate(editingTemplateId, {
          templateName: pendingRecord.templateName,
          attachment,
        });
        setTemplates((prev) => prev.map((t) => (t.id === editingTemplateId ? pendingRecord : t)));
        toastService.success('Contract template updated');
      } else {
        const payload: CreateContractTemplatePayload = {
          segmentId: Number(formData.segment!.value),
          templateName: pendingRecord.templateName,
          attachment,
        };
        await createContractTemplate(payload);
        setTemplates((prev) => [pendingRecord, ...prev]);
        toastService.success(
          pendingRecord.sourceType === 'uploaded'
            ? 'Contract template created from the uploaded PDF'
            : 'Contract template created and PDF generated'
        );
      }
      handleCancelCreate();
    } catch (err: any) {
      const message = err?.message || `Failed to ${editingTemplateId ? 'update' : 'create'} the contract template`;
      setCreateError(message);
      toastService.error(message);
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleDownloadAgain = async (template: ContractTemplateRecord) => {
    if (template.sourceType === 'uploaded' && template.fileDataUrl) {
      downloadDataUrl(template.fileDataUrl, template.fileName || `${slugifyTemplateName(template.templateName)}.pdf`);
      return;
    }

    // The list endpoint only returns attachment metadata (no fileBytes) - fetch the real file by its
    // asset id, the same pattern BidComparisonAwardView/contractPdf use for other attachment previews.
    if (template.sourceType === 'uploaded' && template.attachmentId) {
      setDownloadingId(template.id);
      try {
        const asset = await fetchBuyerAsset(template.attachmentId);
        if (!('fileBytes' in asset) || !asset.fileBytes) {
          toastService.error('message' in asset ? asset.message : 'Failed to load the contract template file');
          return;
        }
        const fileName = asset.fileName || template.fileName || `${slugifyTemplateName(template.templateName)}.pdf`;
        const contentType = resolveMimeType(asset.contentType, fileName);
        const dataUrl = toPdfDataUrl(asset.fileBytes, contentType);
        setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, fileDataUrl: dataUrl, fileName } : t)));
        downloadDataUrl(dataUrl, fileName);
      } catch (err: any) {
        toastService.error(err?.message || 'Failed to load the contract template file');
      } finally {
        setDownloadingId(null);
      }
      return;
    }

    if (template.sourceType === 'uploaded') {
      // No fileDataUrl and no attachmentId - the record has no reference to its file at all, so there's
      // nothing to fetch. Surface this instead of silently falling through to an empty generated PDF.
      toastService.error('This template has no attached file to download.');
      return;
    }

    const doc = generateContractTemplatePdf(template);
    doc.save(`${slugifyTemplateName(template.templateName)}-contract-template.pdf`);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((template) => template.id !== id));
  };

  if (showCreateForm && previewDoc) {
    return (
      <div className="ctpl-container">
        <PageHeader
          title="Preview Contract Template"
          description={`Review the document below before ${editingTemplateId ? 'updating' : 'creating'} this template.`}
          onBack={handleBackToEdit}
          backLabel="Back to edit"
        />

        <div className="ctpl-form-card">
          <div className="ctpl-preview-frame-wrapper">
            <iframe src={previewDoc.dataUrl} title={previewDoc.fileName} className="ctpl-preview-frame" />
          </div>

          {createError && (
            <div className="ctpl-error-message sila-alert sila-alert--danger" role="alert">
              {createError}
            </div>
          )}

          <div className="ctpl-form-actions">
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              onClick={handleBackToEdit}
              disabled={creatingTemplate}
            >
              Back to Edit
            </button>
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              onClick={() => downloadDataUrl(previewDoc.dataUrl, previewDoc.fileName)}
              disabled={creatingTemplate}
            >
              <Download size={13} aria-hidden="true" /> Download
            </button>
            <button
              type="button"
              className="sila-btn sila-btn--primary"
              onClick={handleConfirmSubmit}
              disabled={creatingTemplate}
            >
              {creatingTemplate && <span className="sila-spinner" aria-hidden="true" />}
              {creatingTemplate
                ? editingTemplateId
                  ? 'Updating...'
                  : 'Creating...'
                : editingTemplateId
                  ? 'Confirm & Update'
                  : 'Confirm & Create'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="ctpl-container">
        <PageHeader
          title={editingTemplateId ? 'Edit Contract Template' : 'Create Contract Template'}
          description={
            editingTemplateId
              ? 'Update the template name and/or its document. Segment and family can\'t be changed after a template is created.'
              : 'Define the template name, classification and the terms used to generate this contract document.'
          }
          onBack={handleCancelCreate}
          backLabel="Back to templates list"
        />

        <div className="ctpl-form-card">
          <div className="ctpl-mode-toggle" role="tablist" aria-label="Template creation method">
            <button
              type="button"
              role="tab"
              aria-selected={creationMode === 'form'}
              className={`ctpl-mode-btn${creationMode === 'form' ? ' ctpl-mode-btn--active' : ''}`}
              onClick={() => setCreationMode('form')}
            >
              Fill In Details
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={creationMode === 'upload'}
              className={`ctpl-mode-btn${creationMode === 'upload' ? ' ctpl-mode-btn--active' : ''}`}
              onClick={() => setCreationMode('upload')}
            >
              Upload PDF Template
            </button>
          </div>

          <div className="ctpl-form-group sila-field">
            <label htmlFor="ctpl-template-name" className="sila-label">
              Template Name <span className="sila-required" aria-hidden="true">*</span>
            </label>
            <input
              id="ctpl-template-name"
              type="text"
              className="sila-input"
              placeholder="Enter template name"
              value={formData.templateName}
              onChange={(e) => setFormData((prev) => ({ ...prev, templateName: e.target.value }))}
              aria-required="true"
            />
          </div>

          {editingTemplateId ? (
            <div className="ctpl-classification-grid">
              <div className="ctpl-form-group sila-field">
                <span className="sila-label">Segment</span>
                <div className="ctpl-readonly-value">{editingOriginal?.segmentName || '-'}</div>
              </div>
              {editingOriginal?.familyName && (
                <div className="ctpl-form-group sila-field">
                  <span className="sila-label">Family</span>
                  <div className="ctpl-readonly-value">{editingOriginal.familyName}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="ctpl-classification-grid">
              <div className="ctpl-form-group sila-field">
                <Dropdown
                  label="Segment"
                  isRequired
                  placeholder="Select Segment"
                  isAsync
                  loadOptions={loadSegmentOptions}
                  value={formData.segment}
                  onChange={handleSegmentChange}
                />
              </div>

              <div className="ctpl-form-group sila-field">
                <Dropdown
                  label="Family"
                  isRequired
                  placeholder={!formData.segment ? 'Select Segment first' : 'Select Family'}
                  isDisable={!formData.segment}
                  isAsync
                  loadOptions={loadFamilyOptions}
                  cacheUniques={[formData.segment?.value]}
                  value={formData.family}
                  onChange={(value) => setFormData((prev) => ({ ...prev, family: value }))}
                />
              </div>
            </div>
          )}

          {creationMode === 'upload' ? (
            <div className="ctpl-section">
              <h3 className="ctpl-section-title">Upload Contract Template</h3>
              <p className="ctpl-section-description">
                {editingTemplateId
                  ? 'Choose a new PDF to replace the current document, or leave this as-is to keep it.'
                  : 'Already have a contract template PDF? Upload it directly — no need to fill in Key Terms or the Clause Library below.'}
              </p>

              <div className="ctpl-upload-box">
                <input
                  id="ctpl-upload-input"
                  type="file"
                  accept="application/pdf"
                  className="ctpl-upload-input"
                  onChange={handleFileChange}
                />
                <label htmlFor="ctpl-upload-input" className="ctpl-btn-add-row">
                  <UploadIcon size={12} aria-hidden="true" /> {uploadedFile ? 'Replace File' : 'Choose PDF File'}
                </label>

                {uploadedFile ? (
                  <div className="ctpl-upload-file-badge">
                    <PdfIcon size={14} aria-hidden="true" />
                    <span className="ctpl-upload-file-name">{uploadedFile.name}</span>
                    <button
                      type="button"
                      className="ctpl-btn-remove-row sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                      onClick={() => setUploadedFile(null)}
                      aria-label="Remove uploaded file"
                      title="Remove"
                    >
                      <Times size={13} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  editingOriginal?.fileName && (
                    <div className="ctpl-upload-file-badge">
                      <PdfIcon size={14} aria-hidden="true" />
                      <span className="ctpl-upload-file-name">{editingOriginal.fileName} (current)</span>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <>
          <div className="ctpl-section">
            <h3 className="ctpl-section-title">Description</h3>
            <p className="ctpl-section-description">
              A free-text overview of this contract template, printed on the generated document above Key Terms -
              use this for any longer text that doesn't fit a single Key Terms value.
            </p>
            <div className="ctpl-form-group sila-field">
              <label htmlFor="ctpl-template-description" className="sila-label">Template Description</label>
              <textarea
                id="ctpl-template-description"
                className="sila-textarea"
                rows={4}
                placeholder="Describe this contract template..."
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <div className="ctpl-section">
            <h3 className="ctpl-section-title">Key Terms</h3>

            <div className="ctpl-key-terms-list">
              {formData.keyTerms.map((term) => (
                <div key={term.id} className="ctpl-key-term-row">
                  <div className="ctpl-form-group sila-field">
                    <label className="sila-label">Label</label>
                    <input
                      type="text"
                      className="sila-input"
                      value={term.label}
                      onChange={(e) => handleKeyTermChange(term.id, 'label', e.target.value)}
                    />
                  </div>
                  <div className="ctpl-form-group sila-field">
                    <label className="sila-label">Value</label>
                    <input
                      type="text"
                      className="sila-input"
                      value={term.value}
                      onChange={(e) => handleKeyTermChange(term.id, 'value', e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="ctpl-btn-remove-row sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                    onClick={() => handleRemoveKeyTerm(term.id)}
                    aria-label={`Remove key term ${term.label || ''}`.trim()}
                    title="Remove"
                  >
                    <Times size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="ctpl-btn-add-row" onClick={handleAddKeyTerm}>
              <Plus size={12} aria-hidden="true" /> Add key term
            </button>
          </div>

          <div className="ctpl-section">
            <h3 className="ctpl-section-title">Clause Library</h3>
            <p className="ctpl-section-description">
              Sections and clauses that make up the generated contract document. Only approvers see this full
              detail — buyers and suppliers see the Key Terms summary above instead.
            </p>

            <div className="ctpl-clause-list">
              {formData.clauses.map((clause) => (
                <div key={clause.id} className="ctpl-clause-row">
                  <div className="ctpl-form-group sila-field">
                    <label className="sila-label">Section</label>
                    <input
                      type="text"
                      className="sila-input"
                      value={clause.section}
                      onChange={(e) => handleClauseChange(clause.id, 'section', e.target.value)}
                    />
                  </div>
                  <div className="ctpl-form-group sila-field">
                    <label className="sila-label">Clause Text</label>
                    <textarea
                      className="sila-textarea"
                      rows={2}
                      value={clause.clauseText}
                      onChange={(e) => handleClauseChange(clause.id, 'clauseText', e.target.value)}
                    />
                  </div>
                  <div className="ctpl-form-group sila-field ctpl-clause-type">
                    <Dropdown
                      label="Type"
                      options={CLAUSE_TYPE_OPTIONS}
                      isClearable={false}
                      value={{ name: clause.type, value: clause.type }}
                      onChange={(value) => handleClauseChange(clause.id, 'type', (value?.value as ClauseType) || 'Standard')}
                    />
                  </div>
                  <button
                    type="button"
                    className="ctpl-btn-remove-row sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                    onClick={() => handleRemoveClause(clause.id)}
                    aria-label={`Remove clause ${clause.section || ''}`.trim()}
                    title="Remove"
                  >
                    <Times size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <button type="button" className="ctpl-btn-add-row" onClick={handleAddClause}>
              <Plus size={12} aria-hidden="true" /> Add clause
            </button>

            <ul className="ctpl-clause-type-legend">
              <li><strong>Standard</strong> — locked, can't be edited by the supplier</li>
              <li><strong>Negotiable</strong> — either side can propose changes (redline)</li>
              <li><strong>Optional</strong> — can be toggled in or out per contract</li>
            </ul>
          </div>

          <div className="ctpl-section">
            <h3 className="ctpl-section-title">Custom Sections</h3>
            <p className="ctpl-section-description">
              Add any extra sub headers and form fields this contract template needs, beyond Key Terms and the
              Clause Library.
            </p>

            {formData.customSections.map((section) => (
              <div key={section.id} className="ctpl-custom-section-card">
                <div className="ctpl-custom-section-title-row">
                  <div className="ctpl-form-group sila-field">
                    <label className="sila-label">Sub Header</label>
                    <input
                      type="text"
                      className="sila-input"
                      placeholder="e.g. Delivery Terms"
                      value={section.title}
                      onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="ctpl-btn-remove-row sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                    onClick={() => handleRemoveSection(section.id)}
                    aria-label={`Remove section ${section.title || ''}`.trim()}
                    title="Remove section"
                  >
                    <Times size={13} aria-hidden="true" />
                  </button>
                </div>

                <div className="ctpl-custom-field-list">
                  {section.fields.map((field) => (
                    <div key={field.id} className="ctpl-custom-field-row">
                      <div className="ctpl-form-group sila-field">
                        <label className="sila-label">Field Label</label>
                        <input
                          type="text"
                          className="sila-input"
                          value={field.label}
                          onChange={(e) => handleSectionFieldChange(section.id, field.id, { label: e.target.value })}
                        />
                      </div>
                      <div className="ctpl-form-group sila-field">
                        <Dropdown
                          label="Field Type"
                          placeholder={loadingFieldTypes ? 'Loading...' : 'Select a field type'}
                          isAsync
                          loadOptions={loadFieldTypeOptions}
                          cacheUniques={[fieldTypes.length]}
                          value={field.type ? { name: getFieldTypeLabel(field.type), value: field.type } : null}
                          onChange={(value) => handleSectionFieldChange(section.id, field.id, { type: value?.value || '' })}
                          isDisable={loadingFieldTypes}
                          error={fieldTypesError || undefined}
                        />
                      </div>
                      {isOptionsFieldType(field.type) && (
                        <div className="ctpl-form-group sila-field">
                          <label className="sila-label">Options (comma separated)</label>
                          <input
                            type="text"
                            className="sila-input"
                            placeholder="e.g. Option A, Option B"
                            value={(field.options || []).join(', ')}
                            onChange={(e) => handleSectionFieldOptionsChange(section.id, field.id, e.target.value)}
                          />
                        </div>
                      )}
                      <div className="ctpl-form-group ctpl-form-group--checkbox">
                        <input
                          type="checkbox"
                          id={`ctpl-field-mandatory-${field.id}`}
                          checked={field.mandatory}
                          onChange={(e) => handleSectionFieldChange(section.id, field.id, { mandatory: e.target.checked })}
                        />
                        <label htmlFor={`ctpl-field-mandatory-${field.id}`}>Mandatory</label>
                      </div>
                      <button
                        type="button"
                        className="ctpl-btn-remove-row sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                        onClick={() => handleRemoveSectionField(section.id, field.id)}
                        aria-label={`Remove field ${field.label || ''}`.trim()}
                        title="Remove field"
                      >
                        <Times size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                <button type="button" className="ctpl-btn-add-row" onClick={() => handleAddSectionField(section.id)}>
                  <Plus size={12} aria-hidden="true" /> Add Field
                </button>
              </div>
            ))}

            <button type="button" className="ctpl-btn-add-row" onClick={handleAddSection}>
              <Plus size={12} aria-hidden="true" /> Add Sub Header
            </button>
          </div>
            </>
          )}

          <div className="ctpl-form-actions">
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              onClick={handleCancelCreate}
              disabled={preparingPreview}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sila-btn sila-btn--primary"
              onClick={handlePreview}
              disabled={preparingPreview}
            >
              {preparingPreview && <span className="sila-spinner" aria-hidden="true" />}
              {preparingPreview ? 'Preparing Preview...' : 'Preview'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ctpl-container">
      <div className="ctpl-header sila-page-header">
        <div className="ctpl-header-content">
          <h1 className="sila-page-title">Contract Templates</h1>
          <p className="sila-page-description">
            Reusable templates with key terms and clause libraries used to generate procurement contracts.
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="ctpl-btn-create sila-btn sila-btn--primary" onClick={handleCreateNew}>
            <Plus size={12} aria-hidden="true" /> Create New Template
          </button>
        )}
      </div>

      {templatesError && (
        <div className="ctpl-error-message sila-alert sila-alert--danger" role="alert">
          {templatesError}
        </div>
      )}

      {loadingTemplates ? (
        <div className="ctpl-empty-state-container">
          <Loader size={24} message="Loading contract templates..." />
        </div>
      ) : templates.length === 0 ? (
        <div className="ctpl-empty-state-container">
          <EmptyState
            icon={<ContractIcon size={18} aria-hidden="true" />}
            title={
              isAdmin
                ? "No contract templates yet. Create a new template to get started."
                : "No contract templates available yet."
            }
          />
        </div>
      ) : (
        <div className="ctpl-table-wrapper">
          <div className="ctpl-table-scroll sila-table-wrap">
            <table className="ctpl-table sila-table">
              <thead>
                <tr>
                  <th scope="col">Template Name</th>
                  <th scope="col">Segment</th>
                  <th scope="col">Created</th>
                  <th scope="col" className="ctpl-col-action-heading" aria-label="Action" />
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="ctpl-table-row">
                    <td>
                      <div className="ctpl-template-name-wrapper">
                        <span>{template.templateName}</span>
                        {template.sourceType === 'uploaded' && (
                          <StatusBadge status="Uploaded" tone="info" size="sm" />
                        )}
                      </div>
                    </td>
                    <td>{template.segmentName}</td>
                    <td>{new Date(template.createdAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>
                      <div className="ctpl-action-buttons">
                        <button
                          type="button"
                          className="sila-btn sila-btn--ghost sila-btn--sm"
                          onClick={() => handleDownloadAgain(template)}
                          disabled={downloadingId === template.id}
                          aria-label={`Download PDF for ${template.templateName}`}
                        >
                          {downloadingId === template.id ? (
                            <span className="sila-spinner" aria-hidden="true" />
                          ) : (
                            <Download size={13} aria-hidden="true" />
                          )}
                          {downloadingId === template.id ? 'Loading...' : 'PDF'}
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--sm"
                              onClick={() => handleOpenEdit(template)}
                              aria-label={`Edit ${template.templateName}`}
                              title="Edit"
                            >
                              <Edit2 size={13} aria-hidden="true" /> Edit
                            </button>
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                              onClick={() => handleDeleteTemplate(template.id)}
                              aria-label={`Delete ${template.templateName}`}
                              title="Delete"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
