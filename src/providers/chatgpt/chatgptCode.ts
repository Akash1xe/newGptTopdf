import type { CodeBlock, CodeLine, CodeToken, CodeTokenType } from "../../types/content";
import { normalizeNewlines } from "../../parser/sanitization";

const LANGUAGE_ALIASES: Record<string, string> = {
  "c++": "cpp", cpp: "cpp", cxx: "cpp",
  js: "javascript", javascript: "javascript",
  ts: "typescript", typescript: "typescript",
  py: "python", python: "python",
  sh: "bash", shell: "bash", bash: "bash",
  jsx: "jsx", tsx: "tsx", html: "html", xml: "xml",
  css: "css", json: "json", java: "java", c: "c", csharp: "csharp", cs: "csharp",
  go: "go", rust: "rust", sql: "sql", markdown: "markdown", md: "markdown"
};

const DISPLAY_NAMES: Record<string, string> = {
  cpp: "C++", javascript: "JavaScript", typescript: "TypeScript", python: "Python", bash: "Bash",
  jsx: "JSX", tsx: "TSX", html: "HTML", xml: "XML", css: "CSS", json: "JSON", java: "Java",
  c: "C", csharp: "C#", go: "Go", rust: "Rust", sql: "SQL", markdown: "Markdown"
};

export function normalizeLanguage(input: string | null | undefined): string | undefined {
  const normalized = input?.trim().toLowerCase().replace(/^language-/, "");
  if (!normalized) return undefined;
  return LANGUAGE_ALIASES[normalized] ?? (normalized.match(/^[a-z0-9+#.-]{1,30}$/) ? normalized : undefined);
}

function tokenTypeFromClasses(classes: string[]): CodeTokenType {
  const joined = classes.join(" ").toLowerCase();
  const rules: Array<[string[], CodeTokenType]> = [
    [["keyword"], "keyword"], [["string", "quote"], "string"], [["number", "literal"], "number"],
    [["comment"], "comment"], [["function", "title.function"], "function"], [["variable"], "variable"],
    [["operator"], "operator"], [["punctuation"], "punctuation"], [["property", "attr"], "property"],
    [["class", "class-name", "title.class"], "class-name"], [["type"], "type"], [["builtin", "built_in"], "builtin"],
    [["boolean"], "boolean"], [["regex"], "regex"], [["tag"], "tag"], [["attribute", "attr-name"], "attribute"]
  ];
  for (const [needles, type] of rules) if (needles.some((needle) => joined.includes(needle))) return type;
  return "plain";
}

function flattenTokens(root: Element): CodeToken[] {
  const tokens: CodeToken[] = [];
  const visit = (node: Node, inheritedClasses: string[]) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeNewlines(node.textContent ?? "");
      if (text) tokens.push({ text, tokenType: tokenTypeFromClasses(inheritedClasses), classNames: inheritedClasses.length ? inheritedClasses : undefined });
      return;
    }
    if (!(node instanceof Element)) return;
    const classes = [...inheritedClasses, ...Array.from(node.classList)];
    node.childNodes.forEach((child) => visit(child, classes));
  };
  root.childNodes.forEach((child) => visit(child, []));
  return tokens;
}

function trimOneStructuralTrailingNewline(code: string, tokens: CodeToken[]): { code: string; tokens: CodeToken[] } {
  if (!code.endsWith("\n")) return { code, tokens };
  const next = code.slice(0, -1);
  const copy = tokens.map((token) => ({ ...token }));
  for (let i = copy.length - 1; i >= 0; i--) {
    if (!copy[i].text) continue;
    if (copy[i].text.endsWith("\n")) copy[i].text = copy[i].text.slice(0, -1);
    break;
  }
  return { code: next, tokens: copy.filter((token) => token.text.length > 0) };
}

function tokensToLines(tokens: CodeToken[], code: string): CodeLine[] {
  const lines: CodeLine[] = [{ number: 1, tokens: [], plainText: "" }];
  for (const token of tokens) {
    const parts = token.text.split("\n");
    parts.forEach((part, index) => {
      if (part) {
        const current = lines[lines.length - 1];
        current.tokens.push({ ...token, text: part });
        current.plainText += part;
      }
      if (index < parts.length - 1) lines.push({ number: lines.length + 1, tokens: [], plainText: "" });
    });
  }
  const expected = code.split("\n");
  while (lines.length < expected.length) lines.push({ number: lines.length + 1, tokens: [], plainText: "" });
  return lines;
}

function detectLanguage(code: Element, pre: Element): { language?: string; displayLanguage?: string } {
  const candidates: string[] = [];
  for (const element of [code, pre]) {
    candidates.push(element.getAttribute("data-language") ?? "", element.getAttribute("lang") ?? "");
    for (const cls of Array.from(element.classList)) if (cls.startsWith("language-")) candidates.push(cls.slice(9));
  }
  const wrapper = pre.parentElement;
  const labelCandidates = wrapper ? Array.from(wrapper.querySelectorAll(':scope > div:first-child span, :scope > div:first-child div')).map((el) => el.textContent?.trim() ?? "") : [];
  candidates.push(...labelCandidates.filter((text) => text && !/copy|copied/i.test(text) && text.length < 30));
  for (const candidate of candidates) {
    const language = normalizeLanguage(candidate);
    if (language) return { language, displayLanguage: DISPLAY_NAMES[language] ?? candidate.trim() };
  }
  return {};
}

export function isCodeBlockElement(element: Element): boolean {
  return element.tagName.toLowerCase() === "pre";
}

export function extractCodeBlock(element: Element): CodeBlock | null {
  const pre = element.tagName.toLowerCase() === "pre" ? element : element.closest("pre");
  if (!pre) return null;
  const codeElement = pre.querySelector("code") ?? pre;
  let tokens = flattenTokens(codeElement);
  let code = normalizeNewlines(codeElement.textContent ?? "");
  ({ code, tokens } = trimOneStructuralTrailingNewline(code, tokens));
  const lines = tokensToLines(tokens, code);
  const hasHighlightedTokens = tokens.some((token) => token.tokenType !== "plain");
  const { language, displayLanguage } = detectLanguage(codeElement, pre);
  const lengths = code.split("\n").map((line) => line.length);
  const maxLineLength = lengths.length ? Math.max(...lengths) : 0;
  return {
    type: "code",
    language,
    displayLanguage,
    code,
    lines,
    source: hasHighlightedTokens ? "dom-highlighted" : "plain",
    lineCount: code === "" ? 0 : code.split("\n").length,
    hasLongLines: maxLineLength > 100,
    maxLineLength,
    tabSize: 4
  };
}
