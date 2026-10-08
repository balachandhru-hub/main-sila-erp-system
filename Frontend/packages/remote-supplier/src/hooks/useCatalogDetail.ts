import { useState } from "react";
import { isErrorResponse } from "@vosox/shared-ui";
import { fetchSupplierCatalogDetail, type CatalogDetailResponseItem } from "../api/supplierApi";

export function useCatalogDetail(
  loadCatalogAssetImage: (assetId: string) => Promise<void>,
  catalogAssetImages: Record<string, string>
) {
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogDetailResponseItem | null>(null);
  const [loadingCatalogDetail, setLoadingCatalogDetail] = useState(false);
  const [catalogDetailError, setCatalogDetailError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loadingSelectedImages, setLoadingSelectedImages] = useState(false);

  const [showPunchOutFullPage, setShowPunchOutFullPage] = useState(false);
  const [punchOutPreviewUrl, setPunchOutPreviewUrl] = useState<string>("");
  const [punchOutIframeBlocked, setPunchOutIframeBlocked] = useState(false);

  const openCatalogDetail = async (catalogId: string) => {
    setLoadingCatalogDetail(true);
    setCatalogDetailError(null);
    setSelectedCatalogItem(null);
    setSelectedImageIndex(0);

    try {
      const response = await fetchSupplierCatalogDetail(catalogId);

      if (isErrorResponse(response)) {
        setCatalogDetailError(
          response.description || response.message || 'Failed to load catalog details.'
        );
        return;
      }

      if (Array.isArray(response) && response.length > 0) {
        setSelectedCatalogItem(response[0]);

        const assetIds = (response[0].asset || []).map((a) => a.id).filter(Boolean) as string[];
        if (assetIds.length > 0) {
          setLoadingSelectedImages(true);
          try {
            await Promise.all(assetIds.map((id) => loadCatalogAssetImage(id)));
          } finally {
            setLoadingSelectedImages(false);
          }
        }
      } else {
        setCatalogDetailError('No catalog details found.');
      }
    } catch (error: any) {
      setCatalogDetailError(error.message || 'Failed to load catalog details.');
    } finally {
      setLoadingCatalogDetail(false);
    }
  };

  const closeCatalogDetail = () => {
    setSelectedCatalogItem(null);
    setSelectedImageIndex(0);
    setShowPunchOutFullPage(false);
    setCatalogDetailError(null);
  };

  const selectedCatalogImages: string[] = selectedCatalogItem
    ? ((selectedCatalogItem.asset || [])
      .map((a) => (a.id ? catalogAssetImages[a.id] : undefined))
      .filter(Boolean) as string[])
    : [];

  const goToPrevImage = () => {
    setSelectedImageIndex((prev) =>
      selectedCatalogImages.length === 0 ? 0 : (prev - 1 + selectedCatalogImages.length) % selectedCatalogImages.length
    );
  };

  const goToNextImage = () => {
    setSelectedImageIndex((prev) =>
      selectedCatalogImages.length === 0 ? 0 : (prev + 1) % selectedCatalogImages.length
    );
  };

  const handlePunchOutPreview = (url: string) => {
    setPunchOutPreviewUrl(url);
    setShowPunchOutFullPage(true);
    setPunchOutIframeBlocked(false);
  };

  return {
    selectedCatalogItem,
    loadingCatalogDetail,
    catalogDetailError,
    selectedImageIndex,
    setSelectedImageIndex,
    loadingSelectedImages,
    showPunchOutFullPage,
    setShowPunchOutFullPage,
    punchOutPreviewUrl,
    punchOutIframeBlocked,
    setPunchOutIframeBlocked,
    openCatalogDetail,
    closeCatalogDetail,
    selectedCatalogImages,
    goToPrevImage,
    goToNextImage,
    handlePunchOutPreview,
  };
}
