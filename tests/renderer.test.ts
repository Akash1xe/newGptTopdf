import { describe, expect, it } from "vitest";
import { renderConversation } from "../src/renderer/conversationRenderer";
import { buildPrintStyles } from "../src/renderer/printStyles";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/types/preferences";
import type { ConversationData } from "../src/types/conversation";

function conversation(): ConversationData {
  return {
    provider: "chatgpt",
    title: "Renderer Test",
    url: "https://chatgpt.com/c/test",
    capturedUrl: "https://chatgpt.com/c/test",
    capturedAt: "2026-09-06T10:00:00.000Z",
    conversationId: "test",
    messageCount: 2,
    possiblyPartial: false,
    completeness: { state: "complete", collectedMessages: 2 },
    stats: { totalMessages: 2, userMessages: 1, assistantMessages: 1, codeBlocks: 1, mathNodes: 1, images: 0 },
    messages: [
      { id: "u1", role: "user", order: 0, plainText: "Explain", blocks: [{ type: "paragraph", children: [{ type: "text", text: "Explain ", bold: true }, { type: "inline-code", text: "binary_search" }] }] },
      { id: "a1", role: "assistant", order: 1, plainText: "Answer", blocks: [
        { type: "heading", level: 2, children: [{ type: "text", text: "Answer" }] },
        { type: "code", language: "cpp", displayLanguage: "C++", code: "int x = 1;", lines: [{ number: 1, plainText: "int x = 1;", tokens: [{ text: "int", tokenType: "type" }, { text: " x = ", tokenType: "plain" }, { text: "1", tokenType: "number" }, { text: ";", tokenType: "punctuation" }] }], source: "dom-highlighted", lineCount: 1, hasLongLines: false, maxLineLength: 10, tabSize: 4 },
        { type: "math", displayMode: "block", fallbackText: "a/b", mathML: "<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>", sourceFormat: "mathml", renderStrategy: "mathml" }
      ] }
    ]
  };
}

describe("PDF document renderer", () => {
  it("renders semantic conversation, code tokens and MathML", () => {
    const output = renderConversation(document, conversation(), DEFAULT_EXPORT_PREFERENCES);
    document.body.replaceChildren(output);
    expect(document.querySelector(".message-user")).toBeTruthy();
    expect(document.querySelector(".message-assistant h2")?.textContent).toBe("Answer");
    expect(document.querySelector(".tok-type")?.textContent).toBe("int");
    expect(document.querySelector("mfrac")).toBeTruthy();
    expect(document.body.textContent).toContain("binary_search");
  });

  it("renders recovered LaTeX with bundled KaTeX", () => {
    const data = conversation();
    data.messages[1].blocks.push({
      type: "math",
      displayMode: "block",
      source: "\\frac{a+b}{c+d}",
      sourceFormat: "latex",
      fallbackText: "(a+b)/(c+d)",
      renderStrategy: "latex"
    });
    const output = renderConversation(document, data, DEFAULT_EXPORT_PREFERENCES);
    document.body.replaceChildren(output);
    expect(document.querySelector(".katex")).toBeTruthy();
    expect(document.querySelector(".katex .frac-line")).toBeTruthy();
  });

  it("builds A4 and Letter print rules", () => {
    expect(buildPrintStyles(DEFAULT_EXPORT_PREFERENCES)).toContain("size: A4");
    expect(buildPrintStyles({ ...DEFAULT_EXPORT_PREFERENCES, pageSize: "Letter" })).toContain("size: Letter");
  });
});
