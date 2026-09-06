import katex from "katex";
import type { MathNode } from "../types/content";
import { el } from "./dom";

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

function ensureMathMlNamespace(source: string): string {
  if (!/<math\b/i.test(source) || /<math\b[^>]*\bxmlns\s*=/i.test(source)) return source;
  return source.replace(/<math\b/i, `<math xmlns="${MATHML_NS}"`);
}

function safeMathMl(document: Document, source: string): Element | null {
  try {
    const normalized = ensureMathMlNamespace(source);
    const parsed = new DOMParser().parseFromString(normalized, "application/xml");
    if (parsed.querySelector("parsererror")) return null;

    const math = parsed.documentElement.tagName.toLowerCase() === "math"
      ? parsed.documentElement
      : parsed.querySelector("math");
    if (!math || math.namespaceURI !== MATHML_NS) return null;

    math.querySelectorAll("script,style,iframe,object,embed").forEach((node) => node.remove());
    math.querySelectorAll("*").forEach((node) => {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.name.toLowerCase();
        if (
          name.startsWith("on")
          || name === "src"
          || name === "href"
          || name === "xlink:href"
          || name === "style"
        ) node.removeAttribute(attr.name);
      }
    });

    return document.importNode(math, true);
  } catch {
    return null;
  }
}

function appendTrustedKatexHtml(document: Document, container: HTMLElement, html: string): boolean {
  const template = document.createElement("template");
  // This HTML is produced only by the locally bundled KaTeX library from a
  // plain TeX string. Arbitrary ChatGPT/user innerHTML is never inserted here.
  template.innerHTML = html;
  const katexNode = template.content.querySelector(".katex");
  if (!katexNode) return false;
  container.appendChild(template.content.cloneNode(true));
  return Boolean(container.querySelector(".katex"));
}

function renderLatex(document: Document, container: HTMLElement, source: string, displayMode: boolean): boolean {
  try {
    const html = katex.renderToString(source, {
      displayMode,
      throwOnError: false,
      strict: "warn",
      trust: false,
      output: "htmlAndMathml"
    });
    return appendTrustedKatexHtml(document, container, html);
  } catch {
    return false;
  }
}

export function renderMath(document: Document, node: MathNode): HTMLElement {
  const container = el(document, node.displayMode === "block" ? "div" : "span", `math math-${node.displayMode}`);
  container.setAttribute("aria-label", node.fallbackText || node.source || "Mathematical expression");
  if (node.source) container.dataset.mathSourceFormat = node.sourceFormat ?? "unknown";

  // Primary path: semantic TeX recovered from ChatGPT/KaTeX.
  if (node.source && (node.sourceFormat === "latex" || node.sourceFormat === "tex" || node.renderStrategy === "latex")) {
    if (renderLatex(document, container, node.source, node.displayMode === "block")) return container;
    container.replaceChildren();
  }

  // Secondary path: sanitized MathML. MathML must carry its namespace or
  // Chrome will display its child tags as ordinary inline text (the exact
  // failure that turns fractions into strings like "ba").
  const mathMlSource = node.mathML ?? (node.sourceFormat === "mathml" ? node.source : undefined);
  if (mathMlSource) {
    const math = safeMathMl(document, mathMlSource);
    if (math) {
      container.appendChild(math);
      return container;
    }
  }

  // A source can occasionally arrive without sourceFormat. Give it one final
  // local KaTeX attempt before falling back to visible text.
  if (node.source && renderLatex(document, container, node.source, node.displayMode === "block")) return container;
  container.replaceChildren();

  const fallback = el(document, "span", "math-fallback");
  fallback.textContent = node.fallbackText || node.source || "[math]";
  container.appendChild(fallback);
  return container;
}
