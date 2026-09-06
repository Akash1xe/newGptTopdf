import { describe, expect, it, beforeEach } from "vitest";
import { parseChatGPTMessage } from "../src/providers/chatgpt/chatgptParser";
import { sanitizeHref } from "../src/parser/sanitization";

describe("structured content parser", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  function parse(html: string) {
    document.body.innerHTML = `<div id="root">${html}</div>`;
    return parseChatGPTMessage(document.querySelector("#root")!);
  }

  it("preserves paragraphs and nested marks", () => {
    const result = parse('<p>Hello <strong><em>critical</em></strong> world</p>');
    expect(result.blocks[0].type).toBe("paragraph");
    if (result.blocks[0].type !== "paragraph") return;
    const critical = result.blocks[0].children.find((n) => n.type === "text" && n.text.includes("critical"));
    expect(critical).toMatchObject({ type: "text", bold: true, italic: true });
    expect(result.plainText).toBe("Hello critical world");
  });

  it("preserves headings, blockquotes and horizontal rules", () => {
    const result = parse('<h2>Binary Search</h2><blockquote><p>Sorted data</p></blockquote><hr>');
    expect(result.blocks.map((b) => b.type)).toEqual(["heading", "blockquote", "horizontal-rule"]);
    expect(result.blocks[0]).toMatchObject({ type: "heading", level: 2 });
  });

  it("preserves ordered, unordered, and nested lists", () => {
    const result = parse('<ol start="3"><li>One<ul><li>Nested</li></ul></li><li>Two</li></ol>');
    expect(result.blocks[0]).toMatchObject({ type: "ordered-list", start: 3 });
    if (result.blocks[0].type !== "ordered-list") return;
    expect(result.blocks[0].items).toHaveLength(2);
    expect(result.blocks[0].items[0].blocks.map((b) => b.type)).toEqual(["paragraph", "unordered-list"]);
  });

  it("preserves tables with header and spans", () => {
    const result = parse('<table><thead><tr><th colspan="2">A</th></tr></thead><tbody><tr><td>X</td><td>Y</td></tr></tbody></table>');
    expect(result.blocks[0].type).toBe("table");
    if (result.blocks[0].type !== "table") return;
    expect(result.blocks[0].columnCount).toBe(2);
    expect(result.blocks[0].rows[0].cells[0]).toMatchObject({ header: true, colspan: 2 });
  });

  it("preserves line breaks and inline code", () => {
    const result = parse('<p>Hello<br>use <code>lower_bound()</code></p>');
    if (result.blocks[0].type !== "paragraph") return;
    expect(result.blocks[0].children.some((n) => n.type === "line-break")).toBe(true);
    expect(result.blocks[0].children.some((n) => n.type === "inline-code" && n.text === "lower_bound()")).toBe(true);
  });

  it("sanitizes unsafe links", () => {
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeHref("https://example.com/a")).toBe("https://example.com/a");
    const result = parse('<p><a href="javascript:alert(1)">Bad</a> <a href="https://example.com">Good</a></p>');
    if (result.blocks[0].type !== "paragraph") return;
    expect(result.blocks[0].children.filter((n) => n.type === "link")).toHaveLength(1);
  });

  it("keeps unicode", () => {
    const result = parse('<p>नमस्ते ✅ α β → ∞ café</p>');
    expect(result.plainText).toContain("नमस्ते ✅ α β → ∞ café");
  });
});
