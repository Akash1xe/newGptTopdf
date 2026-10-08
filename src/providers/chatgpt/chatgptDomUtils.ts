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

/**
 * Resolve a role from every semantic contract ChatGPT currently uses.
 * Do not infer roles from text/classes: those are localization/A-B-test fragile.
 */
export function getMessageRole(element: Element): "user" | "assistant" | null {
  for (const attribute of ["data-message-author-role", "data-conversation-role", "data-role", "data-message-author", "data-turn"]) {
    const role = normalizeRole(element.getAttribute(attribute));
    if (role) return role;
  }
  if (element.hasAttribute("data-user-message-bubble")) return "user";
  return null;
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
  const shell = node.closest('[data-turn-key], [data-turn-id], [data-message-id], [data-message-uuid], [data-testid^="conversation-turn"], article[id], section[id]');
  const testId = node.getAttribute("data-testid") ?? shell?.getAttribute("data-testid");
  const ordinal = parseTurnOrdinal(testId);

  // Prefer a true per-message identifier when available.
  const messageId =
    node.getAttribute("data-message-id")
    ?? node.getAttribute("data-message-uuid")
    ?? shell?.getAttribute("data-message-id")
    ?? shell?.getAttribute("data-message-uuid");
  if (messageId?.trim()) return { id: messageId.trim(), quality: "strong", ordinal };

  // The current grouped renderer places the user prompt and assistant answer
  // under one data-turn-key. Scope that shared key by role so the two messages
  // never collapse into one deduplicated entry.
  const turnKey = node.getAttribute("data-turn-key") ?? shell?.getAttribute("data-turn-key");
  if (turnKey?.trim()) return { id: `group:${role}:${turnKey.trim()}`, quality: "strong", ordinal };

  const direct =
    shell?.getAttribute("data-turn-id")
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
  if (role === "user") {
    if (roleNode.hasAttribute("data-user-message-bubble")) return roleNode.querySelector('.whitespace-pre-wrap, [data-message-content]') ?? roleNode;
    return roleNode.querySelector(CHATGPT_SELECTORS.userContent) ?? roleNode;
  }

  // In the current ChatGPT renderer, data-conversation-role="assistant"
  // can be a small accessible label ("ChatGPT said:") while the real response
  // is rendered as its sibling inside the same turn shell. Search both the role
  // marker and its turn shell, then select the richest assistant content node.
  const shell = roleNode.closest(CHATGPT_SELECTORS.turnShells);
  const candidates = [
    ...Array.from(roleNode.querySelectorAll(CHATGPT_SELECTORS.assistantContent)),
    ...(shell && shell !== roleNode ? Array.from(shell.querySelectorAll(CHATGPT_SELECTORS.assistantContent)) : [])
  ].filter((candidate, index, all) =>
    all.indexOf(candidate) === index
    && !candidate.closest("[data-user-message-bubble]")
  );

  let best: Element | undefined;
  let bestLength = -1;
  for (const candidate of candidates) {
    const length = (candidate.textContent ?? "").replace(/\s+/g, " ").trim().length;
    if (length <= bestLength) continue;
    best = candidate;
    bestLength = length;
  }
  return best ?? roleNode;
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

function hasResponsiveScrollTop(element: HTMLElement): boolean {
  const range = Math.max(0, element.scrollHeight - element.clientHeight);
  if (range <= 0) return false;

  const original = element.scrollTop;
  element.scrollTop = original < range ? Math.min(range, original + 1) : Math.max(0, original - 1);
  let moved = Math.abs(element.scrollTop - original) > 0.5;
  if (!moved) {
    // A column-reverse scroller uses 0 at the visual bottom and negative
    // scrollTop values while moving toward older content.
    element.scrollTop = original > -range ? Math.max(-range, original - 1) : Math.min(0, original + 1);
    moved = Math.abs(element.scrollTop - original) > 0.5;
  }
  element.scrollTop = original;
  return moved;
}

function isUsefulScrollCandidate(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  const scrollableOverflow = /(auto|scroll)/.test(style.overflowY);
  const hasRange = element.scrollHeight > element.clientHeight + 120;
  const usefulViewport = element.clientHeight >= Math.min(280, Math.max(120, window.innerHeight * 0.25));
  // Some current ChatGPT renderers keep the actual conversation viewport
  // programmatically scrollable while reporting overflow-y as hidden/clip.
  // Verify that scrollTop really responds instead of relying only on CSS.
  return hasRange && usefulViewport && (scrollableOverflow || hasResponsiveScrollTop(element));
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
