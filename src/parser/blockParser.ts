import type { ContentBlock, InlineNode, ListItem, OrderedListBlock, UnorderedListBlock } from "../types/content";
import type { ParserContext } from "./types";
import { parseInlineChildren, parseNode, inlineNodesToText, normalizeInlineNodes } from "./inlineParser";
import { parseTable } from "./tableParser";
import { controlText } from "./controlText";
import { layoutInfo, visualControl } from './visualLayout';

const INLINE_TAGS = new Set(["a", "abbr", "b", "br", "cite", "code", "del", "em", "i", "kbd", "mark", "s", "small", "span", "strong", "sub", "sup", "time", "u"]);

function isInlineLike(node: Node, context: ParserContext): boolean {
  if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent?.trim());
  if (!(node instanceof Element)) return false;
  if (visualControl(node)) return false;
  // A tiny external-link glyph must not turn a link into separate paragraphs.
  if (node.matches('a') && node.textContent?.trim() && !node.querySelector('img,canvas') && Array.from(node.querySelectorAll('svg')).every(svg => Math.max(svg.clientWidth || Number(svg.getAttribute('width')), svg.clientHeight || Number(svg.getAttribute('height'))) <= 24)) return true;
  if (context.isCodeBlock(node)) return false;
  if (context.isImageElement?.(node)) return false;
  if (node.querySelector('img,svg,canvas,input,textarea,select,progress,code[class*="language-"],[role="checkbox"],[role="radio"],[role="slider"],[role="progressbar"]')) return false;

  // Math semantics take precedence over the HTML tag name. KaTeX display math
  // commonly uses a <span class="katex-display"> wrapper. Treating every
  // <span> as inline first would place a block MathNode inside a paragraph,
  // producing invalid print structure and fragile pagination.
  if (context.isMathElement(node)) return context.extractMathNode(node)?.displayMode === "inline";
  return INLINE_TAGS.has(node.tagName.toLowerCase());
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
  if (element.tagName.toLowerCase() === "iframe" && !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true') {
    return [{ type: "paragraph", children: [{ type: "text", text: `[Embedded content: ${element.getAttribute("title") || "not accessible for export"}]` }] }];
  }
  if (context.shouldIgnoreElement(element)) return [];
  if (element.tagName === 'LABEL') {
    const choices = element.querySelectorAll('input[type="radio"],input[type="checkbox"],[role="radio"],[role="checkbox"]');
    if (choices.length === 1) {
      const choice = visualControl(choices[0]);
      if (choice) return [{ ...choice, text: `${choice.checked ? '[x]' : '[ ]'} ${element.textContent?.trim() || choice.text.replace(/^\[[ x]\]\s*/, '')}` }];
    }
  }
  // Code shells often include a tall UI header. Export their semantic pre once.
  if (element.matches('div,section') && element.querySelectorAll('pre').length === 1) {
    const pre = element.querySelector('pre')!;
    const copy = element.cloneNode(true) as Element;
    copy.querySelectorAll('pre,button,[role="button"]').forEach(node => node.remove());
    const label = copy.textContent?.trim() || '';
    if (!label || /^(javascript|typescript|python|c\+\+|cpp|c#|csharp|java|html|xml|css|json|csv|http|diff|plain text|text|sql|bash|shell|go|rust|markdown)$/i.test(label)) {
      const code = context.extractCodeBlock(pre);
      if (code) return [code];
    }
  }
  const visual = visualControl(element);
  if (visual) return [visual];
  const control = controlText(element);
  if (control !== undefined) return [{ type: "paragraph", children: [{ type: "text", text: control }] }];
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
  const layout = layoutInfo(element);
  if (layout) {
    const blocks = layout.columns > 1 ? Array.from(element.children)
      .filter(child => !context.shouldIgnoreElement(child))
      .map(child => ({ type: 'layout' as const, columns: 1, card: false, blocks: elementToBlock(child, context) ?? parseBlocks(child, context) }))
      .filter(child => child.blocks.length > 0)
      : parseBlocks(element, context);
    if (!blocks.length) {
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const width = rect.width || parseFloat(style?.width || '');
      const height = rect.height || parseFloat(style?.height || '');
      // Preserve small color-legend swatches, not empty toolbar backgrounds.
      if (layout.sourceBackground && width > 0 && height > 0 && width <= 24 && height <= 24) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="${Math.min(width,height)/2}" style="fill:${layout.sourceBackground}"/></svg>`;
        return [{type:'image',mediaKind:'svg',sourceType:'data',width,height,alt:'Legend color',src:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}];
      }
      return [];
    }
    return [{ type: 'layout', ...layout, blocks }];
  }
  if (tag === "p" && !element.querySelector('img,svg,canvas,input,progress,[role="slider"],[role="progressbar"],code[class*="language-"],code[data-language]')) return [{ type: "paragraph", children: parseInlineChildren(element, context) }];
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
      inlineBuffer.push(...parseNode(child, context));
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
      case 'layout': return blocksToPlainText(block.blocks);
      case 'control': return block.text;
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
