import { describe, expect, it } from "vitest";
import { isVerifiedBeginning, mergeCollectedOrder, nextTopStabilityPasses } from "../src/providers/chatgpt/chatgptCollector";
import { parseChatGPTMessage } from "../src/providers/chatgpt/chatgptParser";

function simulateVirtualizedCollection(total: number, windowSize = 80, overlap = 20): string[] {
  const all = Array.from({ length: total }, (_, index) => `turn-${index}`);
  let collected: string[] = [];
  let end = total;

  while (end > 0) {
    const start = Math.max(0, end - windowSize);
    collected = mergeCollectedOrder(collected, all.slice(start, end));
    if (start === 0) break;
    end = start + overlap;
  }
  return collected;
}

describe("reliability helpers", () => {
  it("prepends older lazy-loaded turns around overlap without duplicates", () => {
    expect(mergeCollectedOrder(["m3", "m4", "m5"], ["m1", "m2", "m3", "m4"])).toEqual(["m1", "m2", "m3", "m4", "m5"]);
  });

  it("preserves identical legitimate messages when stable IDs differ at extraction level", () => {
    const current = ["turn-1", "turn-2"];
    expect(mergeCollectedOrder(current, ["turn-0", "turn-1", "turn-2"])).toEqual(["turn-0", "turn-1", "turn-2"]);
  });

  for (const total of [100, 300, 500, 1000]) {
    it(`reconstructs exact order across virtualized windows for ${total} messages`, () => {
      const expected = Array.from({ length: total }, (_, index) => `turn-${index}`);
      expect(simulateVirtualizedCollection(total)).toEqual(expected);
    });
  }

  it("requires three stable passes at the top before beginning is verified", () => {
    let passes = 0;
    passes = nextTopStabilityPasses(passes, { atTop: true, added: 0, oldestBefore: "turn-0", oldestAfter: "turn-0" });
    expect(isVerifiedBeginning(passes)).toBe(false);
    passes = nextTopStabilityPasses(passes, { atTop: true, added: 0, oldestBefore: "turn-0", oldestAfter: "turn-0" });
    expect(isVerifiedBeginning(passes)).toBe(false);
    passes = nextTopStabilityPasses(passes, { atTop: true, added: 0, oldestBefore: "turn-0", oldestAfter: "turn-0" });
    expect(isVerifiedBeginning(passes)).toBe(true);
  });

  it("resets top stability when an older message mounts late", () => {
    const passes = nextTopStabilityPasses(2, { atTop: true, added: 1, oldestBefore: "turn-2", oldestAfter: "turn-0" });
    expect(passes).toBe(0);
  });

  it("resets top stability when the viewport is no longer at the top", () => {
    expect(nextTopStabilityPasses(2, { atTop: false, added: 0, oldestBefore: "turn-0", oldestAfter: "turn-0" })).toBe(0);
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
