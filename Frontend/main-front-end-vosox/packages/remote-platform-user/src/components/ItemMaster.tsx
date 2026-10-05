import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBox,
  FaPlus,
  FaPen,
  FaTrash,
  FaCheck,
  FaTimes,
  FaUpload,
  FaExclamationTriangle,
} from 'react-icons/fa';
import { getAllBuyers } from '../api/platformApi';
import {
  getItemMastersByBuyer,
  createItemMaster,
  updateItemMaster,
  deleteItemMaster,
  uploadItemMasterExcel,
} from '../api/itemmasterapi';
import type { ItemMasterDto } from '../api/itemmasterapi';
import { PageHeader, EmptyState, Loader } from '@vosox/shared-ui';
import { useDepartmentStore } from './useDepartmentStore';
import './ItemMaster.css';

const sila_logo = `${window.location.protocol}//${window.location.host}/assets/SILA_Logo.png`;

interface ConfirmPopupProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ConfirmPopup: React.FC<ConfirmPopupProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="im-popup-overlay sila-root sila-overlay" onClick={onCancel}>
      <div
        className="im-popup sila-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="im-popup-title"
        aria-describedby="im-popup-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="im-popup-header sila-modal-header">
          <div className="im-popup-heading">
            <span className="im-popup-icon" aria-hidden="true">
              <FaExclamationTriangle />
            </span>
            <h3 id="im-popup-title" className="im-popup-title sila-modal-title">{title}</h3>
          </div>
        </div>
        <div className="im-popup-body sila-modal-body">
          <p id="im-popup-message" className="im-popup-message sila-modal-text">{message}</p>
        </div>
        <div className="im-popup-footer sila-modal-footer">
          <button
            type="button"
            className="im-popup-btn-cancel sila-btn sila-btn--secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="im-popup-btn-confirm sila-btn sila-btn--danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <span className="sila-spinner" aria-hidden="true" />}
            {isLoading ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToastProps {
  message: string;
  type: 'error' | 'success';
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`im-toast im-toast-${type} sila-root`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <span>{message}</span>
      <button type="button" className="im-toast-close" onClick={onClose} aria-label="Dismiss notification">
        <FaTimes aria-hidden="true" />
      </button>
    </div>
  );
};

