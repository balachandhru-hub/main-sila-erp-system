import React, { useEffect, useRef, useState } from "react";
import { EmptyState } from "../EmptyState";
import { Loader } from "../Loader";
import type { ChatMessageDto, ChatParticipantProfile } from "./chatTypes";
import { formatDateSeparator, formatFileSize, formatMessageTime, getInitials, isSameCalendarDay } from "./chatUtils";
import {
  IconMessageSquare,
  IconSend,
  IconPaperclip,
  IconFile,
  IconChevronLeft,
  IconClose,
  IconUsers,
} from "./ChatIcons";

interface PendingAttachment {
  localId: string;
  file: File;
}

interface ChatConversationProps {
  role: "buyer" | "supplier";
  /** The logged-in user's own profile — used only to tell "own" messages apart on the supplier side. */
  currentUserProfile: ChatParticipantProfile | null;
  counterpartyName: string | null;
  hasCounterparty: boolean;
  messages: ChatMessageDto[];
  isLoadingMessages: boolean;
  messagesError: string | null;
  hasMoreHistory: boolean;
  isLoadingMoreMessages: boolean;
  onLoadOlder: () => void;
  isSendingMessage: boolean;
  onSendMessage: (body: string, attachments: File[]) => Promise<boolean>;
  downloadingAttachmentId: string | null;
  onDownloadAttachment: (attachmentId: string, fileName: string) => void;
  onBackToList: () => void;
  onOpenDetails: () => void;
  scrollTick: number;
}

/**
 * Whether a message was sent by "us". The buyer side treats every buyer-org
 * message as "own" (there's only ever one buyer viewing); the supplier side
 * needs to distinguish this exact logged-in user from a teammate in the same
 * supplier org, so it matches the sender's id+name against the current
 * profile instead. Preserves each side's original, independently-built logic.
 */
const isOwnMessage = (
  message: ChatMessageDto,
  role: "buyer" | "supplier",
  currentUserProfile: ChatParticipantProfile | null
): boolean => {
  if (role === "buyer") {
    return message.senderOrganizationType?.toLowerCase() === "buyer";
  }
  return (
    !!currentUserProfile &&
    !!message.senderUserId &&
    message.senderUserId === currentUserProfile.userId &&
    message.senderName === currentUserProfile.userName
  );
};

