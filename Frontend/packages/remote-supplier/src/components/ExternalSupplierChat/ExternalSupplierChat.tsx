import React, { useEffect, useRef, useState } from "react";
import "../../../../shared-ui/src/components/Chat/ChatPanel.css";
import {
  isErrorResponse,
  toastService,
  downloadBase64File,
  fileToBase64,
  formatThreadTime,
  getInitials,
  IconClose,
  IconMessageSquare,
  startRfqChatHub,
  stopRfqChatHub,
} from "@vosox/shared-ui";
import type { ExternalChatMessageDto, ExternalChatThreadDto } from "../../dto/externalChatDto";
import {
  fetchExternalSupplierMessageThreads,
  fetchExternalSupplierMessageHistory,
  markExternalSupplierThreadAsRead,
  sendExternalSupplierMessage,
  downloadExternalSupplierMessageAttachment,
} from "../../api/externalSupplierApi";
import ExternalChatConversation from "./ExternalChatConversation";
import ExternalChatDetails from "./ExternalChatDetails";

const HISTORY_PAGE_LIMIT = 20;
// How often the open chat re-checks the history as a safety net for live
// delivery (see the polling effect below).
const LIVE_POLL_INTERVAL_MS = 5000;
 
interface ExternalSupplierChatProps {
  onClose: () => void;
  rfqId: string;
  sessionToken: string;
  rfqNumber?: string;
  rfqTitle?: string;
  /** From the external RFQ response, if the backend supplies it — preferred over the threads API's counterpartyName. */
  buyerName?: string;
  /** From the external RFQ response — the invited external contact's own name, shown for "You" in chat details. */
  externalSupplierName?: string;
}

