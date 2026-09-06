import type { BeginningEvidence, ConversationData, ConversationMessage, ExtractionCompleteness } from "../../types/conversation";
import type { ExtractionProgressData, ExtractionProgressPhase } from "../../types/messages";
import { finalizeConversation, getRoleNodes } from "./chatgptExtractor";
import { parseChatGPTMessage } from "./chatgptParser";
import { CHATGPT_SELECTORS } from "./chatgptSelectors";
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
  skipped: number;
  snapshot: BatchSnapshot;
  oldestId?: string;
  newestId?: string;
}

export interface BatchSnapshot {
  ids: string[];
  ordinals: number[];
  allOrdinalsReliable: boolean;
}

export interface ContinuityCheck {
  status: "continuous" | "gap-suspected" | "unknown";
  overlapCount: number;
  missingOrdinalRanges: Array<{ from: number; to: number }>;
}

type CollectorMode = "turbo" | "recovery" | "verify";

const DEFAULT_MAX_DURATION_MS = 180_000;
const DEFAULT_NO_PROGRESS_LIMIT = 6;
const DEFAULT_TOP_STABILITY_PASSES = 3;
const TAIL_STABILITY_PASSES = 2;
const FAST_SCROLL_RATIO = 3;
const RECOVERY_SCROLL_RATIO = 0.85;
const FAST_WAIT_STEPS = [220, 380, 650, 1_000] as const;
const FAST_SETTLE_MS = 60;
const RECOVERY_WAIT_MS = 700;
const RECOVERY_SETTLE_MS = 100;
const TAIL_VERIFY_WAIT_MS = 250;
const TOP_EXPLICIT_WAIT_MS = 250;
const TOP_WAIT_STEPS = [650, 1_000, 1_500] as const;
const TOP_SETTLE_MS = 80;
const TOP_TOLERANCE_PX = 2;
const BOTTOM_TOLERANCE_PX = 3;
const TURN_MUTATION_SELECTOR = [
  CHATGPT_SELECTORS.roleNodes,
  CHATGPT_SELECTORS.fallbackRoleNodes,
  CHATGPT_SELECTORS.turnShells,
  "[data-message-id]",
  "[data-turn-id]"
].join(",");

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

function nodeTouchesConversationTurn(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;
  return element.matches(TURN_MUTATION_SELECTOR)
    || Boolean(element.querySelector(TURN_MUTATION_SELECTOR))
    || Boolean(element.closest(TURN_MUTATION_SELECTOR));
}

function mutationTouchesConversationTurn(mutation: MutationRecord): boolean {
  if (mutation.type === "attributes") return nodeTouchesConversationTurn(mutation.target);
  if (mutation.type !== "childList") return false;
  return [...mutation.addedNodes, ...mutation.removedNodes].some(nodeTouchesConversationTurn);
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
      if (mutations.some(mutationTouchesConversationTurn)) finish("mutation");
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
  const progress: ExtractionProgressData = { phase, messageCount, iteration, topStabilityPasses };
  if (mode) progress.mode = mode;
  options.onProgress?.(progress);
}

function viewportTop(document: Document, scrollElement: HTMLElement): number {
  if (scrollElement === document.scrollingElement || scrollElement === document.documentElement || scrollElement === document.body) return 0;
  return scrollElement.getBoundingClientRect().top;
}

function distanceFromBottom(scrollElement: HTMLElement): number {
  return Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop);
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
    await waitForConversationMutation(scrollElement, 240);
    await delay(40);
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

  const currentSet = new Set(current);
  const overlapIndex = snapshotIds.findIndex((id) => currentSet.has(id));
  if (overlapIndex < 0) return [...snapshotIds.filter((id) => !currentSet.has(id)), ...current];

  const overlapId = snapshotIds[overlapIndex];
  const next = [...current];
  const overlapCurrentIndex = next.indexOf(overlapId);
  const before = snapshotIds.slice(0, overlapIndex).filter((id) => !currentSet.has(id));
  next.splice(overlapCurrentIndex, 0, ...before);

  const nextSet = new Set(next);
  let cursor = next.indexOf(overlapId) + 1;
  for (const id of snapshotIds.slice(overlapIndex + 1)) {
    if (nextSet.has(id)) {
      const existingIndex = next.indexOf(id);
      if (existingIndex >= cursor) cursor = existingIndex + 1;
      continue;
    }
    next.splice(cursor, 0, id);
    nextSet.add(id);
    cursor++;
  }
  return next;
}

