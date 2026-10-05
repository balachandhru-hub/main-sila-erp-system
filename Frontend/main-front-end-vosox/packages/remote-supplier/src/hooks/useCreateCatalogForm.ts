import { useRef, useState } from "react";
import { useAuthStore } from "../../../host-app/src/store/useAuthStore";
import {
  createSupplierCatalog,
  fetchMetadataReferenceList,
  fetchCurrencies,
  fetchSegments,
  fetchFamilies,
  fetchClassifications,
  fetchCommodities,
  fetchUnits,
} from "../api/supplierApi";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "@vosox/shared-ui";
import type { CatalogAssetDto, CatalogDetailDto, CurrencyItem } from "../dto/supplierDto";
import { emptyCatalogForm, fileToBase64, type CatalogFormState, type CatalogItem } from "../components/Catalog/types";

// Page size used by every async (paginated) Dropdown
const DROPDOWN_PAGE_SIZE = 40;

export interface UseCreateCatalogFormOptions {
  onCreated: () => void;
  onClose: () => void;
}

export function useCreateCatalogForm({ onCreated, onClose }: UseCreateCatalogFormOptions) {
  const [_catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogForm, setCatalogForm] = useState<CatalogFormState>(emptyCatalogForm);
  const [catalogFiles, setCatalogFiles] = useState<File[]>([]);
  const [catalogFilePreviews, setCatalogFilePreviews] = useState<string[]>([]);
  const [isDraggingCatalogFile, setIsDraggingCatalogFile] = useState(false);
  const [creatingCatalog, setCreatingCatalog] = useState(false);
  const [createCatalogError, setCreateCatalogError] = useState<string | null>(null);
  const [createCatalogSuccess, setCreateCatalogSuccess] = useState(false);
  const catalogFileInputRef = useRef<HTMLInputElement>(null);

  // ---- Async loader for the Catalog Type Dropdown (reference-list API has no paging or search, so search client-side) ----
  const loadCatalogTypeOptions = async ({ search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const types = await fetchMetadataReferenceList(['CATALOG_TYPE']);
    if (!Array.isArray(types)) {
      return { options: [], hasMore: false };
    }
    const searchTerm = search.trim().toLowerCase();
    return {
      options: types
        .filter((opt) => !searchTerm || opt.key.toLowerCase().includes(searchTerm))
        .map((opt) => ({ name: opt.key, value: opt.key })),
      hasMore: false,
    };
  };

  // ---- Async paginated loader for the Currency Dropdown (server has no search param, so search client-side) ----
  // `index` is an offset: 0, then 0 + 40, then 0 + 40 + 40, ...
  const fetchCurrencyPage = async (index: number): Promise<CurrencyItem[]> => {
    const result = await fetchCurrencies({ index, limit: DROPDOWN_PAGE_SIZE });
    return result && 'items' in result && Array.isArray(result.items) ? result.items : [];
  };

  const loadCurrencyOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const toOption = (c: CurrencyItem) => ({ name: c.currencyName, value: c.currencyName });
    const searchTerm = search.trim().toLowerCase();

    if (searchTerm) {
      // Page through every currency so a match on a later page isn't missed, then filter here
      const matches: CurrencyItem[] = [];
      let index = 0;
      let items: CurrencyItem[];
      do {
        items = await fetchCurrencyPage(index);
        matches.push(...items.filter((c) => c.currencyName.toLowerCase().includes(searchTerm)));
        index += items.length;
      } while (items.length === DROPDOWN_PAGE_SIZE);
      return { options: matches.map(toOption), hasMore: false };
    }

    const items = await fetchCurrencyPage(page * DROPDOWN_PAGE_SIZE);
    return { options: items.map(toOption), hasMore: items.length === DROPDOWN_PAGE_SIZE };
  };

  // ---- Async paginated loader for the Unit of Measure Dropdown (`index` is an offset: 0, 40, 80, ...) ----
  const loadUnitOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const result = await fetchUnits({
      index: page * DROPDOWN_PAGE_SIZE,
      limit: DROPDOWN_PAGE_SIZE,
      searchTerm: search.trim() || undefined,
    });
    const items = result && 'items' in result && Array.isArray(result.items) ? result.items : [];
    return {
      options: items.map((unit) => ({ name: unit.key, value: unit.key })),
      hasMore: items.length === DROPDOWN_PAGE_SIZE,
    };
  };

  // ---- Async paginated loader for the Segment Dropdown (`pageIndex` is an offset: 0, 40, 80, ...) ----
  const loadSegmentOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    const segments = await fetchSegments({
      pageIndex: page * DROPDOWN_PAGE_SIZE,
      pageSize: DROPDOWN_PAGE_SIZE,
      searchTerm: search.trim() || undefined,
    });
    if (!Array.isArray(segments)) {
      return { options: [], hasMore: false };
    }
    return {
      options: segments.map((seg) => ({ name: seg.title, value: String(seg.segment) })),
      hasMore: segments.length === DROPDOWN_PAGE_SIZE,
    };
  };

  // fetchFamilies supports pagination but not a search param, so each page is
  // fetched as-is and filtered client-side before being handed to the Dropdown.
  const loadFamilyOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!catalogForm.segment) {
      return { options: [], hasMore: false };
    }
    const pageIndex = page * DROPDOWN_PAGE_SIZE; // index of the first item on the page: 0, 40, 80, ...
    const families = await fetchFamilies(Number(catalogForm.segment), { pageIndex, pageSize: DROPDOWN_PAGE_SIZE });
    if (!Array.isArray(families)) {
      return { options: [], hasMore: false };
    }
    const searchTerm = search.trim().toLowerCase();
    const options = families
      .filter((fam) => !searchTerm || fam.title.toLowerCase().includes(searchTerm))
      .map((fam) => ({ name: fam.title, value: String(fam.family) }));
    return { options, hasMore: families.length === DROPDOWN_PAGE_SIZE };
  };

  const loadClassOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!catalogForm.family) {
      return { options: [], hasMore: false };
    }
    const pageIndex = page * DROPDOWN_PAGE_SIZE;
    const classes = await fetchClassifications(Number(catalogForm.family), { pageIndex, pageSize: DROPDOWN_PAGE_SIZE });
    if (!Array.isArray(classes)) {
      return { options: [], hasMore: false };
    }
    const searchTerm = search.trim().toLowerCase();
    const options = classes
      .filter((cls) => !searchTerm || cls.classTitle.toLowerCase().includes(searchTerm))
      .map((cls) => ({ name: cls.classTitle, value: String(cls.class) }));
    return { options, hasMore: classes.length === DROPDOWN_PAGE_SIZE };
  };

  const loadCommodityOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!catalogForm.class) {
      return { options: [], hasMore: false };
    }
    const pageIndex = page * DROPDOWN_PAGE_SIZE;
    const commodities = await fetchCommodities(Number(catalogForm.class), { pageIndex, pageSize: DROPDOWN_PAGE_SIZE });
    if (!Array.isArray(commodities)) {
      return { options: [], hasMore: false };
    }
    const searchTerm = search.trim().toLowerCase();
    const options = commodities
      .filter((com) => !searchTerm || com.commodityTitle.toLowerCase().includes(searchTerm))
      .map((com) => ({ name: com.commodityTitle, value: String(com.commodity) }));
    return { options, hasMore: commodities.length === DROPDOWN_PAGE_SIZE };
  };

  const updateCatalogField = <K extends keyof CatalogFormState>(field: K, value: CatalogFormState[K]) => {
    setCatalogForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSegmentChange = (val: DropdownValue | null) => {
    updateCatalogField("segment", val?.value ?? "");
    updateCatalogField("segmentTitle", val?.name ?? "");
    updateCatalogField("family", "");
    updateCatalogField("familyTitle", "");
    updateCatalogField("class", "");
    updateCatalogField("classTitle", "");
    updateCatalogField("commodity", "");
    updateCatalogField("commodityTitle", "");
  };

  const handleFamilyChange = (val: DropdownValue | null) => {
    updateCatalogField("family", val?.value ?? "");
    updateCatalogField("familyTitle", val?.name ?? "");
    updateCatalogField("class", "");
    updateCatalogField("classTitle", "");
    updateCatalogField("commodity", "");
    updateCatalogField("commodityTitle", "");
  };

  const handleClassChange = (val: DropdownValue | null) => {
    updateCatalogField("class", val?.value ?? "");
    updateCatalogField("classTitle", val?.name ?? "");
    updateCatalogField("commodity", "");
    updateCatalogField("commodityTitle", "");
  };

  const handleCommodityChange = (val: DropdownValue | null) => {
    updateCatalogField("commodity", val?.value ?? "");
    updateCatalogField("commodityTitle", val?.name ?? "");
  };

  const isNonCatalogType = (catalogForm.catalogType || "").toString().toLowerCase().includes("non");

  const closeCreateCatalogModal = () => {
    onClose();
    setCatalogForm(emptyCatalogForm);
    setCatalogFiles([]);
    setCatalogFilePreviews([]);
    setCreateCatalogError(null);
    setCreateCatalogSuccess(false);
  };

  const handleCatalogFilesAdd = (files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const nonImage = incoming.find((f) => !f.type.startsWith("image/"));
    if (nonImage) {
      setCreateCatalogError("Only image files (JPG, PNG, GIF, WEBP, etc.) are allowed.");
      return;
    }

    setCreateCatalogError(null);
    setCatalogFiles((prev) => [...prev, ...incoming]);

    incoming.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setCatalogFilePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveCatalogFile = (index: number) => {
    setCatalogFiles((prev) => prev.filter((_, i) => i !== index));
    setCatalogFilePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogForm.catalogName.trim()) {
      setCreateCatalogError("Catalog name is required.");
      return;
    }
    if (catalogForm.isPunchOut && !catalogForm.punchOutUrl.trim()) {
      setCreateCatalogError("PunchOut URL is required when PunchOut is enabled.");
      return;
    }
    if (catalogForm.availableStock !== "" && Number(catalogForm.availableStock) < 0) {
      setCreateCatalogError("Available stock cannot be negative.");
      return;
    }
    if (
      catalogForm.discountPercent !== "" &&
      (Number(catalogForm.discountPercent) < 0 || Number(catalogForm.discountPercent) > 100)
    ) {
      setCreateCatalogError("Discount must be between 0 and 100.");
      return;
    }
    if (catalogFiles.length === 0) {
      setCreateCatalogError("Please upload at least one image for this catalog item.");
      return;
    }
    if (catalogFiles.some((f) => !f.type.startsWith("image/"))) {
      setCreateCatalogError("Only image files are allowed.");
      return;
    }
    setCreatingCatalog(true);
    setCreateCatalogError(null);
    try {
      const organizationId =
        useAuthStore.getState().organizationId || "";

      if (!organizationId) {
        throw new Error("Organization ID not found. Please log in again.");
      }
      const entityTypesRaw = await fetchMetadataReferenceList(['ENTITY_TYPE']);
      const entityTypes = Array.isArray(entityTypesRaw) ? entityTypesRaw : [];
      const supplierEntityId = entityTypes.find((e) => e.key === 'SUPPLIER')?.id || '59476530-3c10-438b-b3b3-9db9e96e8d93';
      const entityType = entityTypes.find((e) => e.key === 'SUPPLIER')?.key || 'SUPPLIER';

      const assets: CatalogAssetDto[] = await Promise.all(
        catalogFiles.map(async (file) => {
          const fileBytes = await fileToBase64(file);
          return {
            entityType: entityType,
            entityId: supplierEntityId,
            assetType: "CATALOG_ATTACHMENT",
            fileBytes: fileBytes,
            fileName: file.name,
            contentType: file.type,
            // Never a singleton: that would deactivate files this catalog still links to.
            isSingletonAsset: false,
          };
        })
      );

      const catalogPayload: CatalogDetailDto = {
        catalogName: catalogForm.catalogName.trim(),
        description: catalogForm.description.trim(),
        price: Number(catalogForm.price) || 0,
        currency: catalogForm.currency.trim(),
        unitOfMeasure: catalogForm.unitOfMeasure,
        sku: catalogForm.sku.trim() || null,
        availableStock: catalogForm.availableStock === "" ? null : Number(catalogForm.availableStock),
        discountPercent: catalogForm.discountPercent === "" ? null : Number(catalogForm.discountPercent),
        catalogType: catalogForm.catalogType.trim(),
        segment: Number(catalogForm.segment) || 0,
        segmentTitle: catalogForm.segmentTitle.trim(),
        family: Number(catalogForm.family) || 0,
        familyTitle: catalogForm.familyTitle.trim(),
        commodity: Number(catalogForm.commodity) || 0,
        commodityTitle: catalogForm.commodityTitle.trim(),
        class: Number(catalogForm.class) || 0,
        classTitle: catalogForm.classTitle.trim(),
        isPunchOut: catalogForm.isPunchOut,
        punchOutUrl: catalogForm.punchOutUrl.trim(),
        assets,
      } as CatalogDetailDto & { currency: string };

      await createSupplierCatalog({
        organizationId,
        catalog: catalogPayload,
      });

      setCatalogItems((prev) => [
        {
          source: "created",
          ...catalogPayload,
          currency: catalogForm.currency.trim(),
          fileName: catalogFiles[0]?.name,
          filePreview: catalogFilePreviews[0] || null,
          fileType: catalogFiles[0]?.type,
          addedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setCreateCatalogSuccess(true);
      onCreated();
      setTimeout(closeCreateCatalogModal, 900);
    } catch (error: any) {
      setCreateCatalogError(error?.message || "Failed to create catalog. Please try again.");
    } finally {
      setCreatingCatalog(false);
    }
  };

  return {
    catalogForm,
    catalogFiles,
    catalogFilePreviews,
    isDraggingCatalogFile,
    setIsDraggingCatalogFile,
    creatingCatalog,
    createCatalogError,
    createCatalogSuccess,
    catalogFileInputRef,
    loadCatalogTypeOptions,
    loadCurrencyOptions,
    loadUnitOptions,
    loadSegmentOptions,
    loadFamilyOptions,
    loadClassOptions,
    loadCommodityOptions,
    updateCatalogField,
    handleSegmentChange,
    handleFamilyChange,
    handleClassChange,
    handleCommodityChange,
    isNonCatalogType,
    closeCreateCatalogModal,
    handleCatalogFilesAdd,
    handleRemoveCatalogFile,
    handleCreateCatalogSubmit,
  };
}
