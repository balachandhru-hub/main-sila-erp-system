import type { ErrorResponseDto } from '@vosox/shared-ui';
import { getContractTemplates } from '../../../remote-buyer/src/api/Buyerapi';
import type { ContractTemplateRecord } from '../components/ContractTemplate.types';

/**
 * Maps the backend's GET /api/v1/buyer/contract-template list into the UI's ContractTemplateRecord.
 * The list is metadata only (id, templateName, segmentId, assetId, fileName, dateCreated) - no
 * fileBytes/contentType and no fields for keyTerms/clauses/customSections/family (those only ever existed
 * client-side to build the PDF), so every API-sourced record comes back as sourceType "uploaded" with
 * those arrays empty and fileDataUrl unset; the PDF itself is fetched on demand via attachmentId.
 */
export const fetchContractTemplates = async (
  index = 0,
  limit = 50
): Promise<ContractTemplateRecord[] | ErrorResponseDto> => {
  try {
    const items = await getContractTemplates(index, limit);
    return items.map((item) => ({
      id: item.id,
      templateName: item.templateName,
      segmentName: item.segmentTitle || (item.segmentId != null ? `Segment ${item.segmentId}` : ''),
      familyName: '',
      keyTerms: [],
      clauses: [],
      customSections: [],
      createdAt: item.dateCreated || new Date().toISOString(),
      sourceType: 'uploaded',
      fileName: item.fileName,
      fileDataUrl: undefined,
      attachmentId: item.assetId,
    }));
  } catch (err: any) {
    return {
      statusCode: 500,
      message: err?.message || 'Failed to load contract templates',
      description: '',
    };
  }
};
