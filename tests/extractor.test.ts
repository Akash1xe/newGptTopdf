import { describe, expect, it, beforeEach } from "vitest";
import { extractChatGPTConversation } from "../src/providers/chatgpt/chatgptExtractor";

describe("ChatGPT conversation extraction", () => {
  beforeEach(() => {
    document.title = "Binary Search - ChatGPT";
    document.body.innerHTML = "";
  });

  it("extracts roles in DOM order and excludes UI controls", () => {
    document.body.innerHTML = `
      <section data-testid="conversation-turn-0" data-turn-id="u1"><div data-message-author-role="user"><div data-testid="collapsible-user-message-content">Explain binary search <button>Copy</button></div></div></section>
      <section data-testid="conversation-turn-1" data-turn-id="a1"><div data-message-author-role="assistant"><div class="markdown"><h2>Answer</h2><p>Binary search is fast.</p><button aria-label="Read aloud">Read aloud</button></div></div></section>
    `;
    const data = extractChatGPTConversation(document, window.location);
    expect(data.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(data.messages.map((m) => m.order)).toEqual([0, 1]);
    expect(data.messages[0].id).toBe("u1");
    expect(data.messages[0].plainText).toBe("Explain binary search");
    expect(data.messages[1].plainText).not.toContain("Read aloud");
    expect(data.title).toBe("Binary Search");
  });

  it("deduplicates repeated role nodes by stable turn id", () => {
    document.body.innerHTML = `
      <section data-testid="conversation-turn-0" data-turn-id="same"><div data-message-author-role="user"><p>Hello</p></div><div data-message-author-role="user"><p>Hello duplicate</p></div></section>
    `;
    const data = extractChatGPTConversation(document, window.location);
    expect(data.messageCount).toBe(1);
  });

  it("marks extraction possibly partial when turn shells exceed mounted messages", () => {
    document.body.innerHTML = `
      <section data-testid="conversation-turn-0" data-turn="user"><div data-message-author-role="user"><p>Hello</p></div></section>
      <section data-testid="conversation-turn-1" data-turn="assistant"></section>
      <section data-testid="conversation-turn-2" data-turn="user"></section>
    `;
    const data = extractChatGPTConversation(document, window.location);
    expect(data.possiblyPartial).toBe(true);
  });


  it("keeps repeated identical messages distinct using stable conversation-turn identities", () => {
    document.body.innerHTML = `
      <section data-testid="conversation-turn-0"><div data-message-author-role="user"><p>next</p></div></section>
      <section data-testid="conversation-turn-1"><div data-message-author-role="assistant"><div class="markdown"><p>continue</p></div></div></section>
      <section data-testid="conversation-turn-2"><div data-message-author-role="user"><p>next</p></div></section>
      <section data-testid="conversation-turn-3"><div data-message-author-role="assistant"><div class="markdown"><p>continue</p></div></div></section>
      <section data-testid="conversation-turn-4"><div data-message-author-role="user"><p>next</p></div></section>
    `;
    const data = extractChatGPTConversation(document, window.location);
    expect(data.messageCount).toBe(5);
    expect(data.messages.map((message) => message.id)).toEqual([
      "conversation-turn-0",
      "conversation-turn-1",
      "conversation-turn-2",
      "conversation-turn-3",
      "conversation-turn-4"
    ]);
    expect(data.messages.map((message) => message.sourceOrder)).toEqual([0, 1, 2, 3, 4]);
  });

  it("extracts the current grouped data-turn-key renderer", () => {
    document.body.innerHTML = `
      <main>
        <div data-turn-key="turn-alpha">
          <div data-user-message-bubble>
            <div class="whitespace-pre-wrap">Explain the new renderer</div>
          </div>
          <div data-conversation-role="assistant">
            <div class="markdown"><h2>Answer</h2><p>The grouped renderer works.</p></div>
            <div class="turn-action-controls"><button data-testid="copy-turn-action-button">Copy</button></div>
          </div>
        </div>
      </main>
    `;

    const data = extractChatGPTConversation(document, window.location);
    expect(data.messageCount).toBe(2);
    expect(data.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(data.messages.map((message) => message.id)).toEqual([
      "group:user:turn-alpha",
      "group:assistant:turn-alpha"
    ]);
    expect(data.messages[0].plainText).toBe("Explain the new renderer");
    expect(data.messages[1].plainText).toContain("The grouped renderer works.");
    expect(data.messages[1].plainText).not.toContain("Copy");
    expect(data.messages.every((message) => message.identityQuality === "strong")).toBe(true);
  });

  it("merges mixed legacy and grouped role signals without dropping the user or duplicating the assistant", () => {
    document.body.innerHTML = `
      <main>
        <div data-turn-key="turn-beta">
          <div data-user-message-bubble>Question from the new user bubble</div>
          <div data-conversation-role="assistant">
            <div data-message-author-role="assistant">
              <div class="markdown"><p>Answer exposed through both role contracts.</p></div>
            </div>
          </div>
        </div>
      </main>
    `;

    const data = extractChatGPTConversation(document, window.location);
    expect(data.messageCount).toBe(2);
    expect(data.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(data.messages.map((message) => message.id)).toEqual([
      "group:user:turn-beta",
      "group:assistant:turn-beta"
    ]);
    expect(data.messages[1].plainText).toBe("Answer exposed through both role contracts.");
  });

  it("accepts alternate semantic role attributes used by ChatGPT UI variants", () => {
    document.body.innerHTML = `
      <section data-testid="conversation-turn-0">
        <div data-role="user"><div class="whitespace-pre-wrap">Variant user</div></div>
      </section>
      <section data-testid="conversation-turn-1">
        <div data-message-author="assistant"><div class="prose"><p>Variant assistant</p></div></div>
      </section>
    `;

    const data = extractChatGPTConversation(document, window.location);
    expect(data.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(data.messages.map((message) => message.sourceOrder)).toEqual([0, 1]);
    expect(data.messages.map((message) => message.plainText)).toEqual(["Variant user", "Variant assistant"]);
  });

  it("counts code and math nodes", () => {
    document.body.innerHTML = `
      <section data-testid="conversation-turn-0" data-turn-id="a1"><div data-message-author-role="assistant"><div class="markdown">
        <pre><code class="language-js">const x = 1;</code></pre>
        <p>Then <span class="katex"><span class="katex-mathml"><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span></span>.</p>
      </div></div></section>`;
    const data = extractChatGPTConversation(document, window.location);
    expect(data.stats.codeBlocks).toBe(1);
    expect(data.stats.mathNodes).toBe(1);
  });
});
