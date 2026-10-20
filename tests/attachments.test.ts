import { describe, expect, it } from "vitest";
import { parseChatGPTMessage } from "../src/providers/chatgpt/chatgptParser";
import { extractChatGPTConversation } from "../src/providers/chatgpt/chatgptExtractor";
import { collectFullChatGPTConversation } from "../src/providers/chatgpt/chatgptCollector";
import { renderConversation } from "../src/renderer/conversationRenderer";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/types/preferences";

const card = (filename: string, type: string) =>
  `<div class="file-card"><svg width="24" height="24"><path d="M0 0L12 12"/></svg><div><div>${filename}</div><div>${type}</div></div></div>`;

describe("uploaded file cards", () => {
  for (const [filename, type] of [["SET mte practice set.docx.pdf", "PDF"], ["notes.docx", "Word"], ["data.xlsx", "Spreadsheet"], ["archive.zip", "ZIP"]]) {
    it(`omits ${type} icon and filename while retaining the typed prompt`, () => {
      document.body.innerHTML = `<div id="message" data-message-author-role="user">${card(filename, type)}<p>Please explain this document.</p></div>`;
      const result = parseChatGPTMessage(document.querySelector("#message")!, "user");
      expect(result.plainText).toBe("Please explain this document.");
      expect(JSON.stringify(result.blocks)).not.toContain(filename);
      expect(result.blocks).toHaveLength(1);
      expect(document.querySelector(".file-card")).not.toBeNull();
    });
  }

  it("does not leak uploads into the assistant response in grouped turns", () => {
    document.body.innerHTML = `<div data-turn-key="group">
      ${card("uploaded.pdf", "PDF")}
      <div data-user-message-bubble>Explain this.</div>
      <h5 data-conversation-role="assistant">ChatGPT said:</h5>
      <div class="markdown"><p>Here is the explanation.</p></div>
    </div>`;
    const data = extractChatGPTConversation(document, window.location);
    expect(data.messages.map(message => message.plainText)).toEqual(["Explain this.", "Here is the explanation."]);
    const output = renderConversation(document, data, DEFAULT_EXPORT_PREFERENCES);
    expect(output.textContent).not.toContain("uploaded.pdf");
    expect(output.querySelector("img")).toBeNull();
  });

  it("preserves assistant file cards and ordinary filename mentions", () => {
    document.body.innerHTML = `<div id="answer" data-message-author-role="assistant">
      ${card("generated.pdf", "PDF")}<p>Save the report as notes.docx.</p></div>`;
    const result = parseChatGPTMessage(document.querySelector("#answer")!, "assistant");
    expect(result.plainText).toContain("generated.pdf");
    expect(result.plainText).toContain("notes.docx");
    document.body.innerHTML = '<div id="prompt"><p>Please compare notes.pdf with notes.docx.</p><img src="https://example.com/photo.png" width="400" height="300" alt="Uploaded photo"></div>';
    const prompt = parseChatGPTMessage(document.querySelector("#prompt")!, "user");
    expect(prompt.plainText).toContain("Please compare notes.pdf with notes.docx.");
    expect(prompt.blocks.some(block => block.type === "image")).toBe(true);
  });

  it("keeps attachment-only turns accounted for without printing an empty user section", async () => {
    document.body.innerHTML = `<main>
      <article data-message-author-role="user" data-testid="conversation-turn-0">${card("only.pdf", "PDF")}</article>
      <article data-message-author-role="assistant" data-testid="conversation-turn-1"><p>Document received.</p></article>
    </main>`;
    const data = await collectFullChatGPTConversation(document, window.location, {
      mutationWaitMs: 1, settleMs: 0, topStabilityPasses: 1, maxDurationMs: 2000
    });
    expect(data.completeness.state).toBe("complete");
    expect(data.messages).toHaveLength(2);
    const output = renderConversation(document, data, DEFAULT_EXPORT_PREFERENCES);
    expect(output.querySelector(".message-user")).toBeNull();
    expect(output.querySelector(".message-assistant")?.textContent).toContain("Document received.");
    expect(output.textContent).not.toContain("only.pdf");
  });
});
