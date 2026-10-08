import { useState, useEffect } from 'react';
import {
  FaEye as Eye,
  FaEdit as Edit2,
  FaTrash as Trash2,
  FaPlus as Plus,
  FaCheck as Check,
  FaClipboardList as ClipboardIcon,
} from 'react-icons/fa';
import {
  toastService,
  EmptyState,
  Table,
  PageHeader,
  Card,
  StatusBadge,
  QuestionList,
  QuestionItem,
  QuestionOptions,
  Dropdown,
} from '@vosox/shared-ui';
import type { TableColumn, DropdownLoadParams, DropdownLoadResult } from '@vosox/shared-ui';
import './UserTemplate.css';
import {
  createBuyerVerificationTemplate,
  createVerificationTemplateQuestion,
  fetchBuyerVerificationTemplateById,
  fetchBuyerVerificationTemplates,
  updateVerificationTemplateQuestion,
  deleteVerificationTemplate,
  type CreateVerificationTemplatePayload,
  type VerificationTemplateQuestionDto,
} from '../../../remote-buyer/src/api/Buyerapi';
import { fetchDropdownReferenceList, type ReferenceListItemDto } from '../../../remote-buyer/src/api/masterdataApi';
import { useNetworkAdminAuthStore } from '../store/useAuthStore';

interface TemplateQuestion {
  questionId: string;
  question: string;
  questionKey: string;
  questionType: string;
  displayOrder: number;
  answer: string;
  options: string[];
  isRequired: boolean;
}

interface VerificationTemplate {
  templateId: string;
  templateCode: string;
  templateName: string;
  templateType: string;
  description?: string;
  questions: TemplateQuestion[];
}

interface UserTemplateProps {
  organizationId?: string;
}

interface FormField {
  id: number;
  questionId?: string;
  label: string;
  type: string;
  placeholder?: string;
  options?: string[];
  mandatory: boolean;
}

