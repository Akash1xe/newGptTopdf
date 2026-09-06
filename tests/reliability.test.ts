import { describe, expect, it } from "vitest";
import { mergeCollectedOrder } from "../src/providers/chatgpt/chatgptCollector";
import { parseChatGPTMessage } from "../src/providers/chatgpt/chatgptParser";

 describe("reliability helpers", () => {
  it("prepends older lazy-loaded turns around overlap without duplicates", () => {
    expect(mergeCollectedOrder(["m3", "m4", "m5"], ["m1", "m2", "m3", "m4"])).toEqual(["m1", "m2", "m3", "m4", "m5"]);
  });

  it("preserves identical legitimate messages when stable IDs differ at extraction level", () => {
    const current = ["turn-1", "turn-2"];
    expect(mergeCollectedOrder(current, ["turn-0", "turn-1", "turn-2"])).toEqual(["turn-0", "turn-1", "turn-2"]);
  });

  it("parses conversation images but not button icons", () => {
    document.body.innerHTML = `<div id="root"><img src="https://example.com/diagram.png" alt="Architecture diagram"><button><img src="https://example.com/icon.png" alt="icon"></button></div>`;
    const result = parseChatGPTMessage(document.querySelector("#root")!);
    expect(result.blocks.some((block) => block.type === "image" && block.alt === "Architecture diagram")).toBe(true);
    expect(result.plainText).not.toContain("icon");
  });

  it("falls back to text for an unknown malformed element", () => {
    document.body.innerHTML = `<div id="root"><weird-widget><span>Useful fallback text</span></weird-widget></div>`;
    const result = parseChatGPTMessage(document.querySelector("#root")!);
    expect(result.plainText).toContain("Useful fallback text");
  });
});
