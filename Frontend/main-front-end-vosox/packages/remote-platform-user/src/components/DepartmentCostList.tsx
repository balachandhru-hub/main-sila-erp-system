import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaPen,
  FaCheck,
  FaTrash,
  FaTimes,
  FaBuilding,
  FaExclamationTriangle,
} from 'react-icons/fa';
import {
  getAllBuyers,
  getDepartmentsByBuyer,
  getCostCentersByDepartment,
} from '../api/platformApi';
import {
  deleteDepartment,
  deleteCostCenter,
  updateDepartment,
  updateCostCenter,
} from '../api/departmentcostapi';
import type { DepartmentListItemDto, CostCenterListItemDto } from '../api/platformApi';
import { PageHeader, EmptyState, Loader } from '@vosox/shared-ui';
import { useDepartmentStore } from './useDepartmentStore';
import './DepartmentCostList.css';

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
    <div className="dcl-popup-overlay sila-root sila-overlay" onClick={onCancel}>
      <div
        className="dcl-popup sila-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dcl-popup-title"
        aria-describedby="dcl-popup-message"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dcl-popup-header sila-modal-header">
          <div className="dcl-popup-heading">
            <span className="dcl-popup-icon" aria-hidden="true">
              <FaExclamationTriangle />
            </span>
            <h3 id="dcl-popup-title" className="dcl-popup-title sila-modal-title">{title}</h3>
          </div>
        </div>
        <div className="dcl-popup-body sila-modal-body">
          <p id="dcl-popup-message" className="dcl-popup-message sila-modal-text">{message}</p>
        </div>
        <div className="dcl-popup-footer sila-modal-footer">
          <button
            type="button"
            className="dcl-popup-btn-cancel sila-btn sila-btn--secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dcl-popup-btn-confirm sila-btn sila-btn--danger"
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
      className={`dcl-toast dcl-toast-${type} sila-root`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <span>{message}</span>
      <button type="button" className="dcl-toast-close" onClick={onClose} aria-label="Dismiss notification">
        <FaTimes aria-hidden="true" />
      </button>
    </div>
  );
};

