import katex from "katex";
import "katex/dist/katex.min.css";
import type { MathNode } from "../types/content";
import { el } from "./dom";

function safeMathMl(document: Document, source: string): Element | null {
  try {
    const parsed = new DOMParser().parseFromString(source, "application/xml");
    if (parsed.querySelector("parsererror")) return null;
    const math = parsed.documentElement.tagName.toLowerCase() === "math" ? parsed.documentElement : parsed.querySelector("math");
    if (!math) return null;
    return document.importNode(math, true);
  } catch {
    return null;
  }
}

function renderLatex(container: HTMLElement, source: string, displayMode: boolean): boolean {
  try {
    katex.render(source, container, {
      displayMode,
      throwOnError: false,
      strict: "warn",
      trust: false,
      output: "htmlAndMathml"
    });
    return Boolean(container.querySelector(".katex"));
  } catch {
    return false;
  }
}

export function renderMath(document: Document, node: MathNode): HTMLElement {
  const container = el(document, node.displayMode === "block" ? "div" : "span", `math math-${node.displayMode}`);
  container.setAttribute("aria-label", node.fallbackText);

  if (node.source && (node.sourceFormat === "latex" || node.sourceFormat === "tex" || node.renderStrategy === "latex")) {
    if (renderLatex(container, node.source, node.displayMode === "block")) return container;
    container.replaceChildren();
  }

  if (node.mathML) {
    const math = safeMathMl(document, node.mathML);
    if (math) {
      container.appendChild(math);
      return container;
    }
  }

  if (node.source && renderLatex(container, node.source, node.displayMode === "block")) return container;
  container.replaceChildren();

  const fallback = el(document, "span", "math-fallback");
  fallback.textContent = node.fallbackText || node.source || "[math]";
  container.appendChild(fallback);
  return container;
}
