import axiosInstance from "../axiosInstance";
import { readError } from "../readError";
import type { SilaApprovalWorkflow } from "./silaRecipeApi";

export interface SilaApprovalSetupAction {
  action: string;
  approvalType?: string | null;
  /** CONFIGURED | NOT_CONFIGURED | IMMEDIATE */
  status: string;
  note?: string | null;
  flows: SilaApprovalWorkflow[];
}

export interface SilaApprovalSetup {
  area: string;
  actions: SilaApprovalSetupAction[];
}

const list = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

/** Approval setups for inventory, menu engineering, recipe, material and every other function. */
export const getApprovalSetups = async (): Promise<SilaApprovalSetup[]> => {
  try {
    const response = await axiosInstance.get<SilaApprovalSetup[]>("/api/v1/buyer/sila/approval-setups");
    return list(response.data).map((area) => ({
      ...area,
      actions: list(area.actions).map((action) => ({
        ...action,
        flows: list(action.flows).map((flow) => ({ ...flow, levels: list(flow.levels) })),
      })),
    }));
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load the approval setups."));
  }
};
