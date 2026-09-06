import { describe, expect, it } from "vitest";
import {
  checkBatchContinuity,
  collectFullChatGPTConversation,
  detectOrdinalGaps,
  isVerifiedBeginning,
  mergeCollectedOrder,
  nextTopStabilityPasses,
  type BatchSnapshot
} from "../src/providers/chatgpt/chatgptCollector";
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

function batch(from: number, to: number): BatchSnapshot {
  const ordinals = Array.from({ length: to - from + 1 }, (_, index) => from + index);
  return {
    ids: ordinals.map((ordinal) => `turn-${ordinal}`),
    ordinals,
    allOrdinalsReliable: true
  };
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

  it("detects ordinal gaps exactly", () => {
    expect(detectOrdinalGaps([0, 1, 2, 5, 6, 10])).toEqual([
      { from: 3, to: 4 },
      { from: 7, to: 9 }
    ]);
  });

  it("accepts turbo batches that overlap", () => {
    const previous = batch(700, 760);
    const current = batch(620, 710);
    const continuity = checkBatchContinuity(previous, current);
    expect(continuity.status).toBe("continuous");
    expect(continuity.overlapCount).toBeGreaterThan(0);
  });

  it("accepts reliable ordinal-adjacent batches even without ID overlap", () => {
    const previous = batch(700, 760);
    const current = batch(620, 699);
    const continuity = checkBatchContinuity(previous, current);
    expect(continuity.status).toBe("continuous");
  });

  it("detects a turbo jump that skipped a range", () => {
    const previous = batch(700, 760);
    const current = batch(500, 560);
    expect(checkBatchContinuity(previous, current)).toEqual({
      status: "gap-suspected",
      overlapCount: 0,
      missingOrdinalRanges: [{ from: 561, to: 699 }]
    });
  });

  it("proves that a careful recovery batch bridges a suspected turbo gap", () => {
    const lowerSafeBatch = batch(801, 1000);
    const unsafeOlderBatch = batch(501, 700);
    const recoveryBridge = batch(651, 850);

    expect(checkBatchContinuity(lowerSafeBatch, unsafeOlderBatch).status).toBe("gap-suspected");
    expect(checkBatchContinuity(lowerSafeBatch, recoveryBridge).status).toBe("continuous");
    expect(checkBatchContinuity(recoveryBridge, unsafeOlderBatch).status).toBe("continuous");
  });

  it("does not trust no-overlap batches when ordinals are unavailable", () => {
    const previous: BatchSnapshot = { ids: ["a", "b"], ordinals: [], allOrdinalsReliable: false };
    const current: BatchSnapshot = { ids: ["x", "y"], ordinals: [], allOrdinalsReliable: false };
    expect(checkBatchContinuity(previous, current).status).toBe("gap-suspected");
  });

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

  it("resets top stability when scroll height changes at the top", () => {
    const passes = nextTopStabilityPasses(2, {
      atTop: true,
      added: 0,
      oldestBefore: "turn-0",
      oldestAfter: "turn-0",
      heightBefore: 1000,
      heightAfter: 1400
    });
    expect(passes).toBe(0);
  });

  it("resets top stability when the viewport is no longer at the top", () => {
    expect(nextTopStabilityPasses(2, { atTop: false, added: 0, oldestBefore: "turn-0", oldestAfter: "turn-0" })).toBe(0);
  });

  it("deep-parses each stable mounted message once while repeated captures skip known IDs", async () => {
    document.title = "Collector fixture - ChatGPT";
    document.body.innerHTML = `
      <main>
        <article data-message-author-role="user" data-testid="conversation-turn-0">
          <div class="whitespace-pre-wrap">next</div>
        </article>
        <article data-message-author-role="assistant" data-testid="conversation-turn-1">
          <div class="markdown"><p>continue</p></div>
        </article>
        <article data-message-author-role="user" data-testid="conversation-turn-2">
          <div class="whitespace-pre-wrap">next</div>
        </article>
      </main>`;

    const result = await collectFullChatGPTConversation(document, window.location, {
      mutationWaitMs: 1,
      settleMs: 0,
      topStabilityPasses: 1,
      maxDurationMs: 1_000
    });

    expect(result.completeness.state).toBe("complete");
    expect(result.completeness.uniqueParsedMessages).toBe(3);
    expect(result.messages).toHaveLength(3);
    expect(result.messages.map((message) => message.plainText)).toEqual(["next", "continue", "next"]);
    expect(result.completeness.duplicateCandidatesSkipped).toBeGreaterThanOrEqual(3);
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
