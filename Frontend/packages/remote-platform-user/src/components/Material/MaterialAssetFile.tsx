import React, { useState } from 'react';
import type { Sheet } from 'read-excel-file/browser';
import { toastService } from '@vosox/shared-ui';
import { fetchBuyerAsset } from '../../api/platformApi';
import { resolveMimeType } from '../ContractCreation/contractFormatters';
import type { MaterialBulkAsset } from './materialApi';

export interface LoadedAssetFile {
  fileName: string;
  mime: string;
  blob: Blob;
  /** Blob URL for the file; revoke it once it's no longer needed. */
  url: string;
}

/** Fetches a bulk-upload file from the asset service. Returns null (after toasting) on failure. */
export const loadMaterialAssetFile = async (
  asset: MaterialBulkAsset,
  failureMessage: string
): Promise<LoadedAssetFile | null> => {
  try {
    const res = await fetchBuyerAsset(asset.id);
    if (!('fileBytes' in res) || !res.fileBytes) {
      toastService.error(failureMessage);
      return null;
    }
    const fileName = res.fileName || asset.fileName || asset.assetName || 'ItemMaster.xlsx';
    const mime = resolveMimeType(res.contentType || res.fileType, fileName);
    const base64Str = res.fileBytes.includes(',') ? res.fileBytes.split(',')[1] : res.fileBytes;
    const bytes = Uint8Array.from(atob(base64Str), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    return { fileName, mime, blob, url: URL.createObjectURL(blob) };
  } catch {
    toastService.error(failureMessage);
    return null;
  }
};

/** Saves a loaded file to the user's disk and releases its blob URL. */
export const saveLoadedAssetFile = (file: LoadedAssetFile) => {
  const a = document.createElement('a');
  a.href = file.url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(file.url);
};

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString();
  return String(value);
};

/** 0 -> A, 25 -> Z, 26 -> AA, like Excel's column headers. */
const columnLabel = (index: number): string => {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
};

/** Read-only, Excel-style view of a parsed workbook: lettered columns, numbered rows and sheet tabs. */
export const ExcelSheetGrid: React.FC<{ sheets: Sheet[] }> = ({ sheets }) => {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const rows = sheets[activeSheetIndex]?.data ?? [];
  const columnCount = Math.max(1, ...rows.map((row) => row.length));

  return (
    <div className="matap-xls">
      <div className="matap-xls-scroll">
        <table className="matap-xls-grid">
          <thead>
            <tr>
              <th className="matap-xls-corner" />
              {Array.from({ length: columnCount }, (_, c) => (
                <th key={c} scope="col">{columnLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                <th scope="row">{r + 1}</th>
                {Array.from({ length: columnCount }, (_, c) => (
                  <td key={c}>{formatCell(row[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="matap-xls-tabs" role="tablist" aria-label="Worksheets">
        {sheets.map((sheet, index) => (
          <button
            key={sheet.sheet}
            type="button"
            role="tab"
            aria-selected={index === activeSheetIndex}
            className={`matap-xls-tab${index === activeSheetIndex ? ' matap-xls-tab--active' : ''}`}
            onClick={() => setActiveSheetIndex(index)}
          >
            {sheet.sheet}
          </button>
        ))}
      </div>
    </div>
  );
};
