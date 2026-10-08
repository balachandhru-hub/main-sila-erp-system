import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaTimes, FaBuilding, FaList, FaCheck, FaBox, FaClipboard, FaExclamationCircle } from 'react-icons/fa';
import { PageHeader } from '@vosox/shared-ui';
import { getAllBuyers, createBuyerDepartment } from '../api/platformApi';
import { useDepartmentStore } from './useDepartmentStore'; 
import './departmentbuyer.css';

const sila_logo = `${window.location.protocol}//${window.location.host}/assets/SILA_Logo.png`;

export const Department: React.FC = () => {
  const navigate = useNavigate();

  const {
    selectedBuyer,
    setSelectedBuyer,
    departmentName,
    setDepartmentName,
    costCenters,
    addCostCenter,
    updateCostCenter,
    removeCostCenter,
    loading: creating,
    setLoading: setCreating,
    error: createError,
    setError: setCreateError,
    success: createSuccess,
    setSuccess: setCreateSuccess,
    resetForm,
  } = useDepartmentStore();

  const [showPopup, setShowPopup] = useState(false);

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
      console.error('Failed to fetch buyers:', err);
    }
  };

  useEffect(() => {
    fetchAndSelectBuyer();
  }, []);

  const handleBack = () => {
    navigate('../dashboard');
  };

  const handleViewDepartmentList = () => {
    navigate('../departmentcostlist');
  };

  const handleViewItemMaster = () => {
    navigate('../itemmaster');
  };

  const handleViewTemplates = () => {
    navigate('../templates');
  };

  const openPopup = () => {
    resetForm();
    fetchAndSelectBuyer();
    setShowPopup(true);
  };

  const closePopup = () => {
    setShowPopup(false);
    resetForm();
  };

  const handleAddCostCenter = () => {
    addCostCenter('');
  };

  const handleRemoveCostCenter = (index: number) => {
    if (costCenters.length <= 1) return;
    removeCostCenter(index);
  };

  const handleCostCenterChange = (index: number, value: string) => {
    updateCostCenter(index, value);
  };

  const handleCreate = async () => {
    if (!selectedBuyer) {
      setCreateError('Please select a buyer');
      return;
    }
    if (!departmentName.trim()) {
      setCreateError('Please enter department name');
      return;
    }
    const validCostCenters = costCenters.filter((cc) => cc.trim() !== '');
    if (validCostCenters.length === 0) {
      setCreateError('At least one cost center is required');
      return;
    }

    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      await createBuyerDepartment(
        selectedBuyer.id,
        selectedBuyer.organizationId,
        departmentName.trim(),
        validCostCenters
      );

      setCreateSuccess('Department created successfully!');

      setTimeout(() => {
        resetForm();
        setShowPopup(false);
      }, 2000);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create department');
    } finally {
      setCreating(false);
    }
  };



  const settingsItems = [
    {
      key: 'item-master',
      cardClass: '',
      iconClass: 'item-master',
      icon: <FaBox />,
      title: 'Item Master',
      desc: 'Manage item master data and configurations',
      action: 'Open',
      onClick: handleViewItemMaster,
    },
    {
      key: 'dept',
      cardClass: ' active',
      iconClass: 'dept',
      icon: <FaBuilding />,
      title: 'Add Department & Cost Center',
      desc: 'Create departments with associated cost centers for buyers',
      action: 'Open',
      onClick: openPopup,
    },
    {
      key: 'list',
      cardClass: '',
      iconClass: 'list',
      icon: <FaList />,
      title: 'Department & Cost Center List',
      desc: 'View and manage all departments and cost centers',
      action: 'View',
      onClick: handleViewDepartmentList,
    },
    {
      key: 'templates',
      cardClass: '',
      iconClass: 'templates',
      icon: <FaClipboard />,
      title: 'Templates',
      desc: 'Create and manage department templates for quick setup',
      action: 'Manage',
      onClick: handleViewTemplates,
    },
  ];

  return (
    <div className="dept-page-container sila-root">
      <header className="dept-top-header">
        <button type='button' className="dept-top-logo-btn" onClick={handleBack}>
        <img src={sila_logo} alt="SILA" className="dept-top-logo" />
        </button>
      </header>

      <main className="dept-content-wrapper">
        <div className="dept-back-wrapper">
          <PageHeader
            title="Settings"
            onBack={handleBack}
            backLabel="Back"
          />
        </div>

        <ul className="dept-settings-list" aria-label="Settings">
          {settingsItems.map((item) => (
            <li key={item.key} className={`dept-settings-card${item.cardClass}`}>
              <span className={`dept-settings-card-icon ${item.iconClass}`} aria-hidden="true">
                {item.icon}
              </span>
              <div className="dept-settings-card-content">
                <h3 className="dept-settings-card-title">{item.title}</h3>
                <p className="dept-settings-card-desc">{item.desc}</p>
              </div>
              <button
                type="button"
                className="dept-settings-card-btn primary sila-btn sila-btn--secondary sila-btn--sm"
                onClick={item.onClick}
                aria-label={`${item.action} ${item.title}`}
              >
                {item.action}
              </button>
            </li>
          ))}
        </ul>
      </main>

      {showPopup && (
        <div className="dept-popup-overlay sila-root sila-overlay" onClick={closePopup}>
          <div
            className="dept-popup sila-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dept-popup-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dept-popup-header sila-modal-header">
              <h2 id="dept-popup-title" className="dept-popup-title sila-modal-title">
                <FaBuilding className="dept-popup-title-icon" aria-hidden="true" />
                Add Department & Cost Center
              </h2>
              <button
                type="button"
                className="dept-popup-close sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                onClick={closePopup}
                aria-label="Close dialog"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="dept-popup-body sila-modal-body">
              <div className="dept-form-group sila-field">
                <label htmlFor="dept-name-input" className="dept-form-label sila-label">
                  Department Name <span className="dept-required sila-required" aria-hidden="true">*</span>
                </label>
                <input
                  id="dept-name-input"
                  type="text"
                  className={`dept-form-input sila-input ${!selectedBuyer ? 'dept-input-disabled' : ''}`}
                  placeholder={selectedBuyer ? 'Enter department name' : 'Select a buyer first'}
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  disabled={!selectedBuyer}
                  aria-required="true"
                  aria-describedby="dept-name-hint"
                />
                <span id="dept-name-hint" className="dept-hint sila-help">(Only one department per creation)</span>
              </div>

              <fieldset className="dept-form-group dept-fieldset sila-field" aria-describedby="dept-cc-hint">
                <legend className="dept-form-label sila-label">
                  Cost Centers <span className="dept-required sila-required" aria-hidden="true">*</span>
                </legend>
                <span id="dept-cc-hint" className="dept-hint sila-help">(At least one required, multiple allowed)</span>
                <div className="dept-cost-centers-list">
                  {costCenters.map((cc, index) => (
                    <div key={index} className="dept-cost-center-row">
                      <input
                        type="text"
                        className={`dept-form-input dept-cost-input sila-input ${!selectedBuyer ? 'dept-input-disabled' : ''}`}
                        placeholder={selectedBuyer ? `Cost Center ${index + 1}` : 'Select a buyer first'}
                        value={cc}
                        onChange={(e) => handleCostCenterChange(index, e.target.value)}
                        disabled={!selectedBuyer}
                        aria-label={`Cost center ${index + 1}`}
                      />
                      {costCenters.length > 1 && selectedBuyer && (
                        <button
                          type="button"
                          className="dept-remove-cc-btn sila-btn sila-btn--ghost sila-btn--icon"
                          onClick={() => handleRemoveCostCenter(index)}
                          title="Remove"
                          aria-label={`Remove cost center ${index + 1}`}
                        >
                          <FaTimes aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className={`dept-add-cc-btn sila-btn sila-btn--outline sila-btn--sm ${!selectedBuyer ? 'dept-btn-disabled' : ''}`}
                  onClick={handleAddCostCenter}
                  disabled={!selectedBuyer}
                >
                  <FaPlus aria-hidden="true" />
                  Add
                </button>
              </fieldset>

              {createError && (
                <div className="dept-error-msg sila-alert sila-alert--danger" role="alert">
                  <FaExclamationCircle className="dept-msg-icon" aria-hidden="true" />
                  <span>{createError}</span>
                </div>
              )}
              {createSuccess && (
                <div className="dept-success-msg sila-alert sila-alert--success" role="status">
                  <FaCheck className="dept-msg-icon" aria-hidden="true" />
                  <span>{createSuccess}</span>
                </div>
              )}
            </div>

            <div className="dept-popup-footer sila-modal-footer">
              <button type="button" className="dept-btn-secondary sila-btn sila-btn--secondary" onClick={closePopup}>
                Cancel
              </button>
              <button
                type="button"
                className="dept-btn-primary sila-btn sila-btn--primary"
                onClick={handleCreate}
                disabled={creating || !selectedBuyer}
              >
                {creating && <span className="sila-spinner" aria-hidden="true" />}
                {creating ? 'Creating...' : 'Create Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Department;