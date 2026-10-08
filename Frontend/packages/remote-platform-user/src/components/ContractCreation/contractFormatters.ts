// Small, pure formatting/encoding helpers used by ContractCreationView and its PDF generation.

export function fmtINR(val: number) {
  if (!val && val !== 0) return "—";
  return Math.round(val).toLocaleString("en-IN");
}

export function nowLabel() {
  const now = new Date();
  return (
    now.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
    ", " +
    now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
  );
}

export const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

// The asset API's contentType can be missing, generic (octet-stream) or a bare type like "pdf",
// so fall back to the file type / file extension.
export function resolveMimeType(contentType: string | undefined, fileName: string): string {
  if (contentType && contentType.includes("/") && contentType !== "application/octet-stream") {
    return contentType;
  }
  const extension = (contentType || fileName.split(".").pop() || "").toLowerCase();
  return MIME_BY_EXTENSION[extension] || MIME_BY_EXTENSION[fileName.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream";
}

// Loads a same-origin image URL (e.g. a bundled asset) as a PNG data URL, for jsPDF's addImage which needs a
// data URI rather than a plain URL.
export function loadImageAsDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Whether an uploaded Terms & Conditions attachment is itself a PDF (so its real pages can be merged into the
// executed-contract PDF) versus some other file type (docx/image/etc.) that can only be referenced by name.
export function isPdfAttachment(doc: { fileName?: string; assetName?: string; fileType?: string }): boolean {
  const name = (doc.fileName || doc.assetName || "").toLowerCase();
  return (doc.fileType || "").toLowerCase().includes("pdf") || name.endsWith(".pdf");
}
