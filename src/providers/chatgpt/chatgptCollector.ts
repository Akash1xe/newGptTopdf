import type { ConversationData, ConversationMessage, ExtractionCompleteness } from "../../types/conversation";
import { extractChatGPTConversation, finalizeConversation } from "./chatgptExtractor";
import { findConversationScrollElement, isConversationStreaming } from "./chatgptDomUtils";

export type CollectionFailureCode = "CONVERSATION_STILL_GENERATING" | "EXTRACTION_TIMEOUT" | "PAGE_CHANGED";

export class ConversationCollectionError extends Error {
  constructor(public readonly code: CollectionFailureCode, message: string) {
    super(message);
  }
}

export interface CollectionOptions {
  maxIterations?: number;
  maxDurationMs?: number;
  settleMs?: number;
  onProgress?: (messageCount: number) => void;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mergeCollectedOrder(current: string[], snapshotIds: string[]): string[] {
  if (!current.length) return [...snapshotIds];
  const currentSet = new Set(current);
  const overlap = snapshotIds.find((id) => currentSet.has(id));
  if (!overlap) {
    const fresh = snapshotIds.filter((id) => !currentSet.has(id));
    return [...fresh, ...current];
  }

  const snapPivot = snapshotIds.indexOf(overlap);
  const currentPivot = current.indexOf(overlap);
  const before = snapshotIds.slice(0, snapPivot).filter((id) => !currentSet.has(id));
  const after = snapshotIds.slice(snapPivot + 1).filter((id) => !currentSet.has(id));
  const next = [...current];
  next.splice(currentPivot, 0, ...before);
  for (const id of after) {
    const prior = snapshotIds[snapshotIds.indexOf(id) - 1];
    const priorIndex = next.indexOf(prior);
    if (priorIndex >= 0) next.splice(priorIndex + 1, 0, id);
    else next.push(id);
  }
  return next;
}

export async function collectFullChatGPTConversation(
  document: Document,
  location: Location,
  options: CollectionOptions = {}
): Promise<ConversationData> {
  if (isConversationStreaming(document)) {
    throw new ConversationCollectionError("CONVERSATION_STILL_GENERATING", "Wait for ChatGPT to finish generating before exporting.");
  }

  const maxIterations = options.maxIterations ?? 48;
  const maxDurationMs = options.maxDurationMs ?? 15_000;
  const settleMs = options.settleMs ?? 260;
  const capturedUrl = location.href;
  const scrollElement = findConversationScrollElement(document);
  const originalTop = scrollElement.scrollTop;
  const messageMap = new Map<string, ConversationMessage>();
  let order: string[] = [];
  let noProgress = 0;
  let iterations = 0;
  let reachedTop = false;
  let timeout = false;
  const started = performance.now();

  const capture = () => {
    const snapshot = extractChatGPTConversation(document, location);
    const ids = snapshot.messages.map((message) => message.id);
    const priorSize = messageMap.size;
    snapshot.messages.forEach((message) => messageMap.set(message.id, message));
    order = mergeCollectedOrder(order, ids);
    const added = messageMap.size - priorSize;
    if (added > 0) options.onProgress?.(messageMap.size);
    return added;
  };

  try {
    capture();
    while (iterations < maxIterations) {
      iterations++;
      if (location.href !== capturedUrl) throw new ConversationCollectionError("PAGE_CHANGED", "The ChatGPT conversation changed while it was being collected.");
      if (performance.now() - started > maxDurationMs) {
        timeout = true;
        break;
      }

      const currentTop = scrollElement.scrollTop;
      if (currentTop <= 2) {
        reachedTop = true;
        await delay(settleMs);
        const added = capture();
        noProgress = added === 0 ? noProgress + 1 : 0;
        if (noProgress >= 2) break;
        continue;
      }

      const step = Math.max(scrollElement.clientHeight * 0.82, 700);
      scrollElement.scrollTop = Math.max(0, currentTop - step);
      scrollElement.dispatchEvent(new Event("scroll", { bubbles: true }));
      await delay(settleMs);
      const added = capture();
      noProgress = added === 0 ? noProgress + 1 : 0;
      if (noProgress >= 4 && scrollElement.scrollTop <= 2) {
        reachedTop = true;
        break;
      }
    }
  } finally {
    scrollElement.scrollTop = originalTop;
    scrollElement.dispatchEvent(new Event("scroll", { bubbles: true }));
  }

  const messages = order.map((id) => messageMap.get(id)).filter((message): message is ConversationMessage => Boolean(message));
  let completeness: ExtractionCompleteness;
  if (reachedTop && !timeout) completeness = { state: "complete", iterations };
  else if (timeout) completeness = { state: "known-partial", reason: "timeout", iterations };
  else completeness = { state: "possibly-partial", reason: "load-limit", iterations };

  return finalizeConversation(document, location, messages, completeness, capturedUrl);
}
