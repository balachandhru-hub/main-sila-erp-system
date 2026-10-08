import { useState } from "react";
import { fetchSupplierCatalog, fetchSupplierAsset } from "../api/supplierApi";
import type { SupplierCatalogListItem } from "../dto/supplierDto";

export const CATALOG_PAGE_SIZE = 10;

export function useCatalogList() {
  const [catalogList, setCatalogList] = useState<SupplierCatalogListItem[]>([]);
  const [loadingCatalogList, setLoadingCatalogList] = useState(false);
  const [catalogListError, setCatalogListError] = useState<string | null>(null);
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogAssetImages, setCatalogAssetImages] = useState<Record<string, string>>({});

  const catalogTotalPages = Math.max(1, Math.ceil(catalogList.length / CATALOG_PAGE_SIZE));
  const pagedCatalogList = catalogList.slice(
    catalogPage * CATALOG_PAGE_SIZE,
    catalogPage * CATALOG_PAGE_SIZE + CATALOG_PAGE_SIZE
  );

  const loadCatalogAssetImage = async (assetId: string) => {
    if (!assetId || catalogAssetImages[assetId]) return;
    try {
      const asset: any = await fetchSupplierAsset(assetId);
      if (!asset) {
        return;
      }

      if (asset.statusCode && asset.statusCode >= 400) {
        return;
      }

      let src: string | null = null;

      if (asset.fileBytes) {
        const mime = asset.contentType || asset.mimeType || "image/jpeg";
        src = `data:${mime};base64,${asset.fileBytes}`;
      } else if (asset.url) {
        src = asset.url;
      } else if (asset.fileUrl) {
        src = asset.fileUrl;
      } else if (asset.downloadUrl) {
        src = asset.downloadUrl;
      }

      if (src) {
        setCatalogAssetImages((prev) => ({ ...prev, [assetId]: src as string }));
      }
    } catch (error) {
    }
  };

  const loadCatalogList = async () => {
    setLoadingCatalogList(true);
    setCatalogListError(null);
    try {
      const data = await fetchSupplierCatalog();
      if (Array.isArray(data)) {
        setCatalogList(data);
        setCatalogPage(0);
        data.forEach((item) => {
          const firstAssetId = item.assets && item.assets[0]?.id;
          if (firstAssetId) {
            loadCatalogAssetImage(firstAssetId);
          }
        });
      } else {
        setCatalogListError((data as any)?.message || "Failed to load catalogs. Please try again.");
      }
    } catch (error: any) {
      setCatalogListError(error?.message || "Failed to load catalogs. Please try again.");
    } finally {
      setLoadingCatalogList(false);
    }
  };

  return {
    catalogList,
    loadingCatalogList,
    catalogListError,
    catalogPage,
    setCatalogPage,
    catalogTotalPages,
    pagedCatalogList,
    catalogAssetImages,
    loadCatalogAssetImage,
    loadCatalogList,
  };
}
