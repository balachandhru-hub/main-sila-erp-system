export interface ExternalChatAttachmentInputDto {
  fileBytes: string;
  fileName: string;
  contentType: string;
}

export interface ExternalChatAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface SendExternalSupplierMessagePayload {
  rfqId: string;
  body: string;
  attachments: ExternalChatAttachmentInputDto[];
}

export interface ExternalChatMessageDto {
  id: string;
  threadId: string;
  rfqId: string;
  supplierId: string;
  externalSupplierId: string;
  senderUserId: string | null;
  senderName: string;
  senderOrganizationType: string;
  body: string;
  attachments: ExternalChatAttachmentDto[];
  dateCreated: string;
  isReadByBuyer: boolean;
  isReadBySupplier: boolean;
}

export interface ExternalChatThreadDto {
  threadId: string;
  rfqId: string;
  rfqNumber: string;
  buyerId: string;
  supplierId: string;
  externalSupplierId: string;
  counterpartyName: string;
  lastMessageBody: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface ExternalChatMarkThreadReadResponseDto {
  statusCode: number;
  message: string;
  description: string;
  id: string;
}

export interface ExternalChatAttachmentDownloadDto {
  fileName: string;
  contentType: string;
  fileBytes: string;
}