export function nextTopStabilityPasses(
  current: number,
  observation: {
    atTop: boolean;
    added: number;
    oldestBefore?: string;
    oldestAfter?: string;
    heightBefore?: number;
    heightAfter?: number;
  }
): number {
  if (!observation.atTop) return 0;
  if (observation.added > 0) return 0;
  if (observation.oldestBefore !== observation.oldestAfter) return 0;
  if (observation.heightBefore != null && observation.heightAfter != null && Math.abs(observation.heightAfter - observation.heightBefore) > 2) return 0;
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
  let added = 0;
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
    added++;
  }

  const order = mergeCollectedOrder(currentOrder, ids.filter((id) => collectedIds.has(id)));
  const ordinals = candidates
    .map((candidate) => candidate.sourceOrder)
    .filter((value): value is number => Number.isSafeInteger(value));

  return {
    result: {
      added,
      skipped,
      snapshot: {
        ids,
        ordinals,
        allOrdinalsReliable: candidates.length > 0 && ordinals.length === candidates.length
      },
      oldestId: order[0],
      newestId: order[order.length - 1]
    },
    order
  };
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

export function checkBatchContinuity(previous: BatchSnapshot | undefined, current: BatchSnapshot): ContinuityCheck {
  if (!previous || !previous.ids.length || !current.ids.length) {
    return { status: "unknown", overlapCount: 0, missingOrdinalRanges: [] };
  }

  const previousIds = new Set(previous.ids);
  const overlapCount = current.ids.reduce((count, id) => count + (previousIds.has(id) ? 1 : 0), 0);
  if (overlapCount > 0) return { status: "continuous", overlapCount, missingOrdinalRanges: [] };

  if (previous.allOrdinalsReliable && current.allOrdinalsReliable && previous.ordinals.length && current.ordinals.length) {
    const previousMin = Math.min(...previous.ordinals);
    const currentMax = Math.max(...current.ordinals);
    if (currentMax >= previousMin - 1) {
      return { status: "continuous", overlapCount: 0, missingOrdinalRanges: [] };
    }
    return {
      status: "gap-suspected",
      overlapCount: 0,
      missingOrdinalRanges: [{ from: currentMax + 1, to: previousMin - 1 }]
    };
  }

  return { status: "gap-suspected", overlapCount: 0, missingOrdinalRanges: [] };
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
  if (messages.length > 0 && messages.every((message) => Number.isSafeInteger(message.sourceOrder))) {
    return [...messages].sort((a, b) => (a.sourceOrder as number) - (b.sourceOrder as number));
  }
  return messages;
}

function hasTail(messages: ConversationMessage[], tailIds: Set<string>): boolean {
  if (!tailIds.size) return false;
  const ids = new Set(messages.map((message) => message.id));
  for (const id of tailIds) if (!ids.has(id)) return false;
  return true;
}

function ordinalGapsWhenReliable(messages: ConversationMessage[]): Array<{ from: number; to: number }> {
  if (!messages.length || !messages.every((message) => Number.isSafeInteger(message.sourceOrder))) return [];
  return detectOrdinalGaps(messages.map((message) => message.sourceOrder as number));
}

function canUseMountedFastPath(messages: ConversationMessage[], verifiedEnd: boolean): boolean {
  if (!verifiedEnd || !messages.length) return false;
  if (!messages.every((message) => message.identityQuality === "strong" && Number.isSafeInteger(message.sourceOrder))) return false;
  const ordinals = messages.map((message) => message.sourceOrder as number);
  return Math.min(...ordinals) === 0 && detectOrdinalGaps(ordinals).length === 0;
}

