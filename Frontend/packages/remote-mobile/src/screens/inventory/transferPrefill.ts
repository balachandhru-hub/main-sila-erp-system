/** Router state that opens the transfer form with a source, destination and first material filled in. */
export interface TransferPrefill {
  fromLocationId?: string;
  toLocationId?: string;
  material?: {
    id: string;
    materialCode: string;
    description: string;
    baseUom: string;
  };
  /** Quantity of the material, in its base unit. */
  quantity?: number;
  /** Why the transfer is raised (e.g. the live inventory recommendation). */
  reason?: string;
}

export const isTransferPrefill = (value: unknown): value is TransferPrefill =>
  typeof value === 'object' && value !== null && ('fromLocationId' in value || 'toLocationId' in value || 'material' in value);
