import React from "react";
import { Modal } from "@vosox/shared-ui";

interface SilaReceivingConfirmProps {
  heading: string;
  message: string;
  confirmText: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Asks before a destructive action (delete) of the receiving masters. */
const SilaReceivingConfirm: React.FC<SilaReceivingConfirmProps> = ({ heading, message, confirmText, busy, onConfirm, onClose }) => (
  <Modal
    isOpen
    onClose={busy ? () => undefined : onClose}
    size="sm"
    headerProps={{ heading }}
    footerProps={{
      primaryButton: { text: confirmText, onClick: onConfirm, loading: busy, disabled: busy },
      secondaryButton: { text: "Cancel", onClick: onClose, disabled: busy },
    }}
  >
    <div className="sila-root sila-me">
      <p>{message}</p>
    </div>
  </Modal>
);

export default SilaReceivingConfirm;
