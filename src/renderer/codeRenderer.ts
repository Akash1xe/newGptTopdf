import type { CodeBlock } from "../types/content";
import type { ExportPreferences } from "../types/preferences";
import { el } from "./dom";

export function renderCodeBlock(document: Document, block: CodeBlock, preferences: ExportPreferences): HTMLElement {
  const wrapper = el(document, "figure", `code-block code-theme-${preferences.codeTheme}`);
  if (block.lineCount <= 34) wrapper.classList.add("code-short");
  if (block.hasLongLines) wrapper.classList.add("code-has-long-lines");
  if (preferences.wrapCode) wrapper.classList.add("code-wrap");

  if (preferences.showCodeLanguage && (block.displayLanguage || block.language)) {
    const label = el(document, "figcaption", "code-label");
    label.textContent = block.displayLanguage || block.language || "Code";
    wrapper.appendChild(label);
  }

  const pre = el(document, "pre");
  pre.style.tabSize = String(block.tabSize || 4);
  const code = el(document, "code");
  block.lines.forEach((line, index) => {
    line.tokens.forEach((token) => {
      const span = el(document, "span", `tok tok-${token.tokenType}`);
      span.textContent = token.text;
      code.appendChild(span);
    });
    if (index < block.lines.length - 1) code.appendChild(document.createTextNode("\n"));
  });
  if (!block.lines.length && block.code) code.textContent = block.code;
  pre.appendChild(code);
  wrapper.appendChild(pre);
  return wrapper;
}
