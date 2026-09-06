import type { ConversationData } from "../types/conversation";
import type { ExportPreferences } from "../types/preferences";
import { createPrintJobId, savePrintJob } from "./printJobService";

export function filterConversationForExport(conversation: ConversationData, preferences: ExportPreferences): ConversationData {
  const messages = conversation.messages.filter((message) => {
    if (preferences.messageFilter === "all") return true;
    return message.role === preferences.messageFilter;
  }).map((message, order) => ({ ...message, order }));

  return {
    ...conversation,
    messages,
    messageCount: messages.length,
    stats: {
      ...conversation.stats,
      totalMessages: messages.length,
      userMessages: messages.filter((m) => m.role === "user").length,
      assistantMessages: messages.filter((m) => m.role === "assistant").length
    }
  };
}

export async function exportConversationToPdf(conversation: ConversationData, preferences: ExportPreferences): Promise<void> {
  const filtered = filterConversationForExport(conversation, preferences);
  if (!filtered.messages.length) throw new Error("No messages match the selected export filter.");
  const id = createPrintJobId();
  await savePrintJob({ id, createdAt: new Date().toISOString(), conversation: filtered, preferences });
  const url = chrome.runtime.getURL(`print.html?job=${encodeURIComponent(id)}`);
  await chrome.tabs.create({ url, active: true });
}
