import type { ConversationData } from "../types/conversation";
import type { ExportPreferences } from "../types/preferences";

const PREFIX = "printJob:";

export interface PrintJob {
  id: string;
  createdAt: string;
  conversation: ConversationData;
  preferences: ExportPreferences;
}

function key(id: string): string {
  return `${PREFIX}${id}`;
}

export function createPrintJobId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function savePrintJob(job: PrintJob): Promise<void> {
  await chrome.storage.session.set({ [key(job.id)]: job });
}

export async function getPrintJob(id: string): Promise<PrintJob | null> {
  const result = await chrome.storage.session.get(key(id));
  return (result[key(id)] as PrintJob | undefined) ?? null;
}

export async function removePrintJob(id: string): Promise<void> {
  await chrome.storage.session.remove(key(id));
}
