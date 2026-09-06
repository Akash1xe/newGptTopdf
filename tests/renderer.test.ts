import { describe, expect, it } from "vitest";
import { renderConversation } from "../src/renderer/conversationRenderer";
import { renderMath } from "../src/renderer/mathRenderer";
import { buildPrintStyles } from "../src/renderer/printStyles";
import { getBodyFontStack, getTextWeightValues, resolvePdfAppearance } from "../src/services/pdfAppearanceService";
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
    expect(document.querySelector(".message-user strong")?.textContent).toContain("Explain");
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

  it("resolves compact, wide and custom page margins safely", () => {
    expect(resolvePdfAppearance({ ...DEFAULT_EXPORT_PREFERENCES, marginPreset: "compact" })).toMatchObject({ marginTop: "8mm", marginRight: "10mm" });
    expect(resolvePdfAppearance({ ...DEFAULT_EXPORT_PREFERENCES, marginPreset: "wide" })).toMatchObject({ marginTop: "22mm", marginRight: "24mm" });
    const custom = { ...DEFAULT_EXPORT_PREFERENCES, marginPreset: "custom" as const, customMargins: { top: 10, right: 12, bottom: 14, left: 16 } };
    expect(buildPrintStyles(custom)).toContain("margin: 10mm 12mm 14mm 16mm");
  });

  it("maps local body fonts and keeps code explicitly monospace", () => {
    expect(getBodyFontStack("georgia")).toContain("Georgia");
    expect(getBodyFontStack("times")).toContain("Times New Roman");
    const css = buildPrintStyles({ ...DEFAULT_EXPORT_PREFERENCES, bodyFontFamily: "georgia", bodyFontSize: 14, codeFontSize: 12 });
    expect(css).toContain('--pdf-body-font: Georgia, "Times New Roman", serif');
    expect(css).toContain("--pdf-body-size: 14pt");
    expect(css).toContain("--pdf-code-size: 12pt");
    expect(css).toMatch(/\.code-block pre[^}]*ui-monospace/);
    expect(css).toMatch(/\.code-block pre[^}]*font-weight:\s*400/);
    expect(css).toMatch(/\.inline-code[^}]*font-weight:\s*400/);
  });

  it("shifts every semantic text weight relative to the regular 400 baseline", () => {
    expect(getTextWeightValues("regular")).toEqual({
      body: "400", bold: "700", heading: "700", title: "700", tableHeader: "700", role: "750", meta: "400", codeLabel: "600"
    });
    expect(getTextWeightValues("light")).toEqual({
      body: "300", bold: "600", heading: "600", title: "600", tableHeader: "600", role: "650", meta: "300", codeLabel: "500"
    });
    expect(getTextWeightValues("medium")).toEqual({
      body: "500", bold: "800", heading: "800", title: "800", tableHeader: "800", role: "850", meta: "500", codeLabel: "700"
    });
    expect(getTextWeightValues("semibold")).toEqual({
      body: "600", bold: "900", heading: "900", title: "900", tableHeader: "900", role: "900", meta: "600", codeLabel: "800"
    });
    expect(getTextWeightValues("bold")).toEqual({
      body: "700", bold: "900", heading: "900", title: "900", tableHeader: "900", role: "900", meta: "700", codeLabel: "900"
    });
    expect(getTextWeightValues("extrabold")).toEqual({
      body: "800", bold: "900", heading: "900", title: "900", tableHeader: "900", role: "900", meta: "800", codeLabel: "900"
    });
  });

  it("supports custom relative thickness without flattening semantic hierarchy", () => {
    expect(getTextWeightValues("custom", 550)).toEqual({
      body: "550", bold: "850", heading: "850", title: "850", tableHeader: "850", role: "900", meta: "550", codeLabel: "750"
    });
    expect(getTextWeightValues("custom", 350)).toEqual({
      body: "350", bold: "650", heading: "650", title: "650", tableHeader: "650", role: "700", meta: "350", codeLabel: "550"
    });

    const css = buildPrintStyles({ ...DEFAULT_EXPORT_PREFERENCES, textWeight: "custom", customTextWeight: 550 });
    expect(css).toContain("--pdf-body-weight: 550");
    expect(css).toContain("--pdf-bold-weight: 850");
    expect(css).toContain("--pdf-heading-weight: 850");
    expect(css).toContain("--pdf-title-weight: 850");
    expect(css).toContain("--pdf-table-header-weight: 850");
    expect(css).toContain("--pdf-role-weight: 900");
    expect(css).toContain("--pdf-meta-weight: 550");
    expect(css).toContain("--pdf-code-label-weight: 750");
  });

  it("calculates relative weight from canonical values on every resolution", () => {
    const first = getTextWeightValues("medium");
    const second = getTextWeightValues("medium");
    expect(first).toEqual(second);
    expect(first.body).toBe("500");
    expect(first.bold).toBe("800");
  });

  it("applies the relative shift globally to document text while preserving semantic weights", () => {
    const css = buildPrintStyles({ ...DEFAULT_EXPORT_PREFERENCES, textWeight: "medium" });
    expect(css).toMatch(/\.export-document \{[^}]*font-weight:\s*var\(--pdf-body-weight\)/);
    expect(css).toContain(".message-body strong, .message-body b { font-weight: var(--pdf-bold-weight); }");
    expect(css).toMatch(/\.document-title[^}]*font-weight:\s*var\(--pdf-title-weight\)/);
    expect(css).toMatch(/h1,h2,h3,h4,h5,h6[^}]*font-weight:\s*var\(--pdf-heading-weight\)/);
    expect(css).toMatch(/\.message-role[^}]*font-weight:\s*var\(--pdf-role-weight\)/);
    expect(css).toMatch(/th \{[^}]*font-weight:\s*var\(--pdf-table-header-weight\)/);
    expect(css).toMatch(/\.document-meta[^}]*font-weight:\s*var\(--pdf-meta-weight\)/);
  });

  it("clamps heavy relative semantic weights at 900", () => {
    const extra = resolvePdfAppearance({ ...DEFAULT_EXPORT_PREFERENCES, textWeight: "extrabold" });
    expect(extra.bodyFontWeight).toBe("800");
    expect(extra.boldFontWeight).toBe("900");
    expect(extra.headingFontWeight).toBe("900");
    expect(extra.roleFontWeight).toBe("900");

    const unsafeCustom = resolvePdfAppearance({ ...DEFAULT_EXPORT_PREFERENCES, textWeight: "custom", customTextWeight: 5000 });
    expect(unsafeCustom.bodyFontWeight).toBe("800");
    expect(unsafeCustom.boldFontWeight).toBe("900");
  });

  it("applies message, paragraph and line spacing through centralized variables", () => {
    const css = buildPrintStyles({
      ...DEFAULT_EXPORT_PREFERENCES,
      messagePadding: "spacious",
      messageSpacing: "compact",
      paragraphSpacing: "spacious",
      lineSpacing: "relaxed"
    });
    expect(css).toContain("--pdf-message-padding: 15px");
    expect(css).toContain("--pdf-message-gap: 10px");
    expect(css).toContain("--pdf-paragraph-gap: 1em");
    expect(css).toContain("--pdf-line-height: 1.7");
  });

  it("rejects arbitrary font and thickness CSS and clamps unsafe appearance values at render time", () => {
    const unsafe = {
      ...DEFAULT_EXPORT_PREFERENCES,
      bodyFontFamily: "Arial; color:red" as never,
      bodyFontSize: 500,
      textWeight: "900; color:red" as never,
      customTextWeight: 5000,
      codeFontSize: -20,
      marginPreset: "custom" as const,
      customMargins: { top: -5, right: 100, bottom: 15, left: 15 }
    };
    const css = buildPrintStyles(unsafe);
    expect(css).not.toContain("color:red");
    expect(css).toContain("--pdf-body-size: 18pt");
    expect(css).toContain("--pdf-body-weight: 400");
    expect(css).toContain("--pdf-bold-weight: 700");
    expect(css).toContain("--pdf-code-size: 8pt");
    expect(css).toContain("margin: 5mm 40mm 15mm 15mm");
  });

  it("keeps source code and inline code outside the global relative shift", () => {
    const css = buildPrintStyles({ ...DEFAULT_EXPORT_PREFERENCES, textWeight: "custom", customTextWeight: 650 });
    expect(css).toContain("--pdf-body-weight: 650");
    expect(css).toContain("--pdf-bold-weight: 900");
    expect(css).toMatch(/\.code-block pre[^}]*font-weight:\s*400/);
    expect(css).toMatch(/\.inline-code[^}]*font-weight:\s*400/);
    expect(css).toMatch(/\.code-label[^}]*font-weight:\s*var\(--pdf-code-label-weight\)/);
  });

  it("does not apply shifted body thickness or body fonts to KaTeX", () => {
    const css = buildPrintStyles({ ...DEFAULT_EXPORT_PREFERENCES, bodyFontFamily: "times", bodyFontSize: 18, textWeight: "custom", customTextWeight: 650 });
    expect(css).toContain(".math { max-width: 100%; font-weight: 400; }");
    expect(css).toContain(".math .katex { font-size: 1.06em; color: inherit; }");
    expect(css).not.toMatch(/\.math \.katex[^}]*font-family/);
    expect(css).not.toMatch(/\.math \.katex[^}]*var\(--pdf-body-weight\)/);
    expect(css).not.toMatch(/\.math[^}]*var\(--pdf-body-weight\)/);
    expect(css).not.toMatch(/\.export-document \*[^}]*font-family/);
  });
});
