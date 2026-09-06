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

export function getStableMessageId(node: Element, role: "user" | "assistant", fallbackOrder: number): string {
  const shell = node.closest('[data-turn-id], [data-message-id], [data-testid^="conversation-turn"], article[id], section[id]');
  const direct =
    node.getAttribute("data-message-id")
    ?? shell?.getAttribute("data-turn-id")
    ?? shell?.getAttribute("data-message-id")
    ?? shell?.getAttribute("data-testid")
    ?? shell?.id;
  if (direct?.trim()) return direct.trim();

  const normalized = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  return `fallback-${role}-${fnv1a(normalized)}-${fallbackOrder}`;
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

export function findConversationScrollElement(document: Document): HTMLElement {
  const firstRole = document.querySelector(CHATGPT_SELECTORS.roleNodes);
  let current = firstRole?.parentElement ?? null;
  while (current && current !== document.body) {
    const style = getComputedStyle(current);
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 100) return current;
    current = current.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}