const ChatConversation: React.FC<ChatConversationProps> = ({
  role,
  currentUserProfile,
  counterpartyName,
  hasCounterparty,
  messages,
  isLoadingMessages,
  messagesError,
  hasMoreHistory,
  isLoadingMoreMessages,
  onLoadOlder,
  isSendingMessage,
  onSendMessage,
  downloadingAttachmentId,
  onDownloadAttachment,
  onBackToList,
  onOpenDetails,
  scrollTick,
}) => {
  const [messageText, setMessageText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessageText("");
    setPendingAttachments([]);
  }, [counterpartyName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [scrollTick]);

  if (!counterpartyName) {
    return (
      <div className="brc-conversation">
        <div className="brc-state-wrap">
          <EmptyState
            icon={<IconMessageSquare />}
            title="Select a supplier"
            description="Choose a supplier from the list to view or start a conversation."
          />
        </div>
      </div>
    );
  }

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const additions: PendingAttachment[] = Array.from(files).map((file) => ({
      localId: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
    }));
    setPendingAttachments((prev) => [...prev, ...additions]);
    e.target.value = "";
  };

  const removeAttachment = (localId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.localId !== localId));
  };

  const canSend = (messageText.trim().length > 0 || pendingAttachments.length > 0) && !isSendingMessage;

  const handleSend = async () => {
    if (!canSend) return;
    const trimmed = messageText.trim();
    const files = pendingAttachments.map((a) => a.file);
    const success = await onSendMessage(trimmed, files);
    if (success) {
      setMessageText("");
      setPendingAttachments([]);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="brc-conversation">
      <div className="brc-conversation-header">
        <button type="button" className="brc-back-to-list" onClick={onBackToList} aria-label="Back to supplier list">
          <IconChevronLeft />
        </button>
        <div className="brc-supplier-avatar" aria-hidden="true">
          {getInitials(counterpartyName)}
        </div>
        <div className="brc-conversation-header-text">
          <h3 className="brc-conversation-name">{counterpartyName}</h3>
          <button type="button" className="brc-conversation-participants-toggle" onClick={onOpenDetails}>
            <IconUsers />
            Chat details
          </button>
        </div>
      </div>

      {isLoadingMessages ? (
        <div className="brc-state-wrap">
          <Loader size={24} message="Loading conversation history..." />
        </div>
      ) : messagesError ? (
        <div className="brc-state-wrap">
          <EmptyState variant="error" title={messagesError} />
        </div>
      ) : messages.length === 0 ? (
        <div className="brc-state-wrap">
          <EmptyState
            icon={<IconMessageSquare />}
            title="No messages yet"
            description={
              hasCounterparty
                ? "No messages yet. Start the conversation by sending a message."
                : `Start a conversation with ${counterpartyName}.`
            }
          />
        </div>
      ) : (
        <div className="brc-messages" role="log" aria-label={`Messages with ${counterpartyName}`}>
          {hasMoreHistory && (
            <button
              type="button"
              className="brc-load-older"
              onClick={onLoadOlder}
              disabled={isLoadingMoreMessages}
            >
              {isLoadingMoreMessages ? "Loading..." : "Load older messages"}
            </button>
          )}

          {messages.map((message, index) => {
            const isOwn = isOwnMessage(message, role, currentUserProfile);
            const previousMessage = messages[index - 1];
            const showDateSeparator =
              !previousMessage || !isSameCalendarDay(previousMessage.dateCreated, message.dateCreated);
            return (
              <React.Fragment key={message.id}>
                {showDateSeparator && (
                  <div className="brc-date-separator">
                    <span>{formatDateSeparator(message.dateCreated)}</span>
                  </div>
                )}
                <div className={`brc-message-row ${isOwn ? "brc-message-row-own" : "brc-message-row-other"}`}>
                  <div className="brc-message-sender">{isOwn ? "You" : message.senderName}</div>
                  <div className="brc-message-bubble">
                    {message.body && <div className="brc-message-body">{message.body}</div>}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="brc-message-attachments">
                        {message.attachments.map((att) => (
                          <button
                            key={att.id}
                            type="button"
                            className="brc-attachment-chip"
                            onClick={() => onDownloadAttachment(att.id, att.fileName)}
                            disabled={downloadingAttachmentId === att.id}
                            title={`Download ${att.fileName}`}
                          >
                            <span className="brc-attachment-chip-icon" aria-hidden="true">
                              <IconFile />
                            </span>
                            <span className="brc-attachment-chip-info">
                              <span className="brc-attachment-chip-name">{att.fileName}</span>
                              <br />
                              <span className="brc-attachment-chip-size">
                                {downloadingAttachmentId === att.id ? "Downloading..." : formatFileSize(att.fileSizeBytes)}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <time className="brc-message-time" dateTime={message.dateCreated}>
                    {formatMessageTime(message.dateCreated)}
                  </time>
                </div>
              </React.Fragment>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {pendingAttachments.length > 0 && (
        <div className="brc-attachment-preview-row">
          {pendingAttachments.map((att) => (
            <div key={att.localId} className="brc-attachment-preview-chip">
              <IconFile />
              <span className="brc-attachment-preview-name" title={att.file.name}>
                {att.file.name}
              </span>
              <span>({formatFileSize(att.file.size)})</span>
              <button
                type="button"
                className="brc-attachment-preview-remove"
                onClick={() => removeAttachment(att.localId)}
                aria-label={`Remove ${att.file.name}`}
              >
                <IconClose />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="brc-composer">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="brc-file-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleFilesSelected}
        />
        <button
          type="button"
          className="brc-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSendingMessage}
          title="Attach files"
          aria-label="Attach files"
        >
          <IconPaperclip />
        </button>
        <textarea
          className="brc-composer-input"
          placeholder="Type a message..."
          aria-label={`Message ${counterpartyName}`}
          rows={1}
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          disabled={isSendingMessage}
        />
        <button type="button" className="brc-send-btn" onClick={handleSend} disabled={!canSend}>
          {isSendingMessage ? <span className="brc-spinner-sm" aria-hidden="true" /> : <IconSend />}
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatConversation;
