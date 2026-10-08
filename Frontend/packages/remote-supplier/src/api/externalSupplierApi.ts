import externalSupplierInstance from './externalSupplierInstance';
import type {
  ExternalRFQDetailResponse,
  ExternalSubmitQuotationPayload,
  ExternalSubmitQuotationResponse,
  ExternalAssetDto,
} from '../dto/externalSupplierDto';
import type {
  SendExternalSupplierMessagePayload,
  ExternalChatMessageDto,
  ExternalChatThreadDto,
  ExternalChatMarkThreadReadResponseDto,
  ExternalChatAttachmentDownloadDto,
} from '../dto/externalChatDto';
import type { ErrorResponseDto } from '@vosox/shared-ui';

const wrapError = (error: any, fallbackMessage: string): ErrorResponseDto => {
  if (error.response && error.response.data) {
    const errData = error.response.data;
    return {
      statusCode: errData.statusCode || errData.status_code || error.response.status || 500,
      message: errData.message || fallbackMessage,
      description: errData.description || 'No details provided',
    };
  }
  return {
    statusCode: 500,
    message: 'Unexpected Error',
    description: 'Something went wrong. Please try again later.',
  };
};

const sessionTokenHeader = (sessionToken: string) => ({
  headers: { 'X-Session-Token': sessionToken },
});

export const fetchExternalRfqDetails = async (
  rfqId: string,
  sessionToken: string
): Promise<ExternalRFQDetailResponse | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.get(
      `/api/v1/supplier/external-rfq/${rfqId}`,
      sessionTokenHeader(sessionToken)
    );
    return response.data;
  } catch (error: any) {
    return wrapError(error, 'Failed to load RFQ details');
  }
};

export const fetchExternalAsset = async (
  assetId: string,
  rfqId: string,
  sessionToken: string
): Promise<ExternalAssetDto | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.get<ExternalAssetDto>(
      `/api/v1/buyer/externa-asset/${assetId}`,
      {
        ...sessionTokenHeader(sessionToken),
        params: { rfqId },
      }
    );
    return response.data;
  } catch (error: any) {
    return wrapError(error, 'Failed to fetch document');
  }
};

export const submitExternalQuotation = async (
  rfqId: string,
  sessionToken: string,
  payload: ExternalSubmitQuotationPayload
): Promise<ExternalSubmitQuotationResponse | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.put(
      `/api/v1/supplier/external-rfq/${rfqId}/quotation`,
      payload,
      sessionTokenHeader(sessionToken)
    );
    return response.data;
  } catch (error: any) {
    return wrapError(error, 'Failed to submit quotation');
  }
};

/* ---------------------------------- External Supplier Chat ---------------------------------- */

export const sendExternalSupplierMessage = async (
  sessionToken: string,
  payload: SendExternalSupplierMessagePayload
): Promise<ExternalChatMessageDto | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.post<ExternalChatMessageDto>(
      '/api/v1/buyer/external-message/supplier-send',
      payload,
      { ...sessionTokenHeader(sessionToken), params: { rfqId: payload.rfqId } }
    );
    return response.data;
  } catch (error: any) {
    return wrapError(error, 'Failed to send message');
  }
};

export const fetchExternalSupplierMessageThreads = async (
  rfqId: string,
  sessionToken: string
): Promise<ExternalChatThreadDto[] | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.get<ExternalChatThreadDto[]>(
      '/api/v1/buyer/external-message/supplier-thread',
      { ...sessionTokenHeader(sessionToken), params: { rfqId } }
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    // "No conversations found" for this RFQ is an expected empty state, not a
    // real failure — treat it as zero threads whether the backend reports it
    // via the HTTP status or via a status_code/statusCode field in the body.
    const bodyStatus = error.response?.data?.status_code ?? error.response?.data?.statusCode;
    if (error.response?.status === 404 || bodyStatus === 404) {
      return [];
    }
    return wrapError(error, 'Failed to fetch chat threads');
  }
};

export const fetchExternalSupplierMessageHistory = async (
  threadId: string,
  rfqId: string,
  sessionToken: string,
  index = 0,
  limit = 20
): Promise<ExternalChatMessageDto[] | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.get<ExternalChatMessageDto[]>(
      `/api/v1/buyer/external-message/supplier-thread/${threadId}/history`,
      { ...sessionTokenHeader(sessionToken), params: { rfqId, index, limit } }
    );
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    return wrapError(error, 'Failed to fetch chat history');
  }
};

export const markExternalSupplierThreadAsRead = async (
  threadId: string,
  rfqId: string,
  sessionToken: string
): Promise<ExternalChatMarkThreadReadResponseDto | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.post<ExternalChatMarkThreadReadResponseDto>(
      `/api/v1/buyer/external-message/supplier-thread/${threadId}/read`,
      undefined,
      { ...sessionTokenHeader(sessionToken), params: { rfqId } }
    );
    return response.data;
  } catch (error: any) {
    return wrapError(error, 'Failed to mark conversation as read');
  }
};

export const downloadExternalSupplierMessageAttachment = async (
  attachmentId: string,
  rfqId: string,
  sessionToken: string
): Promise<ExternalChatAttachmentDownloadDto | ErrorResponseDto> => {
  try {
    const response = await externalSupplierInstance.get<ExternalChatAttachmentDownloadDto>(
      `/api/v1/buyer/external-message/supplier-attachment/${attachmentId}`,
      { ...sessionTokenHeader(sessionToken), params: { rfqId } }
    );
    return response.data;
  } catch (error: any) {
    return wrapError(error, 'Failed to download attachment');
  }
};