interface TemplateFormData {
  name: string;
  description: string;
  fields: FormField[];
}
const IconBack = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function UserTemplate({ organizationId }: UserTemplateProps) {
  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const [apiTemplates, setApiTemplates] = useState<VerificationTemplate[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    fields: [],
  });

  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState({
    label: '',
    type: '',
    options: '',
    mandatory: false,
  });

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [viewingTemplate, setViewingTemplate] = useState<VerificationTemplate | null>(null);
  const [loadingViewId, setLoadingViewId] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<string[]>([]);

  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<VerificationTemplate | null>(null);
  const [editFormData, setEditFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    fields: [],
  });
  const [editingFieldIdForEdit, setEditingFieldIdForEdit] = useState<number | null>(null);
  const [editFieldForm, setEditFieldForm] = useState({
    label: '',
    type: '',
    options: '',
    mandatory: false,
  });
  const [showEditFieldForm, setShowEditFieldForm] = useState(false);
  const [updatingTemplate, setUpdatingTemplate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [questionTypes, setQuestionTypes] = useState<ReferenceListItemDto[]>([]);
  const [loadingQuestionTypes, setLoadingQuestionTypes] = useState(false);
  const [questionTypesError, setQuestionTypesError] = useState<string | null>(null);
  const loadQuestionTypes = async (): Promise<ReferenceListItemDto[]> => {
    setLoadingQuestionTypes(true);
    setQuestionTypesError(null);
    try {
      const result = await fetchDropdownReferenceList(['QUESTION_TYPE']);
      if (!Array.isArray(result)) {
        setQuestionTypesError(result.message || 'Failed to load question types');
        return [];
      }
      setQuestionTypes(result);
      return result;
    } catch (err: any) {
      setQuestionTypesError(err?.message || 'Failed to load question types');
      return [];
    } finally {
      setLoadingQuestionTypes(false);
    }
  };

  const loadPage = async (page: number): Promise<boolean> => {
    setLoadingTemplates(true);
    setTemplatesError(null);
    try {
      const index = (page - 1) * itemsPerPage;
      const result = await fetchBuyerVerificationTemplates(index, itemsPerPage, organizationId);

      if (!Array.isArray(result)) {
        setTemplatesError(result.message || 'Failed to load templates');
        return false;
      }

      if (result.length === 0 && page > 1) {
        return loadPage(page - 1);
      }

      setCurrentPage(page);
      setApiTemplates(result);
      setHasNextPage(result.length === itemsPerPage);
      return true;
    } catch (err: any) {
      setTemplatesError(err?.message || 'Failed to load templates');
      return false;
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    loadPage(1);
  }, [organizationId]);

  useEffect(() => {
    loadQuestionTypes();
  }, []);

  const handleNextPage = () => {
    if (hasNextPage && !loadingTemplates) {
      loadPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1 && !loadingTemplates) {
      loadPage(currentPage - 1);
    }
  };

  const getQuestionTypeLabel = (key: string) =>
    questionTypes.find((qt) => qt.key === key)?.description || key;

  // ---- Async loader for the Field Type Dropdown (reference-list API has no paging or search, so search client-side) ----
  const loadQuestionTypeOptions = async ({ search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    // Reuse the types loaded on mount; fetch again only if that load failed
    const types = questionTypes.length > 0 ? questionTypes : await loadQuestionTypes();
    const searchTerm = search.trim().toLowerCase();
    return {
      options: types
        .filter((qt) => !searchTerm || qt.description.toLowerCase().includes(searchTerm))
        .map((qt) => ({ name: qt.description, value: qt.key })),
      hasMore: false,
    };
  };

  const isOptionsType = (key: string) => key === 'RADIO_BUTTON' || key === 'CHECK_BOX';


  const handleCreateTemplate = () => {
    setShowCreateForm(true);
    setCurrentStep(1);
    setPublishError(null);
    setFormData({ name: '', description: '', fields: [] });
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    setCurrentStep(1);
    setPublishError(null);
    setFormData({ name: '', description: '', fields: [] });
  };

  const handleStep1Next = () => {
    if (!formData.name.trim()) {
      toastService.error('Please enter a template name');
      return;
    }
    setCurrentStep(2);
  };

  const handleAddField = () => {
    setEditingFieldId(null);
    setFieldForm({
      label: '',
      type: questionTypes[0]?.key || '',
      options: '',
      mandatory: false,
    });
    setShowFieldForm(true);
  };

  const handleEditField = (fieldId: number) => {
    const field = formData.fields.find((f) => f.id === fieldId);
    if (field) {
      setEditingFieldId(fieldId);
      setFieldForm({
        label: field.label,
        type: field.type,
        options: field.options?.join(', ') || '',
        mandatory: field.mandatory,
      });
      setShowFieldForm(true);
    }
  };

  const handleDeleteField = (fieldId: number) => {
    setFormData({
      ...formData,
      fields: formData.fields.filter((f) => f.id !== fieldId),
    });
  };

  const handleSaveField = () => {
    if (!fieldForm.label.trim()) {
      toastService.error('Please enter a question label');
      return;
    }
    if (!fieldForm.type) {
      toastService.error('Please select a field type');
      return;
    }

    const newField: FormField = {
      id: editingFieldId || Date.now(),
      label: fieldForm.label,
      type: fieldForm.type,
      options: fieldForm.options
        ? fieldForm.options.split(',').map((opt) => opt.trim())
        : undefined,
      mandatory: fieldForm.mandatory,
    };

    if (editingFieldId) {
      setFormData({
        ...formData,
        fields: formData.fields.map((f) =>
          f.id === editingFieldId ? newField : f
        ),
      });
      toastService.success('Field updated successfully');
    } else {
      setFormData({
        ...formData,
        fields: [...formData.fields, newField],
      });
      toastService.success('Field added successfully');
    }

    setShowFieldForm(false);
  };

  const handlePublishTemplate = async () => {
    if (!formData.name.trim()) {
      toastService.error('Please enter a template name');
      return;
    }

    if (formData.fields.length === 0) {
      toastService.error('Please add at least one field');
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const templatePayload: CreateVerificationTemplatePayload = {
        templateName: formData.name,
        description: formData.description,
      };

      const templateResult = await createBuyerVerificationTemplate(templatePayload, organizationId);

      if (typeof templateResult !== 'string') {
        setPublishError(templateResult.message || 'Failed to create template');
        return;
      }

      const templateId = templateResult;

      for (let i = 0; i < formData.fields.length; i++) {
        const field = formData.fields[i];

        const questionDto: VerificationTemplateQuestionDto = {
          verificationTemplateId: templateId,
          question: field.label,
          questionType: field.type,
          isRequired: Boolean(field.mandatory),
          displayOrder: i,
          options: field.options || [],
        };

        const questionResult = await createVerificationTemplateQuestion({
          verificationTemplateQuestionDto: questionDto,
        });

        if (typeof questionResult !== 'string') {
          setPublishError(
            `Template created, but failed to save question "${field.label}": ${questionResult.message}`
          );
          return;
        }
      }

      const refreshed = await loadPage(1);
      if (!refreshed) {
        setPublishError('Template created, but the template list could not be refreshed. Please reload.');
        return;
      }

      handleCancelCreate();
      toastService.success('Template created successfully');
    } catch (err: any) {
      setPublishError(err?.message || 'Something went wrong while publishing the template.');
    } finally {
      setPublishing(false);
    }
  };

  const handleViewTemplate = async (templateId: string) => {
    setLoadingViewId(templateId);
    setViewError(null);

    try {
      const result = await fetchBuyerVerificationTemplateById(templateId);

      if ('statusCode' in result) {
        setViewError(result.message || 'Failed to load template details');
        return;
      }

      setViewingTemplate(result);
    } catch (err: any) {
      setViewError(err?.message || 'Failed to load template details');
    } finally {
      setLoadingViewId(null);
    }
  };

  const handleOpenEditTemplate = (template: VerificationTemplate) => {
    setEditingTemplate(template);
    const convertedFields: FormField[] = template.questions.map((q, idx) => ({
      id: idx,
      questionId: q.questionId,
      label: q.question,
      type: q.questionType,
      options: q.options && q.options.length > 0 ? q.options : undefined,
      mandatory: q.isRequired ?? false,
    }));
    setEditFormData({
      name: template.templateName,
      description: template.description || '',
      fields: convertedFields,
    });
    setUpdateError(null);
    setDeletedQuestionIds([]);
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setEditFormData({ name: '', description: '', fields: [] });
    setShowEditFieldForm(false);
    setUpdateError(null);
    setDeletedQuestionIds([]);
  };

  const handleAddFieldForEdit = () => {
    setEditingFieldIdForEdit(null);
    setEditFieldForm({
      label: '',
      type: questionTypes[0]?.key || '',
      options: '',
      mandatory: false,
    });
    setShowEditFieldForm(true);
  };

  const handleEditFieldForEdit = (fieldId: number) => {
    const field = editFormData.fields.find((f) => f.id === fieldId);
    if (field) {
      setEditingFieldIdForEdit(fieldId);
      setEditFieldForm({
        label: field.label,
        type: field.type,
        options: field.options?.join(', ') || '',
        mandatory: field.mandatory,
      });
      setShowEditFieldForm(true);
    }
  };

  const handleDeleteFieldForEdit = (fieldId: number) => {
    const fieldToDelete = editFormData.fields.find((f) => f.id === fieldId);

    if (fieldToDelete?.questionId) {
      setDeletedQuestionIds((prev) => [...prev, fieldToDelete.questionId!]);
    }

    setEditFormData({
      ...editFormData,
      fields: editFormData.fields.filter((f) => f.id !== fieldId),
    });
  };

  const handleSaveFieldForEdit = () => {
    if (!editFieldForm.label.trim()) {
      toastService.error('Please enter a question label');
      return;
    }
    if (!editFieldForm.type) {
      toastService.error('Please select a field type');
      return;
    }
    const originalField =
      editingFieldIdForEdit !== null
        ? editFormData.fields.find((f) => f.id === editingFieldIdForEdit)
        : undefined;

    const newField: FormField = {
      id: editingFieldIdForEdit ?? Date.now(),
      questionId: originalField?.questionId,
      label: editFieldForm.label,
      type: editFieldForm.type,
      options: editFieldForm.options
        ? editFieldForm.options.split(',').map((opt) => opt.trim())
        : undefined,
      mandatory: editFieldForm.mandatory,
    };

    if (editingFieldIdForEdit !== null) {
      setEditFormData({
        ...editFormData,
        fields: editFormData.fields.map((f) =>
          f.id === editingFieldIdForEdit ? newField : f
        ),
      });
      toastService.success('Field updated successfully');
    } else {
      setEditFormData({
        ...editFormData,
        fields: [...editFormData.fields, newField],
      });
      toastService.success('Field added successfully');
    }

    setShowEditFieldForm(false);
  };

  const handleUpdateTemplate = async () => {
    if (editFormData.fields.length === 0) {
      toastService.error('Please add at least one field');
      return;
    }

    if (!editingTemplate) return;

    setUpdatingTemplate(true);
    setUpdateError(null);

    try {
      for (let i = 0; i < editFormData.fields.length; i++) {
        const field = editFormData.fields[i];
        const options = (field.options || []).map((optionText, idx) => ({
          optionText,
          displayOrder: idx,
        }));

        if (field.questionId) {
          const result = await updateVerificationTemplateQuestion({
            verificationTemplateQuestionDto: {
              id: field.questionId,
              verificationTemplateId: editingTemplate.templateId,
              question: field.label,
              questionType: field.type,
              isRequired: Boolean(field.mandatory),
              displayOrder: i,
              options,
            },
          });

          if (typeof result !== 'string') {
            setUpdateError(
              `Failed to update question "${field.label}": ${result.message}`
            );
            return;
          }
        } else {
          const result = await createVerificationTemplateQuestion({
            verificationTemplateQuestionDto: {
              verificationTemplateId: editingTemplate.templateId,
              question: field.label,
              questionType: field.type,
              isRequired: Boolean(field.mandatory),
              displayOrder: i,
              options: field.options || [],
            },
          });

          if (typeof result !== 'string') {
            setUpdateError(
              `Failed to add question "${field.label}": ${result.message}`
            );
            return;
          }
        }
      }

      for (const questionId of deletedQuestionIds) {
        const originalQuestion = editingTemplate.questions.find(
          (q) => q.questionId === questionId
        );

        if (!originalQuestion) continue;

        const result = await updateVerificationTemplateQuestion({
          verificationTemplateQuestionDto: {
            id: questionId,
            verificationTemplateId: editingTemplate.templateId,
            question: originalQuestion.question,
            questionType: originalQuestion.questionType,
            isRequired: Boolean(originalQuestion.isRequired),
            displayOrder: originalQuestion.displayOrder,
            isDeleted: true,
            options: (originalQuestion.options || []).map((optionText, idx) => ({
              optionText,
              displayOrder: idx,
            })),
          },
        });

        if (typeof result !== 'string') {
          setUpdateError(
            `Failed to delete question "${originalQuestion.question}": ${result.message}`
          );
          return;
        }
      }

      const refreshed = await loadPage(currentPage);
      if (!refreshed) {
        setUpdateError(
          'Questions saved, but the template list could not be refreshed. Please reload.'
        );
        return;
      }

      if (viewingTemplate?.templateId === editingTemplate.templateId) {
        const latest = await fetchBuyerVerificationTemplateById(editingTemplate.templateId);
        if (!('statusCode' in latest)) setViewingTemplate(latest);
      }

      handleCancelEdit();
      toastService.success('Template updated successfully');
    } catch (err: any) {
      setUpdateError(
        err?.message || 'Something went wrong while updating the template.'
      );
    } finally {
      setUpdatingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    setDeletingTemplateId(templateId);
    setDeleteError(null);

    try {
      const result = await deleteVerificationTemplate(templateId);

      if (typeof result !== 'boolean' || result !== true) {
        const message =
          result && typeof result === 'object' && 'message' in result
            ? (result as { message?: string }).message || 'Failed to delete template'
            : 'Failed to delete template';
        setDeleteError(message);
        toastService.error(message);
        return;
      }

      const refreshed = await loadPage(currentPage);
      if (!refreshed) {
        setDeleteError('Template deleted, but the template list could not be refreshed. Please reload.');
        return;
      }

      toastService.success('Template deleted successfully');
    } catch (err: any) {
      const message = err?.message || 'Something went wrong while deleting the template.';
      setDeleteError(message);
      toastService.error(message);
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const createSteps = ['Enter Template Information', 'Configure Form Fields'];

  if (showCreateForm) {
    return (
      <div className="ut-container">
        <div className="ut-header ut-header--create sila-page-header">
          <div className="ut-header-main sila-page-header-main">
            <button
              type="button"
              className="afd-back ut-back-btn sila-btn sila-btn--secondary sila-btn--icon sila-btn--sm"
              onClick={handleCancelCreate}
              aria-label="Back to templates list"
              title="Back"
            >
              <IconBack />
            </button>
            <div className="ut-header-content">
              <h1 className="sila-page-title">Onboarding Registration Templates</h1>
              <p className="sila-page-description">Configure compliance checks, required physical files, and document parameters for unverified vendor groups.</p>
            </div>
          </div>
        </div>

        <div className="ut-form-card">
          <ol className="sila-steps ut-steps" aria-label="Template creation progress">
            {createSteps.map((label, idx) => {
              const stepNumber = idx + 1;
              const state =
                stepNumber < currentStep ? 'sila-step--done' : stepNumber === currentStep ? 'sila-step--current' : '';
              return (
                <li
                  key={label}
                  className={`sila-step ${state}`.trim()}
                  aria-current={stepNumber === currentStep ? 'step' : undefined}
                >
                  <span className="sila-step-marker" aria-hidden="true">
                    {stepNumber < currentStep ? <Check size={10} /> : stepNumber}
                  </span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          {currentStep === 1 ? (
            <>
              <div className="ut-form-header">
                <span className="ut-step-indicator">Step 1 of 2</span>
                <h2>Enter Template Information</h2>
              </div>

              <div className="ut-form-group sila-field">
                <label htmlFor="ut-create-name" className="sila-label">
                  Template Name <span className="sila-required" aria-hidden="true">*</span>
                </label>
                <input
                  id="ut-create-name"
                  type="text"
                  className="sila-input"
                  placeholder="Enter template name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  aria-required="true"
                />
              </div>

              <div className="ut-form-group sila-field">
                <label htmlFor="ut-create-description" className="sila-label">Description</label>
                <textarea
                  id="ut-create-description"
                  className="sila-textarea"
                  placeholder="Explain the target supplier group and compliance standards met this checklist."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={4}
                />
              </div>

              <div className="ut-form-actions">
                <button type="button" className="ut-btn-cancel sila-btn sila-btn--secondary" onClick={handleCancelCreate}>
                  Cancel
                </button>
                <button type="button" className="ut-btn-primary sila-btn sila-btn--primary" onClick={handleStep1Next}>
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="ut-form-header">
                <span className="ut-step-indicator">Step 2 of 2</span>
                <h2>Configure Form Fields</h2>
              </div>

              <div className="ut-add-field-section">
                <button type="button" className="ut-btn-add-field" onClick={handleAddField}>
                  <Plus size={12} aria-hidden="true" /> Add Form Field
                </button>
              </div>

              {showFieldForm && (
                <div className="ut-inline-field-form">
                  <div className="ut-inline-form-container">
                    <div className="ut-form-group sila-field">
                      <Dropdown
                        label="Field Type"
                        isRequired
                        placeholder={loadingQuestionTypes ? 'Loading...' : 'Select a field type'}
                        isAsync
                        loadOptions={loadQuestionTypeOptions}
                        cacheUniques={[questionTypes.length]}
                        value={fieldForm.type ? { name: getQuestionTypeLabel(fieldForm.type), value: fieldForm.type } : null}
                        onChange={(val) => setFieldForm((prev) => ({ ...prev, type: val?.value || '' }))}
                        isDisable={loadingQuestionTypes}
                        error={questionTypesError || undefined}
                      />
                    </div>

                    <div className="ut-form-group sila-field">
                      <label htmlFor="ut-create-field-label" className="sila-label">
                        Question Label <span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="ut-create-field-label"
                        type="text"
                        className="sila-input"
                        placeholder="eg. Business Type"
                        value={fieldForm.label}
                        onChange={(e) =>
                          setFieldForm({ ...fieldForm, label: e.target.value })
                        }
                        aria-required="true"
                      />
                    </div>

                    {isOptionsType(fieldForm.type) && (
                      <div className="ut-form-group sila-field">
                        <label htmlFor="ut-create-field-options" className="sila-label">Available Options (Comma Separated)</label>
                        <input
                          id="ut-create-field-options"
                          type="text"
                          className="sila-input"
                          placeholder="eg. Manufacturer, Distributor, Retailer"
                          value={fieldForm.options}
                          onChange={(e) =>
                            setFieldForm({
                              ...fieldForm,
                              options: e.target.value,
                            })
                          }
                        />
                      </div>
                    )}

                    <div className="ut-form-group ut-form-group--checkbox">
                      <input
                        type="checkbox"
                        id="mandatory"
                        checked={fieldForm.mandatory}
                        onChange={(e) =>
                          setFieldForm({
                            ...fieldForm,
                            mandatory: e.target.checked,
                          })
                        }
                      />
                      <label htmlFor="mandatory">
                        Make this field mandatory (*)
                      </label>
                    </div>

                    <div className="ut-inline-form-actions">
                      <button
                        type="button"
                        className="ut-btn-cancel sila-btn sila-btn--secondary sila-btn--sm"
                        onClick={() => setShowFieldForm(false)}
                      >
                        Cancel
                      </button>
                      <button type="button" className="ut-btn-primary sila-btn sila-btn--primary sila-btn--sm" onClick={handleSaveField}>
                        Save Field
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="ut-fields-list">
                <h3 className="ut-fields-list-title">Configured Form Schema ({formData.fields.length})</h3>
                {formData.fields.length === 0 ? (
                  <p className="ut-empty-state">No fields added yet. Click "Add Form Field" to get started.</p>
                ) : (
                  formData.fields.map((field) => (
                    <div key={field.id} className="ut-field-item">
                      <div className="ut-field-info">
                        <div className="ut-field-name">{field.label}</div>
                        <div className="ut-field-type">Type: {getQuestionTypeLabel(field.type)}</div>
                        {field.mandatory && (
                          <span className="ut-field-mandatory sila-badge sila-badge--sm sila-badge--danger">Mandatory</span>
                        )}
                      </div>
                      <div className="ut-field-actions">
                        <button
                          type="button"
                          className="ut-btn-edit-field sila-btn sila-btn--ghost sila-btn--sm"
                          onClick={() => handleEditField(field.id)}
                          aria-label={`Edit field ${field.label}`}
                        >
                          <Edit2 size={13} aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          className="ut-btn-delete-field sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                          onClick={() => handleDeleteField(field.id)}
                          aria-label={`Delete field ${field.label}`}
                          title="Delete"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {publishError && (
                <div className="ut-error-message ut-error-message--form sila-alert sila-alert--danger" role="alert">
                  {publishError}
                </div>
              )}

              <div className="ut-form-actions">
                <button
                  type="button"
                  className="ut-btn-cancel sila-btn sila-btn--secondary"
                  onClick={() => setCurrentStep(1)}
                  disabled={publishing}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ut-btn-publish sila-btn sila-btn--primary"
                  onClick={handlePublishTemplate}
                  disabled={publishing}
                >
                  {publishing && <span className="sila-spinner" aria-hidden="true" />}
                  {publishing ? 'Publishing...' : 'Publish Template'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Editing is its own page too. It sits in front of the details page (if open), so Cancel
  // and Save return there; opened from the list, they return to the list.
  if (editingTemplate) {
    return (
      <div className="ut-container">
        <PageHeader
          title={`Edit: ${editingTemplate.templateName}`}
          description="Add, change or remove the questions suppliers answer. Name and description can't be changed."
          onBack={handleCancelEdit}
          backLabel={viewingTemplate ? 'Back to template details' : 'Back to templates list'}
        />

        <div className="ut-form-card">
          <div className="ut-form-group sila-field">
            <label htmlFor="ut-edit-name" className="sila-label">Template Name</label>
            <input
              id="ut-edit-name"
              type="text"
              className="ut-input--readonly sila-input"
              readOnly
              value={editFormData.name}
            />
          </div>

          <div className="ut-form-group sila-field">
            <label htmlFor="ut-edit-description" className="sila-label">Description</label>
            <textarea
              id="ut-edit-description"
              className="ut-textarea--readonly sila-textarea"
              readOnly
              value={editFormData.description}
              rows={4}
            />
          </div>

          <div className="ut-add-field-section">
            <button type="button" className="ut-btn-add-field" onClick={handleAddFieldForEdit}>
              <Plus size={12} aria-hidden="true" /> Add Form Field
            </button>
          </div>

          {showEditFieldForm && (
            <div className="ut-inline-field-form">
              <div className="ut-inline-form-container">
                <div className="ut-form-group sila-field">
                  <Dropdown
                    label="Field Type"
                    isRequired
                    placeholder={loadingQuestionTypes ? 'Loading...' : 'Select a field type'}
                    isAsync
                    loadOptions={loadQuestionTypeOptions}
                    cacheUniques={[questionTypes.length]}
                    value={editFieldForm.type ? { name: getQuestionTypeLabel(editFieldForm.type), value: editFieldForm.type } : null}
                    onChange={(val) => setEditFieldForm((prev) => ({ ...prev, type: val?.value || '' }))}
                    isDisable={loadingQuestionTypes}
                    error={questionTypesError || undefined}
                  />
                </div>

                <div className="ut-form-group sila-field">
                  <label htmlFor="ut-edit-field-label" className="sila-label">
                    Question Label <span className="sila-required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="ut-edit-field-label"
                    type="text"
                    className="sila-input"
                    placeholder="eg. Business Type"
                    value={editFieldForm.label}
                    onChange={(e) =>
                      setEditFieldForm({ ...editFieldForm, label: e.target.value })
                    }
                    aria-required="true"
                  />
                </div>

                {isOptionsType(editFieldForm.type) && (
                  <div className="ut-form-group sila-field">
                    <label htmlFor="ut-edit-field-options" className="sila-label">Available Options (Comma Separated)</label>
                    <input
                      id="ut-edit-field-options"
                      type="text"
                      className="sila-input"
                      placeholder="eg. Manufacturer, Distributor, Retailer"
                      value={editFieldForm.options}
                      onChange={(e) =>
                        setEditFieldForm({
                          ...editFieldForm,
                          options: e.target.value,
                        })
                      }
                    />
                  </div>
                )}

                <div className="ut-form-group ut-form-group--checkbox">
                  <input
                    type="checkbox"
                    id="mandatory-edit"
                    checked={editFieldForm.mandatory}
                    onChange={(e) =>
                      setEditFieldForm({
                        ...editFieldForm,
                        mandatory: e.target.checked,
                      })
                    }
                  />
                  <label htmlFor="mandatory-edit">
                    Make this field mandatory (*)
                  </label>
                </div>

                <div className="ut-inline-form-actions">
                  <button
                    type="button"
                    className="ut-btn-cancel sila-btn sila-btn--secondary sila-btn--sm"
                    onClick={() => setShowEditFieldForm(false)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="ut-btn-primary sila-btn sila-btn--primary sila-btn--sm" onClick={handleSaveFieldForEdit}>
                    Save Field
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="ut-fields-list">
            <h3 className="ut-fields-list-title">Configured Form Schema ({editFormData.fields.length})</h3>
            {editFormData.fields.length === 0 ? (
              <p className="ut-empty-state">No fields added yet. Click "Add Form Field" to get started.</p>
            ) : (
              editFormData.fields.map((field) => (
                <div key={field.id} className="ut-field-item">
                  <div className="ut-field-info">
                    <div className="ut-field-name">{field.label}</div>
                    <div className="ut-field-type">Type: {getQuestionTypeLabel(field.type)}</div>
                    {field.mandatory && (
                      <span className="ut-field-mandatory sila-badge sila-badge--sm sila-badge--danger">Mandatory</span>
                    )}
                  </div>
                  <div className="ut-field-actions">
                    <button
                      type="button"
                      className="ut-btn-edit-field sila-btn sila-btn--ghost sila-btn--sm"
                      onClick={() => handleEditFieldForEdit(field.id)}
                      aria-label={`Edit field ${field.label}`}
                    >
                      <Edit2 size={13} aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      className="ut-btn-delete-field sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                      onClick={() => handleDeleteFieldForEdit(field.id)}
                      aria-label={`Delete field ${field.label}`}
                      title="Delete"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {updateError && (
            <div className="ut-error-message ut-error-message--form sila-alert sila-alert--danger" role="alert">
              {updateError}
            </div>
          )}

          <div className="ut-form-actions">
            <button
              type="button"
              className="ut-btn-cancel sila-btn sila-btn--secondary"
              onClick={handleCancelEdit}
              disabled={updatingTemplate}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ut-btn-publish sila-btn sila-btn--primary"
              onClick={handleUpdateTemplate}
              disabled={updatingTemplate}
            >
              {updatingTemplate && <span className="sila-spinner" aria-hidden="true" />}
              {updatingTemplate ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Template details open as their own page (like Create), not a dialog over the list.
  if (viewingTemplate) {
    const sortedQuestions = viewingTemplate.questions.slice().sort((a, b) => a.displayOrder - b.displayOrder);
    const requiredCount = sortedQuestions.filter((q) => q.isRequired).length;
    const canEdit = currentUser?.userRole === "BUYER_ADMINISTRATOR";

    return (
      <div className="ut-container">
        <PageHeader
          title={viewingTemplate.templateName}
          meta={<StatusBadge status={viewingTemplate.templateType} tone="info" size="sm" />}
          description={viewingTemplate.description || 'Questions suppliers answer when this template is attached to an invitation.'}
          onBack={() => setViewingTemplate(null)}
          backLabel="Back to templates list"
          actions={canEdit && (
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              onClick={() => handleOpenEditTemplate(viewingTemplate)}
            >
              <Edit2 size={13} aria-hidden="true" /> Edit Template
            </button>
          )}
        />

        <Card>
          <dl className="sila-meta-grid">
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Template Code</dt>
              <dd className="sila-meta-value"><span className="sila-ref">{viewingTemplate.templateCode}</span></dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Type</dt>
              <dd className="sila-meta-value">{viewingTemplate.templateType}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Questions</dt>
              <dd className="sila-meta-value">{sortedQuestions.length}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Required</dt>
              <dd className="sila-meta-value">{requiredCount} of {sortedQuestions.length}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Questions" subtitle="Shown to suppliers in this order.">
          {sortedQuestions.length === 0 ? (
            <EmptyState
              icon={<ClipboardIcon size={18} aria-hidden="true" />}
              title="No questions configured for this template."
            />
          ) : (
            <QuestionList aria-label={`${viewingTemplate.templateName} questions`}>
              {sortedQuestions.map((q, index) => (
                <QuestionItem
                  key={q.questionId}
                  index={index + 1}
                  question={q.question}
                  typeLabel={getQuestionTypeLabel(q.questionType)}
                  required={q.isRequired}
                >
                  {q.options && q.options.length > 0 && <QuestionOptions options={q.options} />}
                </QuestionItem>
              ))}
            </QuestionList>
          )}
        </Card>
      </div>
    );
  }

  const isBuyerAdmin = currentUser?.userRole === "BUYER_ADMINISTRATOR";

  const templateColumns: TableColumn<VerificationTemplate>[] = [
    {
      id: 'templateName',
      header: 'Template Name',
      headerClassName: 'ut-col-name',
      className: 'ut-col-name',
      cell: ({ row }) => (
        <div className="ut-template-name-wrapper">
          <div className="ut-template-name">{row.templateName}</div>
          <div className="ut-template-description">
            {row.questions.length} questions • {row.templateType}
          </div>
        </div>
      ),
    },
    {
      id: 'lastModified',
      header: 'Last Modified',
      headerClassName: 'ut-col-modified',
      className: 'ut-col-modified',
      cell: () => new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' }),
    },
    {
      id: 'actions',
      header: 'Action',
      headerClassName: 'ut-col-action ut-col-action-heading',
      className: 'ut-col-action',
      cell: ({ row: template }) => (
        <div className={`ut-action-buttons ${template.templateType === "DEFAULT" ? "ut-default-template" : ""}`}>
          <button
            type="button"
            className="ut-btn-action ut-btn-view sila-btn sila-btn--ghost sila-btn--sm"
            title="View"
            onClick={() => handleViewTemplate(template.templateId)}
            disabled={loadingViewId === template.templateId}
            aria-label={`View ${template.templateName}`}
          >
            {loadingViewId === template.templateId ? (
              <span className="sila-spinner" aria-hidden="true" />
            ) : (
              <Eye size={13} aria-hidden="true" />
            )}
            {loadingViewId === template.templateId ? 'Loading...' : 'View'}
          </button>
          {isBuyerAdmin && (
            <>
              <button
                type="button"
                className="ut-btn-action ut-btn-edit sila-btn sila-btn--ghost sila-btn--sm"
                title="Edit"
                onClick={() => handleOpenEditTemplate(template)}
                aria-label={`Edit ${template.templateName}`}
              >
                <Edit2 size={13} aria-hidden="true" />
                Edit
              </button>
              <button
                type="button"
                className="ut-btn-action ut-btn-delete sila-btn sila-btn--ghost sila-btn--sm"
                title="Delete"
                onClick={() => setConfirmDeleteId(template.templateId)}
                disabled={deletingTemplateId === template.templateId}
                aria-label={`Delete ${template.templateName}`}
              >
                {deletingTemplateId === template.templateId ? (
                  <span className="sila-spinner" aria-hidden="true" />
                ) : (
                  <Trash2 size={13} aria-hidden="true" />
                )}
                {deletingTemplateId === template.templateId ? 'Deleting...' : ''}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="ut-container ut-container--list">
      <div className="ut-header sila-page-header">
        <div className="ut-header-content">
          <h1 className="sila-page-title">Onboarding Registration Templates</h1>
          <p className="sila-page-description">Configure compliance checks, required physical files, and document parameters for unverified vendor groups.</p>
        </div>
        {currentUser?.userRole === "BUYER_ADMINISTRATOR" && (
          <button type="button" className="ut-btn-create sila-btn sila-btn--primary" onClick={handleCreateTemplate}>
            <Plus size={12} aria-hidden="true" /> Create Template
          </button>
        )}
      </div>

      {viewError && (
        <div className="ut-error-message ut-error-message--page sila-alert sila-alert--danger" role="alert">
          {viewError}
        </div>
      )}

      {deleteError && (
        <div className="ut-error-message ut-error-message--page sila-alert sila-alert--danger" role="alert">
          {deleteError}
        </div>
      )}

      <Table<VerificationTemplate>
        columns={templateColumns}
        data={apiTemplates}
        getRowId={(template) => template.templateId}
        loading={loadingTemplates}
        loadingLabel="Loading templates…"
        error={templatesError ?? undefined}
        emptyState={{
          icon: <ClipboardIcon size={18} aria-hidden="true" />,
          title: 'No templates available. Create a new template to get started.',
        }}
        rowClassName="ut-table-row"
        className="ut-table-wrapper ut-table"
        wrapClassName="ut-table-scroll"
        pagination={
          apiTemplates.length > 0 && (currentPage > 1 || hasNextPage)
            ? {
                page: currentPage,
                hasNext: hasNextPage,
                onPrevious: handlePrevPage,
                onNext: handleNextPage,
                disabled: loadingTemplates,
                summary: `Page ${currentPage}`,
              }
            : undefined
        }
      />

      {/* Inline Delete Confirmation */}
      {confirmDeleteId && (
        <div className="ut-modal-overlay sila-root sila-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div
            className="ut-modal ut-modal--confirm sila-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="ut-confirm-title"
            aria-describedby="ut-confirm-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header">
              <h2 id="ut-confirm-title" className="sila-modal-title">Delete template</h2>
            </div>
            <div className="sila-modal-body">
              <p id="ut-confirm-text" className="ut-confirm-text sila-modal-text">
                Are you sure you want to delete this template? This cannot be undone.
              </p>
            </div>
            <div className="ut-form-actions ut-form-actions--modal sila-modal-footer">
              <button
                type="button"
                className="ut-btn-cancel sila-btn sila-btn--secondary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ut-btn-delete-confirm sila-btn sila-btn--danger"
                onClick={() => {
                  const templateId = confirmDeleteId;
                  setConfirmDeleteId(null);
                  handleDeleteTemplate(templateId);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
