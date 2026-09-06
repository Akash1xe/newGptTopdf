import type { ConversationData, ConversationMessage, ConversationStats, ExtractionCompleteness } from "../../types/conversation";
import type { ContentBlock, InlineNode } from "../../types/content";
import { CHATGPT_SELECTORS } from "./chatgptSelectors";
import { conversationIdFromLocation, findConversationScrollElement, findMessageContent, getMessageIdentity, isElementMeaningfullyVisible, normalizeRole } from "./chatgptDomUtils";
import { parseChatGPTMessage } from "./chatgptParser";

function countInline(nodes: InlineNode[]): { mathNodes: number } {
  let mathNodes = 0;
  for (const node of nodes) {
    if (node.type === "math") mathNodes++;
    else if (node.type === "link") mathNodes += countInline(node.children).mathNodes;
  }
  return { mathNodes };
}

function countRichNodes(blocks: ContentBlock[]): { codeBlocks: number; mathNodes: number; images: number } {
  let codeBlocks = 0;
  let mathNodes = 0;
  let images = 0;
  const walk = (items: ContentBlock[]) => {
    for (const block of items) {
      if (block.type === "code") codeBlocks++;
      else if (block.type === "math") mathNodes++;
      else if (block.type === "image") images++;
      else if (block.type === "blockquote") walk(block.blocks);
      else if (block.type === "ordered-list" || block.type === "unordered-list") block.items.forEach((item) => walk(item.blocks));
      else if (block.type === "paragraph" || block.type === "heading") mathNodes += countInline(block.children).mathNodes;
      else if (block.type === "table") block.rows.forEach((row) => row.cells.forEach((cell) => { mathNodes += countInline(cell.children).mathNodes; }));
    }
  };
  walk(blocks);
  return { codeBlocks, mathNodes, images };
}

export function buildConversationStats(messages: ConversationMessage[]): ConversationStats {
  let codeBlocks = 0;
  let mathNodes = 0;
  let images = 0;
  messages.forEach((message) => {
    const counts = countRichNodes(message.blocks);
    codeBlocks += counts.codeBlocks;
    mathNodes += counts.mathNodes;
    images += counts.images;
  });
  return {
    totalMessages: messages.length,
    userMessages: messages.filter((message) => message.role === "user").length,
    assistantMessages: messages.filter((message) => message.role === "assistant").length,
    codeBlocks,
    mathNodes,
    images
  };
}

export function getConversationTitle(document: Document): string {
  const cleaned = document.title.replace(/\s*[|–—-]\s*ChatGPT\s*$/i, "").trim();
  return cleaned && cleaned.toLowerCase() !== "chatgpt" ? cleaned : "ChatGPT Conversation";
}

export function getRoleNodes(document: Document): Element[] {
  const primary = Array.from(document.querySelectorAll(CHATGPT_SELECTORS.roleNodes));
  const nodes = primary.length ? primary : Array.from(document.querySelectorAll(CHATGPT_SELECTORS.fallbackRoleNodes));
  return nodes.filter((node) => {
    try { return isElementMeaningfullyVisible(node); } catch { return node.getAttribute("hidden") === null && node.getAttribute("aria-hidden") !== "true"; }
  });
}

export function extractChatGPTConversation(document: Document, location: Location): ConversationData {
  const nodes = getRoleNodes(document);
  const seen = new Set<string>();
  const messages: ConversationMessage[] = [];

  for (const node of nodes) {
    const role = normalizeRole(node.getAttribute("data-message-author-role") ?? node.getAttribute("data-turn"));
    if (!role) continue;
    const identity = getMessageIdentity(node, role, messages.length);
    const id = identity.id;
    if (seen.has(id)) continue;
    const content = findMessageContent(node, role);
    try {
      const parsed = parseChatGPTMessage(content);
      if (!parsed.plainText && parsed.blocks.length === 0) continue;
      seen.add(id);
      messages.push({ id, role, order: messages.length, sourceOrder: identity.ordinal, identityQuality: identity.quality, plainText: parsed.plainText, blocks: parsed.blocks });
    } catch {
      const fallback = content.textContent?.trim() ?? "";
      if (!fallback) continue;
      seen.add(id);
      messages.push({ id, role, order: messages.length, sourceOrder: identity.ordinal, identityQuality: identity.quality, plainText: fallback, blocks: [{ type: "paragraph", children: [{ type: "text", text: fallback }] }] });
    }
  }

  const shellCount = document.querySelectorAll(CHATGPT_SELECTORS.turnShells).length;
  const scrollElement = findConversationScrollElement(document);
  const possiblyPartial = (shellCount > messages.length && shellCount > 0) || scrollElement.scrollTop > 2;
  const completeness: ExtractionCompleteness = possiblyPartial
    ? { state: "possibly-partial", reason: "virtualized-history", collectedMessages: messages.length }
    : { state: "complete", collectedMessages: messages.length };

  return {
    provider: "chatgpt",
    title: getConversationTitle(document),
    url: location.href,
    capturedUrl: location.href,
    capturedAt: new Date().toISOString(),
    conversationId: conversationIdFromLocation(location),
    messageCount: messages.length,
    possiblyPartial,
    completeness,
    messages,
    stats: buildConversationStats(messages)
  };
}

export function finalizeConversation(
  document: Document,
  location: Location,
  messages: ConversationMessage[],
  completeness: ExtractionCompleteness,
  capturedUrl: string
): ConversationData {
  const ordered = messages.map((message, order) => ({ ...message, order }));
  return {
    provider: "chatgpt",
    title: getConversationTitle(document),
    url: capturedUrl,
    capturedUrl,
    capturedAt: new Date().toISOString(),
    conversationId: conversationIdFromLocation(location),
    messageCount: ordered.length,
    possiblyPartial: completeness.state !== "complete",
    completeness: { ...completeness, collectedMessages: ordered.length },
    messages: ordered,
    stats: buildConversationStats(ordered)
  };
}
