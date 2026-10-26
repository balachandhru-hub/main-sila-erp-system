import type { SupplierDashboardAnalytics } from '@vosox/shared-ui';
import {
  getIntegrationExecutions,
  getIntegrations,
  integrationProcessOf,
  pullIntegration,
  type IntegrationConfiguration,
  type IntegrationExecution,
} from '../../../remote-buyer/src/api/integrationsApi';
import { getPurchaseOrders, type PurchaseOrderListItem } from '../../../remote-buyer/src/api/purchaseOrderApi';
import supplierInstance from '../../../remote-supplier/src/api/supplierInstance';
import {
  createSupplierCatalog,
  fetchRFQById,
  fetchSupplierAsset,
  fetchSupplierCatalog,
  fetchSupplierCatalogDetail,
  fetchSupplierDashboardAnalytics,
  getSupplierProfile,
  updateSupplierCatalogStock,
  type CatalogDetailResponseItem,
  type RFQDetailResponse,
  type SupplierCatalogListItem,
} from '../../../remote-supplier/src/api/supplierApi';

const PAGE = 20;

interface ErrorBody {
  statusCode?: number;
  message?: string;
  description?: string;
}

const asError = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || !('statusCode' in value)) return null;
  const body = value as ErrorBody;
  if (typeof body.statusCode !== 'number' || body.statusCode < 400) return null;
  return body.description || body.message || 'The Cloud service could not complete this request.';
};

const unwrap = <T>(value: T, fallback: string): T => {
  const message = asError(value);
  if (message) throw new Error(message || fallback);
  return value;
};

export interface SupplierRfqRow {
  rfqId: string;
  supplierRfqId: string;
  number: string;
  title: string;
  customer: string;
  endDate: string;
  location: string;
  /** Present when the list was loaded with a server status. The summary list does not return a status of its own. */
  queriedStatus: string | null;
}

const rowOf = (item: Record<string, unknown>, queriedStatus: string | null): SupplierRfqRow => ({
  rfqId: String(item.rfqId || item.RFQId || ''),
  supplierRfqId: String(item.supplierRFQId || item.supplierRfqId || ''),
  number: String(item.rfqNumber || item.RFQNumber || ''),
  title: String(item.title || item.Title || 'RFQ'),
  customer: String(item.organizationName || item.buyerName || ''),
  endDate: String(item.endDate || item.EndDate || ''),
  location: String(item.deliveryLocation || ''),
  queriedStatus,
});

export interface SupplierContext {
  supplierId: string;
  organizationId: string;
}

export const loadSupplierContext = async (): Promise<SupplierContext | null> => {
  const profile = await getSupplierProfile();
  const message = asError(profile);
  if (message) throw new Error(message);
  if (!profile || typeof profile !== 'object' || !('id' in profile) || !profile.id) return null;
  return { supplierId: String(profile.id), organizationId: String(profile.organizationId || '') };
};

