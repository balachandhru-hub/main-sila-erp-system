import { create } from 'zustand';

// Types
export interface SelectedBuyerState {
  id: string;
  organizationId: string;
  organizationName: string;
}

export interface DepartmentStoreState {
  // Selected Buyer
  selectedBuyer: SelectedBuyerState | null;
  setSelectedBuyer: (buyer: SelectedBuyerState | null) => void;

  // Department Form State
  departmentName: string;
  setDepartmentName: (name: string) => void;

  // Cost Centers (array of strings)
  costCenters: string[];
  addCostCenter: (costCenter: string) => void;
  updateCostCenter: (index: number, value: string) => void;
  removeCostCenter: (index: number) => void;

  // Loading & Error States
  loading: boolean;
  setLoading: (loading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;

  // Reset
  resetForm: () => void;
}

export const useDepartmentStore = create<DepartmentStoreState>((set) => ({
  // Selected Buyer
  selectedBuyer: null,
  setSelectedBuyer: (buyer) => set({ selectedBuyer: buyer }),

  // Department Form State
  departmentName: '',
  setDepartmentName: (name) => set({ departmentName: name }),

  // Cost Centers
  costCenters: [''], // Start with one empty cost center
  addCostCenter: (costCenter) =>
    set((state) => ({
      costCenters: [...state.costCenters, costCenter],
    })),
  updateCostCenter: (index, value) =>
    set((state) => {
      const updated = [...state.costCenters];
      updated[index] = value;
      return { costCenters: updated };
    }),
  removeCostCenter: (index) =>
    set((state) => ({
      costCenters: state.costCenters.filter((_, i) => i !== index),
    })),

  // Loading & Error States
  loading: false,
  setLoading: (loading) => set({ loading }),
  error: null,
  setError: (error) => set({ error }),
  success: null,
  setSuccess: (success) => set({ success }),

  // Reset Form
  resetForm: () =>
    set({
      selectedBuyer: null,
      departmentName: '',
      costCenters: [''],
      error: null,
      success: null,
    }),
}));