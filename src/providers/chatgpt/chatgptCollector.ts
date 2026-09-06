import type { BeginningEvidence, ConversationData, ConversationMessage, ExtractionCompleteness } from "../../types/conversation";
import type { ExtractionProgressData, ExtractionProgressPhase } from "../../types/messages";
import { extractChatGPTConversation, finalizeConversation, getRoleNodes } from "./chatgptExtractor";
import {
  conversationIdentityFromLocation,
  dispatchSyntheticScroll,
  findConversationScrollElement,
  getMessageIdentity,
  isConversationStreaming,
  normalizeRole
} from "./chatgptDomUtils";

export type CollectionFailureCode =
  | "CONVERSATION_STILL_GENERATING"
  | "EXTRACTION_TIMEOUT"
  | "EXTRACTION_CANCELLED"
  | "SCROLL_CONTAINER_LOST"
  | "PAGE_CHANGED";

export class ConversationCollectionError extends Error {
  constructor(public readonly code: CollectionFailureCode, message: string) {
    super(message);
  }
}

export interface CollectionOptions {
  /** Test-only/diagnostic safety override. Production collection has no iteration cap. */
  maxIterations?: number;
  maxDurationMs?: number;
  mutationWaitMs?: number;
  settleMs?: number;
  noProgressLimit?: number;
  topStabilityPasses?: number;
  signal?: AbortSignal;
  onProgress?: (progress: ExtractionProgressData) => void;
}

interface ScrollRestorePoint {
  originalTop: number;
  originalBottomOffset: number;
  originalScrollableRange: number;
  anchorId?: string;
  anchorOffset?: number;
}

interface CaptureResult {
  added: number;
  oldestId?: string;
  newestId?: string;
}

const DEFAULT_MAX_DURATION_MS = 180_000;
const DEFAULT_MUTATION_WAIT_MS = 1_350;
const DEFAULT_SETTLE_MS = 140;
const DEFAULT_NO_PROGRESS_LIMIT = 6;
const DEFAULT_TOP_STABILITY_PASSES = 3;
const TOP_EVIDENCE_WAIT_MS = 360;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function abortError(): ConversationCollectionError {
  return new ConversationCollectionError("EXTRACTION_CANCELLED", "Full conversation loading was cancelled.");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForConversationMutation(root: Node, timeoutMs: number, signal?: AbortSignal): Promise<"mutation" | "timeout"> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    let settled = false;
    const finish = (result: "mutation" | "timeout") => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const onAbort = () => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) =>
        mutation.type === "childList"
        || (mutation.type === "attributes" && ["data-message-author-role", "data-turn-id", "data-message-id", "data-testid", "hidden", "aria-hidden"].includes(mutation.attributeName ?? ""))
      );
      if (relevant) finish("mutation");
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-message-author-role", "data-turn-id", "data-message-id", "data-testid", "hidden", "aria-hidden"]
    });
    const timer = setTimeout(() => finish("timeout"), timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
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
    if (next.includes(id)) continue;
    const snapshotIndex = snapshotIds.indexOf(id);
    const prior = snapshotIds[snapshotIndex - 1];
    const priorIndex = next.indexOf(prior);
    if (priorIndex >= 0) next.splice(priorIndex + 1, 0, id);
    else next.push(id);
  }
  return next;
}

export function nextTopStabilityPasses(
  current: number,
  observation: { atTop: boolean; added: number; oldestBefore?: string; oldestAfter?: string }
): number {
  if (!observation.atTop) return 0;
  if (observation.added > 0) return 0;
  if (observation.oldestBefore !== observation.oldestAfter) return 0;
  return current + 1;
}

export function isVerifiedBeginning(topStabilityPasses: number, requiredPasses = DEFAULT_TOP_STABILITY_PASSES): boolean {
  return topStabilityPasses >= requiredPasses;
}

function emitProgress(
  options: CollectionOptions,
  phase: ExtractionProgressPhase,
  messageCount: number,
  iteration: number,
  topStabilityPasses: number
): void {
  options.onProgress?.({ phase, messageCount, iteration, topStabilityPasses });
}

function viewportTop(document: Document, scrollElement: HTMLElement): number {
  if (scrollElement === document.scrollingElement || scrollElement === document.documentElement || scrollElement === document.body) return 0;
  return scrollElement.getBoundingClientRect().top;
}

function captureScrollRestorePoint(document: Document, scrollElement: HTMLElement): ScrollRestorePoint {
  const originalTop = scrollElement.scrollTop;
  const originalScrollableRange = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
  const originalBottomOffset = Math.max(0, originalScrollableRange - originalTop);
  const top = viewportTop(document, scrollElement);
  const bottom = top + Math.max(scrollElement.clientHeight, document.defaultView?.innerHeight ?? 0);
  let anchorId: string | undefined;
  let anchorOffset: number | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index, node] of getRoleNodes(document).entries()) {
    const role = normalizeRole(node.getAttribute("data-message-author-role") ?? node.getAttribute("data-turn"));
    if (!role) continue;
    const rect = node.getBoundingClientRect();
    if (rect.bottom <= top || rect.top >= bottom) continue;
    const distance = Math.abs(rect.top - top);
    if (distance >= bestDistance) continue;
    const identity = getMessageIdentity(node, role, index);
    if (identity.quality !== "strong") continue;
    bestDistance = distance;
    anchorId = identity.id;
    anchorOffset = rect.top - top;
  }

  return { originalTop, originalBottomOffset, originalScrollableRange, anchorId, anchorOffset };
}

