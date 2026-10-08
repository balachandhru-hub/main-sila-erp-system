import React, { useState } from "react";
import { FaTimes } from "react-icons/fa";
import "./ExternalSupplierModal.css";

export interface ExternalSupplierFormValues {
    supplierName: string;
    email: string;
    phoneNumber: string;
    address: string;
}

interface ExternalSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (supplier: ExternalSupplierFormValues) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ExternalSupplierModal: React.FC<ExternalSupplierModalProps> = ({
    isOpen,
    onClose,
    onAdd,
}) => {
    const [supplierName, setSupplierName] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [address, setAddress] = useState("");

    const [errors, setErrors] = useState<Record<string, string>>({});

    if (!isOpen) {
        return null;
    }

    const resetForm = () => {
        setSupplierName("");
        setEmail("");
        setPhoneNumber("");
        setAddress("");
        setErrors({});
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const clearError = (field: string) => {
        setErrors((prev) => {
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};

        if (!supplierName.trim()) {
            newErrors.supplierName = "Please enter the external supplier name";
        }

        if (!email.trim()) {
            newErrors.email = "Please enter an email address";
        } else if (!EMAIL_PATTERN.test(email.trim())) {
            newErrors.email = "Please enter a valid email address";
        }

        if (!phoneNumber.trim()) {
            newErrors.phoneNumber = "Please enter a contact number";
        }

        if (!address.trim()) {
            newErrors.address = "Please enter an address";
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onAdd({
            supplierName: supplierName.trim(),
            email: email.trim(),
            phoneNumber: phoneNumber.trim(),
            address: address.trim(),
        });

        resetForm();
        onClose();
    };

    return (
        <div
            className="external-supplier-modal-overlay"
            onClick={handleClose}
        >
            <div
                className="external-supplier-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="external-supplier-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="external-supplier-modal-header">
                    <div>
                        <h2 className="external-supplier-modal-title" id="external-supplier-modal-title">
                            Add External Supplier
                        </h2>

                        <p className="external-supplier-modal-subtitle">
                            Add a supplier who is not yet registered on the platform.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="external-supplier-modal-close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>

                <form
                    className="external-supplier-modal-form"
                    onSubmit={handleSubmit}
                >
                    <div className="external-supplier-modal-body">
                        {/* Supplier Name */}
                        <div className="external-supplier-field">
                            <label htmlFor="external-supplier-name">
                                External Supplier Name <span aria-hidden="true">*</span>
                            </label>

                            <input
                                id="external-supplier-name"
                                type="text"
                                placeholder="Enter supplier name"
                                value={supplierName}
                                className={errors.supplierName ? "external-supplier-input-error" : ""}
                                aria-required="true"
                                aria-invalid={!!errors.supplierName}
                                aria-describedby={errors.supplierName ? "external-supplier-name-error" : undefined}
                                onChange={(e) => {
                                    setSupplierName(e.target.value);
                                    clearError("supplierName");
                                }}
                            />

                            {errors.supplierName && (
                                <div className="external-supplier-error" id="external-supplier-name-error">{errors.supplierName}</div>
                            )}
                        </div>

                        {/* Email */}
                        <div className="external-supplier-field">
                            <label htmlFor="external-supplier-email">
                                Email <span aria-hidden="true">*</span>
                            </label>

                            <input
                                id="external-supplier-email"
                                type="email"
                                placeholder="Enter email address"
                                value={email}
                                className={errors.email ? "external-supplier-input-error" : ""}
                                aria-required="true"
                                aria-invalid={!!errors.email}
                                aria-describedby={errors.email ? "external-supplier-email-error" : undefined}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    clearError("email");
                                }}
                            />

                            {errors.email && (
                                <div className="external-supplier-error" id="external-supplier-email-error">{errors.email}</div>
                            )}
                        </div>

                        {/* Contact Number */}
                        <div className="external-supplier-field">
                            <label htmlFor="external-supplier-phone">
                                Contact Number <span aria-hidden="true">*</span>
                            </label>

                            <input
                                id="external-supplier-phone"
                                type="tel"
                                placeholder="Enter contact number"
                                value={phoneNumber}
                                className={errors.phoneNumber ? "external-supplier-input-error" : ""}
                                aria-required="true"
                                aria-invalid={!!errors.phoneNumber}
                                aria-describedby={errors.phoneNumber ? "external-supplier-phone-error" : undefined}
                                onChange={(e) => {
                                    setPhoneNumber(e.target.value);
                                    clearError("phoneNumber");
                                }}
                            />

                            {errors.phoneNumber && (
                                <div className="external-supplier-error" id="external-supplier-phone-error">{errors.phoneNumber}</div>
                            )}
                        </div>

                        {/* Address */}
                        <div className="external-supplier-field external-supplier-field-full">
                            <label htmlFor="external-supplier-address">
                                Address <span aria-hidden="true">*</span>
                            </label>

                            <input
                                id="external-supplier-address"
                                type="text"
                                placeholder="Enter address"
                                value={address}
                                className={errors.address ? "external-supplier-input-error" : ""}
                                aria-required="true"
                                aria-invalid={!!errors.address}
                                aria-describedby={errors.address ? "external-supplier-address-error" : undefined}
                                onChange={(e) => {
                                    setAddress(e.target.value);
                                    clearError("address");
                                }}
                            />

                            {errors.address && (
                                <div className="external-supplier-error" id="external-supplier-address-error">{errors.address}</div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="external-supplier-modal-footer">
                        <button
                            type="button"
                            className="external-supplier-cancel-btn sila-btn sila-btn--secondary"
                            onClick={handleClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="external-supplier-add-btn sila-btn sila-btn--primary"
                        >
                            Add Supplier
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExternalSupplierModal;
