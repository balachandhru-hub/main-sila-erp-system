import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ChatPanel.css";
import { EmptyState } from "../EmptyState";
import { Loader } from "../Loader";
import { toastService } from "../../services/toastservice";
import type {
  ChatApiAdapter,
  ChatCounterpartyRef,
  ChatMessageDto,
  ChatParticipantProfile,
  ChatThreadDto,
} from "./chatTypes";
import ChatConversation from "./ChatConversation";
import ChatDetails, { type ObservedParticipant } from "./ChatDetails";
import { downloadBase64File, fileToBase64, formatThreadTime, getInitials } from "./chatUtils";
import { IconClose, IconMessageSquare } from "./ChatIcons";
import { startRfqChatHub, stopRfqChatHub, type RfqChatHubParams } from "./rfqChatHub";

const HISTORY_PAGE_LIMIT = 20;

interface ChatCounterparty {
  id: string;
  name: string;
  thread: ChatThreadDto | null;
  isExternal: boolean;
}

export interface ChatPanelProps {
  onClose: () => void;
  role: "buyer" | "supplier";
  rfqId: string;
  rfqNumber?: string;
  rfqTitle?: string;
  /** The counterparties this panel can chat with — every awarded/invited supplier for the buyer, or just the one buyer for a supplier. */
  counterparties: ChatCounterpartyRef[];
  /** Shown when `counterparties` is empty instead of the supplier list/conversation. */
  noCounterpartiesMessage?: string;
  currentUserProfile: ChatParticipantProfile | null;
  isLoadingCurrentUserProfile?: boolean;
  /** Bridges to the host's own message REST endpoints — see ChatApiAdapter. */
  api: ChatApiAdapter;
  hubParams: RfqChatHubParams;
}

/** Other people observed sending messages, scoped per role — see ChatDetails for why these differ. */
const computeObservedParticipants = (
  messages: ChatMessageDto[],
  role: "buyer" | "supplier",
  currentUserProfile: ChatParticipantProfile | null
): ObservedParticipant[] => {
  const seen = new Map<string, string>();
  if (role === "buyer") {
    // Individual supplier-side people are only knowable from who has actually
    // sent a message in the currently open thread — not from invitedUsers.
    for (const message of messages) {
      if (message.senderOrganizationType?.toLowerCase() === "buyer") continue;
      if (!message.senderName) continue;
      // External supplier messages have no senderUserId (they're an unregistered
      // session-token contact, not an internal user) — fall back to the sender
      // name itself as the dedup key so they still show up here.
      const key = message.senderUserId || message.senderName;
      if (!seen.has(key)) seen.set(key, message.senderName);
    }
  } else {
    // Other supplier-side people are only knowable from who has actually sent
    // a message in this thread — not from any invited-users list.
    for (const message of messages) {
      if (message.senderOrganizationType?.toLowerCase() !== "supplier") continue;
      if (!message.senderUserId || !message.senderName) continue;
      if (message.senderUserId === currentUserProfile?.userId) continue;
      if (!seen.has(message.senderUserId)) seen.set(message.senderUserId, message.senderName);
    }
  }
  return Array.from(seen.entries()).map(([userId, name]) => ({ userId, name }));
};

