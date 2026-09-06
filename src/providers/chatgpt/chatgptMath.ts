import type { MathNode } from "../../types/content";
import { normalizeNewlines } from "../../parser/sanitization";

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
const TEX_ENCODING_RE = /(?:^|\s|;)(?:application\/x-(?:tex|latex)|text\/latex)(?:$|\s|;)/i;
const TEX_ATTRIBUTE_NAMES = ["data-latex", "data-tex", "data-math", "data-math-source", "data-formula"] as const;

function normalizeMathSource(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeNewlines(value).trim();
  return normalized || undefined;
}

function isInsideAnotherKatex(element: Element): boolean {
  const parent = element.parentElement;
  if (!parent) return false;
  return Boolean(parent.closest(".katex"));
}

function topLevelKatex(element: Element): boolean {
  if (element.classList.contains("katex-display")) return true;
  if (!element.classList.contains("katex")) return false;
  // The .katex inside .katex-display is intentionally ignored because the
  // .katex-display wrapper represents the complete display expression.
  if (element.closest(".katex-display") && !element.classList.contains("katex-display")) return false;
  return !isInsideAnotherKatex(element);
}

export function isMathElement(element: Element): boolean {
  if (topLevelKatex(element)) return true;

  const tag = element.tagName.toLowerCase();
  if (tag === "math") {
    // A <math> inside KaTeX is the semantic duplicate of the visible formula.
    // The outer .katex/.katex-display node is responsible for producing the
    // single normalized MathNode.
    return !element.closest(".katex, .katex-display");
  }

  if (TEX_ATTRIBUTE_NAMES.some((name) => element.hasAttribute(name))) return true;
  return false;
}

function sanitizeMathML(math: Element): string {
  const clone = math.cloneNode(true) as Element;
  clone.querySelectorAll("script,style,iframe,object,embed").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach((node) => {
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

  // Math elements coming from an HTML DOM frequently serialize without an
  // explicit xmlns attribute even though their namespaceURI is MathML. Once
  // that string is parsed again by the isolated print document it would become
  // generic XML and render as flattened text. Persist the namespace explicitly.
  if (clone.tagName.toLowerCase() === "math" && !clone.getAttribute("xmlns")) {
    clone.setAttribute("xmlns", MATHML_NS);
  }
  return clone.outerHTML;
}

function findLatexSource(element: Element): string | undefined {
  for (const attribute of TEX_ATTRIBUTE_NAMES) {
    const direct = normalizeMathSource(element.getAttribute(attribute));
    if (direct) return direct;
  }

  // Do not use one exact selector for encoding. In real pages the value may be
  // capitalized or carry an additional parameter. Inspect annotation nodes and
  // normalize the encoding value instead.
  for (const annotation of Array.from(element.querySelectorAll("annotation"))) {
    const encoding = annotation.getAttribute("encoding")?.trim() ?? "";
    if (!TEX_ENCODING_RE.test(encoding)) continue;
    const source = normalizeMathSource(annotation.textContent);
    if (source) return source;
  }

  // Some renderers expose the TeX source as an accessibility label on the
  // formula root rather than an annotation. Only accept it as TeX when it looks
  // like TeX markup; ordinary spoken labels remain fallbacks, not source.
  const aria = normalizeMathSource(element.getAttribute("aria-label"));
  if (aria && /\\[A-Za-z]+|[_^{}]/.test(aria)) return aria;
  return undefined;
}

function findMathML(element: Element): string | undefined {
  const math = element.tagName.toLowerCase() === "math" ? element : element.querySelector("math");
  return math ? sanitizeMathML(math) : undefined;
}

function fallbackText(element: Element, source?: string): string {
  // Keeping TeX as the fallback is intentionally preferable to silently
  // flattening it to an incorrect visual string such as "x2" or "ba".
  if (source) return source;
  const aria = normalizeMathSource(element.getAttribute("aria-label"));
  if (aria) return aria;

  const math = element.tagName.toLowerCase() === "math" ? element : element.querySelector("math");
  if (math) {
    // Exclude the TeX annotation from text fallback when possible because it is
    // metadata, not part of the visible expression.
    const clone = math.cloneNode(true) as Element;
    clone.querySelectorAll("annotation").forEach((node) => node.remove());
    const semantic = normalizeMathSource(clone.textContent);
    if (semantic) return semantic;
  }

  const text = normalizeMathSource(element.textContent);
  return text ?? "[math]";
}

function detectDisplayMode(element: Element): "inline" | "block" {
  const declaredStyle = (
    element.getAttribute("data-math-style")
    ?? element.getAttribute("data-display")
    ?? element.getAttribute("display")
    ?? ""
  ).toLowerCase();

  if (
    declaredStyle === "block"
    || declaredStyle === "display"
    || declaredStyle === "true"
    || element.classList.contains("katex-display")
    || element.classList.contains("math-display")
    || element.classList.contains("display-math")
    || element.classList.contains("math-block")
    || element.closest(".katex-display, .math-display, .display-math, .math-block")
  ) return "block";

  const math = element.tagName.toLowerCase() === "math" ? element : element.querySelector("math");
  if (math?.getAttribute("display")?.toLowerCase() === "block") return "block";
  if (element.tagName.toLowerCase() === "div" && element.hasAttribute("data-math-source")) return "block";
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
    renderStrategy: source ? "latex" : mathML ? "mathml" : "text-fallback",
    sourceLength: source?.length
  };
}
