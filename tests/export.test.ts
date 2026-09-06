import { describe, expect, it } from "vitest";
import { filterConversationForExport } from "../src/services/pdfExportService";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/types/preferences";
import type { ConversationData } from "../src/types/conversation";

const sample: ConversationData = {
  provider: "chatgpt", title: "Test", url: "https://chatgpt.com/c/x", capturedUrl: "https://chatgpt.com/c/x", capturedAt: new Date(0).toISOString(), messageCount: 3,
  possiblyPartial: false, completeness: { state: "complete" }, stats: { totalMessages: 3, userMessages: 2, assistantMessages: 1, codeBlocks: 0, mathNodes: 0, images: 0 },
  messages: [
    { id: "1", role: "user", order: 0, plainText: "A", blocks: [{ type: "paragraph", children: [{ type: "text", text: "A" }] }] },
    { id: "2", role: "assistant", order: 1, plainText: "B", blocks: [{ type: "paragraph", children: [{ type: "text", text: "B" }] }] },
    { id: "3", role: "user", order: 2, plainText: "C", blocks: [{ type: "paragraph", children: [{ type: "text", text: "C" }] }] }
  ]
};

describe("export filtering", () => {
  it("exports assistant only without mutating original", () => {
    const result = filterConversationForExport(sample, { ...DEFAULT_EXPORT_PREFERENCES, messageFilter: "assistant" });
    expect(result.messages.map((m) => m.role)).toEqual(["assistant"]);
    expect(result.messages[0].order).toBe(0);
    expect(sample.messageCount).toBe(3);
  });
});
