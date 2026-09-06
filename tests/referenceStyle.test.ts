import { describe, expect, it } from "vitest";
import { renderConversation } from "../src/renderer/conversationRenderer";
import { renderCodeBlock } from "../src/renderer/codeRenderer";
import { buildPrintStyles } from "../src/renderer/printStyles";
import { highlightCodeLines } from "../src/renderer/fallbackCodeHighlighter";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/types/preferences";
import type { ConversationData } from "../src/types/conversation";
import type { CodeBlock } from "../src/types/content";

function assistantConversation(): ConversationData {
  return {
    provider: "chatgpt",
    title: "Reference Style",
    url: "https://chatgpt.com/c/reference",
    capturedUrl: "https://chatgpt.com/c/reference",
    capturedAt: "2026-09-06T10:00:00.000Z",
    conversationId: "reference",
    messageCount: 2,
    possiblyPartial: false,
    completeness: { state: "complete", collectedMessages: 2 },
    stats: { totalMessages: 2, userMessages: 0, assistantMessages: 2, codeBlocks: 0, mathNodes: 0, images: 0 },
    messages: [
      { id: "a1", role: "assistant", order: 0, plainText: "First", blocks: [{ type: "heading", level: 2, children: [{ type: "text", text: "First section" }] }, { type: "paragraph", children: [{ type: "text", text: "Normal " }, { type: "text", text: "important", bold: true }] }] },
      { id: "a2", role: "assistant", order: 1, plainText: "Second", blocks: [{ type: "paragraph", children: [{ type: "text", text: "Second response" }] }] }
    ]
  };
}

function plainCppBlock(code: string): CodeBlock {
  return {
    type: "code",
    language: "cpp",
    displayLanguage: "C++",
    code,
    lines: code.split("\n").map((plainText, index) => ({ number: index + 1, plainText, tokens: plainText ? [{ text: plainText, tokenType: "plain" as const }] : [] })),
    source: "plain",
    lineCount: code ? code.split("\n").length : 0,
    hasLongLines: false,
    maxLineLength: Math.max(0, ...code.split("\n").map((line) => line.length)),
    tabSize: 4
  };
}

describe("reference-style PDF presentation", () => {
  it("uses compact print-oriented defaults", () => {
    expect(DEFAULT_EXPORT_PREFERENCES.bodyFontSize).toBe(8);
    expect(DEFAULT_EXPORT_PREFERENCES.codeFontSize).toBe(8);
    expect(DEFAULT_EXPORT_PREFERENCES.marginPreset).toBe("compact");
    expect(DEFAULT_EXPORT_PREFERENCES.messageSpacing).toBe("compact");
    expect(DEFAULT_EXPORT_PREFERENCES.paragraphSpacing).toBe("compact");
    expect(DEFAULT_EXPORT_PREFERENCES.lineSpacing).toBe("compact");
  });

  it("renders assistant-only exports as a continuous document without repeated role labels", () => {
    const preferences = { ...DEFAULT_EXPORT_PREFERENCES, excludeUserMessages: true, messageFilter: "assistant" as const };
    const output = renderConversation(document, assistantConversation(), preferences);
    document.body.replaceChildren(output);
    expect(output.classList.contains("assistant-only-document")).toBe(true);
    expect(document.querySelectorAll(".message-role")).toHaveLength(0);
    expect(document.querySelector(".document-subtitle")).toBeNull();
    expect(document.querySelector(".document-title")?.textContent).toBe("Reference Style");
    expect(document.querySelector("strong")?.textContent).toBe("important");
  });

  it("keeps role labels when both sides of the conversation are exported", () => {
    const conversation = assistantConversation();
    conversation.messages = [
      { id: "u1", role: "user", order: 0, plainText: "Question", blocks: [{ type: "paragraph", children: [{ type: "text", text: "Question" }] }] },
      conversation.messages[0]
    ];
    conversation.messageCount = 2;
    const output = renderConversation(document, conversation, { ...DEFAULT_EXPORT_PREFERENCES, messageFilter: "all", excludeUserMessages: false });
    document.body.replaceChildren(output);
    expect(Array.from(document.querySelectorAll(".message-role")).map((node) => node.textContent)).toEqual(["User", "Assistant"]);
  });

  it("uses compact flat code, inline-code, table and heading rules", () => {
    const css = buildPrintStyles(DEFAULT_EXPORT_PREFERENCES);
    expect(css).toContain("--pdf-body-size: 8pt");
    expect(css).toContain("--pdf-code-size: 8pt");
    expect(css).toMatch(/\.document-title[^}]*font-size:\s*1\.9em/);
    expect(css).toMatch(/h1 \{ font-size:\s*1\.5em/);
    expect(css).toMatch(/\.code-block \{[^}]*border:\s*0;[^}]*border-radius:\s*2px/);
    expect(css).toMatch(/\.inline-code \{[^}]*border:\s*0;[^}]*border-radius:\s*2px/);
    expect(css).toContain("padding: .24em .4em");
    expect(css).toContain("table { width: 100%; border-collapse: collapse");
  });

  it("fallback-highlights plain C++ without changing a single source character", () => {
    const source = '#include <bits/stdc++.h>\nint main() {\n  // note\n  string s = "hello";\n  return 0;\n}';
    const lines = highlightCodeLines(source, "cpp");
    expect(lines.map((line) => line.plainText).join("\n")).toBe(source);
    const types = lines.flatMap((line) => line.tokens.map((token) => token.tokenType));
    expect(types).toContain("keyword");
    expect(types).toContain("type");
    expect(types).toContain("comment");
    expect(types).toContain("string");
    expect(types).toContain("number");
  });

  it("uses fallback syntax tokens when the captured code block is plain", () => {
    const source = "int main() { return 0; }";
    const output = renderCodeBlock(document, plainCppBlock(source), DEFAULT_EXPORT_PREFERENCES);
    document.body.replaceChildren(output);
    expect(output.classList.contains("code-fallback-highlighted")).toBe(true);
    expect(document.querySelector(".tok-type")?.textContent).toContain("int");
    expect(document.querySelector(".tok-keyword")?.textContent).toContain("return");
    expect(document.querySelector("pre")?.textContent).toBe(source);
  });
});
