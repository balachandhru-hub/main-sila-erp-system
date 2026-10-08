import { useEffect, useRef, useState } from "react";
import {
  fetchSegments,
  fetchFamilies,
  fetchClassifications,
  fetchCommodities,
} from "../api/masterdataApi";
import { fetchBuyerCatalog, fetchBuyerAsset, fetchBuyerCatalogDetail } from "../api/Buyerapi";
import type { BuyerCatalogResponse as BuyerCatalogResponseType } from "../api/Buyerapi";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "@vosox/shared-ui";
import { isErrorResponse } from "@vosox/shared-ui";
import { PRODUCT_PAGE_SIZES, type ProductFilterState, type ProductSort } from "../components/product/types";

const SEGMENT_PAGE_SIZE = 40;
const FAMILY_PAGE_SIZE = 40;
const CLASS_PAGE_SIZE = 40;
const COMMODITY_PAGE_SIZE = 40;

const EMPTY_FILTERS: ProductFilterState = {
  segment: "",
  family: "",
  class: "",
  commodity: "",
  search: "",
  supplier: "",
};

/** Which page of the catalog to read, in which order. */
interface CatalogPageRequest {
  page: number;
  pageSize: number;
  sort: ProductSort;
}

/**
 * All state and API calls behind the buyer product catalog: filters, search, sort, server-side paging,
 * product detail and PunchOut preview.
 */
