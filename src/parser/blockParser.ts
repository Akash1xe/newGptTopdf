import type { ContentBlock, InlineNode, ListItem, OrderedListBlock, UnorderedListBlock } from "../types/content";
import type { ParserContext } from "./types";
import { parseInlineChildren, inlineNodesToText, normalizeInlineNodes } from "./inlineParser";
import { parseTable } from "./tableParser";

const INLINE_TAGS = new Set(["a", "abbr", "b", "br", "cite", "code", "del", "em", "i", "kbd", "mark", "s", "small", "span", "strong", "sub", "sup", "time", "u"]);

function isInlineLike(node: Node, context: ParserContext): boolean {
  if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
  if (!(node instanceof Element)) return false;
  if (context.isImageElement?.(node)) return false;
  return INLINE_TAGS.has(node.tagName.toLowerCase()) || (context.isMathElement(node) && context.extractMathNode(node)?.displayMode === "inline");
}

function parseList(list: Element, context: ParserContext): OrderedListBlock | UnorderedListBlock {
  const items: ListItem[] = Array.from(list.children)
    .filter((child) => child.tagName.toLowerCase() === "li")
    .map((li) => ({ blocks: parseBlocks(li, context) }));
  if (list.tagName.toLowerCase() === "ol") {
    return { type: "ordered-list", start: Number(list.getAttribute("start") ?? 1) || 1, items };
  }
  return { type: "unordered-list", items };
}

function elementToBlock(element: Element, context: ParserContext): ContentBlock[] | null {
  if (context.shouldIgnoreElement(element)) return [];
  if (context.isCodeBlock(element)) {
    const block = context.extractCodeBlock(element);
    return block ? [block] : [];
  }
  if (context.isMathElement(element)) {
    const math = context.extractMathNode(element);
    if (math?.displayMode === "block") return [math];
  }
  if (context.isImageElement?.(element)) {
    const image = context.extractImageBlock?.(element);
    return image ? [image] : [];
  }

  const tag = element.tagName.toLowerCase();
  if (tag === "p") return [{ type: "paragraph", children: parseInlineChildren(element, context) }];
  if (/^h[1-6]$/.test(tag)) {
    return [{ type: "heading", level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6, children: parseInlineChildren(element, context) }];
  }
  if (tag === "ol" || tag === "ul") return [parseList(element, context)];
  if (tag === "blockquote") return [{ type: "blockquote", blocks: parseBlocks(element, context) }];
  if (tag === "table") return [parseTable(element, context)];
  if (tag === "hr") return [{ type: "horizontal-rule" }];
  if (tag === "pre") {
    const block = context.extractCodeBlock(element);
    return block ? [block] : [];
  }
  return null;
}

export function parseBlocks(root: Element, context: ParserContext): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let inlineBuffer: InlineNode[] = [];

  const flushInline = () => {
    const children = normalizeInlineNodes(inlineBuffer);
    if (inlineNodesToText(children).trim() || children.some((node) => node.type === "math" || node.type === "inline-code")) {
      blocks.push({ type: "paragraph", children });
    }
    inlineBuffer = [];
  };

  for (const child of Array.from(root.childNodes)) {
    if (isInlineLike(child, context)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const wrapper = root.ownerDocument.createElement("span");
        wrapper.textContent = child.textContent;
        inlineBuffer.push(...parseInlineChildren(wrapper, context));
      } else if (child instanceof Element) {
        const wrapper = root.ownerDocument.createElement("span");
        wrapper.append(child.cloneNode(true));
        inlineBuffer.push(...parseInlineChildren(wrapper, context));
      }
      continue;
    }

    if (!(child instanceof Element)) continue;
    flushInline();
    try {
      const direct = elementToBlock(child, context);
      if (direct !== null) blocks.push(...direct);
      else blocks.push(...parseBlocks(child, context));
    } catch {
      const fallback = child.textContent?.trim();
      if (fallback) blocks.push({ type: "paragraph", children: [{ type: "text", text: fallback }] });
    }
  }
  flushInline();
  return blocks.filter((block) => block.type !== "paragraph" || block.children.length > 0);
}

export function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "paragraph":
      case "heading": return inlineNodesToText(block.children);
      case "ordered-list":
      case "unordered-list": return block.items.map((item) => blocksToPlainText(item.blocks)).join("\n");
      case "blockquote": return blocksToPlainText(block.blocks);
      case "table": return block.rows.map((row) => row.cells.map((cell) => inlineNodesToText(cell.children)).join("\t")).join("\n");
      case "horizontal-rule": return "---";
      case "code": return block.code;
      case "math": return block.fallbackText;
      case "image": return block.alt ? `[Image: ${block.alt}]` : "[Image]";
    }
  }).filter(Boolean).join("\n\n").trim();
}