const ChatPanel: React.FC<ChatPanelProps> = ({
  onClose,
  role,
  rfqId,
  rfqNumber,
  rfqTitle,
  counterparties,
  noCounterpartiesMessage = "No suppliers are invited to this RFQ.",
  currentUserProfile,
  isLoadingCurrentUserProfile = false,
  api,
  hubParams,
}) => {
  const [threads, setThreads] = useState<ChatThreadDto[]>([]);
  // Starts true (not false) because threads are always fetched on mount — this
  // keeps the auto-select-first-counterparty effect below from firing on the
  // very first render pass, before that fetch has actually populated `threads`.
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "conversation">("list");
  const [isChatDetailsOpen, setIsChatDetailsOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [scrollTick, setScrollTick] = useState(0);

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  // Read inside the SignalR handler (registered once per hub key) so it always
  // sees the currently open thread without reconnecting on every switch.
  const selectedThreadIdRef = useRef<string | null>(null);

  // One chat thread per counterparty. `counterparties` from the host is the
  // ONLY source for who appears here — a matching thread (if any) is merged
  // in, but a counterparty with no thread yet still gets a "Start chat" entry.
  const chatCounterparties = useMemo<ChatCounterparty[]>(() => {
    const list: ChatCounterparty[] = counterparties
      .filter((c) => !!c?.id)
      .map((c) => {
        const thread =
          threads.find((t) => (c.isExternal ? t.externalSupplierId === c.id || t.supplierId === c.id : t.supplierId === c.id)) ||
          null;
        const name = thread?.counterpartyName || c.name || (c.isExternal ? "External Supplier" : "Supplier");
        return { id: c.id, name, thread, isExternal: !!c.isExternal };
      });

    list.sort((a, b) => {
      const at = a.thread?.lastMessageAt ? new Date(a.thread.lastMessageAt).getTime() : 0;
      const bt = b.thread?.lastMessageAt ? new Date(b.thread.lastMessageAt).getTime() : 0;
      return bt - at;
    });

    return list;
  }, [counterparties, threads]);

  const currentCounterparty = chatCounterparties.find((c) => c.id === selectedCounterpartyId) || null;
  const totalUnread = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);

  const observedParticipants = useMemo<ObservedParticipant[]>(
    () => computeObservedParticipants(messages, role, currentUserProfile),
    [messages, role, currentUserProfile]
  );

  useEffect(() => {
    let cancelled = false;
    const loadThreads = async () => {
      setLoadingThreads(true);
      try {
        const data = await api.fetchThreads();
        if (!cancelled) setThreads(data);
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || "Failed to load conversations.";
          toastService.error(msg);
        }
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    };
    loadThreads();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId]);

  useEffect(() => {
    selectedThreadIdRef.current = currentCounterparty?.thread?.threadId || null;
  }, [currentCounterparty]);

  // Routes a live SignalR message into the open conversation (if it belongs to
  // the thread currently on screen) and/or the list preview/unread count. Uses
  // a ref for the selected thread instead of a dependency so the hub
  // connection below doesn't need to be recreated on every selection change.
  const handleIncomingMessages = (payload: ChatMessageDto | ChatMessageDto[]) => {
    const incoming = Array.isArray(payload) ? payload : [payload];
    if (incoming.length === 0) return;

    const openThreadId = selectedThreadIdRef.current;

    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const forOpenThread = incoming.filter(
        (m) => m.threadId === openThreadId && !existingIds.has(m.id)
      );
      return forOpenThread.length > 0 ? [...prev, ...forOpenThread] : prev;
    });

    if (incoming.some((m) => m.threadId === openThreadId)) {
      setScrollTick((t) => t + 1);
    }

    let hasUnknownThread = false;
    setThreads((prev) => {
      const next = [...prev];
      incoming.forEach((message) => {
        const idx = next.findIndex((t) => t.threadId === message.threadId);
        if (idx === -1) {
          hasUnknownThread = true;
          return;
        }
        const isOpenThread = message.threadId === openThreadId;
        next[idx] = {
          ...next[idx],
          lastMessageBody: message.body || (message.attachments?.length ? "Sent an attachment" : ""),
          lastMessageAt: message.dateCreated,
          unreadCount: isOpenThread ? 0 : next[idx].unreadCount + 1,
        };
      });
      return next;
    });

    // A message for a thread this panel hasn't seen yet (e.g. a supplier's
    // first reply) — refresh the thread list from the existing REST endpoint
    // rather than guessing at a new ChatThreadDto's fields.
    if (hasUnknownThread) {
      api.fetchThreads()
        .then((data) => setThreads(data))
        .catch((err) => {
          console.error("[ChatPanel] Failed to refresh threads after an unrecognized SignalR message:", err);
        });
    }
  };

  useEffect(() => {
    startRfqChatHub(hubParams, handleIncomingMessages).catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[ChatPanel] SignalR connection failed:", err);
    });

    return () => {
      stopRfqChatHub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubParams.rfqId, hubParams.supplierId, hubParams.externalSessionToken]);

  useEffect(() => {
    if (!loadingThreads && !selectedCounterpartyId && chatCounterparties.length > 0) {
      setSelectedCounterpartyId(chatCounterparties[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingThreads, chatCounterparties.length]);

  useEffect(() => {
    setMessages([]);
    setMessagesError(null);
    setHistoryIndex(0);
    setHasMoreHistory(false);

    if (!selectedCounterpartyId) return;
    const counterparty = chatCounterparties.find((c) => c.id === selectedCounterpartyId);
    const thread = counterparty?.thread;
    if (!thread) return;

    let cancelled = false;
    const loadHistory = async () => {
      setLoadingMessages(true);
      try {
        const data = await api.fetchHistory(thread.threadId, 0, HISTORY_PAGE_LIMIT);
        if (cancelled) return;
        const sorted = [...data].sort(
          (a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
        );
        setMessages(sorted);
        setHistoryIndex(data.length);
        setHasMoreHistory(data.length === HISTORY_PAGE_LIMIT);
        setScrollTick((t) => t + 1);

        if (thread.unreadCount > 0) {
          api.markThreadRead(thread.threadId)
            .then(() => {
              setThreads((prev) =>
                prev.map((t) => (t.threadId === thread.threadId ? { ...t, unreadCount: 0 } : t))
              );
            })
            .catch((err: any) => {
              toastService.error(err?.message || "Failed to mark conversation as read.");
            });
        }
      } catch (err: any) {
        if (!cancelled) setMessagesError(err?.message || "Failed to load conversation history.");
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCounterpartyId]);

  const handleSelectCounterparty = (id: string) => {
    setSelectedCounterpartyId(id);
    setIsChatDetailsOpen(false);
    setMobileView("conversation");
  };

  const handleBackToList = () => setMobileView("list");

  const handleLoadOlder = async () => {
    const thread = currentCounterparty?.thread;
    if (!thread || loadingMoreMessages || !hasMoreHistory) return;
    setLoadingMoreMessages(true);
    try {
      const data = await api.fetchHistory(thread.threadId, historyIndex, HISTORY_PAGE_LIMIT);
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
    if (!selectedCounterpartyId || isSendingMessage) return false;
    const counterparty = chatCounterparties.find((c) => c.id === selectedCounterpartyId);
    if (!counterparty) return false;

    setIsSendingMessage(true);
    try {
      const attachments = await Promise.all(
        files.map(async (file) => ({
          fileBytes: await fileToBase64(file),
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        }))
      );

      const response = await api.sendMessage(
        { id: selectedCounterpartyId, isExternal: counterparty.isExternal },
        body,
        attachments
      );

      // The SignalR broadcast for this same message can arrive before this
      // REST response does — dedup by id so it isn't appended twice.
      setMessages((prev) => (prev.some((m) => m.id === response.id) ? prev : [...prev, response]));

      setThreads((prev) => {
        const idx = prev.findIndex((t) =>
          counterparty.isExternal ? t.externalSupplierId === selectedCounterpartyId : t.supplierId === selectedCounterpartyId
        );
        if (idx === -1) {
          const newThread: ChatThreadDto = {
            threadId: response.threadId,
            rfqId,
            rfqNumber: rfqNumber || "",
            buyerId: "",
            supplierId: counterparty.isExternal ? "" : selectedCounterpartyId,
            externalSupplierId: counterparty.isExternal ? selectedCounterpartyId : undefined,
            counterpartyName: counterparty.name,
            lastMessageBody: response.body,
            lastMessageAt: response.dateCreated,
            unreadCount: 0,
          };
          return [newThread, ...prev];
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          threadId: response.threadId,
          lastMessageBody: response.body || (response.attachments.length > 0 ? "Sent an attachment" : ""),
          lastMessageAt: response.dateCreated,
          unreadCount: 0,
        };
        return updated;
      });

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
      const data = await api.downloadAttachment(attachmentId);
      downloadBase64File(data.fileBytes, data.fileName || fallbackFileName, data.contentType);
    } catch (err: any) {
      toastService.error(err?.message || "Failed to download attachment.");
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  return (
    <div className="brc-overlay" onClick={onClose}>
      <div
        className="brc-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brc-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="brc-header">
          <div className="brc-header-title-row">
            <span className="brc-header-icon" aria-hidden="true">
              <IconMessageSquare />
            </span>
            <div className="brc-header-text">
              <h2 id="brc-drawer-title" className="brc-header-title">{rfqTitle ? `Chat — ${rfqTitle}` : "RFQ Chat"}</h2>
              <div className="brc-header-subtitle">
                {rfqNumber ? <span className="sila-ref">{rfqNumber}</span> : ""}
                {totalUnread > 0 ? `${rfqNumber ? " • " : ""}${totalUnread} unread` : ""}
              </div>
            </div>
          </div>
          <button type="button" className="brc-close-btn" onClick={onClose} aria-label="Close chat">
            <IconClose />
          </button>
        </div>

        {counterparties.length === 0 ? (
          <div className="brc-state-wrap">
            <EmptyState icon={<IconMessageSquare />} title={noCounterpartiesMessage} />
          </div>
        ) : (
          <div className={`brc-body brc-mobile-${mobileView}`}>
            <div className="brc-supplier-list">
              <div className="brc-supplier-list-header">Chats</div>
              <div className="brc-supplier-items">
                {loadingThreads ? (
                  <div className="brc-state-wrap">
                    <Loader size={24} message="Loading conversations..." />
                  </div>
                ) : chatCounterparties.length === 0 ? (
                  <div className="brc-state-wrap">
                    <EmptyState title={noCounterpartiesMessage} />
                  </div>
                ) : (
                  <>
                    {chatCounterparties.map((counterparty) => (
                      <div
                        key={counterparty.id}
                        className={`brc-supplier-item${
                          counterparty.id === selectedCounterpartyId ? " brc-supplier-item-active" : ""
                        }${counterparty.thread?.unreadCount ? " brc-supplier-item-unread" : ""}`}
                        onClick={() => handleSelectCounterparty(counterparty.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleSelectCounterparty(counterparty.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-current={counterparty.id === selectedCounterpartyId ? "true" : undefined}
                      >
                        <div className="brc-supplier-avatar" aria-hidden="true">{getInitials(counterparty.name)}</div>
                        <div className="brc-supplier-info">
                          <div className="brc-supplier-name-row">
                            <span className="brc-supplier-name">{counterparty.name}</span>
                            {counterparty.thread?.lastMessageAt && (
                              <span className="brc-supplier-time">
                                {formatThreadTime(counterparty.thread.lastMessageAt)}
                              </span>
                            )}
                          </div>
                          <div className="brc-supplier-preview-row">
                            {counterparty.thread ? (
                              <span className="brc-supplier-preview">
                                {counterparty.thread.lastMessageBody || "No messages yet"}
                              </span>
                            ) : (
                              <span className="brc-supplier-preview-start">Start chat</span>
                            )}
                            {!!counterparty.thread?.unreadCount && (
                              <span
                                className="brc-unread-badge"
                                aria-label={`${counterparty.thread.unreadCount} unread`}
                              >
                                {counterparty.thread.unreadCount > 99 ? "99+" : counterparty.thread.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {isChatDetailsOpen && currentCounterparty ? (
              <ChatDetails
                role={role}
                counterpartyName={currentCounterparty.name}
                currentUserProfile={currentUserProfile}
                isLoadingCurrentUserProfile={isLoadingCurrentUserProfile}
                observedParticipants={observedParticipants}
                onBack={() => setIsChatDetailsOpen(false)}
              />
            ) : (
              <ChatConversation
                role={role}
                currentUserProfile={currentUserProfile}
                counterpartyName={currentCounterparty?.name || null}
                hasCounterparty={!!currentCounterparty?.thread}
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
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
