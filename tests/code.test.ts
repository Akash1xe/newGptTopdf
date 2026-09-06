import { describe, expect, it, beforeEach } from "vitest";
import { extractCodeBlock, normalizeLanguage } from "../src/providers/chatgpt/chatgptCode";

describe("code extraction", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  function code(html: string) {
    document.body.innerHTML = html;
    return extractCodeBlock(document.querySelector("pre")!);
  }

  it("normalizes common language aliases", () => {
    expect(normalizeLanguage("C++")).toBe("cpp");
    expect(normalizeLanguage("js")).toBe("javascript");
    expect(normalizeLanguage("ts")).toBe("typescript");
    expect(normalizeLanguage("py")).toBe("python");
    expect(normalizeLanguage("sh")).toBe("bash");
  });

  it("preserves indentation, blank lines and special characters", () => {
    const block = code('<pre><code class="language-cpp">if (a &lt; b &amp;&amp; c &gt; d) {\n    cout &lt;&lt; "hello";\n\n    return 0;\n}\n</code></pre>')!;
    expect(block.language).toBe("cpp");
    expect(block.code).toBe('if (a < b && c > d) {\n    cout << "hello";\n\n    return 0;\n}');
    expect(block.lines[2].plainText).toBe("");
    expect(block.lines.map((l) => l.plainText).join("\n")).toBe(block.code);
  });

  it("preserves HTML source literally", () => {
    const block = code('<pre><code class="language-html">&lt;div class="card"&gt;\n  &lt;span&gt;Hello&lt;/span&gt;\n&lt;/div&gt;</code></pre>')!;
    expect(block.code).toContain('<div class="card">');
    expect(block.code).toContain("<span>Hello</span>");
  });

  it("preserves unicode comments", () => {
    const block = code('<pre><code>// संख्या को print करो\ncout &lt;&lt; "✅ Done";</code></pre>')!;
    expect(block.code).toContain("संख्या");
    expect(block.code).toContain("✅ Done");
  });

  it("normalizes syntax token types and reconstructs lines", () => {
    const block = code('<pre><code class="language-js"><span class="hljs-keyword">const</span> x = <span class="hljs-number">10</span>;</code></pre>')!;
    expect(block.source).toBe("dom-highlighted");
    expect(block.lines[0].tokens.some((t) => t.tokenType === "keyword")).toBe(true);
    expect(block.lines[0].tokens.map((t) => t.text).join("")).toBe(block.code);
  });

  it("marks long lines without truncating", () => {
    const longLine = "x".repeat(220);
    const block = code(`<pre><code>${longLine}</code></pre>`)!;
    expect(block.hasLongLines).toBe(true);
    expect(block.maxLineLength).toBe(220);
    expect(block.code).toBe(longLine);
  });
});
