import React, { useEffect, useRef, useState } from "react";
import { FaTimes } from "react-icons/fa";
import { toastService } from "../../services/toastservice";
import { Button } from "../Button";
import type { SupplierRfqUserDto, SupplierUsersModalApi } from "./types";
import "./SupplierUsersModal.css";

interface SupplierUsersModalProps {
    isOpen: boolean;
    supplierName: string;
    organizationId?: string;
    initialSelectedUserIds: string[];
    api: SupplierUsersModalApi;
    onClose: () => void;
    onSave: (userIds: string[]) => void;
}

const SupplierUsersModal: React.FC<SupplierUsersModalProps> = ({
    isOpen,
    supplierName,
    organizationId,
    initialSelectedUserIds,
    api,
    onClose,
    onSave,
}) => {
    const [users, setUsers] = useState<SupplierRfqUserDto[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const allSelectRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (allSelectRef.current) {
            allSelectRef.current.indeterminate = selectedIds.size > 0 && selectedIds.size < users.length;
        }
    }, [selectedIds, users.length]);

    useEffect(() => {
        if (!isOpen) return;

        setSelectedIds(new Set(initialSelectedUserIds));

        if (!organizationId) {
            setUsers([]);
            setError("This supplier does not have an organization on file.");
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        api.getOrganizationUsersForRfq(organizationId)
            .then((data) => {
                if (cancelled) return;
                setUsers(data);
            })
            .catch((err: any) => {
                if (cancelled) return;
                setError(err?.message || "Failed to load supplier users.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, organizationId]);

    if (!isOpen) {
        return null;
    }

    const handleClose = () => {
        onClose();
    };

    const toggleUser = (userId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(userId)) {
                next.delete(userId);
            } else {
                next.add(userId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(users.map((user) => user.id)));
    };

    const handleDeselectAll = () => {
        setSelectedIds(new Set());
    };

    const handleToggleAllCheckbox = () => {
        if (selectedIds.size === users.length) {
            handleDeselectAll();
        } else {
            handleSelectAll();
        }
    };

    const handleSave = () => {
        onSave(Array.from(selectedIds));
        toastService.success("Supplier users updated.");
        onClose();
    };

    return (
        <div
            className="supplier-users-modal-overlay"
            onClick={handleClose}
        >
            <div
                className="supplier-users-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="supplier-users-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="supplier-users-modal-header">
                    <div>
                        <h2 className="supplier-users-modal-title" id="supplier-users-modal-title">
                            Select Users
                        </h2>

                        <p className="supplier-users-modal-subtitle">
                            Choose which users at {supplierName} should receive this RFQ.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="supplier-users-modal-close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <FaTimes aria-hidden="true" />
                    </button>
                </div>

                <div className="supplier-users-modal-body">
                    {loading && (
                        <div className="supplier-users-modal-state">
                            <span className="sila-spinner" aria-hidden="true" />
                            Loading users...
                        </div>
                    )}

                    {!loading && error && (
                        <div className="supplier-users-modal-state supplier-users-modal-error" role="alert">{error}</div>
                    )}

                    {!loading && !error && users.length === 0 && (
                        <div className="supplier-users-modal-state">
                            No users found for this organization.
                        </div>
                    )}

                    {!loading && !error && users.length > 0 && (
                        <>
                            <div className="supplier-users-list-actions">
                                <label className="supplier-users-list-count">
                                    <input
                                        ref={allSelectRef}
                                        type="checkbox"
                                        checked={users.length > 0 && selectedIds.size === users.length}
                                        onChange={handleToggleAllCheckbox}
                                        aria-label="Select all users"
                                    />
                                    {selectedIds.size} of {users.length} selected
                                </label>
                                <div className="sila-btn-group">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        onClick={handleSelectAll}
                                        disabled={selectedIds.size === users.length}
                                    >
                                        Select All
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleDeselectAll}
                                        disabled={selectedIds.size === 0}
                                    >
                                        Remove All
                                    </Button>
                                </div>
                            </div>

                            <ul className="supplier-users-list">
                                {users.map((user) => (
                                    <li
                                        key={user.id}
                                        className={`supplier-users-list-item${selectedIds.has(user.id) ? " supplier-users-list-item-selected" : ""}`}
                                    >
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(user.id)}
                                                onChange={() => toggleUser(user.id)}
                                            />
                                            <span className="supplier-users-list-name">{user.name}</span>
                                            <span className="supplier-users-list-email">{user.email}</span>
                                            {user.userRole && (
                                                <span className="supplier-users-list-role">{user.userRole}</span>
                                            )}
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>

                <div className="supplier-users-modal-footer">
                    <button
                        type="button"
                        className="supplier-users-cancel-btn sila-btn sila-btn--secondary"
                        onClick={handleClose}
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="supplier-users-save-btn sila-btn sila-btn--primary"
                        onClick={handleSave}
                        disabled={loading || !!error}
                    >
                        Save Selection
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SupplierUsersModal;
