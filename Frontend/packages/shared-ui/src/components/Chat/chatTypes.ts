/** Canonical RFQ-chat wire types, shared by the buyer and supplier remotes' message APIs. */

export interface ChatAttachmentInputDto {
  fileBytes: string;
  fileName: string;
  contentType: string;
}

export interface ChatAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface ChatMessageDto {
  id: string;
  threadId: string;
  senderUserId: string;
  senderName: string;
  senderOrganizationType: string;
  body: string;
  attachments: ChatAttachmentDto[];
  dateCreated: string;
  isReadByBuyer: boolean;
  isReadBySupplier: boolean;
}

export interface ChatThreadDto {
  threadId: string;
  rfqId: string;
  rfqNumber: string;
  buyerId: string;
  supplierId: string;
  externalSupplierId?: string;
  counterpartyName: string;
  lastMessageBody: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface MarkThreadReadResponseDto {
  statusCode: number;
  message: string;
  description: string;
  id: string;
}

export interface ChatAttachmentDownloadDto {
  fileName: string;
  contentType: string;
  fileBytes: string;
}

/** Identifies who a message is being sent to — a supplierId, or an externalSupplierId when `isExternal` is set. */
export interface ChatTarget {
  id: string;
  isExternal: boolean;
}

/**
 * Host-supplied bridge to that host's own message REST endpoints. ChatPanel never calls an API directly —
 * it has no dependency on any remote's axios instance — so each host (buyer/supplier) builds one of these
 * from its own existing *Api.ts chat functions and hands it in as a prop.
 */
export interface ChatApiAdapter {
  fetchThreads: () => Promise<ChatThreadDto[]>;
  fetchHistory: (threadId: string, index: number, limit: number) => Promise<ChatMessageDto[]>;
  markThreadRead: (threadId: string) => Promise<void>;
  sendMessage: (target: ChatTarget, body: string, attachments: ChatAttachmentInputDto[]) => Promise<ChatMessageDto>;
  downloadAttachment: (attachmentId: string) => Promise<ChatAttachmentDownloadDto>;
}

/** One counterparty this panel can chat with — a supplier (buyer's view) or the buyer (supplier's view). */
export interface ChatCounterpartyRef {
  id: string;
  name: string;
  isExternal?: boolean;
}

/** The subset of a logged-in person's profile the chat UI actually displays. */
export interface ChatParticipantProfile {
  userId: string;
  name: string;
  userName: string;
  email: string;
  organizationName?: string;
}
