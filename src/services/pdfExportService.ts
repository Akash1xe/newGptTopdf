import type { ConversationData } from "../types/conversation";
import type { ExportPreferences } from "../types/preferences";
import { buildConversationStats } from "../providers/chatgpt/chatgptExtractor";
import { createPrintJobId, savePrintJob } from "./printJobService";

export class NoExportableMessagesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoExportableMessagesError";
  }
}

export function filterConversationForExport(conversation: ConversationData, preferences: ExportPreferences): ConversationData {
  const effectiveFilter = preferences.excludeUserMessages ? "assistant" : preferences.messageFilter;
  const messages = conversation.messages
    .filter((message) => effectiveFilter === "all" || message.role === effectiveFilter)
    .map((message, order) => ({ ...message, order }));

  return {
    ...conversation,
    messages,
    messageCount: messages.length,
    stats: buildConversationStats(messages)
  };
}

export async function exportConversationToPdf(conversation: ConversationData, preferences: ExportPreferences): Promise<void> {
  const filtered = filterConversationForExport(conversation, preferences);
  if (!filtered.messages.length) {
    if (preferences.excludeUserMessages || preferences.messageFilter === "assistant") {
      throw new NoExportableMessagesError("No ChatGPT responses are available to export.");
    }
    throw new NoExportableMessagesError("No messages match the selected export filter.");
  }
  const id = createPrintJobId();
  await savePrintJob({ id, createdAt: new Date().toISOString(), conversation: filtered, preferences });
  const url = chrome.runtime.getURL(`print.html?job=${encodeURIComponent(id)}`);
  await chrome.tabs.create({ url, active: true });
}
