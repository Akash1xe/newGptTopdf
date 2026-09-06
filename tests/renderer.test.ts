import { describe, expect, it } from "vitest";
import { renderConversation } from "../src/renderer/conversationRenderer";
import { renderMath } from "../src/renderer/mathRenderer";
import { buildPrintStyles } from "../src/renderer/printStyles";
import { DEFAULT_EXPORT_PREFERENCES } from "../src/types/preferences";
import type { ConversationData } from "../src/types/conversation";
import type { MathNode } from "../src/types/content";

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

function conversation(): ConversationData {
  return {
    provider: "chatgpt",
    title: "Renderer Test",
    url: "https://chatgpt.com/c/test",
    capturedUrl: "https://chatgpt.com/c/test",
    capturedAt: "2026-09-06T10:00:00.000Z",
    conversationId: "test",
    messageCount: 2,
    possiblyPartial: false,
    completeness: { state: "complete", collectedMessages: 2 },
    stats: { totalMessages: 2, userMessages: 1, assistantMessages: 1, codeBlocks: 1, mathNodes: 1, images: 0 },
    messages: [
      { id: "u1", role: "user", order: 0, plainText: "Explain", blocks: [{ type: "paragraph", children: [{ type: "text", text: "Explain ", bold: true }, { type: "inline-code", text: "binary_search" }] }] },
      { id: "a1", role: "assistant", order: 1, plainText: "Answer", blocks: [
        { type: "heading", level: 2, children: [{ type: "text", text: "Answer" }] },
        { type: "code", language: "cpp", displayLanguage: "C++", code: "int x = 1;", lines: [{ number: 1, plainText: "int x = 1;", tokens: [{ text: "int", tokenType: "type" }, { text: " x = ", tokenType: "plain" }, { text: "1", tokenType: "number" }, { text: ";", tokenType: "punctuation" }] }], source: "dom-highlighted", lineCount: 1, hasLongLines: false, maxLineLength: 10, tabSize: 4 },
        { type: "math", displayMode: "block", fallbackText: "a/b", mathML: '<math xmlns="http://www.w3.org/1998/Math/MathML"><mfrac><mi>a</mi><mi>b</mi></mfrac></math>', sourceFormat: "mathml", renderStrategy: "mathml" }
      ] }
    ]
  };
}

function latex(source: string, displayMode: "inline" | "block" = "block"): MathNode {
  return { type: "math", displayMode, source, sourceFormat: "latex", fallbackText: source, renderStrategy: "latex" };
}

describe("PDF document renderer", () => {
  it("renders semantic conversation, code tokens and namespaced MathML", () => {
    const output = renderConversation(document, conversation(), DEFAULT_EXPORT_PREFERENCES);
    document.body.replaceChildren(output);
    expect(document.querySelector(".message-user")).toBeTruthy();
    expect(document.querySelector(".message-assistant h2")?.textContent).toBe("Answer");
    expect(document.querySelector(".tok-type")?.textContent).toBe("int");
    const math = document.querySelector("math");
    expect(math?.namespaceURI).toBe(MATHML_NS);
    expect(document.querySelector("mfrac")).toBeTruthy();
    expect(document.body.textContent).toContain("binary_search");
  });

  it.each([
    ["root", "\\sqrt{x}", ".sqrt"],
    ["fraction", "\\frac{a}{b}", ".frac-line"],
    ["power", "x^2", ".msupsub"],
    ["subscript", "x_i", ".msupsub"],
    ["derivative", "\\frac{dy}{dx}", ".frac-line"],
    ["partial derivative", "\\frac{\\partial f}{\\partial x}", ".frac-line"],
    ["summation", "\\sum_{i=1}^{n}i", ".mop"],
    ["integral", "\\int_0^1x^2\\,dx", ".mop"],
    ["matrix", "\\begin{bmatrix}1&2\\\\3&4\\end{bmatrix}", ".mtable"],
    ["cases", "f(x)=\\begin{cases}x^2&x\\ge0\\\\-x&x<0\\end{cases}", ".mtable"],
    ["quadratic formula", "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}", ".frac-line"],
    ["physics radical", "v=\\sqrt{u^2+2as}", ".sqrt"]
  ])("renders %s using local KaTeX structure", (_name, source, selector) => {
    const output = renderMath(document, latex(source));
    document.body.replaceChildren(output);
    expect(document.querySelector(".katex")).toBeTruthy();
    expect(document.querySelector(selector)).toBeTruthy();
    expect(document.querySelector('annotation[encoding="application/x-tex"]')?.textContent).toContain(source);
  });

  it("keeps inline math inline in the renderer model", () => {
    const output = renderMath(document, latex("x_i^2", "inline"));
    expect(output.tagName.toLowerCase()).toBe("span");
    expect(output.classList.contains("math-inline")).toBe(true);
  });

  it("falls back safely for malformed TeX instead of throwing", () => {
    const output = renderMath(document, latex("\\frac{"));
    expect(output.textContent?.length).toBeGreaterThan(0);
  });

  it("repairs missing MathML namespace before importing into the print document", () => {
    const output = renderMath(document, {
      type: "math",
      displayMode: "block",
      fallbackText: "a/b",
      mathML: "<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>",
      sourceFormat: "mathml",
      renderStrategy: "mathml"
    });
    const math = output.querySelector("math");
    expect(math?.namespaceURI).toBe(MATHML_NS);
    expect(output.querySelector("mfrac")).toBeTruthy();
  });

  it("builds print-safe math rules without clipping formulas", () => {
    const css = buildPrintStyles(DEFAULT_EXPORT_PREFERENCES);
    expect(css).toContain("size: A4");
    expect(css).toContain(".math-block");
    expect(css).toContain("overflow: visible");
    expect(css).not.toMatch(/\.math-block[^}]*overflow:\s*hidden/);
    expect(buildPrintStyles({ ...DEFAULT_EXPORT_PREFERENCES, pageSize: "Letter" })).toContain("size: Letter");
  });
});