async function rollbackAfterTurboGap(
  document: Document,
  scrollElement: HTMLElement,
  safeTop: number,
  waitMs: number,
  settleMs: number,
  signal?: AbortSignal
): Promise<void> {
  const range = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
  scrollElement.scrollTop = Math.min(Math.max(0, safeTop), range);
  dispatchSyntheticScroll(document, scrollElement);
  await waitForConversationMutation(scrollElement, waitMs, signal);
  await delay(settleMs, signal);
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
  const waitOverride = options.mutationWaitMs;
  const settleOverride = options.settleMs;
  const capturedUrl = location.href;
  const capturedIdentity = conversationIdentityFromLocation(location);
  const scrollElement = findConversationScrollElement(document);
  if (!scrollElement.isConnected) {
    throw new ConversationCollectionError("SCROLL_CONTAINER_LOST", "The ChatGPT conversation viewport could not be found.");
  }

  const restorePoint = captureScrollRestorePoint(document, scrollElement);
  const messageMap = new Map<string, ConversationMessage>();
  const collectedIds = new Set<string>();
  let order: string[] = [];
  let noProgress = 0;
  let iterations = 0;
  let turboIterations = 0;
  let recoveryIterations = 0;
  let duplicateCandidatesSkipped = 0;
  let verifiedBeginning = false;
  let verifiedEnd = false;
  let continuityVerified = true;
  let topStability = 0;
  let tailStability = 0;
  let gapsDetected = 0;
  let gapsRecovered = 0;
  let unresolvedGaps = 0;
  let partialReason: ExtractionCompleteness["reason"] | undefined;
  let beginningEvidence: BeginningEvidence | undefined;
  let adaptiveWaitIndex = 0;
  let previousBatch: BatchSnapshot | undefined;
  let recoveryTarget: BatchSnapshot | undefined;
  let mode: CollectorMode = "turbo";
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

  const checkSafetyBudget = () => {
    if (now() - started >= maxDurationMs) {
      partialReason = "timeout";
      return false;
    }
    if (options.maxIterations != null && iterations >= options.maxIterations) {
      partialReason = "load-limit";
      return false;
    }
    return true;
  };

  const capture = (): CaptureResult => {
    const captured = captureUnseenMessages(document, messageMap, collectedIds, order);
    order = captured.order;
    duplicateCandidatesSkipped += captured.result.skipped;
    return captured.result;
  };

  let tailIds = new Set<string>();

  try {
    let latest = capture();
    emitProgress(options, "capturing", messageMap.size, iterations, topStability, "turbo");

    // First verify the current conversation tail. If the user opened the popup
    // from the middle of a chat, quickly move to the bottom and capture newer
    // virtualized turns before traversing history upward.
    let newestBefore = latest.newestId;
    while (tailStability < TAIL_STABILITY_PASSES) {
      assertPageStable();
      if (!checkSafetyBudget()) break;
      iterations++;
      const atBottomBefore = distanceFromBottom(scrollElement) <= BOTTOM_TOLERANCE_PX;
      if (!atBottomBefore) {
        scrollElement.scrollTop = Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight);
        dispatchSyntheticScroll(document, scrollElement);
      }
      await waitForConversationMutation(scrollElement, waitOverride ?? TAIL_VERIFY_WAIT_MS, options.signal);
      await delay(settleOverride ?? FAST_SETTLE_MS, options.signal);
      assertPageStable();
      latest = capture();
      const atBottomAfter = distanceFromBottom(scrollElement) <= BOTTOM_TOLERANCE_PX;
      if (atBottomAfter && latest.added === 0 && latest.newestId === newestBefore) tailStability++;
      else tailStability = 0;
      newestBefore = latest.newestId;
      emitProgress(options, "capturing", messageMap.size, iterations, topStability, "turbo");
    }

    tailIds = new Set(latest.snapshot.ids.filter((id) => collectedIds.has(id)));
    verifiedEnd = tailStability >= TAIL_STABILITY_PASSES && tailIds.size > 0;
    previousBatch = latest.snapshot;

    if (!partialReason) {
      const mountedMessages = sortCollectedMessages(order, messageMap);
      if (canUseMountedFastPath(mountedMessages, verifiedEnd)) {
        verifiedBeginning = true;
        beginningEvidence = "turn-ordinal";
        continuityVerified = true;
      }
    }

    while (!verifiedBeginning && !partialReason) {
      assertPageStable();
      if (!checkSafetyBudget()) break;
      iterations++;

      const topBefore = scrollElement.scrollTop;
      const oldestBefore = order[0];
      const heightBefore = scrollElement.scrollHeight;

      if (topBefore <= TOP_TOLERANCE_PX) {
        if (recoveryTarget) {
          partialReason = "unresolved-gap";
          continuityVerified = false;
          unresolvedGaps = Math.max(1, unresolvedGaps);
          break;
        }

        mode = "verify";
        const explicit = explicitBeginningEvidence(sortCollectedMessages(order, messageMap));
        const topWait = waitOverride ?? (explicit
          ? TOP_EXPLICIT_WAIT_MS
          : TOP_WAIT_STEPS[Math.min(topStability, TOP_WAIT_STEPS.length - 1)]);
        emitProgress(options, "verifying-start", messageMap.size, iterations, topStability, mode);
        await waitForConversationMutation(scrollElement, topWait, options.signal);
        await delay(settleOverride ?? TOP_SETTLE_MS, options.signal);
        assertPageStable();
        latest = capture();
        topStability = nextTopStabilityPasses(topStability, {
          atTop: scrollElement.scrollTop <= TOP_TOLERANCE_PX,
          added: latest.added,
          oldestBefore,
          oldestAfter: order[0],
          heightBefore,
          heightAfter: scrollElement.scrollHeight
        });
        if (latest.added > 0) noProgress = 0;
        beginningEvidence = explicitBeginningEvidence(sortCollectedMessages(order, messageMap)) ?? beginningEvidence;
        emitProgress(options, "verifying-start", messageMap.size, iterations, topStability, mode);
        if (isVerifiedBeginning(topStability, requiredTopStabilityPasses)) {
          verifiedBeginning = true;
          beginningEvidence ??= "stable-top";
        }
        continue;
      }

      mode = recoveryTarget ? "recovery" : "turbo";
      topStability = 0;
      const ratio = mode === "turbo" ? FAST_SCROLL_RATIO : RECOVERY_SCROLL_RATIO;
      const step = Math.max(scrollElement.clientHeight * ratio, mode === "turbo" ? 900 : 320);
      const requestedTop = Math.max(0, topBefore - step);
      const safeBatch: BatchSnapshot | undefined = previousBatch;

      emitProgress(options, mode === "recovery" ? "recovering-gap" : "loading-older", messageMap.size, iterations, topStability, mode);
      scrollElement.scrollTop = requestedTop;
      dispatchSyntheticScroll(document, scrollElement);

      const waitMs = mode === "turbo"
        ? (waitOverride ?? FAST_WAIT_STEPS[Math.min(adaptiveWaitIndex, FAST_WAIT_STEPS.length - 1)])
        : (waitOverride ?? RECOVERY_WAIT_MS);
      await waitForConversationMutation(scrollElement, waitMs, options.signal);
      await delay(settleOverride ?? (mode === "turbo" ? FAST_SETTLE_MS : RECOVERY_SETTLE_MS), options.signal);
      assertPageStable();
      latest = capture();
      const currentBatch = latest.snapshot;
      const continuity = checkBatchContinuity(previousBatch, currentBatch);
      const moved = Math.abs(scrollElement.scrollTop - topBefore) > TOP_TOLERANCE_PX;
      const oldestChanged = oldestBefore !== order[0];
      const meaningfulProgress = latest.added > 0 || oldestChanged;

      if (mode === "turbo") turboIterations++;
      else recoveryIterations++;

      if (mode === "turbo" && continuity.status === "gap-suspected") {
        gapsDetected++;
        unresolvedGaps = Math.max(1, continuity.missingOrdinalRanges.length);
        continuityVerified = false;
        recoveryTarget = currentBatch;
        previousBatch = safeBatch;
        adaptiveWaitIndex = Math.min(adaptiveWaitIndex + 1, FAST_WAIT_STEPS.length - 1);
        await rollbackAfterTurboGap(
          document,
          scrollElement,
          topBefore,
          waitOverride ?? RECOVERY_WAIT_MS,
          settleOverride ?? RECOVERY_SETTLE_MS,
          options.signal
        );
        assertPageStable();
        capture();
        continue;
      }

      if (mode === "recovery") {
        if (continuity.status === "continuous") {
          previousBatch = currentBatch;
          noProgress = 0;
          const bridge = recoveryTarget ? checkBatchContinuity(currentBatch, recoveryTarget) : undefined;
          if (bridge?.status === "continuous") {
            gapsRecovered++;
            unresolvedGaps = 0;
            continuityVerified = true;
            recoveryTarget = undefined;
            adaptiveWaitIndex = 0;
          }
        } else {
          noProgress = meaningfulProgress ? 0 : noProgress + 1;
        }
      } else {
        if (continuity.status === "continuous") {
          previousBatch = currentBatch;
          adaptiveWaitIndex = 0;
        } else if (continuity.status === "unknown" && meaningfulProgress) {
          previousBatch = currentBatch;
          adaptiveWaitIndex = 0;
        } else {
          adaptiveWaitIndex = Math.min(adaptiveWaitIndex + 1, FAST_WAIT_STEPS.length - 1);
        }
        noProgress = meaningfulProgress || moved ? 0 : noProgress + 1;
      }

      if (noProgress >= noProgressLimit && scrollElement.scrollTop > TOP_TOLERANCE_PX) {
        partialReason = recoveryTarget ? "unresolved-gap" : "no-progress";
        if (recoveryTarget) {
          continuityVerified = false;
          unresolvedGaps = Math.max(1, unresolvedGaps);
        }
      }
    }

    const messagesBeforeRestore = sortCollectedMessages(order, messageMap);
    verifiedEnd = verifiedEnd && hasTail(messagesBeforeRestore, tailIds);
    const ordinalGaps = ordinalGapsWhenReliable(messagesBeforeRestore);
    if (ordinalGaps.length > 0) {
      gapsDetected += ordinalGaps.length;
      unresolvedGaps = Math.max(unresolvedGaps, ordinalGaps.length);
      continuityVerified = false;
      partialReason ??= "unresolved-gap";
    }
    if (!verifiedEnd) partialReason ??= "tail-missing";
    if (recoveryTarget) {
      continuityVerified = false;
      unresolvedGaps = Math.max(1, unresolvedGaps);
      partialReason ??= "unresolved-gap";
    }
  } finally {
    emitProgress(options, "restoring", messageMap.size, iterations, topStability, "verify");
    await restoreScrollPosition(document, scrollElement, restorePoint);
  }

  const messages = sortCollectedMessages(order, messageMap);
  const traversedVirtualizedHistory = turboIterations > 0 || recoveryIterations > 0;
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

  const commonDiagnostics = {
    iterations,
    elapsedMs: Math.round(now() - started),
    noProgressPasses: noProgress,
    topStabilityPasses: topStability,
    tailStabilityPasses: tailStability,
    turboIterations,
    recoveryIterations,
    gapsDetected,
    gapsRecovered,
    unresolvedGaps,
    uniqueParsedMessages: messageMap.size,
    duplicateCandidatesSkipped,
    oldestMessageId: messages[0]?.id,
    newestMessageId: messages[messages.length - 1]?.id
  };

  const completeness: ExtractionCompleteness = canMarkComplete
    ? {
        state: "complete",
        ...commonDiagnostics,
        reachedBeginning: true,
        verifiedBeginning: true,
        verifiedEnd: true,
        continuityVerified: true,
        beginningEvidence,
        unresolvedGaps: 0
      }
    : {
        state: "known-partial",
        ...commonDiagnostics,
        reason: partialReason ?? (continuityVerified ? "unknown" : "continuity-unverified"),
        reachedBeginning: verifiedBeginning,
        verifiedBeginning: false,
        verifiedEnd,
        continuityVerified,
        beginningEvidence
      };

  return finalizeConversation(document, location, messages, completeness, capturedUrl);
}
