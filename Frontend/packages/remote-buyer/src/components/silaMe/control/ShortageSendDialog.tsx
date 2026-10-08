import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { sendShortageReport, type SilaShortageFilter } from "../../../api/silaMe/silaControlApi";

interface ShortageSendDialogProps {
  filter: SilaShortageFilter;
  onClose: () => void;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 10;

/** "a@x.com; b@y.com" → ["a@x.com", "b@y.com"] */
const splitEmails = (text: string): string[] =>
  text
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

/** Emails the summary of the filtered shortage report (no attachment) through the platform email service. */
const ShortageSendDialog: React.FC<ShortageSendDialogProps> = ({ filter, onClose }) => {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const toEmails = splitEmails(to);
    const ccEmails = splitEmails(cc);
    const invalid = [...toEmails, ...ccEmails].find((email) => !EMAIL.test(email));
    if (toEmails.length === 0) {
      setError("Enter at least one email address in To.");
      return;
    }
    if (invalid) {
      setError(`${invalid} is not a valid email address.`);
      return;
    }
    if (toEmails.length + ccEmails.length > MAX_RECIPIENTS) {
      setError(`Send the report to at most ${MAX_RECIPIENTS} addresses.`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await sendShortageReport(filter, {
        toEmails,
        ccEmails,
        subject: subject.trim() || undefined,
        message: message.trim() || undefined,
      });
      toastService.success(`Report sent to ${result.sent} of ${result.recipients} recipient(s).`);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not send the report. Download the Excel or PDF report instead.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={sending ? () => undefined : onClose}
      headerProps={{ heading: "Send shortage report" }}
      footerProps={{
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: sending },
        primaryButton: { text: "Send", onClick: send, loading: sending },
      }}
    >
      <div className="sila-root sila-me sctl-stack">
        <p className="sila-help">The email carries the totals of the current filter. Recipients open SILA ME for the lines.</p>
        <div className="sila-field">
          <label className="sila-label" htmlFor="ssr-send-to">To<span className="sila-required">*</span></label>
          <input id="ssr-send-to" className="sila-input" value={to} disabled={sending} placeholder="name@company.com; other@company.com" onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="ssr-send-cc">CC</label>
          <input id="ssr-send-cc" className="sila-input" value={cc} disabled={sending} onChange={(e) => setCc(e.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="ssr-send-subject">Subject</label>
          <input id="ssr-send-subject" className="sila-input" value={subject} maxLength={200} disabled={sending} placeholder="Stock shortage report" onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="ssr-send-message">Message</label>
          <textarea id="ssr-send-message" className="sila-textarea" rows={4} value={message} maxLength={1000} disabled={sending} onChange={(e) => setMessage(e.target.value)} />
        </div>
        {error && <div className="sila-alert sila-alert--danger" role="alert">{error}</div>}
      </div>
    </Modal>
  );
};

export default ShortageSendDialog;
