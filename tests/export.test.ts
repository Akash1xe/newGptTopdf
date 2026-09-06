import { describe, expect, it } from "vitest";
import { filterConversationForExport } from "../src/services/pdfExportService";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/types/preferences";
import type { ConversationData, ConversationMessage } from "../src/types/conversation";

function textMessage(id: string, role: "user" | "assistant", order: number, text: string): ConversationMessage {
  return {
    id,
    role,
    order,
    plainText: text,
    blocks: [{ type: "paragraph", children: [{ type: "text", text }] }]
  };
}

const sample: ConversationData = {
  provider: "chatgpt",
  title: "Test",
  url: "https://chatgpt.com/c/x",
  capturedUrl: "https://chatgpt.com/c/x",
  capturedAt: new Date(0).toISOString(),
  messageCount: 4,
  possiblyPartial: false,
  completeness: { state: "complete", verifiedBeginning: true, verifiedEnd: true, continuityVerified: true },
  stats: { totalMessages: 4, userMessages: 2, assistantMessages: 2, codeBlocks: 0, mathNodes: 0, images: 0 },
  messages: [
    textMessage("1", "user", 0, "A"),
    textMessage("2", "assistant", 1, "B"),
    textMessage("3", "user", 2, "C"),
    textMessage("4", "assistant", 3, "D")
  ]
};

describe("export filtering", () => {
  it("keeps all messages by default", () => {
    const result = filterConversationForExport(sample, DEFAULT_EXPORT_PREFERENCES);
    expect(result.messages.map((message) => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(result.messageCount).toBe(4);
  });

  it("excludes user prompts and preserves assistant order", () => {
    const result = filterConversationForExport(sample, {
      ...DEFAULT_EXPORT_PREFERENCES,
      excludeUserMessages: true
    });
    expect(result.messages.map((message) => message.plainText)).toEqual(["B", "D"]);
    expect(result.messages.map((message) => message.order)).toEqual([0, 1]);
    expect(result.stats).toMatchObject({ totalMessages: 2, userMessages: 0, assistantMessages: 2 });
  });

  it("does not mutate the verified source conversation", () => {
    const originalIds = sample.messages.map((message) => message.id);
    const result = filterConversationForExport(sample, {
      ...DEFAULT_EXPORT_PREFERENCES,
      excludeUserMessages: true
    });
    expect(result).not.toBe(sample);
    expect(result.messages).not.toBe(sample.messages);
    expect(sample.messageCount).toBe(4);
    expect(sample.messages.map((message) => message.id)).toEqual(originalIds);
    expect(sample.messages.map((message) => message.order)).toEqual([0, 1, 2, 3]);
  });

  it("keeps repeated assistant responses as separate messages", () => {
    const repeated: ConversationData = {
      ...sample,
      messageCount: 4,
      messages: [
        textMessage("u1", "user", 0, "next"),
        textMessage("a1", "assistant", 1, "continue"),
        textMessage("u2", "user", 2, "next"),
        textMessage("a2", "assistant", 3, "continue")
      ]
    };
    const result = filterConversationForExport(repeated, {
      ...DEFAULT_EXPORT_PREFERENCES,
      excludeUserMessages: true
    });
    expect(result.messages.map((message) => message.id)).toEqual(["a1", "a2"]);
    expect(result.messages.map((message) => message.plainText)).toEqual(["continue", "continue"]);
  });

  it("preserves assistant math, code, table and image blocks unchanged", () => {
    const richAssistant: ConversationMessage = {
      id: "assistant-rich",
      role: "assistant",
      order: 1,
      plainText: "rich answer",
      blocks: [
        { type: "math", displayMode: "block", source: "\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}", sourceFormat: "latex", fallbackText: "quadratic formula", renderStrategy: "latex" },
        { type: "code", language: "cpp", displayLanguage: "C++", code: "int x = 1;", lines: [{ number: 1, tokens: [{ text: "int x = 1;", tokenType: "plain" }], plainText: "int x = 1;" }], source: "plain", lineCount: 1, hasLongLines: false, maxLineLength: 10, tabSize: 2 },
        { type: "table", columnCount: 1, rows: [{ cells: [{ header: true, colspan: 1, rowspan: 1, children: [{ type: "text", text: "Value" }] }] }] },
        { type: "image", src: "https://example.com/diagram.png", alt: "diagram", sourceType: "remote", mediaKind: "image" }
      ]
    };
    const richConversation: ConversationData = {
      ...sample,
      messageCount: 2,
      messages: [textMessage("user-rich", "user", 0, "Explain"), richAssistant]
    };
    const result = filterConversationForExport(richConversation, {
      ...DEFAULT_EXPORT_PREFERENCES,
      excludeUserMessages: true
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].blocks).toEqual(richAssistant.blocks);
    expect(result.stats).toMatchObject({ codeBlocks: 1, mathNodes: 1, images: 1 });
  });

  it("filters a 1000-message verified conversation in exact assistant order", () => {
    const messages = Array.from({ length: 1000 }, (_, index) =>
      textMessage(`turn-${index}`, index % 2 === 0 ? "user" : "assistant", index, `message-${index}`)
    );
    const large: ConversationData = {
      ...sample,
      messageCount: messages.length,
      messages
    };
    const result = filterConversationForExport(large, {
      ...DEFAULT_EXPORT_PREFERENCES,
      excludeUserMessages: true
    });
    expect(result.messages).toHaveLength(500);
    expect(result.messages[0].id).toBe("turn-1");
    expect(result.messages[499].id).toBe("turn-999");
    expect(result.messages.every((message) => message.role === "assistant")).toBe(true);
  });

  it("keeps the legacy assistant-only message filter working", () => {
    const result = filterConversationForExport(sample, {
      ...DEFAULT_EXPORT_PREFERENCES,
      messageFilter: "assistant"
    });
    expect(result.messages.map((message) => message.role)).toEqual(["assistant", "assistant"]);
  });
});
