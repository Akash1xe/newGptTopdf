import type { InlineNode } from "../types/content";
import { renderMath } from "./mathRenderer";
import { el } from "./dom";

function renderText(document: Document, node: Extract<InlineNode, { type: "text" }>): Node {
  let current: Node = document.createTextNode(node.text);
  if (node.strikethrough) {
    const del = el(document, "del"); del.appendChild(current); current = del;
  }
  if (node.italic) {
    const em = el(document, "em"); em.appendChild(current); current = em;
  }
  if (node.bold) {
    const strong = el(document, "strong"); strong.appendChild(current); current = strong;
  }
  return current;
}

export function renderInlineNodes(document: Document, nodes: InlineNode[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const node of nodes) {
    switch (node.type) {
      case "text": fragment.appendChild(renderText(document, node)); break;
      case "line-break": fragment.appendChild(document.createElement("br")); break;
      case "inline-code": {
        const code = el(document, "code", "inline-code");
        code.textContent = node.text;
        fragment.appendChild(code);
        break;
      }
      case "link": {
        const anchor = el(document, "a");
        anchor.href = node.href;
        anchor.rel = "noreferrer noopener";
        anchor.appendChild(renderInlineNodes(document, node.children));
        fragment.appendChild(anchor);
        break;
      }
      case "math": fragment.appendChild(renderMath(document, node)); break;
    }
  }
  return fragment;
}
