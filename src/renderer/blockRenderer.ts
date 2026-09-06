import type { ContentBlock } from "../types/content";
import type { ExportPreferences } from "../types/preferences";
import { renderInlineNodes } from "./inlineRenderer";
import { renderCodeBlock } from "./codeRenderer";
import { renderMath } from "./mathRenderer";
import { renderTable } from "./tableRenderer";
import { renderImage } from "./imageRenderer";
import { el } from "./dom";

function renderList(document: Document, block: Extract<ContentBlock, { type: "ordered-list" | "unordered-list" }>, preferences: ExportPreferences): HTMLElement {
  const list: HTMLOListElement | HTMLUListElement = block.type === "ordered-list" ? el(document, "ol") : el(document, "ul");
  if (block.type === "ordered-list" && list instanceof HTMLOListElement && block.start !== 1) list.start = block.start;
  block.items.forEach((item) => {
    const li = el(document, "li");
    item.blocks.forEach((child) => li.appendChild(renderBlock(document, child, preferences)));
    list.appendChild(li);
  });
  return list;
}

export function renderBlock(document: Document, block: ContentBlock, preferences: ExportPreferences): HTMLElement {
  switch (block.type) {
    case "paragraph": {
      const p = el(document, "p");
      p.appendChild(renderInlineNodes(document, block.children));
      return p;
    }
    case "heading": {
      const h = document.createElement(`h${block.level}`) as HTMLHeadingElement;
      h.appendChild(renderInlineNodes(document, block.children));
      return h;
    }
    case "ordered-list":
    case "unordered-list": return renderList(document, block, preferences);
    case "blockquote": {
      const quote = el(document, "blockquote");
      block.blocks.forEach((child) => quote.appendChild(renderBlock(document, child, preferences)));
      return quote;
    }
    case "table": return renderTable(document, block);
    case "horizontal-rule": return el(document, "hr");
    case "code": return renderCodeBlock(document, block, preferences);
    case "math": return renderMath(document, block);
    case "image": return renderImage(document, block);
  }
}

export function renderBlocks(document: Document, blocks: ContentBlock[], preferences: ExportPreferences): DocumentFragment {
  const fragment = document.createDocumentFragment();
  blocks.forEach((block) => fragment.appendChild(renderBlock(document, block, preferences)));
  return fragment;
}
