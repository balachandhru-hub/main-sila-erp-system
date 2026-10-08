import React, { useState } from 'react';
import { Modal, toastService } from '@vosox/shared-ui';
import type { ContractPurchaseOrderDraftDto, CreateContractPurchaseOrderRequest } from './contractPurchaseOrderApi';

interface CreatePurchaseOrderDialogProps {
  contractNumber: string;
  draft: ContractPurchaseOrderDraftDto;
  submitting: boolean;
  onSubmit: (details: CreateContractPurchaseOrderRequest) => void;
  onClose: () => void;
}

type FieldName = keyof CreateContractPurchaseOrderRequest;

interface FieldDefinition {
  name: FieldName;
  label: string;
  hint?: string;
  type?: 'text' | 'date';
}

/** The details the ERP needs for a purchase order and the contract does not hold. */
const FIELDS: FieldDefinition[] = [
  { name: 'purchaseOrderType', label: 'Purchase order type', hint: 'For example NB' },
  { name: 'purchasingOrganization', label: 'Purchasing organization' },
  { name: 'purchasingGroup', label: 'Purchasing group' },
  { name: 'companyCode', label: 'Company code' },
  { name: 'supplierCode', label: 'Supplier code', hint: "The supplier's vendor number in the ERP" },
  { name: 'purchaseOrderDate', label: 'Purchase order date', type: 'date' },
  { name: 'plant', label: 'Plant' },
  { name: 'storageLocation', label: 'Storage location' },
  { name: 'accountAssignmentCategory', label: 'Account assignment category', hint: 'For example U or K' },
  { name: 'glAccount', label: 'GL account' },
];

/** Date of the draft ("2026-10-06T00:00:00Z") as the value of a date input. */
const toDateInput = (value: string | null | undefined): string => (value ? value.slice(0, 10) : '');

/**
 * Asked when the buyer has a purchase order API: the purchase order is sent to the ERP, which needs details that
 * neither the contract nor the RFQ hold. The values already known are filled in.
 */
const CreatePurchaseOrderDialog: React.FC<CreatePurchaseOrderDialogProps> = ({ contractNumber, draft, submitting, onSubmit, onClose }) => {
  const [values, setValues] = useState<CreateContractPurchaseOrderRequest>({
    ...draft.values,
    purchaseOrderDate: toDateInput(draft.values.purchaseOrderDate),
  });

  const isRequired = (name: FieldName) => draft.requiredFields.includes(name);

  const handleSubmit = () => {
    const missing = FIELDS.filter((field) => isRequired(field.name) && !(values[field.name] ?? '').toString().trim());
    if (missing.length > 0) {
      toastService.error(`Please fill in: ${missing.map((field) => field.label).join(', ')}.`);
      return;
    }
    onSubmit(values);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      headerProps={{ heading: 'Create Purchase Order', subHeading: `Contract ${contractNumber}. The ERP needs these details.` }}
      footerProps={{
        secondaryButton: { text: 'Cancel', onClick: onClose, disabled: submitting },
        primaryButton: { text: 'Create Purchase Order', onClick: handleSubmit, loading: submitting },
      }}
    >
      <div className="sila-root ctr-po-form">
        {FIELDS.map((field) => {
          const id = `ctr-po-${field.name}`;
          return (
            <div className="sila-field" key={field.name}>
              <label className="sila-label" htmlFor={id}>
                {field.label}
                {isRequired(field.name) && <span className="sila-required" aria-hidden="true">*</span>}
              </label>
              <input
                id={id}
                className="sila-input"
                type={field.type ?? 'text'}
                value={(values[field.name] ?? '') as string}
                disabled={submitting}
                aria-required={isRequired(field.name) || undefined}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              />
              {field.hint && <span className="sila-help">{field.hint}</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export default CreatePurchaseOrderDialog;
