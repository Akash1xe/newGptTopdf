import type { InlineNode, TextNode } from "../types/content";
import type { ParserContext } from "./types";
import { normalizeProseWhitespace, sanitizeHref } from "./sanitization";

interface Marks {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
}

function textNode(text: string, marks: Marks): TextNode {
  return { type: "text", text, ...marks };
}

function nextMarks(element: Element, marks: Marks): Marks {
  const tag = element.tagName.toLowerCase();
  return {
    bold: marks.bold || tag === "strong" || tag === "b" || undefined,
    italic: marks.italic || tag === "em" || tag === "i" || undefined,
    strikethrough: marks.strikethrough || tag === "s" || tag === "del" || tag === "strike" || undefined
  };
}

function parseNode(node: Node, context: ParserContext, marks: Marks): InlineNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = normalizeProseWhitespace(node.textContent ?? "");
    return text ? [textNode(text, marks)] : [];
  }
  if (!(node instanceof Element) || context.shouldIgnoreElement(node)) return [];

  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [{ type: "line-break" }];
  if (context.isMathElement(node)) {
    const math = context.extractMathNode(node);
    return math ? [math] : [];
  }
  if (tag === "code" && !node.closest("pre")) {
    return [{ type: "inline-code", text: node.textContent ?? "" }];
  }
  if (tag === "a") {
    const href = sanitizeHref(node.getAttribute("href"));
    const children = parseInlineChildren(node, context, nextMarks(node, marks));
    return href ? [{ type: "link", href, children }] : children;
  }

  const inherited = nextMarks(node, marks);
  return Array.from(node.childNodes).flatMap((child) => parseNode(child, context, inherited));
}

function sameMarks(a: TextNode, b: TextNode): boolean {
  return a.bold === b.bold && a.italic === b.italic && a.strikethrough === b.strikethrough;
}

export function normalizeInlineNodes(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const node of nodes) {
    if (node.type === "text" && !node.text) continue;
    const prev = out[out.length - 1];
    if (prev?.type === "text" && node.type === "text" && sameMarks(prev, node)) {
      prev.text += node.text;
    } else {
      out.push(node);
    }
  }

  const first = out[0];
  if (first?.type === "text") first.text = first.text.replace(/^ +/, "");
  const last = out[out.length - 1];
  if (last?.type === "text") last.text = last.text.replace(/ +$/, "");
  return out.filter((node) => node.type !== "text" || node.text.length > 0);
}

export function parseInlineChildren(element: Element, context: ParserContext, marks: Marks = {}): InlineNode[] {
  return normalizeInlineNodes(Array.from(element.childNodes).flatMap((child) => parseNode(child, context, marks)));
}

export function inlineNodesToText(nodes: InlineNode[]): string {
  return nodes.map((node) => {
    switch (node.type) {
      case "text": return node.text;
      case "link": return inlineNodesToText(node.children);
      case "inline-code": return node.text;
      case "line-break": return "\n";
      case "math": return node.fallbackText;
    }
  }).join("");
}