async function restoreScrollPosition(document: Document, scrollElement: HTMLElement, point: ScrollRestorePoint): Promise<void> {
  if (!scrollElement.isConnected) return;
  const range = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
  let target = Math.min(point.originalTop, range);

  // When the user started close to the bottom, preserving the distance from
  // the bottom is more robust than raw scrollTop after virtualized history has
  // changed the scroll range.
  if (point.originalBottomOffset <= Math.max(scrollElement.clientHeight * 1.5, 800)) {
    target = Math.max(0, range - point.originalBottomOffset);
  } else if (point.originalScrollableRange > 0 && range > 0 && point.originalTop > range) {
    target = Math.min(range, (point.originalTop / point.originalScrollableRange) * range);
  }

  scrollElement.scrollTop = target;
  dispatchSyntheticScroll(document, scrollElement);
  try {
    await Promise.race([waitForConversationMutation(scrollElement, 420), delay(420)]);
    await delay(80);
  } catch {
    // Restoration is best-effort and must never mask the extraction result.
  }

  if (!point.anchorId || point.anchorOffset == null) return;
  const top = viewportTop(document, scrollElement);
  for (const [index, node] of getRoleNodes(document).entries()) {
    const role = normalizeRole(node.getAttribute("data-message-author-role") ?? node.getAttribute("data-turn"));
    if (!role) continue;
    const identity = getMessageIdentity(node, role, index);
    if (identity.id !== point.anchorId) continue;
    const currentOffset = node.getBoundingClientRect().top - top;
    scrollElement.scrollTop += currentOffset - point.anchorOffset;
    dispatchSyntheticScroll(document, scrollElement);
    break;
  }
}

function sortCollectedMessages(order: string[], messageMap: Map<string, ConversationMessage>): ConversationMessage[] {
  const messages = order.map((id) => messageMap.get(id)).filter((message): message is ConversationMessage => Boolean(message));
  if (messages.length > 0 && messages.every((message) => Number.isSafeInteger(message.sourceOrder))) {
    return [...messages].sort((a, b) => (a.sourceOrder as number) - (b.sourceOrder as number));
  }
  return messages;
}

function explicitBeginningEvidence(messages: ConversationMessage[]): BeginningEvidence | undefined {
  const ordinals = messages.map((message) => message.sourceOrder).filter((value): value is number => Number.isSafeInteger(value));
  return ordinals.length > 0 && Math.min(...ordinals) === 0 ? "turn-ordinal" : undefined;
}

function hasReliableCrossWindowIdentity(messages: ConversationMessage[], traversedVirtualizedHistory: boolean): boolean {
  if (!traversedVirtualizedHistory) return true;
  return messages.every((message) => message.identityQuality !== "contextual");
}

