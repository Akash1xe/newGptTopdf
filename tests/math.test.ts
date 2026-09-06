import { describe, expect, it, beforeEach } from "vitest";
import { extractMathNode, isMathElement } from "../src/providers/chatgpt/chatgptMath";
import { parseChatGPTMessage } from "../src/providers/chatgpt/chatgptParser";

describe("math extraction", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  function katex(source: string, display = false) {
    const klass = display ? "katex-display" : "katex";
    document.body.innerHTML = `<span class="${klass}"><span class="katex-mathml"><math${display ? ' display="block"' : ""}><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">${source}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">visual duplicate</span></span>`;
    const el = document.body.firstElementChild!;
    expect(isMathElement(el)).toBe(true);
    return extractMathNode(el)!;
  }

  it("recovers inline latex", () => {
    const node = katex("x^2");
    expect(node).toMatchObject({ displayMode: "inline", source: "x^2", sourceFormat: "latex", renderStrategy: "latex" });
  });

  it("recovers display math", () => {
    const node = katex("\\frac{a}{b}", true);
    expect(node.displayMode).toBe("block");
    expect(node.source).toBe("\\frac{a}{b}");
  });

  it.each([
    "\\sqrt{x}",
    "x^{10}",
    "x_{ij}",
    "\\int_0^1 x^2\\,dx",
    "\\sum_{i=1}^{n} i",
    "\\prod_{i=1}^{n} a_i",
    "\\lim_{x \\to 0} \\frac{\\sin x}{x}",
    "\\alpha + \\beta",
    "\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}",
    "\\begin{cases}x^2 & x \\ge 0 \\\\ -x & x < 0\\end{cases}"
  ])("preserves latex source %s", (source: string) => {
    expect(katex(source).source).toBe(source);
  });

  it("uses sanitized MathML when latex is absent", () => {
    document.body.innerHTML = '<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>';
    const node = extractMathNode(document.querySelector("math")!)!;
    expect(node.source).toBeUndefined();
    expect(node.mathML).toContain("<mfrac>");
    expect(node.renderStrategy).toBe("mathml");
  });

  it("creates one node for a KaTeX semantic + visual duplicate", () => {
    document.body.innerHTML = '<p>Area <span class="katex"><span class="katex-mathml"><math><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">x2</span></span> end.</p>';
    const parsed = parseChatGPTMessage(document.body);
    expect(parsed.blocks).toHaveLength(1);
    if (parsed.blocks[0].type !== "paragraph") return;
    const mathNodes = parsed.blocks[0].children.filter((n) => n.type === "math");
    expect(mathNodes).toHaveLength(1);
    expect(parsed.plainText).toBe("Area x^2 end.");
  });
});
