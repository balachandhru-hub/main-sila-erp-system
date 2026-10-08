import axiosInstance from './axiosInstance';

export interface AssistantTable {
  title: string | null;
  columns: string[];
  rows: string[][];
}

/** An item-master entry the buyer can pick for an item. */
export interface ItemCandidate {
  code: string;
  group: string;
  description: string;
}

export interface ItemTableRow {
  name: string;
  quantity: number | null;
  uom: string | null;
  /** choose: still to be decided; matched: an item-master entry; free_text: requested as free text */
  state: 'choose' | 'matched' | 'free_text';
  code: string | null;
  group: string | null;
  description: string | null;
  candidates: ItemCandidate[];
}

/** Sent while the bot asks which item-master entry each item uses. */
export interface ItemTable {
  rows: ItemTableRow[];
  notes: string[];
}

export interface AssistantReplyData extends Record<string, unknown> {
  item_table?: ItemTable;
}

export interface AssistantReply {
  session_id: string;
  reply: string;
  suggestions: string[];
  tables: AssistantTable[];
  awaiting: string | null;
  needs_confirmation: boolean;
  flow: string | null;
  data: AssistantReplyData;
}

/** A stored message; bot messages also carry the reply fields (suggestions, tables, ...). */
export interface AssistantStoredMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  tables?: AssistantTable[];
  data?: AssistantReplyData;
}

export interface AssistantSession {
  id: string;
  title: string | null;
  flow: string | null;
  updated_at: string;
  messages: AssistantStoredMessage[];
}

const BASE = '/api/v1/python/chat';

/** A turn can call several slow services in a row (category lists, suppliers), so it gets longer than the default 60 s. */
const ASSISTANT_TIMEOUT_MS = 180000;

const toError = (error: any, fallback: string): Error => {
  const data = error?.response?.data;
  if (data) {
    return new Error(data.message || data.description || `${fallback} (${error.response.status}).`);
  }
  return new Error('Could not reach the server. Please check your connection and try again.');
};

/** The buyer's choice for one item of the item table: an item-master entry by code, or free text (no code). */
export interface ItemChoice {
  item: string;
  code: string | null;
}

export const sendAssistantMessage = async (
  message: string,
  sessionId: string | null,
  itemChoices?: ItemChoice[],
): Promise<AssistantReply> => {
  try {
    const response = await axiosInstance.post<AssistantReply>(`${BASE}/message`, {
      message,
      session_id: sessionId,
      ...(itemChoices ? { item_choices: itemChoices } : {}),
    }, { timeout: ASSISTANT_TIMEOUT_MS });
    return response.data;
  } catch (error: any) {
    throw toError(error, 'The assistant could not answer');
  }
};

export const getItemMaster = async (): Promise<ItemCandidate[]> => {
  try {
    const response = await axiosInstance.get<ItemCandidate[]>(`${BASE}/item-master`);
    return response.data;
  } catch (error: any) {
    throw toError(error, 'Failed to load the item master');
  }
};

export const getAssistantSessions = async (): Promise<AssistantSession[]> => {
  try {
    const response = await axiosInstance.get<AssistantSession[]>(`${BASE}/sessions`);
    return response.data;
  } catch (error: any) {
    throw toError(error, 'Failed to load conversations');
  }
};

export const getAssistantSession = async (id: string): Promise<AssistantSession> => {
  try {
    const response = await axiosInstance.get<AssistantSession>(`${BASE}/sessions/${id}`);
    return response.data;
  } catch (error: any) {
    throw toError(error, 'Failed to load the conversation');
  }
};

export const deleteAssistantSession = async (id: string): Promise<void> => {
  try {
    await axiosInstance.delete(`${BASE}/sessions/${id}`);
  } catch (error: any) {
    throw toError(error, 'Failed to delete the conversation');
  }
};