export const loadRfqs = async (options: {
  supplierId: string;
  index?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<SupplierRfqRow[]> => {
  const response = await supplierInstance.post('/api/v1/supplier/rfq-master-data', {
    supplierId: options.supplierId,
    index: options.index ?? 0,
    limit: options.limit ?? PAGE,
    status: options.status || undefined,
    search: options.search || undefined,
  });
  const data = unwrap<unknown>(response.data, 'Could not load RFQs.');
  const list = Array.isArray(data) ? data : [];
  return list.map((item) => rowOf(item as Record<string, unknown>, options.status ?? null));
};

export const loadRfqDetail = async (rfqId: string): Promise<RFQDetailResponse> => {
  const result = await fetchRFQById(rfqId);
  const message = asError(result);
  if (message) throw new Error(message);
  return result as RFQDetailResponse;
};

export const loadAnalytics = async (): Promise<SupplierDashboardAnalytics> => fetchSupplierDashboardAnalytics();

export const loadCatalog = async (): Promise<SupplierCatalogListItem[]> => {
  const result = await fetchSupplierCatalog();
  const list = unwrap(result, 'Could not load the product catalog.');
  return Array.isArray(list) ? list : [];
};

export const loadCatalogDetail = async (catalogId: string): Promise<CatalogDetailResponseItem | null> => {
  const result = await fetchSupplierCatalogDetail(catalogId);
  const list = unwrap(result, 'Could not load the product.');
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
};

export const loadCatalogImage = async (assetId: string): Promise<string | null> => {
  const asset = await fetchSupplierAsset(assetId);
  if (asError(asset) || !asset || typeof asset !== 'object') return null;
  const file = asset as { fileBytes?: string; contentType?: string; url?: string; fileUrl?: string };
  if (file.fileBytes) return `data:${file.contentType || 'image/jpeg'};base64,${file.fileBytes}`;
  return file.url || file.fileUrl || null;
};

export const saveCatalogStock = async (
  catalogId: string,
  payload: { sku: string; availableStock: number | null; discountPercent: number | null },
): Promise<void> => {
  const result = await updateSupplierCatalogStock(catalogId, payload);
  if (result !== true) throw new Error(asError(result) || 'Could not update the product.');
};

/** Updates price and description through the existing catalog update. Pictures are left unchanged. */
export const saveCatalogPrice = async (item: CatalogDetailResponseItem, price: number, description: string): Promise<void> => {
  try {
    await supplierInstance.put('/api/v1/supplier/catalog', {
      catalog: {
        id: item.catalogId,
        catalogName: item.catalogName,
        description,
        price,
        unitOfMeasure: item.unitOfMeasure,
        sku: item.sku,
        availableStock: item.availableStock,
        discountPercent: item.discountPercent,
        catalogType: item.catalogType,
        segment: item.segment,
        segmentTitle: item.segmentTitle,
        family: item.family,
        familyTitle: item.familyTitle,
        commodity: item.commodity,
        commodityTitle: item.commodityTitle,
        class: item.class,
        classTitle: item.classTitle,
        isPunchOut: item.isPunchOut,
        punchOutUrl: item.punchOutUrl,
      },
    });
  } catch (error: unknown) {
    const response = (error as { response?: { data?: unknown } }).response?.data;
    throw new Error(asError(response) || 'Could not update the product.');
  }
};

export const addCatalogProduct = async (input: {
  organizationId: string;
  catalogName: string;
  description: string;
  price: number;
  currency: string;
  unitOfMeasure: string;
  catalogType: string;
}): Promise<void> => {
  const result = await createSupplierCatalog({
    organizationId: input.organizationId,
    catalog: {
      catalogName: input.catalogName,
      description: input.description,
      price: input.price,
      currency: input.currency,
      unitOfMeasure: input.unitOfMeasure,
      catalogType: input.catalogType,
      isPunchOut: false,
      punchOutUrl: '',
      assets: [],
    } as never,
  });
  const message = asError(result);
  if (message) throw new Error(message);
};

export const loadCustomerOrders = async (index = 0, limit = PAGE): Promise<PurchaseOrderListItem[]> =>
  getPurchaseOrders('supplier', limit, index);

export interface SyncRow {
  configuration: IntegrationConfiguration;
  execution: IntegrationExecution | null;
  canRun: boolean;
}

export const loadSync = async (): Promise<SyncRow[]> => {
  const [configurations, executions] = await Promise.all([
    getIntegrations('supplier'),
    getIntegrationExecutions('supplier'),
  ]);
  return configurations.map((configuration) => {
    const history = executions
      .filter((execution) => execution.configurationId === configuration.id)
      .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
    return {
      configuration,
      execution: history[0] ?? null,
      canRun: integrationProcessOf(configuration.processType).pull === 'full',
    };
  });
};

export const loadSyncHistory = async (configurationId: string): Promise<IntegrationExecution[]> => {
  const executions = await getIntegrationExecutions('supplier', configurationId);
  return [...executions].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
};

export const runSupplierSync = async (configurationId: string): Promise<void> => {
  await pullIntegration('supplier', configurationId, true);
};

export const PAGE_SIZE = PAGE;