export const DepartmentCostList: React.FC = () => {
  const navigate = useNavigate();

  const { selectedBuyer, setSelectedBuyer } = useDepartmentStore();

  const [departments, setDepartments] = useState<DepartmentListItemDto[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentListItemDto | null>(null);

  const [costCenters, setCostCenters] = useState<CostCenterListItemDto[]>([]);
  const [costCentersLoading, setCostCentersLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editDepartmentName, setEditDepartmentName] = useState('');
  const [editCostCenters, setEditCostCenters] = useState<CostCenterListItemDto[]>([]);

  const [originalDepartmentName, setOriginalDepartmentName] = useState('');
  const [originalCostCenters, setOriginalCostCenters] = useState<CostCenterListItemDto[]>([]);

  const [confirmPopup, setConfirmPopup] = useState<{
    isOpen: boolean;
    type: 'department' | 'costcenter';
    title: string;
    message: string;
    targetId: string;
    targetIndex?: number;
  }>({
    isOpen: false,
    type: 'department',
    title: '',
    message: '',
    targetId: '',
  });

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  useEffect(() => {
    const fetchAndSelectBuyer = async () => {
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
        setError(err.message || 'Failed to load buyers.');
      }
    };
    fetchAndSelectBuyer();
  }, []);

  useEffect(() => {
    if (!selectedBuyer) {
      setDepartments([]);
      setSelectedDepartment(null);
      setCostCenters([]);
      return;
    }

    const fetchDepartments = async () => {
      setDepartmentsLoading(true);
      setError(null);
      try {
        const data = await getDepartmentsByBuyer(selectedBuyer.id, { index: 0, limit: 100 });
        const resolved = Array.isArray(data) ? data : (data as any)?.departments || (data as any)?.data || [];
        setDepartments(resolved);
      } catch (err: any) {
        setError(err.message || 'Failed to load departments.');
      } finally {
        setDepartmentsLoading(false);
      }
    };

    fetchDepartments();
  }, [selectedBuyer?.id]); 

  const fetchCostCenters = async (deptId: string) => {
    setCostCentersLoading(true);
    setError(null);
    try {
      const data = await getCostCentersByDepartment(deptId, { index: 0, limit: 100 });
      const resolved = Array.isArray(data) ? data : (data as any)?.costCenters || (data as any)?.data || [];
      setCostCenters(resolved);
    } catch (err: any) {
      setError(err.message || 'Failed to load cost centers.');
    } finally {
      setCostCentersLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDepartment) {
      setCostCenters([]);
      return;
    }
    fetchCostCenters(selectedDepartment.id);
  }, [selectedDepartment]);


  const handleDepartmentSelect = (deptId: string) => {
    if (!deptId) {
      setSelectedDepartment(null);
      return;
    }
    const dept = departments.find((d) => d.id === deptId);
    if (dept) {
      setSelectedDepartment(dept);
      setIsEditing(false);
    }
  };

  const handleEdit = () => {
    setOriginalDepartmentName(selectedDepartment?.department || '');
    setOriginalCostCenters([...costCenters]);
    setEditDepartmentName(selectedDepartment?.department || '');
    setEditCostCenters([...costCenters]);
    setIsEditing(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!selectedDepartment) return;

    const deptChanged = editDepartmentName.trim() !== originalDepartmentName.trim();
    const changedCostCenters = editCostCenters.filter((cc, i) => {
      const original = originalCostCenters[i];
      return !original || cc.costCenter.trim() !== original.costCenter.trim();
    });

    if (!deptChanged && changedCostCenters.length === 0) {
      setIsEditing(false);
      return;
    }

    setSaveLoading(true);
    setError(null);

    try {
      const promises: Promise<any>[] = [];

      if (deptChanged) {
        promises.push(
          updateDepartment(selectedDepartment.id, editDepartmentName.trim())
        );
      }

      for (const cc of changedCostCenters) {
        promises.push(updateCostCenter(cc.id, cc.costCenter.trim()));
      }

      await Promise.all(promises);

      if (deptChanged && selectedDepartment) {
        setSelectedDepartment({
          ...selectedDepartment,
          department: editDepartmentName.trim(),
        });
        if (selectedBuyer) {
          const data = await getDepartmentsByBuyer(selectedBuyer.id, { index: 0, limit: 100 });
          const resolved = Array.isArray(data) ? data : (data as any)?.departments || (data as any)?.data || [];
          setDepartments(resolved);
        }
      }

      if (selectedDepartment) {
        await fetchCostCenters(selectedDepartment.id);
      }

      setIsEditing(false);
      setToast({ message: 'Changes saved successfully!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save changes.', type: 'error' });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditCostCenters([]);
    setEditDepartmentName('');
    setError(null);
  };

  const openDeleteDepartmentConfirm = () => {
    if (!selectedDepartment) return;
    setConfirmPopup({
      isOpen: true,
      type: 'department',
      title: 'Delete Department',
      message: `Are you sure you want to delete the department "${selectedDepartment.department}"? This will also remove all associated cost centers.`,
      targetId: selectedDepartment.id,
    });
  };

  const openDeleteCostCenterConfirm = (costCenterId: string, costCenterName: string, index: number) => {
    setConfirmPopup({
      isOpen: true,
      type: 'costcenter',
      title: 'Delete Cost Center',
      message: `Are you sure you want to delete the cost center "${costCenterName}"?`,
      targetId: costCenterId,
      targetIndex: index,
    });
  };

  const closeConfirmPopup = () => {
    setConfirmPopup((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirmDelete = async () => {
    if (!confirmPopup.targetId) return;

    setDeleteLoading(true);
    setError(null);

    try {
      if (confirmPopup.type === 'department') {
        await deleteDepartment(confirmPopup.targetId);
        setSelectedDepartment(null);
        setCostCenters([]);
        setDepartments((prev) => prev.filter((d) => d.id !== confirmPopup.targetId));
        setIsEditing(false);
        setToast({ message: 'Department deleted successfully!', type: 'success' });
      } else {
        await deleteCostCenter(confirmPopup.targetId);
        if (selectedDepartment) {
          await fetchCostCenters(selectedDepartment.id);
        }
        if (confirmPopup.targetIndex !== undefined) {
          setEditCostCenters((prev) => prev.filter((_, i) => i !== confirmPopup.targetIndex));
        }
        setToast({ message: 'Cost center deleted successfully!', type: 'success' });
      }
      closeConfirmPopup();
    } catch (err: any) {
      setToast({ message: err.message || `Failed to delete ${confirmPopup.type}.`, type: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleClose = () => {
    navigate('../settings');
  };

  const rowSpanCount = isEditing ? editCostCenters.length : costCenters.length;

  return (
    <div className="dcl-page-container sila-root">
      <header className="dcl-top-header">
        <img src={sila_logo} alt="SILA" className="dcl-top-logo" />
      </header>

      <main className="dcl-content-wrapper">
        <PageHeader
          className="dcl-page-title-section"
          title="Department & Cost Center List"
          description="Select a department to view and manage cost centers"
          actions={
            <button
              type="button"
              className="dcl-close-btn sila-btn sila-btn--secondary sila-btn--icon"
              onClick={handleClose}
              title="Close"
              aria-label="Close department and cost center list"
            >
              <FaTimes aria-hidden="true" />
            </button>
          }
        />

        {error && (
          <div className="dcl-error-banner sila-alert sila-alert--danger" role="alert">
            <FaExclamationTriangle className="dcl-error-icon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}

        <section className="dcl-table-section" aria-label="Cost centers">
          <div className="dcl-filters-bar sila-toolbar">
            <div className="dcl-filter-group">
              <label htmlFor="dcl-department-select" className="dcl-filter-label sila-label">
                Department <span className="dcl-required sila-required" aria-hidden="true">*</span>
              </label>
              <div className="dcl-select-wrapper">
                <select
                  id="dcl-department-select"
                  className={`dcl-form-select sila-select ${!selectedBuyer ? 'dcl-select-disabled' : ''}`}
                  value={selectedDepartment?.id || ''}
                  onChange={(e) => handleDepartmentSelect(e.target.value)}
                  disabled={!selectedBuyer || departmentsLoading}
                  aria-required="true"
                  aria-busy={departmentsLoading || undefined}
                >
                  <option value="">
                    {!selectedBuyer
                      ? 'Select buyer first'
                      : departmentsLoading
                      ? 'Loading departments...'
                      : '-- Choose a Department --'}
                  </option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.department}
                    </option>
                  ))}
                </select>
                {selectedDepartment && (
                  <button
                    type="button"
                    className="dcl-clear-select-btn"
                    onClick={() => handleDepartmentSelect('')}
                    title="Clear department"
                    aria-label="Clear department"
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {!selectedDepartment ? (
            <EmptyState
              className="dcl-empty-state"
              icon={<FaBuilding aria-hidden="true" />}
              title={!selectedBuyer ? 'Select a Buyer' : 'Select a Department'}
              description={
                !selectedBuyer
                  ? 'Choose a buyer from the dropdown above to get started.'
                  : 'Choose a department to view its cost centers.'
              }
            />
          ) : costCentersLoading ? (
            <div className="dcl-loading-container">
              <Loader size={24} message="Loading cost centers..." />
            </div>
          ) : (
            <div className="dcl-table-wrapper sila-table-wrap">
              <table className="dcl-table sila-table">
                <thead>
                  <tr>
                    <th scope="col" className="dcl-th-dept">Department</th>
                    <th scope="col" className="dcl-th-cc">Cost Center</th>
                    <th scope="col" className="dcl-th-edit">Edit</th>
                    <th scope="col" className="dcl-th-delete">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {costCenters.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="dcl-no-data">
                        <EmptyState
                          icon={<FaBuilding aria-hidden="true" />}
                          title="No cost centers found for this department."
                        />
                      </td>
                    </tr>
                  ) : (
                    (isEditing ? editCostCenters : costCenters).map((cc, index) => (
                      <tr
                        key={isEditing ? `edit-${index}` : cc.id}
                        className={`${index % 2 === 0 ? 'dcl-row-even' : 'dcl-row-odd'}${isEditing ? ' dcl-row-editing' : ''}`}
                      >
                        {index === 0 && (
                          <td className="dcl-td-dept" rowSpan={rowSpanCount}>
                            {isEditing ? (
                              <input
                                type="text"
                                className="dcl-edit-input sila-input"
                                value={editDepartmentName}
                                onChange={(e) => setEditDepartmentName(e.target.value)}
                                aria-label="Department name"
                              />
                            ) : (
                              <span className="dcl-dept-name">{selectedDepartment.department}</span>
                            )}
                          </td>
                        )}

                        <td className="dcl-td-cc">
                          {isEditing ? (
                            <div className="dcl-cc-edit-row">
                              <input
                                type="text"
                                className="dcl-edit-input sila-input"
                                value={cc.costCenter}
                                onChange={(e) => {
                                  const updated = [...editCostCenters];
                                  updated[index] = { ...updated[index], costCenter: e.target.value };
                                  setEditCostCenters(updated);
                                }}
                                aria-label={`Cost center ${index + 1}`}
                              />
                              <button
                                type="button"
                                className="dcl-cc-delete-btn sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                                onClick={() => openDeleteCostCenterConfirm(cc.id, cc.costCenter, index)}
                                title="Delete cost center"
                                aria-label={`Delete cost center ${cc.costCenter}`}
                              >
                                <FaTrash aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <span className="dcl-cc-name sila-ref">{cc.costCenter}</span>
                          )}
                        </td>

                        {index === 0 && (
                          <td className="dcl-td-edit" rowSpan={rowSpanCount}>
                            {isEditing ? (
                              <div className="dcl-edit-actions">
                                <button
                                  type="button"
                                  className="dcl-save-btn sila-btn sila-btn--primary sila-btn--sm sila-btn--icon"
                                  onClick={handleSave}
                                  disabled={saveLoading}
                                  title="Save changes"
                                  aria-label="Save changes"
                                >
                                  {saveLoading ? <span className="sila-spinner" aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
                                </button>
                                <button
                                  type="button"
                                  className="dcl-cancel-btn sila-btn sila-btn--secondary sila-btn--sm sila-btn--icon"
                                  onClick={handleCancelEdit}
                                  disabled={saveLoading}
                                  title="Cancel"
                                  aria-label="Cancel editing"
                                >
                                  <FaTimes aria-hidden="true" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="dcl-edit-btn sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                                onClick={handleEdit}
                                title="Edit department"
                                aria-label={`Edit department ${selectedDepartment.department}`}
                              >
                                <FaPen aria-hidden="true" />
                              </button>
                            )}
                          </td>
                        )}

                        {index === 0 && (
                          <td className="dcl-td-delete" rowSpan={rowSpanCount}>
                            <button
                              type="button"
                              className="dcl-delete-btn sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                              onClick={openDeleteDepartmentConfirm}
                              title="Delete department"
                              aria-label={`Delete department ${selectedDepartment.department}`}
                            >
                              <FaTrash aria-hidden="true" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}

                  {isEditing && editCostCenters.length === 0 && (
                    <tr className="dcl-row-editing">
                      <td className="dcl-td-dept">
                        <input
                          type="text"
                          className="dcl-edit-input sila-input"
                          value={editDepartmentName}
                          onChange={(e) => setEditDepartmentName(e.target.value)}
                          aria-label="Department name"
                        />
                      </td>
                      <td className="dcl-td-cc dcl-no-cc">No cost centers remaining</td>
                      <td className="dcl-td-edit">
                        <div className="dcl-edit-actions">
                          <button
                            type="button"
                            className="dcl-save-btn sila-btn sila-btn--primary sila-btn--sm sila-btn--icon"
                            onClick={handleSave}
                            disabled={saveLoading}
                            title="Save changes"
                            aria-label="Save changes"
                          >
                            {saveLoading ? <span className="sila-spinner" aria-hidden="true" /> : <FaCheck aria-hidden="true" />}
                          </button>
                          <button
                            type="button"
                            className="dcl-cancel-btn sila-btn sila-btn--secondary sila-btn--sm sila-btn--icon"
                            onClick={handleCancelEdit}
                            disabled={saveLoading}
                            title="Cancel"
                            aria-label="Cancel editing"
                          >
                            <FaTimes aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                      <td className="dcl-td-delete">
                        <button
                          type="button"
                          className="dcl-delete-btn sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                          onClick={openDeleteDepartmentConfirm}
                          title="Delete department"
                          aria-label="Delete department"
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <ConfirmPopup
        isOpen={confirmPopup.isOpen}
        title={confirmPopup.title}
        message={confirmPopup.message}
        onConfirm={handleConfirmDelete}
        onCancel={closeConfirmPopup}
        isLoading={deleteLoading}
      />
    </div>
  );
};

export default DepartmentCostList;