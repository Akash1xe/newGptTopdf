import type { BeginningEvidence, ConversationData, ConversationMessage, ExtractionCompleteness } from "../../types/conversation";
import type { ExtractionProgressData, ExtractionProgressPhase } from "../../types/messages";
import { finalizeConversation, getRoleNodes } from "./chatgptExtractor";
import { parseChatGPTMessage } from "./chatgptParser";
import {
  conversationIdentityFromLocation,
  dispatchSyntheticScroll,
  findConversationScrollElement,
  findMessageContent,
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

interface MountedMessageCandidate {
  id: string;
  role: "user" | "assistant";
  sourceOrder?: number;
  identityQuality: "strong" | "contextual";
  element: Element;
}

interface CaptureResult {
  added: number;
  parsed: number;
  skipped: number;
  ids: string[];
  oldestId?: string;
  newestId?: string;
  minOrdinal?: number;
  maxOrdinal?: number;
}

interface BatchSnapshot {
  ids: string[];
  ordinals: number[];
}

interface ContinuityCheck {
  status: "continuous" | "gap-suspected" | "unknown";
  overlapCount: number;
  missingOrdinalRanges: Array<{ from: number; to: number }>;
}

type CollectorMode = "turbo" | "recovery" | "verify";

const DEFAULT_MAX_DURATION_MS = 180_000;
const DEFAULT_NO_PROGRESS_LIMIT = 6;
const DEFAULT_TOP_STABILITY_PASSES = 3;
const FAST_SCROLL_RATIO = 3;
const RECOVERY_SCROLL_RATIO = 0.85;
const FAST_WAIT_STEPS = [220, 380, 650, 1_000] as const;
const FAST_SETTLE_MS = 60;
const RECOVERY_WAIT_MS = 700;
const RECOVERY_SETTLE_MS = 100;
const TOP_VERIFY_WAIT_MS = 320;
const TOP_SETTLE_MS = 80;

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

function emitProgress(
  options: CollectionOptions,
  phase: ExtractionProgressPhase,
  messageCount: number,
  iteration: number,
  topStabilityPasses: number,
  mode?: CollectorMode
): void {
  options.onProgress?.({ phase, messageCount, iteration, topStabilityPasses, mode });
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

  if (point.originalBottomOffset <= Math.max(scrollElement.clientHeight * 1.5, 800)) {
    target = Math.max(0, range - point.originalBottomOffset);
  } else if (point.originalScrollableRange > 0 && range > 0 && point.originalTop > range) {
    target = Math.min(range, (point.originalTop / point.originalScrollableRange) * range);
  }

  scrollElement.scrollTop = target;
  dispatchSyntheticScroll(document, scrollElement);
  try {
    await Promise.race([waitForConversationMutation(scrollElement, 260), delay(260)]);
    await delay(50);
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

export function mergeCollectedOrder(current: string[], snapshotIds: string[]): string[] {
  if (!current.length) return [...snapshotIds];
  if (!snapshotIds.length) return [...current];

  const positions = new Map(current.map((id, index) => [id, index] as const));
  const overlap = snapshotIds.find((id) => positions.has(id));
  if (!overlap) {
    const currentSet = new Set(current);
    return [...snapshotIds.filter((id) => !currentSet.has(id)), ...current];
  }

  const currentSet = new Set(current);
  const snapPivot = snapshotIds.indexOf(overlap);
  const currentPivot = positions.get(overlap) ?? 0;
  const before = snapshotIds.slice(0, snapPivot).filter((id) => !currentSet.has(id));
  const next = [...current];
  next.splice(currentPivot, 0, ...before);

  const nextSet = new Set(next);
  let insertionIndex = next.indexOf(overlap) + 1;
  for (const id of snapshotIds.slice(snapPivot + 1)) {
    if (nextSet.has(id)) {
      insertionIndex = next.indexOf(id) + 1;
      continue;
    }
    next.splice(insertionIndex, 0, id);
    nextSet.add(id);
    insertionIndex++;
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

function discoverMountedMessageCandidates(document: Document): MountedMessageCandidate[] {
  const candidates: MountedMessageCandidate[] = [];
  for (const [index, node] of getRoleNodes(document).entries()) {
    const role = normalizeRole(node.getAttribute("data-message-author-role") ?? node.getAttribute("data-turn"));
    if (!role) continue;
    const identity = getMessageIdentity(node, role, index);
    candidates.push({
      id: identity.id,
      role,
      sourceOrder: identity.ordinal,
      identityQuality: identity.quality,
      element: node
    });
  }
  return candidates;
}

function parseCandidate(candidate: MountedMessageCandidate, order: number): ConversationMessage | null {
  const content = findMessageContent(candidate.element, candidate.role);
  try {
    const parsed = parseChatGPTMessage(content);
    if (!parsed.plainText && parsed.blocks.length === 0) return null;
    return {
      id: candidate.id,
      role: candidate.role,
      order,
      sourceOrder: candidate.sourceOrder,
      identityQuality: candidate.identityQuality,
      plainText: parsed.plainText,
      blocks: parsed.blocks
    };
  } catch {
    const fallback = content.textContent?.trim() ?? "";
    if (!fallback) return null;
    return {
      id: candidate.id,
      role: candidate.role,
      order,
      sourceOrder: candidate.sourceOrder,
      identityQuality: candidate.identityQuality,
      plainText: fallback,
      blocks: [{ type: "paragraph", children: [{ type: "text", text: fallback }] }]
    };
  }
}

function captureUnseenMessages(
  document: Document,
  messageMap: Map<string, ConversationMessage>,
  collectedIds: Set<string>,
  currentOrder: string[]
): { result: CaptureResult; order: string[] } {
  const candidates = discoverMountedMessageCandidates(document);
  const ids = candidates.map((candidate) => candidate.id);
  let parsed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    if (collectedIds.has(candidate.id)) {
      skipped++;
      continue;
    }
    const message = parseCandidate(candidate, messageMap.size);
    if (!message) continue;
    messageMap.set(candidate.id, message);
    collectedIds.add(candidate.id);
    parsed++;
  }

  const order = mergeCollectedOrder(currentOrder, ids.filter((id) => collectedIds.has(id)));
  const ordinals = candidates
    .map((candidate) => candidate.sourceOrder)
    .filter((value): value is number => Number.isSafeInteger(value));

  return {
    result: {
      added: parsed,
      parsed,
      skipped,
      ids,
      oldestId: order[0],
      newestId: order[order.length - 1],
      minOrdinal: ordinals.length ? Math.min(...ordinals) : undefined,
      maxOrdinal: ordinals.length ? Math.max(...ordinals) : undefined
    },
    order
  };
}

function snapshotFromCapture(capture: CaptureResult): BatchSnapshot {
  return {
    ids: capture.ids,
    ordinals: []
  };
}

function messageOrdinals(ids: string[], messageMap: Map<string, ConversationMessage>): number[] {
  return ids
    .map((id) => messageMap.get(id)?.sourceOrder)
    .filter((value): value is number => Number.isSafeInteger(value));
}

export function detectOrdinalGaps(ordinals: number[]): Array<{ from: number; to: number }> {
  const unique = [...new Set(ordinals)].sort((a, b) => a - b);
  const gaps: Array<{ from: number; to: number }> = [];
  for (let index = 1; index < unique.length; index++) {
    const previous = unique[index - 1];
    const current = unique[index];
    if (current > previous + 1) gaps.push({ from: previous + 1, to: current - 1 });
  }
  return gaps;
}

export function checkBatchContinuity(
  previous: BatchSnapshot | undefined,
  current: BatchSnapshot,
  messageMap: Map<string, ConversationMessage>
): ContinuityCheck {
  if (!previous || !previous.ids.length || !current.ids.length) {
    return { status: "unknown", overlapCount: 0, missingOrdinalRanges: [] };
  }

  const previousIds = new Set(previous.ids);
  const overlapCount = current.ids.reduce((count, id) => count + (previousIds.has(id) ? 1 : 0), 0);
  const previousOrdinals = messageOrdinals(previous.ids, messageMap);
  const currentOrdinals = messageOrdinals(current.ids, messageMap);
  const combinedOrdinals = [...previousOrdinals, ...currentOrdinals];
  const missingOrdinalRanges = detectOrdinalGaps(combinedOrdinals);

  if (previousOrdinals.length && currentOrdinals.length) {
    const previousMin = Math.min(...previousOrdinals);
    const currentMax = Math.max(...currentOrdinals);
    if (currentMax >= previousMin - 1) {
      return { status: "continuous", overlapCount, missingOrdinalRanges: [] };
    }
    return { status: "gap-suspected", overlapCount, missingOrdinalRanges };
  }

  if (overlapCount > 0) return { status: "continuous", overlapCount, missingOrdinalRanges: [] };
  return { status: "gap-suspected", overlapCount: 0, missingOrdinalRanges };
}

function explicitBeginningEvidence(messages: ConversationMessage[]): BeginningEvidence | undefined {
  const ordinals = messages.map((message) => message.sourceOrder).filter((value): value is number => Number.isSafeInteger(value));
  return ordinals.length > 0 && Math.min(...ordinals) === 0 ? "turn-ordinal" : undefined;
}

function hasReliableCrossWindowIdentity(messages: ConversationMessage[], traversedVirtualizedHistory: boolean): boolean {
  if (!traversedVirtualizedHistory) return true;
  return messages.every((message) => message.identityQuality !== "contextual");
}

function sortCollectedMessages(order: string[], messageMap: Map<string, ConversationMessage>): ConversationMessage[] {
  const messages = order.map((id) => messageMap.get(id)).filter((message): message is ConversationMessage => Boolean(message));
  const withOrdinals = messages.filter((message) => Number.isSafeInteger(message.sourceOrder));
  if (withOrdinals.length === messages.length && messages.length > 0) {
    return [...messages].sort((a, b) => (a.sourceOrder as number) - (b.sourceOrder as number));
  }
  return messages;
}

function hasTail(messages: ConversationMessage[], initialTailIds: Set<string>): boolean {
  if (!initialTailIds.size) return true;
  const ids = new Set(messages.map((message) => message.id));
  for (const id of initialTailIds) if (!ids.has(id)) return false;
  return true;
}

function allKnownOrdinalGaps(messages: ConversationMessage[]): Array<{ from: number; to: number }> {
  const ordinals = messages.map((message) => message.sourceOrder).filter((value): value is number => Number.isSafeInteger(value));
  return ordinals.length >= 2 ? detectOrdinalGaps(ordinals) : [];
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
  const noProgressLimit = options.noProgressLimit ?? DEFAULT_NO_PROGRESS_LIMIT;
  const requiredTopStabilityPasses = options.topStabilityPasses ?? DEFAULT_TOP_STABILITY_PASSES;
  const fastWaitOverride = options.mutationWaitMs;
  const settleOverride = options.settleMs;
  const capturedUrl = location.href;
  const capturedIdentity = conversationIdentityFromLocation(location);
  const scrollElement = findConversationScrollElement(document);
  if (!scrollElement.isConnected) {
    throw new ConversationCollectionError("SCROLL_CONTAINER_LOST", "The ChatGPT conversation viewport could not be found.");
  }

  const restorePoint = captureScrollRestorePoint(document, scrollElement);
  const initialTop = scrollElement.scrollTop;
  const messageMap = new Map<string, ConversationMessage>();
  const collectedIds = new Set<string>();
  let order: string[] = [];
  let noProgress = 0;
  let iterations = 0;
  let turboIterations = 0;
  let recoveryIterations = 0;
  let verifiedBeginning = false;
  let verifiedEnd = false;
  let continuityVerified = true;
  let topStability = 0;
  let gapsDetected = 0;
  let gapsRecovered = 0;
  let unresolvedGaps = 0;
  let partialReason: ExtractionCompleteness["reason"] | undefined;
  let beginningEvidence: BeginningEvidence | undefined;
  let adaptiveWaitIndex = 0;
  let previousBatch: BatchSnapshot | undefined;
  const started = now();

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

  const capture = (): CaptureResult => {
    const captured = captureUnseenMessages(document, messageMap, collectedIds, order);
    order = captured.order;
    return captured.result;
  };

  try {
    const initialCapture = capture();
    const initialTailIds = new Set(initialCapture.ids.filter((id) => collectedIds.has(id)));
    previousBatch = snapshotFromCapture(initialCapture);
    emitProgress(options, "capturing", messageMap.size, iterations, topStability, "turbo");

    while (true) {
      assertPageStable();
      if (now() - started >= maxDurationMs) {
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
        emitProgress(options, "verifying-start", messageMap.size, iterations, topStability, "verify");
        await waitForConversationMutation(scrollElement, TOP_VERIFY_WAIT_MS, options.signal);
        await delay(settleOverride ?? TOP_SETTLE_MS, options.signal);
        assertPageStable();
        const latest = capture();
        topStability = nextTopStabilityPasses(topStability, {
          atTop: scrollElement.scrollTop <= 2,
          added: latest.added,
          oldestBefore,
          oldestAfter: order[0]
        });
        if (latest.added > 0) noProgress = 0;
        beginningEvidence = explicitBeginningEvidence(sortCollectedMessages(order, messageMap)) ?? beginningEvidence;
        emitProgress(options, "verifying-start", messageMap.size, iterations, topStability, "verify");
        if (isVerifiedBeginning(topStability, requiredTopStabilityPasses)) {
          verifiedBeginning = true;
          beginningEvidence ??= "stable-top";
          break;
        }
        continue;
      }

      topStability = 0;
      const currentMode: CollectorMode = unresolvedGaps > 0 ? "recovery" : "turbo";
      const ratio = currentMode === "turbo" ? FAST_SCROLL_RATIO : RECOVERY_SCROLL_RATIO;
      const step = Math.max(scrollElement.clientHeight * ratio, currentMode === "turbo" ? 900 : 320);
      const requestedTop = Math.max(0, topBefore - step);
      emitProgress(options, currentMode === "recovery" ? "recovering-gap" : "loading-older", messageMap.size, iterations, topStability, currentMode);
      scrollElement.scrollTop = requestedTop;
      dispatchSyntheticScroll(document, scrollElement);

      const waitMs = currentMode === "turbo"
        ? (fastWaitOverride ?? FAST_WAIT_STEPS[Math.min(adaptiveWaitIndex, FAST_WAIT_STEPS.length - 1)])
        : RECOVERY_WAIT_MS;
      await waitForConversationMutation(scrollElement, waitMs, options.signal);
      await delay(settleOverride ?? (currentMode === "turbo" ? FAST_SETTLE_MS : RECOVERY_SETTLE_MS), options.signal);
      assertPageStable();

      const latest = capture();
      const currentBatch: BatchSnapshot = { ids: latest.ids, ordinals: messageOrdinals(latest.ids, messageMap) };
      const continuity = checkBatchContinuity(previousBatch, currentBatch, messageMap);
      const moved = Math.abs(scrollElement.scrollTop - topBefore) > 2;
      const oldestChanged = oldestBefore !== order[0];
      const meaningfulProgress = latest.added > 0 || oldestChanged;

      if (currentMode === "turbo") turboIterations++;
      else recoveryIterations++;

      if (continuity.status === "gap-suspected") {
        if (unresolvedGaps === 0) gapsDetected++;
        unresolvedGaps = Math.max(1, continuity.missingOrdinalRanges.length);
        continuityVerified = false;
        adaptiveWaitIndex = Math.min(adaptiveWaitIndex + 1, FAST_WAIT_STEPS.length - 1);
      } else if (continuity.status === "continuous") {
        if (unresolvedGaps > 0) gapsRecovered += unresolvedGaps;
        unresolvedGaps = 0;
        continuityVerified = true;
        adaptiveWaitIndex = 0;
      } else if (meaningfulProgress) {
        adaptiveWaitIndex = 0;
      } else {
        adaptiveWaitIndex = Math.min(adaptiveWaitIndex + 1, FAST_WAIT_STEPS.length - 1);
      }

      noProgress = meaningfulProgress || moved ? 0 : noProgress + 1;
      previousBatch = currentBatch.ids.length ? currentBatch : previousBatch;

      if (noProgress >= noProgressLimit && scrollElement.scrollTop > 2) {
        partialReason = unresolvedGaps > 0 ? "unresolved-gap" : "no-progress";
        break;
      }
    }

    const messagesBeforeRestore = sortCollectedMessages(order, messageMap);
    verifiedEnd = hasTail(messagesBeforeRestore, initialTailIds);
    const ordinalGaps = allKnownOrdinalGaps(messagesBeforeRestore);
    if (ordinalGaps.length > 0) {
      gapsDetected += ordinalGaps.length;
      unresolvedGaps = Math.max(unresolvedGaps, ordinalGaps.length);
      continuityVerified = false;
      partialReason ??= "unresolved-gap";
    }
    if (!verifiedEnd) partialReason ??= "tail-missing";
  } finally {
    emitProgress(options, "restoring", messageMap.size, iterations, topStability, "verify");
    await restoreScrollPosition(document, scrollElement, restorePoint);
  }

  const messages = sortCollectedMessages(order, messageMap);
  const traversedVirtualizedHistory = initialTop > 2 || turboIterations > 0 || recoveryIterations > 0;
  if (verifiedBeginning && !hasReliableCrossWindowIdentity(messages, traversedVirtualizedHistory)) {
    verifiedBeginning = false;
    continuityVerified = false;
    partialReason = "identity-conflict";
  }

  const canMarkComplete =
    verifiedBeginning
    && verifiedEnd
    && continuityVerified
    && unresolvedGaps === 0
    && !partialReason;

  const completeness: ExtractionCompleteness = canMarkComplete
    ? {
        state: "complete",
        iterations,
        elapsedMs: Math.round(now() - started),
        noProgressPasses: noProgress,
        topStabilityPasses: topStability,
        reachedBeginning: true,
        verifiedBeginning: true,
        verifiedEnd: true,
        continuityVerified: true,
        beginningEvidence,
        turboIterations,
        recoveryIterations,
        gapsDetected,
        gapsRecovered,
        unresolvedGaps: 0,
        uniqueParsedMessages: messageMap.size,
        duplicateCandidatesSkipped: Math.max(0, iterations - messageMap.size),
        oldestMessageId: messages[0]?.id,
        newestMessageId: messages[messages.length - 1]?.id
      }
    : {
        state: "known-partial",
        reason: partialReason ?? (continuityVerified ? "unknown" : "continuity-unverified"),
        iterations,
        elapsedMs: Math.round(now() - started),
        noProgressPasses: noProgress,
        topStabilityPasses: topStability,
        reachedBeginning: verifiedBeginning,
        verifiedBeginning: false,
        verifiedEnd,
        continuityVerified,
        beginningEvidence,
        turboIterations,
        recoveryIterations,
        gapsDetected,
        gapsRecovered,
        unresolvedGaps,
        uniqueParsedMessages: messageMap.size,
        duplicateCandidatesSkipped: 0,
        oldestMessageId: messages[0]?.id,
        newestMessageId: messages[messages.length - 1]?.id
      };

  return finalizeConversation(document, location, messages, completeness, capturedUrl);
}
