import type { MessageIdentityQuality } from "../../types/conversation";
import { CHATGPT_SELECTORS } from "./chatgptSelectors";

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function shouldIgnoreChatGPTElement(element: Element): boolean {
  if (element.matches(CHATGPT_SELECTORS.ignored)) return true;
  if (element.getAttribute("hidden") !== null) return true;
  if (element.getAttribute("aria-hidden") === "true" && !element.matches('.katex, .katex *, math, math *')) return true;
  const testId = element.getAttribute("data-testid")?.toLowerCase() ?? "";
  if (["copy", "feedback", "regenerate", "share", "read-aloud"].some((token) => testId.includes(token))) return true;
  return false;
}

export function normalizeRole(value: string | null): "user" | "assistant" | null {
  return value === "user" || value === "assistant" ? value : null;
}

export interface MessageIdentity {
  id: string;
  quality: MessageIdentityQuality;
  ordinal?: number;
}

function parseTurnOrdinal(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/conversation-turn[-_:]?(\d+)/i);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function getMessageIdentity(node: Element, role: "user" | "assistant", fallbackOrder: number): MessageIdentity {
  const shell = node.closest('[data-turn-id], [data-message-id], [data-testid^="conversation-turn"], article[id], section[id]');
  const testId = node.getAttribute("data-testid") ?? shell?.getAttribute("data-testid");
  const ordinal = parseTurnOrdinal(testId);
  const direct =
    node.getAttribute("data-message-id")
    ?? shell?.getAttribute("data-turn-id")
    ?? shell?.getAttribute("data-message-id")
    ?? testId
    ?? shell?.id;

  if (direct?.trim()) return { id: direct.trim(), quality: "strong", ordinal };

  // Last-resort identity. It intentionally includes position so identical text
  // in one mounted snapshot remains distinct. The full collector treats this
  // identity as contextual and will not claim verified completeness after a
  // virtualized multi-pass traversal that depends on these fallback IDs.
  const normalized = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  return {
    id: `fallback-${role}-${fnv1a(normalized)}-${fallbackOrder}`,
    quality: "contextual"
  };
}

export function getStableMessageId(node: Element, role: "user" | "assistant", fallbackOrder: number): string {
  return getMessageIdentity(node, role, fallbackOrder).id;
}

export function findMessageContent(roleNode: Element, role: "user" | "assistant"): Element {
  if (role === "user") return roleNode.querySelector(CHATGPT_SELECTORS.userContent) ?? roleNode;
  return roleNode.querySelector(CHATGPT_SELECTORS.assistantContent) ?? roleNode;
}

export function isElementMeaningfullyVisible(element: Element): boolean {
  if (element.getAttribute("hidden") !== null || element.getAttribute("aria-hidden") === "true") return false;
  const style = getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return true;
}

export function isConversationStreaming(document: Document): boolean {
  return Array.from(document.querySelectorAll(CHATGPT_SELECTORS.streaming)).some(isElementMeaningfullyVisible);
}

export function conversationIdFromLocation(location: Location): string | undefined {
  const match = location.pathname.match(/\/c\/([^/?#]+)/);
  return match?.[1];
}

export function conversationIdentityFromLocation(location: Location): string {
  return conversationIdFromLocation(location) ?? `${location.hostname}${location.pathname}${location.search}`;
}

function isUsefulScrollCandidate(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  const scrollableOverflow = /(auto|scroll)/.test(style.overflowY);
  const hasRange = element.scrollHeight > element.clientHeight + 120;
  const usefulViewport = element.clientHeight >= Math.min(280, Math.max(120, window.innerHeight * 0.25));
  return scrollableOverflow && hasRange && usefulViewport;
}

export function findConversationScrollElement(document: Document): HTMLElement {
  const roles = Array.from(document.querySelectorAll(CHATGPT_SELECTORS.roleNodes));
  const fallbackRoles = roles.length ? roles : Array.from(document.querySelectorAll(CHATGPT_SELECTORS.fallbackRoleNodes));
  const anchor = fallbackRoles[Math.floor(fallbackRoles.length / 2)] ?? document.querySelector("main");
  let current = anchor?.parentElement ?? null;
  let broadCandidate: HTMLElement | null = null;

  while (current && current !== document.body) {
    if (isUsefulScrollCandidate(current)) {
      if (current.clientWidth >= Math.min(520, window.innerWidth * 0.55)) return current;
      broadCandidate ??= current;
    }
    current = current.parentElement;
  }

  if (broadCandidate) return broadCandidate;
  const scrolling = document.scrollingElement as HTMLElement | null;
  return scrolling ?? document.documentElement;
}

export function dispatchSyntheticScroll(document: Document, element: HTMLElement): void {
  const EventCtor = document.defaultView?.Event ?? Event;
  element.dispatchEvent(new EventCtor("scroll", { bubbles: true }));
}