export async function collectFullChatGPTConversation(
  document: Document,
  location: Location,
  options: CollectionOptions = {}
): Promise<ConversationData> {
  if (isConversationStreaming(document)) {
    throw new ConversationCollectionError("CONVERSATION_STILL_GENERATING", "Wait for ChatGPT to finish generating before exporting.");
  }

  throwIfAborted(options.signal);
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const mutationWaitMs = options.mutationWaitMs ?? DEFAULT_MUTATION_WAIT_MS;
  const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
  const noProgressLimit = options.noProgressLimit ?? DEFAULT_NO_PROGRESS_LIMIT;
  const requiredTopStabilityPasses = options.topStabilityPasses ?? DEFAULT_TOP_STABILITY_PASSES;
  const capturedUrl = location.href;
  const capturedIdentity = conversationIdentityFromLocation(location);
  const scrollElement = findConversationScrollElement(document);
  if (!scrollElement.isConnected) {
    throw new ConversationCollectionError("SCROLL_CONTAINER_LOST", "The ChatGPT conversation viewport could not be found.");
  }

  const restorePoint = captureScrollRestorePoint(document, scrollElement);
  const initialTop = scrollElement.scrollTop;
  const messageMap = new Map<string, ConversationMessage>();
  let order: string[] = [];
  let noProgress = 0;
  let iterations = 0;
  let reachedTop = false;
  let verifiedBeginning = false;
  let topStability = 0;
  let partialReason: ExtractionCompleteness["reason"] | undefined;
  let beginningEvidence: BeginningEvidence | undefined;
  const started = now();

  const capture = (): CaptureResult => {
    const snapshot = extractChatGPTConversation(document, location);
    const ids = snapshot.messages.map((message) => message.id);
    const priorSize = messageMap.size;
    snapshot.messages.forEach((message) => messageMap.set(message.id, message));
    order = mergeCollectedOrder(order, ids);
    const added = messageMap.size - priorSize;
    const oldestId = order[0];
    const newestId = order[order.length - 1];
    return { added, oldestId, newestId };
  };

  const assertPageStable = () => {
    throwIfAborted(options.signal);
    if (conversationIdentityFromLocation(location) !== capturedIdentity) {
      throw new ConversationCollectionError("PAGE_CHANGED", "The ChatGPT conversation changed while it was being collected.");
    }
    if (isConversationStreaming(document)) {
      throw new ConversationCollectionError("CONVERSATION_STILL_GENERATING", "ChatGPT started generating while the conversation was being collected. Wait for it to finish, then retry.");
    }
    if (!scrollElement.isConnected) {
      throw new ConversationCollectionError("SCROLL_CONTAINER_LOST", "The ChatGPT conversation viewport changed while it was being collected. Retry the export.");
    }
  };

  try {
    let latest = capture();
    emitProgress(options, "capturing", messageMap.size, iterations, topStability);

    while (true) {
      assertPageStable();
      const elapsed = now() - started;
      if (elapsed >= maxDurationMs) {
        partialReason = "timeout";
        break;
      }
      if (options.maxIterations != null && iterations >= options.maxIterations) {
        partialReason = "load-limit";
        break;
      }

      iterations++;
      const topBefore = scrollElement.scrollTop;
      const oldestBefore = order[0];

      if (topBefore <= 2) {
        reachedTop = true;
        const currentMessages = sortCollectedMessages(order, messageMap);
        const explicit = explicitBeginningEvidence(currentMessages);
        emitProgress(options, "verifying-start", messageMap.size, iterations, topStability);
        await waitForConversationMutation(scrollElement, explicit ? TOP_EVIDENCE_WAIT_MS : mutationWaitMs, options.signal);
        await delay(settleMs, options.signal);
        assertPageStable();
        latest = capture();
        topStability = nextTopStabilityPasses(topStability, {
          atTop: scrollElement.scrollTop <= 2,
          added: latest.added,
          oldestBefore,
          oldestAfter: order[0]
        });
        if (latest.added > 0) noProgress = 0;
        emitProgress(options, "verifying-start", messageMap.size, iterations, topStability);

        if (isVerifiedBeginning(topStability, requiredTopStabilityPasses)) {
          verifiedBeginning = true;
          beginningEvidence = explicit ?? "stable-top";
          break;
        }
        continue;
      }

      reachedTop = false;
      topStability = 0;
      emitProgress(options, "loading-older", messageMap.size, iterations, topStability);
      const step = Math.max(scrollElement.clientHeight * 0.8, 320);
      const requestedTop = Math.max(0, topBefore - step);
      scrollElement.scrollTop = requestedTop;
      dispatchSyntheticScroll(document, scrollElement);
      const topAfterScrollRequest = scrollElement.scrollTop;

      await waitForConversationMutation(scrollElement, mutationWaitMs, options.signal);
      await delay(settleMs, options.signal);
      assertPageStable();
      latest = capture();

      const topAfter = scrollElement.scrollTop;
      const oldestAfter = order[0];
      const moved = Math.abs(topAfter - topBefore) > 2 || Math.abs(topAfterScrollRequest - topBefore) > 2;
      const oldestChanged = oldestBefore !== oldestAfter;
      const meaningfulProgress = latest.added > 0 || oldestChanged || moved;
      noProgress = meaningfulProgress ? 0 : noProgress + 1;
      emitProgress(options, "loading-older", messageMap.size, iterations, topStability);

      if (noProgress >= noProgressLimit && scrollElement.scrollTop > 2) {
        partialReason = "no-progress";
        break;
      }
    }
  } finally {
    emitProgress(options, "restoring", messageMap.size, iterations, topStability);
    await restoreScrollPosition(document, scrollElement, restorePoint);
  }

  const messages = sortCollectedMessages(order, messageMap);
  const traversedVirtualizedHistory = initialTop > 2 || iterations > requiredTopStabilityPasses;
  if (verifiedBeginning && !hasReliableCrossWindowIdentity(messages, traversedVirtualizedHistory)) {
    verifiedBeginning = false;
    partialReason = "identity-conflict";
  }

  const completeness: ExtractionCompleteness = verifiedBeginning && !partialReason
    ? {
        state: "complete",
        iterations,
        elapsedMs: Math.round(now() - started),
        noProgressPasses: noProgress,
        topStabilityPasses: topStability,
        reachedBeginning: reachedTop,
        verifiedBeginning: true,
        beginningEvidence,
        oldestMessageId: messages[0]?.id,
        newestMessageId: messages[messages.length - 1]?.id
      }
    : {
        state: "known-partial",
        reason: partialReason ?? "unknown",
        iterations,
        elapsedMs: Math.round(now() - started),
        noProgressPasses: noProgress,
        topStabilityPasses: topStability,
        reachedBeginning: reachedTop,
        verifiedBeginning: false,
        oldestMessageId: messages[0]?.id,
        newestMessageId: messages[messages.length - 1]?.id
      };

  return finalizeConversation(document, location, messages, completeness, capturedUrl);
}