// An external supplier bid link is always a single conversation between the
// invited external contact and the buyer who created the RFQ — like
// SupplierRFQChat (and unlike the Buyer Admin chat's multi-supplier list),
// there is no set of counterparties to group/select between. There is no
// supplierId/externalSupplierId available on this page to send or filter
// by — the backend resolves the caller's identity from the X-Session-Token
// header alone, so every call here is scoped by rfqId + that header only.
const ExternalSupplierChat: React.FC<ExternalSupplierChatProps> = ({
  onClose,
  rfqId,
  sessionToken,
  rfqNumber,
  rfqTitle,
  buyerName,
  externalSupplierName,
}) => {
  const [thread, setThread] = useState<ExternalChatThreadDto | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);

  const [mobileView, setMobileView] = useState<"list" | "conversation">("list");
  const [isChatDetailsOpen, setIsChatDetailsOpen] = useState(false);

  const [messages, setMessages] = useState<ExternalChatMessageDto[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  // Read inside the SignalR handler (registered once per rfqId) so it always
  // sees the current thread without needing to reconnect once the very first
  // message resolves it.
  const threadIdRef = useRef<string | null>(null);

  // buyerName from the RFQ-by-id response is the source of truth for the
  // Buyer's identity — the threads API's counterpartyName is only a fallback
  // for when it's unavailable.
  const counterpartyName = buyerName || thread?.counterpartyName || "Buyer";

  const loadInitialHistory = async (threadId: string, unreadCount: number) => {
    setLoadingMessages(true);
    setMessagesError(null);
    try {
      const data = await fetchExternalSupplierMessageHistory(threadId, rfqId, sessionToken, 0, HISTORY_PAGE_LIMIT);
      if (isErrorResponse(data)) {
        setMessagesError(data.description || data.message || "Failed to load conversation history.");
        return;
      }
      const sorted = [...data].sort(
        (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
      );
      setMessages(sorted);
      setHistoryIndex(data.length);
      setHasMoreHistory(data.length === HISTORY_PAGE_LIMIT);
      setScrollTick((t) => t + 1);

      if (unreadCount > 0) {
        const readResult = await markExternalSupplierThreadAsRead(threadId, rfqId, sessionToken);
        if (isErrorResponse(readResult)) {
          toastService.error(readResult.description || readResult.message || "Failed to mark conversation as read.");
        } else {
          setThread((prev) => (prev && prev.threadId === threadId ? { ...prev, unreadCount: 0 } : prev));
        }
      }
    } catch (err: any) {
      setMessagesError(err?.message || "Failed to load conversation history.");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoadingThread(true);
      try {
        const result = await fetchExternalSupplierMessageThreads(rfqId, sessionToken);
        if (cancelled) return;
        if (isErrorResponse(result)) {
          const msg = result.description || result.message || "Failed to load conversation.";
          toastService.error(msg);
          setLoadingThread(false);
          return;
        }
        // An external bid link is scoped to exactly one supplier/buyer thread
        // via the session token itself — no supplierId to filter by here.
        const existing = result[0] || null;
        setThread(existing);
        setLoadingThread(false);
        if (existing) {
          await loadInitialHistory(existing.threadId, existing.unreadCount);
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || "Failed to load conversation.";
          toastService.error(msg);
          setLoadingThread(false);
        }
      }
    };
    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId, sessionToken]);

  useEffect(() => {
    threadIdRef.current = thread?.threadId || null;
  }, [thread]);
 
  // Read by the polling effect so it can tell which fetched messages are new
  // without being re-created on every message.
  const messagesRef = useRef<ExternalChatMessageDto[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
 
  // Routes a live SignalR message into the conversation. The connection is
  // scoped to this rfqId via the session token header (see below), so every
  // message it delivers already belongs to this thread with the buyer.
  const handleIncomingMessages = (payload: ExternalChatMessageDto | ExternalChatMessageDto[]) => {
    const incoming = Array.isArray(payload) ? payload : [payload];
    if (incoming.length === 0) return;

    const openThreadId = threadIdRef.current;
    const relevant = openThreadId ? incoming.filter((m) => m.threadId === openThreadId) : incoming;
    if (relevant.length === 0) return;

    let appended: ExternalChatMessageDto[] = [];
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      appended = relevant.filter((m) => !existingIds.has(m.id));
      return appended.length > 0 ? [...prev, ...appended] : prev;
    });

    if (appended.length === 0) return;

    setScrollTick((t) => t + 1);

    const latest = appended[appended.length - 1];
    setThread((prev) => ({
      threadId: latest.threadId,
      rfqId,
      rfqNumber: rfqNumber || prev?.rfqNumber || "",
      buyerId: prev?.buyerId || "",
      supplierId: latest.supplierId || prev?.supplierId || "",
      externalSupplierId: latest.externalSupplierId || prev?.externalSupplierId || "",
      counterpartyName: prev?.counterpartyName || counterpartyName,
      lastMessageBody: latest.body || (latest.attachments?.length > 0 ? "Sent an attachment" : ""),
      lastMessageAt: latest.dateCreated,
      unreadCount: 0,
    }));
  };

  useEffect(() => {
    // No supplierId to scope the connection with (see the props comment
    // above) — and none is needed: per spec this chat always connects to
    // /buyermessageHub (the same hub the Buyer Admin chat uses), which
    // rfqChatHub.ts selects whenever supplierId is omitted. The session
    // token is sent as the session_token/external_rfq_id query params
    // MessageHub actually reads (see rfqChatHub.ts) — not a header, which
    // would silently never reach the backend once the connection upgrades
    // to WebSockets.
    startRfqChatHub(
      { rfqId, sessionToken },
      handleIncomingMessages as (messages: any) => void
    ).catch((err) => {
      console.error("[ExternalSupplierChat] SignalR connection failed:", err);
    });

    return () => {
      stopRfqChatHub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId, sessionToken]);
 
  // Live-chat safety net. SignalR is the primary path, but a broadcast only
  // reaches connections held by the SAME backend process that handled the
  // send (hub groups are in-memory). When the buyer's send and this tab are
  // served by different backends - e.g. a bid link on the deployed site while
  // the buyer works against another API instance, both sharing one database -
  // the message is saved but never pushed here, and only shows after the chat
  // is reopened. So while the chat is open (and the tab visible), also pull
  // the newest page of history and merge in anything not shown yet. Ids are
  // deduped, so it is harmless when SignalR did deliver the message.
  useEffect(() => {
    let stopped = false;
    let inFlight = false;
 
    const poll = async () => {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      try {
        let threadId = threadIdRef.current;
        if (!threadId) {
          // No conversation yet when the chat opened - the buyer's first
          // message creates the thread, so look for it.
          const threads = await fetchExternalSupplierMessageThreads(rfqId, sessionToken);
          if (stopped || isErrorResponse(threads) || threads.length === 0) return;
          threadId = threads[0].threadId;
          threadIdRef.current = threadId;
          setThread(threads[0]);
        }
 
        const data = await fetchExternalSupplierMessageHistory(threadId, rfqId, sessionToken, 0, HISTORY_PAGE_LIMIT);
        if (stopped || isErrorResponse(data)) return;
 
        const knownIds = new Set(messagesRef.current.map((m) => m.id));
        const fresh = data
          .filter((m) => !knownIds.has(m.id))
          .sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
        if (fresh.length === 0) return;
 
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const toAdd = fresh.filter((m) => !existingIds.has(m.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
        setScrollTick((t) => t + 1);
 
        const latest = fresh[fresh.length - 1];
        setThread((prev) =>
          prev
            ? {
                ...prev,
                lastMessageBody: latest.body || (latest.attachments?.length > 0 ? "Sent an attachment" : ""),
                lastMessageAt: latest.dateCreated,
                unreadCount: 0,
              }
            : prev
        );
 
        // The chat is open, so a message from the buyer is being read now.
        if (fresh.some((m) => m.senderOrganizationType?.toLowerCase() === "buyer")) {
          await markExternalSupplierThreadAsRead(threadId, rfqId, sessionToken);
        }
      } catch {
        // Transient network error - the next tick retries.
      } finally {
        inFlight = false;
      }
    };
 
    const timer = window.setInterval(poll, LIVE_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [rfqId, sessionToken]);
 
  const handleSelectThread = () => setMobileView("conversation");
  const handleBackToList = () => setMobileView("list");

  const handleLoadOlder = async () => {
    if (!thread || loadingMoreMessages || !hasMoreHistory) return;
    setLoadingMoreMessages(true);
    try {
      const data = await fetchExternalSupplierMessageHistory(
        thread.threadId,
        rfqId,
        sessionToken,
        historyIndex,
        HISTORY_PAGE_LIMIT
      );
      if (isErrorResponse(data)) {
        toastService.error(data.description || data.message || "Failed to load older messages.");
        return;
      }
      const sorted = [...data].sort(
        (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
      );
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        return [...sorted.filter((m) => !existingIds.has(m.id)), ...prev];
      });
      setHistoryIndex((prev) => prev + data.length);
      setHasMoreHistory(data.length === HISTORY_PAGE_LIMIT);
    } catch (err: any) {
      toastService.error(err?.message || "Failed to load older messages.");
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleSendMessage = async (body: string, files: File[]): Promise<boolean> => {
    if (isSendingMessage) return false;
    setIsSendingMessage(true);
    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          fileBytes: await fileToBase64(file),
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        }))
      );

      const result = await sendExternalSupplierMessage(sessionToken, {
        rfqId,
        body,
        attachments,
      });
      if (isErrorResponse(result)) {
        toastService.error(result.description || result.message || "Failed to send message.");
        return false;
      }

      // The SignalR broadcast for this same message can arrive before this
      // REST response does — dedup by id so it isn't appended twice.
      setMessages((prev) => (prev.some((m) => m.id === result.id) ? prev : [...prev, result]));
      setThread((prev) => ({
        threadId: result.threadId,
        rfqId,
        rfqNumber: rfqNumber || prev?.rfqNumber || "",
        buyerId: prev?.buyerId || "",
        supplierId: result.supplierId || prev?.supplierId || "",
        externalSupplierId: result.externalSupplierId || prev?.externalSupplierId || "",
        counterpartyName,
        lastMessageBody: result.body || (result.attachments.length > 0 ? "Sent an attachment" : ""),
        lastMessageAt: result.dateCreated,
        unreadCount: 0,
      }));
      setScrollTick((t) => t + 1);
      return true;
    } catch (err: any) {
      toastService.error(err?.message || "Failed to send message.");
      return false;
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleDownloadAttachment = async (attachmentId: string, fallbackFileName: string) => {
    if (downloadingAttachmentId) return;
    setDownloadingAttachmentId(attachmentId);
    try {
      const data = await downloadExternalSupplierMessageAttachment(attachmentId, rfqId, sessionToken);
      if (isErrorResponse(data)) {
        toastService.error(data.description || data.message || "Failed to download attachment.");
        return;
      }
      downloadBase64File(data.fileBytes, data.fileName || fallbackFileName, data.contentType);
    } catch (err: any) {
      toastService.error(err?.message || "Failed to download attachment.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  return (
    <div className="brc-overlay" onClick={onClose}>
      <div className="brc-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="brc-header">
          <div className="brc-header-title-row">
            <span className="brc-header-icon">
              <IconMessageSquare />
            </span>
            <div className="brc-header-text">
              <h2 className="brc-header-title">{rfqTitle ? `Chat — ${rfqTitle}` : "RFQ Chat"}</h2>
              <div className="brc-header-subtitle">
                {rfqNumber ? `${rfqNumber}` : ""}
                {!!thread?.unreadCount && `${rfqNumber ? " • " : ""}${thread.unreadCount} unread`}
              </div>
            </div>
          </div>
          <button type="button" className="brc-close-btn" onClick={onClose} aria-label="Close chat">
            <IconClose />
          </button>
        </div>

        <div className={`brc-body brc-mobile-${mobileView}`}>
          <div className="brc-supplier-list">
            <div className="brc-supplier-list-header">Chats</div>
            <div className="brc-supplier-items">
              {loadingThread ? (
                <div className="brc-loading-state">
                  <div className="brc-spinner-md" />
                  <span>Loading conversation...</span>
                </div>
              ) : (
                <div
                  className="brc-supplier-item brc-supplier-item-active"
                  onClick={handleSelectThread}
                  role="button"
                  tabIndex={0}
                >
                  <div className="brc-supplier-avatar">{getInitials(counterpartyName)}</div>
                  <div className="brc-supplier-info">
                    <div className="brc-supplier-name-row">
                      <span className="brc-supplier-name">{counterpartyName}</span>
                      {thread?.lastMessageAt && (
                        <span className="brc-supplier-time">{formatThreadTime(thread.lastMessageAt)}</span>
                      )}
                    </div>
                    {rfqNumber && <div className="brc-supplier-user-count">{rfqNumber}</div>}
                    <div className="brc-supplier-preview-row">
                      {thread ? (
                        <span className="brc-supplier-preview">{thread.lastMessageBody || "No messages yet"}</span>
                      ) : (
                        <span className="brc-supplier-preview-start">Start chat</span>
                      )}
                      {!!thread?.unreadCount && (
                        <span className="brc-unread-badge">
                          {thread.unreadCount > 99 ? "99+" : thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isChatDetailsOpen ? (
            <ExternalChatDetails
              counterpartyName={counterpartyName}
              externalSupplierName={externalSupplierName}
              onBack={() => setIsChatDetailsOpen(false)}
            />
          ) : (
            <ExternalChatConversation
              counterpartyName={counterpartyName}
              externalSupplierName={externalSupplierName}
              hasThread={!!thread}
              messages={messages}
              isLoadingMessages={loadingMessages}
              messagesError={messagesError}
              hasMoreHistory={hasMoreHistory}
              isLoadingMoreMessages={loadingMoreMessages}
              onLoadOlder={handleLoadOlder}
              isSendingMessage={isSendingMessage}
              onSendMessage={handleSendMessage}
              downloadingAttachmentId={downloadingAttachmentId}
              onDownloadAttachment={handleDownloadAttachment}
              onBackToList={handleBackToList}
              onOpenDetails={() => setIsChatDetailsOpen(true)}
              scrollTick={scrollTick}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ExternalSupplierChat;