export const useProductCatalog = () => {
  // ---- Filter State ----
  const [filters, setFilters] = useState<ProductFilterState>(EMPTY_FILTERS);

  // ---- Selected Classification Values (kept as-is from Dropdown's onChange so the label never goes stale) ----
  const [selectedSegment, setSelectedSegment] = useState<DropdownValue | null>(null);
  const [selectedFamily, setSelectedFamily] = useState<DropdownValue | null>(null);
  const [selectedClass, setSelectedClass] = useState<DropdownValue | null>(null);
  const [selectedCommodity, setSelectedCommodity] = useState<DropdownValue | null>(null);

  // ---- Loading States ----
  const [loadingResults, setLoadingResults] = useState(false);

  // ---- Results State (one server page) ----
  const [catalogResults, setCatalogResults] = useState<BuyerCatalogResponseType[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- Paging and sort: the server returns one page; one extra row tells whether there is a next page ----
  const [pageRequest, setPageRequest] = useState<CatalogPageRequest>({ page: 0, pageSize: PRODUCT_PAGE_SIZES[0], sort: "name" });
  const [hasNextPage, setHasNextPage] = useState(false);
  // The filters the shown page was read with (typed-but-not-applied filters do not change paging).
  const appliedFiltersRef = useRef<ProductFilterState>(EMPTY_FILTERS);
  // Only the newest request may update the results (fast paging or sorting can overtake a slow page).
  const requestIdRef = useRef(0);

  const [productAssetImages, setProductAssetImages] = useState<Record<string, string>>({});

  // Detail view
  const [selectedProduct, setSelectedProduct] = useState<BuyerCatalogResponseType | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loadingSelectedImages, setLoadingSelectedImages] = useState(false);
  const [loadingProductDetail, setLoadingProductDetail] = useState(false);
  const [productDetailError, setProductDetailError] = useState<string | null>(null);

  const [showPunchOutFullPage, setShowPunchOutFullPage] = useState(false);
  const [punchOutPreviewUrl, setPunchOutPreviewUrl] = useState<string>("");
  const [punchOutIframeBlocked, setPunchOutIframeBlocked] = useState(false);

  const fetchProducts = async (filterState: ProductFilterState, request: CatalogPageRequest) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    appliedFiltersRef.current = filterState;
    setPageRequest(request);
    setLoadingResults(true);
    setError(null);

    try {
      const results = await fetchBuyerCatalog({
        segment: filterState.segment || undefined,
        family: filterState.family || undefined,
        class: filterState.class || undefined,
        commodity: filterState.commodity || undefined,
        search: filterState.search.trim() || undefined,
        supplier: filterState.supplier.trim() || undefined,
        index: request.page * request.pageSize,
        limit: request.pageSize + 1,
        sort: request.sort,
      });
      if (requestId !== requestIdRef.current) return;

      if (Array.isArray(results)) {
        const pageRows = results.slice(0, request.pageSize);
        setCatalogResults(pageRows);
        setHasNextPage(results.length > request.pageSize);
        pageRows.forEach((item: BuyerCatalogResponseType) => {
          const firstAssetId = item.asset && item.asset[0]?.id;
          if (firstAssetId) {
            loadProductAssetImage(firstAssetId);
          }
        });
      } else if (results.statusCode === 404) {
        // The catalog API answers "not found" when no product matches: an empty page, not an error.
        setCatalogResults([]);
        setHasNextPage(false);
      } else {
        setError(results.description && results.description !== "No details provided"
          ? results.description
          : "Failed to fetch catalogs. Please try again.");
        setCatalogResults([]);
        setHasNextPage(false);
      }
      setHasSearched(true);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError("Failed to fetch catalogs. Please try again.");
      setCatalogResults([]);
      setHasNextPage(false);
      setHasSearched(true);
    } finally {
      if (requestId === requestIdRef.current) setLoadingResults(false);
    }
  };

  useEffect(() => {
    fetchProducts(EMPTY_FILTERS, pageRequest);
    // Loads the first page once; later loads follow user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Async paginated loader for the Segment Dropdown ----
  const loadSegmentOptions = async ({
    page,
    search,
  }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const pageIndex = page * SEGMENT_PAGE_SIZE; // Dropdown pages are 0-based; the API is 1-based
    const segments = await fetchSegments(pageIndex, SEGMENT_PAGE_SIZE, search || undefined);

    if (!Array.isArray(segments)) {
      return { options: [], hasMore: false };
    }

    return {
      options: segments.map((seg) => ({
        name: seg.title,
        value: String(seg.segment),
      })),
      hasMore: segments.length === SEGMENT_PAGE_SIZE,
    };
  };

  // ---- Async paginated loader for the Family Dropdown ----
  const loadFamilyOptions = async ({
    page,
    search,
  }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!filters.segment) {
      return { options: [], hasMore: false };
    }

    const pageIndex = page * FAMILY_PAGE_SIZE; // Dropdown pages are 0-based; the API is 1-based
    const families = await fetchFamilies(filters.segment, { pageIndex, pageSize: FAMILY_PAGE_SIZE });

    if (!Array.isArray(families)) {
      return { options: [], hasMore: false };
    }

    const searchTerm = search.trim().toLowerCase();
    const options = families
      .filter((fam) => !searchTerm || fam.title.toLowerCase().includes(searchTerm))
      .map((fam) => ({
        name: fam.title,
        value: String(fam.family),
      }));

    return {
      options,
      hasMore: families.length === FAMILY_PAGE_SIZE,
    };
  };

  // ---- Async paginated loader for the Class Dropdown ----
  const loadClassOptions = async ({
    page,
    search,
  }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!filters.family) {
      return { options: [], hasMore: false };
    }

    const pageIndex = page * CLASS_PAGE_SIZE; // Dropdown pages are 0-based; the API is 1-based
    const classes = await fetchClassifications(filters.family, { pageIndex, pageSize: CLASS_PAGE_SIZE });

    if (!Array.isArray(classes)) {
      return { options: [], hasMore: false };
    }

    const searchTerm = search.trim().toLowerCase();
    const options = classes
      .filter((cls) => !searchTerm || cls.classTitle.toLowerCase().includes(searchTerm))
      .map((cls) => ({
        name: cls.classTitle,
        value: String(cls.class),
      }));

    return {
      options,
      hasMore: classes.length === CLASS_PAGE_SIZE,
    };
  };

  // ---- Async paginated loader for the Commodity Dropdown ----
  const loadCommodityOptions = async ({
    page,
    search,
  }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!filters.class) {
      return { options: [], hasMore: false };
    }

    const pageIndex = page * COMMODITY_PAGE_SIZE; // Dropdown pages are 0-based; the API is 1-based
    const commodities = await fetchCommodities(filters.class, { pageIndex, pageSize: COMMODITY_PAGE_SIZE });

    if (!Array.isArray(commodities)) {
      return { options: [], hasMore: false };
    }

    const searchTerm = search.trim().toLowerCase();
    const options = commodities
      .filter((com) => !searchTerm || com.commodityTitle.toLowerCase().includes(searchTerm))
      .map((com) => ({
        name: com.commodityTitle,
        value: String(com.commodity),
      }));

    return {
      options,
      hasMore: commodities.length === COMMODITY_PAGE_SIZE,
    };
  };

  const handleSegmentChange = (val: DropdownValue | null) => {
    setFilters((prev) => ({
      ...prev,
      segment: val ? Number(val.value) : "",
      family: "",
      class: "",
      commodity: "",
    }));

    setSelectedSegment(val);
    setSelectedFamily(null);
    setSelectedClass(null);
    setSelectedCommodity(null);
  };

  const handleFamilyChange = (val: DropdownValue | null) => {
    setFilters((prev) => ({
      ...prev,
      family: val ? Number(val.value) : "",
      class: "",
      commodity: "",
    }));

    setSelectedFamily(val);
    setSelectedClass(null);
    setSelectedCommodity(null);
  };

  const handleClassChange = (val: DropdownValue | null) => {
    setFilters((prev) => ({
      ...prev,
      class: val ? Number(val.value) : "",
      commodity: "",
    }));

    setSelectedClass(val);
    setSelectedCommodity(null);
  };

  const handleCommodityChange = (val: DropdownValue | null) => {
    setFilters((prev) => ({
      ...prev,
      commodity: val ? Number(val.value) : "",
    }));

    setSelectedCommodity(val);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    setFilters((prev) => ({
      ...prev,
      search: value,
    }));

    // Clearing the search box shows every product again.
    if (value.trim() === "") {
      fetchProducts({ ...filters, search: "" }, { ...pageRequest, page: 0 });
    }
  };

  // Supplier filter: part of the supplier's name or SNID. Applied on search; clearing it reloads.
  const handleSupplierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    setFilters((prev) => ({
      ...prev,
      supplier: value,
    }));

    if (value.trim() === "") {
      fetchProducts({ ...filters, supplier: "" }, { ...pageRequest, page: 0 });
    }
  };

  /** Applies the typed search and the chosen filters, from the first page. */
  const handleSearchSubmit = () => {
    fetchProducts(filters, { ...pageRequest, page: 0 });
  };

  /** Clears every filter and the search, and shows the first page. */
  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSelectedSegment(null);
    setSelectedFamily(null);
    setSelectedClass(null);
    setSelectedCommodity(null);
    fetchProducts(EMPTY_FILTERS, { ...pageRequest, page: 0 });
  };

  /** Another page of the same (applied) filters. */
  const goToPage = (page: number) => {
    if (page < 0 || loadingResults) return;
    fetchProducts(appliedFiltersRef.current, { ...pageRequest, page });
  };

  const changeSort = (sort: ProductSort) => {
    fetchProducts(appliedFiltersRef.current, { ...pageRequest, sort, page: 0 });
  };

  const changePageSize = (pageSize: number) => {
    fetchProducts(appliedFiltersRef.current, { ...pageRequest, pageSize, page: 0 });
  };

  /** Filters chosen in the drawer (classification levels and supplier), for the "Filters (n)" button. */
  const activeFilterCount = [filters.segment, filters.family, filters.class, filters.commodity, filters.supplier.trim()]
    .filter((value) => value !== "").length;

  const loadProductAssetImage = async (assetId: string) => {
    if (!assetId || productAssetImages[assetId]) return;
    try {
      const asset: any = await fetchBuyerAsset(assetId);
      if (!asset || asset.statusCode) return;

      let src: string | null = null;
      if (asset.fileBytes) {
        const mime = asset.contentType || asset.fileType || "image/png";
        src = `data:${mime};base64,${asset.fileBytes}`;
      } else if (asset.url) {
        src = asset.url;
      } else if (asset.fileUrl) {
        src = asset.fileUrl;
      }

      if (src) {
        setProductAssetImages((prev) => ({ ...prev, [assetId]: src as string }));
      }
    } catch (error) {
    }
  };

  const openProductDetail = async (catalogId: string) => {
    setLoadingProductDetail(true);
    setProductDetailError(null);
    setSelectedProduct(null);
    setSelectedImageIndex(0);

    try {
      const response = await fetchBuyerCatalogDetail(catalogId);

      if (isErrorResponse(response)) {
        setProductDetailError(
          response.description || response.message || 'Failed to load product details.'
        );
        return;
      }

      setSelectedProduct(response);

      const assetIds = (response.asset || []).map((a) => a.id).filter(Boolean) as string[];
      if (assetIds.length > 0) {
        setLoadingSelectedImages(true);
        try {
          await Promise.all(assetIds.map((id) => loadProductAssetImage(id)));
        } finally {
          setLoadingSelectedImages(false);
        }
      }
    } catch (error: any) {
      setProductDetailError(error.message || 'Failed to load product details.');
    } finally {
      setLoadingProductDetail(false);
    }
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
    setSelectedImageIndex(0);
    setShowPunchOutFullPage(false);
    setProductDetailError(null);
  };

  const selectedProductImages: string[] = selectedProduct
    ? ((selectedProduct.asset || [])
      .map((a) => (a.id ? productAssetImages[a.id] : undefined))
      .filter(Boolean) as string[])
    : [];

  const goToPrevProductImage = () => {
    setSelectedImageIndex((prev) =>
      selectedProductImages.length === 0 ? 0 : (prev - 1 + selectedProductImages.length) % selectedProductImages.length
    );
  };

  const goToNextProductImage = () => {
    setSelectedImageIndex((prev) =>
      selectedProductImages.length === 0 ? 0 : (prev + 1) % selectedProductImages.length
    );
  };

  const handlePunchOutPreview = (url: string) => {
    setPunchOutPreviewUrl(url);
    setShowPunchOutFullPage(true);
    setPunchOutIframeBlocked(false);
  };

  return {
    filters,
    selectedSegment,
    selectedFamily,
    selectedClass,
    selectedCommodity,
    loadingResults,
    catalogResults,
    hasSearched,
    error,
    page: pageRequest.page,
    pageSize: pageRequest.pageSize,
    sort: pageRequest.sort,
    hasNextPage,
    goToPage,
    changeSort,
    changePageSize,
    clearFilters,
    activeFilterCount,
    productAssetImages,
    selectedProduct,
    selectedImageIndex,
    setSelectedImageIndex,
    loadingSelectedImages,
    loadingProductDetail,
    productDetailError,
    showPunchOutFullPage,
    setShowPunchOutFullPage,
    punchOutPreviewUrl,
    punchOutIframeBlocked,
    setPunchOutIframeBlocked,
    loadSegmentOptions,
    loadFamilyOptions,
    loadClassOptions,
    loadCommodityOptions,
    handleSegmentChange,
    handleFamilyChange,
    handleClassChange,
    handleCommodityChange,
    handleSearchChange,
    handleSupplierChange,
    handleSearchSubmit,
    openProductDetail,
    closeProductDetail,
    selectedProductImages,
    goToPrevProductImage,
    goToNextProductImage,
    handlePunchOutPreview,
  };
};
