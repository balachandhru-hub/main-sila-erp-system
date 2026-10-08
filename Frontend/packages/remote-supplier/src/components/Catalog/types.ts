export interface CatalogItem {
    source: "created" | "uploaded";
    catalogName: string;
    description: string;
    price: number;
    currency: string;
    unitOfMeasure: string;
    catalogType: string;
    segment?: number;
    segmentTitle?: string;
    family?: number;
    familyTitle?: string;
    commodity?: number;
    commodityTitle?: string;
    class?: number;
    classTitle?: string;
    isPunchOut: boolean;
    punchOutUrl: string;
    fileName?: string;
    filePreview?: string | null;
    fileType?: string;
    addedAt: string;
}

export const emptyCatalogForm = {
    catalogName: "",
    description: "",
    price: "",
    currency: "",
    unitOfMeasure: "",
    sku: "",
    availableStock: "",
    discountPercent: "",
    catalogType: "",
    type: "",
    subType: "",
    segment: "",
    segmentTitle: "",
    family: "",
    familyTitle: "",
    commodity: "",
    commodityTitle: "",
    class: "",
    classTitle: "",
    isPunchOut: false,
    punchOutUrl: "",
};

export type CatalogFormState = typeof emptyCatalogForm;

export const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
};
