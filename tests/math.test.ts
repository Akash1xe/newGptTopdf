import { beforeEach, describe, expect, it } from "vitest";
import { extractMathNode, isMathElement } from "../src/providers/chatgpt/chatgptMath";
import { parseChatGPTMessage } from "../src/providers/chatgpt/chatgptParser";

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

describe("math extraction", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  function katex(source: string, display = false) {
    const wrapperOpen = display ? '<span class="katex-display">' : "";
    const wrapperClose = display ? "</span>" : "";
    document.body.innerHTML = `${wrapperOpen}<span class="katex"><span class="katex-mathml"><math xmlns="${MATHML_NS}"${display ? ' display="block"' : ""}><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">${escapeHtml(source)}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">flattened visual duplicate</span></span>${wrapperClose}`;
    const el = document.body.firstElementChild!;
    expect(isMathElement(el)).toBe(true);
    return extractMathNode(el)!;
  }

  it("recovers inline latex", () => {
    const node = katex("x^2");
    expect(node).toMatchObject({ displayMode: "inline", source: "x^2", sourceFormat: "latex", renderStrategy: "latex" });
  });

  it("recovers display latex from the outer katex-display wrapper", () => {
    const node = katex("\\frac{a}{b}", true);
    expect(node.displayMode).toBe("block");
    expect(node.source).toBe("\\frac{a}{b}");
  });

  it.each([
    "\\sqrt{x}",
    "\\sqrt{25}=5",
    "\\sqrt{9}=3",
    "\\sqrt[3]{8}=2",
    "\\sqrt[n]{x}",
    "\\sqrt{x^2+y^2}",
    "\\frac{a}{b}",
    "\\frac{10}{2}=5",
    "\\frac{x+1}{x-1}",
    "\\frac{dy}{dx}",
    "\\frac{\\partial f}{\\partial x}",
    "\\frac{x^2}{2}+C",
    "\\frac{m}{V}",
    "\\frac{W}{t}",
    "\\frac{1}{T}",
    "x^2",
    "x^3",
    "5^2=25",
    "E=mc^2",
    "3\\times10^8",
    "1\\times10^{-6}",
    "x_1",
    "x_2",
    "v_f",
    "v_i",
    "a_{ij}",
    "x_i^2",
    "\\sum_{i=1}^{5} i",
    "\\sum_{i=1}^{n} i",
    "\\prod_{i=1}^{4} i",
    "\\lim_{x\\to a}f(x)",
    "\\lim_{x\\to2}x^2=4",
    "\\int x\\,dx",
    "\\int_a^b f(x)\\,dx",
    "\\int_0^2 x\\,dx",
    "\\vec{v}",
    "|\\vec{v}|",
    "\\vec{A}\\cdot\\vec{B}",
    "\\vec{A}\\times\\vec{B}",
    "\\nabla f",
    "\\nabla\\cdot\\vec{F}",
    "\\nabla\\times\\vec{F}",
    "\\alpha+\\beta+\\gamma+\\delta+\\Delta+\\epsilon+\\theta+\\lambda+\\mu+\\rho+\\sigma+\\tau+\\phi+\\omega+\\Omega+\\pi",
    "a\\neq b\\; x\\geq y\\; x\\leq z\\; x\\approx1\\; x\\in A\\; y\\notin B\\; A\\subset B\\; A\\cup B\\; A\\cap B\\; \\emptyset\\; \\pm\\; \\infty\\; y\\propto x\\; x\\rightarrow5",
    "\\begin{bmatrix}1 & 2 \\\\ 3 & 4\\end{bmatrix}",
    "f(x)=\\begin{cases}x^2 & x\\geq0 \\\\ -x & x<0\\end{cases}",
    "\\begin{aligned}a &= b+c \\\\ d &= e+f\\end{aligned}",
    "\\binom{n}{k}",
    "\\left|\\frac{a}{b}\\right|",
    "\\lfloor x \\rfloor",
    "\\lceil x \\rceil",
    "\\overline{AB}",
    "\\hat{x}",
    "\\tilde{x}",
    "\\mathbf{A}",
    "\\mathbb{R}",
    "\\mathcal{F}",
    "\\sin\\theta+\\cos\\theta+\\tan\\theta",
    "\\log x+\\ln x",
    "\\forall x\\;\\exists y\\; x\\Rightarrow y\\;x\\Leftrightarrow y",
    "\\subseteq\\;\\supseteq\\;\\oint\\;\\iint\\;\\iiint",
    "v=\\sqrt{u^2+2as}",
    "x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}"
  ])("preserves semantic TeX source %s", (source: string) => {
    expect(katex(source, true).source).toBe(source);
  });

  it("supports the current ChatGPT data-math-source structure", () => {
    document.body.innerHTML = '<span data-math-source="\\sqrt{x^2+y^2}" data-math-style="display"><span aria-hidden="true">x2+y2</span></span>';
    const node = extractMathNode(document.body.firstElementChild!)!;
    expect(node).toMatchObject({ source: "\\sqrt{x^2+y^2}", sourceFormat: "latex", displayMode: "block", renderStrategy: "latex" });
  });

  it("accepts a parameterized/case-insensitive TeX annotation encoding", () => {
    document.body.innerHTML = `<span class="katex"><span class="katex-mathml"><math xmlns="${MATHML_NS}"><semantics><mi>x</mi><annotation encoding="Application/X-TeX; mode=display">\\sqrt{x}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">x</span></span>`;
    expect(extractMathNode(document.querySelector(".katex")!)?.source).toBe("\\sqrt{x}");
  });

  it("uses sanitized namespaced MathML when latex is absent", () => {
    document.body.innerHTML = '<math><mfrac><mi>a</mi><mi>b</mi></mfrac></math>';
    const node = extractMathNode(document.querySelector("math")!)!;
    expect(node.source).toBeUndefined();
    expect(node.mathML).toContain(`xmlns="${MATHML_NS}"`);
    expect(node.mathML).toContain("<mfrac>");
    expect(node.renderStrategy).toBe("mathml");
  });

  it("creates one node for a KaTeX semantic + visual duplicate", () => {
    document.body.innerHTML = `<p>Area <span class="katex"><span class="katex-mathml"><math xmlns="${MATHML_NS}"><semantics><mi>x</mi><annotation encoding="application/x-tex">x^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">x2</span></span> end.</p>`;
    const parsed = parseChatGPTMessage(document.body);
    expect(parsed.blocks).toHaveLength(1);
    if (parsed.blocks[0].type !== "paragraph") return;
    const mathNodes = parsed.blocks[0].children.filter((n) => n.type === "math");
    expect(mathNodes).toHaveLength(1);
    expect(mathNodes[0]).toMatchObject({ type: "math", source: "x^2" });
    expect(parsed.plainText).toBe("Area x^2 end.");
  });

  it("keeps inline math inline and display math as a block", () => {
    document.body.innerHTML = `<div><p>Inline <span class="katex"><span class="katex-mathml"><math xmlns="${MATHML_NS}"><semantics><mi>x</mi><annotation encoding="application/x-tex">x_i^2</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">x2</span></span> end.</p><span class="katex-display"><span class="katex"><span class="katex-mathml"><math xmlns="${MATHML_NS}" display="block"><semantics><mi>x</mi><annotation encoding="application/x-tex">\\frac{a}{b}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">ab</span></span></span></div>`;
    const parsed = parseChatGPTMessage(document.body.firstElementChild!);
    expect(parsed.blocks[0].type).toBe("paragraph");
    expect(parsed.blocks[1]).toMatchObject({ type: "math", displayMode: "block", source: "\\frac{a}{b}" });
  });

  it("does not classify ordinary code-like text as math", () => {
    document.body.innerHTML = "<p><code>vector&lt;int&gt;</code> dp[i][j] x++</p>";
    const parsed = parseChatGPTMessage(document.body);
    expect(parsed.blocks.some((block) => block.type === "math")).toBe(false);
    expect(parsed.plainText).toContain("vector<int>");
  });
});
