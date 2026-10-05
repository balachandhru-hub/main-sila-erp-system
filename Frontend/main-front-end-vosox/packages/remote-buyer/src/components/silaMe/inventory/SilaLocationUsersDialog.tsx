import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  getOrganizationUsers,
  type OrganizationUser,
} from "../../../../../remote-platform-user/src/api/departmentcostapi";
import { useBuyerAuthStore } from "../../../store/useBuyerAuthStore";
import { getLocationUsers, setLocationUsers, type SilaLocation, type SilaLocationUser } from "../../../api/silaMe/silaInventoryApi";

interface SilaLocationUsersDialogProps {
  location: SilaLocation;
  onClose: () => void;
  onSaved: () => void;
}

/** Picks the users who work at a location. Users of the location's outlet see it already through the outlet. */
const SilaLocationUsersDialog: React.FC<SilaLocationUsersDialogProps> = ({ location, onClose, onSaved }) => {
  const organizationId = useBuyerAuthStore((state) => state.personDetail?.organizationId);
  const [users, setUsers] = useState<OrganizationUser[]>([]);
  const [assigned, setAssigned] = useState<SilaLocationUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([getOrganizationUsers(organizationId), getLocationUsers(location.id)])
      .then(([userRows, assignedRows]) => {
        if (!active) return;
        setUsers(Array.isArray(userRows) ? userRows : []);
        setAssigned(assignedRows);
        setSelected(new Set(assignedRows.map((user) => user.userId)));
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the users.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId, location.id]);

  const toggle = (userId: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      await setLocationUsers(location.id, Array.from(selected));
      toastService.success("Users assigned.");
      onSaved();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not assign the users.");
    } finally {
      setSaving(false);
    }
  };

  const term = search.trim().toLowerCase();
  const visible = users.filter(
    (user) =>
      !term ||
      (user.name ?? "").toLowerCase().includes(term) ||
      (user.email ?? "").toLowerCase().includes(term) ||
      (user.roleName ?? "").toLowerCase().includes(term),
  );

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      headerProps={{ heading: "Location users", subHeading: `${location.locationName} (${location.locationCode})` }}
      footerProps={{
        secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: saving },
        primaryButton: { text: "Save", onClick: handleSave, loading: saving, disabled: loading || Boolean(error) },
      }}
    >
      <div className="sila-root sila-me sinv-dialog">
        {!organizationId || loading ? (
          <Loader size={24} message="Loading users..." />
        ) : error ? (
          <EmptyState variant="error" title="Couldn't load the users" description={error} />
        ) : users.length === 0 ? (
          <EmptyState title="No users in the organization" />
        ) : (
          <>
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-users-search">Search users</label>
              <input
                id="sinv-users-search"
                className="sila-input"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {assigned.length > 0 && (
              <div className="sila-field">
                <span className="sila-label">Assigned now</span>
                <ul className="sinv-check-list" aria-label="Users assigned now">
                  {assigned.map((user) => (
                    <li key={user.userId}>
                      {user.name || user.userId}
                      <span className="sinv-sub">{[user.email, user.roleName].filter(Boolean).join(" · ") || "Details unavailable"}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <span className="sila-help">{selected.size} selected</span>
            {visible.length === 0 ? (
              <EmptyState title="No users match the search" />
            ) : (
              <div className="sinv-check-list" role="group" aria-label="Users">
                {visible.map((user) => (
                  <label key={user.userId} className="sila-choice">
                    <input type="checkbox" checked={selected.has(user.userId)} onChange={() => toggle(user.userId)} />
                    <span>
                      {user.name || user.userName}
                      <span className="sinv-sub">{[user.email, user.roleName].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaLocationUsersDialog;
