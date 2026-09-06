import type { MathNode } from "../../types/content";
import { normalizeNewlines } from "../../parser/sanitization";

function topLevelKatex(element: Element): boolean {
  if (element.classList.contains("katex-display")) return true;
  if (element.classList.contains("katex")) return !element.parentElement?.closest(".katex-display, .katex");
  return false;
}

export function isMathElement(element: Element): boolean {
  if (topLevelKatex(element)) return true;
  if (element.tagName.toLowerCase() === "math") return !element.closest(".katex");
  if (element.hasAttribute("data-math") || element.hasAttribute("data-latex")) return true;
  return false;
}

function sanitizeMathML(math: Element): string {
  const clone = math.cloneNode(true) as Element;
  clone.querySelectorAll("script,style,iframe").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "src" || name === "href" || name === "xlink:href") node.removeAttribute(attr.name);
    }
  });
  return clone.outerHTML;
}

function findLatexSource(element: Element): string | undefined {
  const direct = element.getAttribute("data-latex") ?? element.getAttribute("data-math");
  if (direct?.trim()) return normalizeNewlines(direct.trim());
  const annotation = element.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="application/x-latex"], annotation[encoding="text/latex"]');
  const value = annotation?.textContent?.trim();
  return value ? normalizeNewlines(value) : undefined;
}

function findMathML(element: Element): string | undefined {
  const math = element.tagName.toLowerCase() === "math" ? element : element.querySelector("math");
  return math ? sanitizeMathML(math) : undefined;
}

function fallbackText(element: Element, source?: string): string {
  if (source) return source;
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  const math = element.tagName.toLowerCase() === "math" ? element : element.querySelector("math");
  const text = math?.textContent?.trim() ?? element.textContent?.trim() ?? "";
  return normalizeNewlines(text) || "[math]";
}

function detectDisplayMode(element: Element): "inline" | "block" {
  if (element.classList.contains("katex-display") || element.getAttribute("display") === "block" || element.closest(".katex-display")) return "block";
  return "inline";
}

export function extractMathNode(element: Element): MathNode | null {
  if (!isMathElement(element)) return null;
  const source = findLatexSource(element);
  const mathML = findMathML(element);
  const fallback = fallbackText(element, source);
  return {
    type: "math",
    displayMode: detectDisplayMode(element),
    source,
    sourceFormat: source ? "latex" : mathML ? "mathml" : undefined,
    fallbackText: fallback,
    mathML,
    renderStrategy: source ? "latex" : mathML ? "mathml" : fallback ? "text-fallback" : "dom-fallback",
    sourceLength: source?.length
  };
}