export const ItemMaster: React.FC = () => {
  const navigate = useNavigate();

  const { selectedBuyer, setSelectedBuyer } = useDepartmentStore();


  const [itemMasters, setItemMasters] = useState<ItemMasterDto[]>([]);
  const [itemMastersLoading, setItemMastersLoading] = useState(false);

  const [description, setDescription] = useState('');
  const [materialCode, setMaterialCode] = useState('');
  const [materialGroup, setMaterialGroup] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editMaterialCode, setEditMaterialCode] = useState('');
  const [editMaterialGroup, setEditMaterialGroup] = useState('');
  const [originalItem, setOriginalItem] = useState<ItemMasterDto | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletePopup, setDeletePopup] = useState<{
    isOpen: boolean;
    itemId: string;
    itemName: string;
  }>({ isOpen: false, itemId: '', itemName: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);


  useEffect(() => {
    const fetchBuyers = async () => {
      try {
        const data = await getAllBuyers({ index: 0, limit: 1000 });
        const resolved = Array.isArray(data) ? data : (data as any)?.buyers || (data as any)?.data || [];

        const first = resolved[0] as any;
        if (first) {
          const buyerId = first.buyerId || first.id;
          const orgId = first.organizationId || first.id;
          const orgName = first.organizationName || first.businessProfile?.organizationName || 'Unnamed';

          if (buyerId) {
            setSelectedBuyer({
              id: buyerId,
              organizationId: orgId,
              organizationName: orgName,
            });
          }
        }
      } catch (err: any) {
        showToast(err.message || 'Failed to load buyers.', 'error');
      }
    };
    fetchBuyers();
  }, []);

  const fetchItemMasters = async (buyerId: string) => {
    setItemMastersLoading(true);
    try {
      const data = await getItemMastersByBuyer(buyerId, { index: 0, limit: 100 });
      const resolved = Array.isArray(data) ? data : (data as any)?.itemMasters || (data as any)?.data || [];
      setItemMasters(resolved);
    } catch (err: any) {
      showToast(err.message || 'Failed to load item masters.', 'error');
    } finally {
      setItemMastersLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedBuyer) {
      setItemMasters([]);
      return;
    }
    fetchItemMasters(selectedBuyer.id);
  }, [selectedBuyer?.id]);

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
  };

  const resetForm = () => {
    setDescription('');
    setMaterialCode('');
    setMaterialGroup('');
  };

  const handleCreate = async () => {
    if (!selectedBuyer) {
      showToast('Please select a buyer', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Please enter description', 'error');
      return;
    }
    if (!materialCode.trim()) {
      showToast('Please enter material code', 'error');
      return;
    }
    if (!materialGroup.trim()) {
      showToast('Please enter material group', 'error');
      return;
    }

    setCreating(true);
    try {
      await createItemMaster({
        buyerId: selectedBuyer.id,
        description: description.trim(),
        materialCode: materialCode.trim(),
        materialGroup: materialGroup.trim(),
      });

      showToast('Item master created successfully!', 'success');
      resetForm();
      await fetchItemMasters(selectedBuyer.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to create item master.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (item: ItemMasterDto) => {
    setEditingItem(item.id);
    setEditDescription(item.description);
    setEditMaterialCode(item.materialCode);
    setEditMaterialGroup(item.materialGroup);
    setOriginalItem(item);
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditDescription('');
    setEditMaterialCode('');
    setEditMaterialGroup('');
    setOriginalItem(null);
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!selectedBuyer || !originalItem) return;

    const descChanged = editDescription.trim() !== originalItem.description;
    const codeChanged = editMaterialCode.trim() !== originalItem.materialCode;
    const groupChanged = editMaterialGroup.trim() !== originalItem.materialGroup;

    if (!descChanged && !codeChanged && !groupChanged) {
      cancelEdit();
      return;
    }

    setSavingEdit(true);
    try {
      await updateItemMaster(itemId, {
        buyerId: selectedBuyer.id,
        description: editDescription.trim(),
        materialCode: editMaterialCode.trim(),
        materialGroup: editMaterialGroup.trim(),
      });

      showToast('Item master updated successfully!', 'success');
      cancelEdit();
      await fetchItemMasters(selectedBuyer.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to update item master.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeletePopup = (item: ItemMasterDto) => {
    setDeletePopup({
      isOpen: true,
      itemId: item.id,
      itemName: item.description,
    });
  };

  const closeDeletePopup = () => {
    setDeletePopup((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirmDelete = async () => {
    if (!deletePopup.itemId) return;

    setDeleteLoading(true);
    try {
      await deleteItemMaster(deletePopup.itemId);
      showToast('Item master deleted successfully!', 'success');
      closeDeletePopup();
      if (selectedBuyer) {
        await fetchItemMasters(selectedBuyer.id);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete item master.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedBuyer) return;

    setUploading(true);
    try {
      await uploadItemMasterExcel(selectedBuyer.id, file);
      showToast('File uploaded successfully!', 'success');
      await fetchItemMasters(selectedBuyer.id);
    } catch (err: any) {
      showToast(err.message || 'Failed to upload file.', 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleClose = () => {
    navigate('../settings');
  };

  const isFormDisabled = !selectedBuyer;

  return (
    <div className="im-page-container sila-root">
      <header className="im-top-header">
        <img src={sila_logo} alt="SILA" className="im-top-logo" />
      </header>

      <main className="im-content-wrapper">
        <PageHeader
          className="im-page-title-section"
          title="Item Master"
          description="Manage item master data for buyers"
          actions={
            <button
              type="button"
              className="im-close-btn sila-btn sila-btn--secondary sila-btn--icon"
              onClick={handleClose}
              title="Close"
              aria-label="Close item master"
            >
              <FaTimes aria-hidden="true" />
            </button>
          }
        />

        <section className="im-form-section" aria-labelledby="im-form-heading">
          <h2 id="im-form-heading" className="im-section-title">New item master</h2>
          <div className="im-form-grid">
            <div className="im-form-group sila-field">
              <label htmlFor="im-description" className="im-form-label sila-label">
                Description <span className="im-required sila-required" aria-hidden="true">*</span>
              </label>
              <input
                id="im-description"
                type="text"
                className={`im-form-input sila-input ${isFormDisabled ? 'im-input-disabled' : ''}`}
                placeholder={selectedBuyer ? 'Enter description' : 'Select a buyer first'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isFormDisabled}
                aria-required="true"
              />
            </div>

            <div className="im-form-group sila-field">
              <label htmlFor="im-material-code" className="im-form-label sila-label">
                Material Code <span className="im-required sila-required" aria-hidden="true">*</span>
              </label>
              <input
                id="im-material-code"
                type="text"
                className={`im-form-input sila-input ${isFormDisabled ? 'im-input-disabled' : ''}`}
                placeholder={selectedBuyer ? 'Enter material code' : 'Select a buyer first'}
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                disabled={isFormDisabled}
                aria-required="true"
              />
            </div>

            <div className="im-form-group sila-field">
              <label htmlFor="im-material-group" className="im-form-label sila-label">
                Material Group <span className="im-required sila-required" aria-hidden="true">*</span>
              </label>
              <input
                id="im-material-group"
                type="text"
                className={`im-form-input sila-input ${isFormDisabled ? 'im-input-disabled' : ''}`}
                placeholder={selectedBuyer ? 'Enter material group' : 'Select a buyer first'}
                value={materialGroup}
                onChange={(e) => setMaterialGroup(e.target.value)}
                disabled={isFormDisabled}
                aria-required="true"
              />
            </div>
          </div>

          <div className="im-form-actions">
            {selectedBuyer && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="im-file-input"
                  accept=".xlsx,.xls,.csv"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="im-btn-upload sila-btn sila-btn--secondary"
                  onClick={triggerFileUpload}
                  disabled={uploading}
                >
                  {uploading ? <span className="sila-spinner" aria-hidden="true" /> : <FaUpload aria-hidden="true" />}
                  {uploading ? 'Uploading...' : 'Upload Excel'}
                </button>
              </>
            )}

            <button
              type="button"
              className="im-btn-create sila-btn sila-btn--primary"
              onClick={handleCreate}
              disabled={creating || isFormDisabled}
            >
              {creating ? <span className="sila-spinner" aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
              {creating ? 'Creating...' : 'Create Item Master'}
            </button>
          </div>
        </section>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <section className="im-table-section" aria-label="Item masters">
          {!selectedBuyer ? (
            <EmptyState
              className="im-empty-state"
              icon={<FaBox aria-hidden="true" />}
              title="Select a Buyer"
              description="Choose a buyer to view item masters."
            />
          ) : itemMastersLoading ? (
            <div className="im-loading-container">
              <Loader size={24} message="Loading item masters..." />
            </div>
          ) : (
            <div className="im-table-wrapper sila-table-wrap">
              <table className="im-table sila-table">
                <thead>
                  <tr>
                    <th scope="col" className="im-th-desc">Description</th>
                    <th scope="col" className="im-th-code">Material Code</th>
                    <th scope="col" className="im-th-group">Material Group</th>
                    <th scope="col" className="im-th-edit">Edit</th>
                    <th scope="col" className="im-th-delete">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {itemMasters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="im-no-data">
                        <EmptyState
                          icon={<FaBox aria-hidden="true" />}
                          title="No item masters found for this buyer."
                        />
                      </td>
                    </tr>
                  ) : (
                    itemMasters.map((item, index) => {
                      const isEditing = editingItem === item.id;
                      return (
                        <tr
                          key={item.id}
                          className={`${index % 2 === 0 ? 'im-row-even' : 'im-row-odd'}${isEditing ? ' im-row-editing' : ''}`}
                        >
                          <td className="im-td-desc">
                            {isEditing ? (
                              <input
                                type="text"
                                className="im-edit-input sila-input"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                aria-label="Description"
                              />
                            ) : (
                              item.description
                            )}
                          </td>

                          <td className="im-td-code">
                            {isEditing ? (
                              <input
                                type="text"
                                className="im-edit-input sila-input"
                                value={editMaterialCode}
                                onChange={(e) => setEditMaterialCode(e.target.value)}
                                aria-label="Material code"
                              />
                            ) : (
                              <span className="sila-ref">{item.materialCode}</span>
                            )}
                          </td>

                          <td className="im-td-group">
                            {isEditing ? (
                              <input
                                type="text"
                                className="im-edit-input sila-input"
                                value={editMaterialGroup}
                                onChange={(e) => setEditMaterialGroup(e.target.value)}
                                aria-label="Material group"
                              />
                            ) : (
                              item.materialGroup
                            )}
                          </td>

                          <td className="im-td-edit">
                            {isEditing ? (
                              <div className="im-edit-actions">
                                <button
                                  type="button"
                                  className="im-save-btn sila-btn sila-btn--primary sila-btn--sm sila-btn--icon"
                                  onClick={() => handleSaveEdit(item.id)}
                                  disabled={savingEdit}
                                  title="Save"
                                  aria-label={`Save ${item.description}`}
                                >
                                  {savingEdit ? <span className="sila-spinner" aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
                                </button>
                                <button
                                  type="button"
                                  className="im-cancel-btn sila-btn sila-btn--secondary sila-btn--sm sila-btn--icon"
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                  title="Cancel"
                                  aria-label="Cancel editing"
                                >
                                  <FaTimes aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="im-edit-btn sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                                onClick={() => startEdit(item)}
                                title="Edit"
                                aria-label={`Edit ${item.description}`}
                              >
                                <FaPen aria-hidden="true" />
                              </button>
                            )}
                          </td>

                          <td className="im-td-delete">
                            <button
                              type="button"
                              className="im-delete-btn sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                              onClick={() => openDeletePopup(item)}
                              title="Delete"
                              aria-label={`Delete ${item.description}`}
                            >
                              <FaTrash aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <ConfirmPopup
        isOpen={deletePopup.isOpen}
        title="Delete Item Master"
        message={`Are you sure you want to delete "${deletePopup.itemName}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeletePopup}
        isLoading={deleteLoading}
      />
    </div>
  );
};

export default ItemMaster;