import type { ExportPreferences } from "../types/preferences";
import { resolvePdfAppearance } from "../services/pdfAppearanceService";

export function buildPrintStyles(preferences: ExportPreferences): string {
  const pageSize = preferences.pageSize === "Letter" ? "Letter" : "A4";
  const appearance = resolvePdfAppearance(preferences);
  return `
@page { size: ${pageSize}; margin: ${appearance.marginTop} ${appearance.marginRight} ${appearance.marginBottom} ${appearance.marginLeft}; }
:root {
  color-scheme: light dark;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  font-size: 14px;
  --pdf-body-font: ${appearance.bodyFontFamily};
  --pdf-body-size: ${appearance.bodyFontSize};
  --pdf-code-size: ${appearance.codeFontSize};
  --pdf-line-height: ${appearance.lineHeight};
  --pdf-message-padding: ${appearance.messagePadding};
  --pdf-message-gap: ${appearance.messageSpacing};
  --pdf-paragraph-gap: ${appearance.paragraphSpacing};
  --pdf-margin-top: ${appearance.marginTop};
  --pdf-margin-right: ${appearance.marginRight};
  --pdf-margin-bottom: ${appearance.marginBottom};
  --pdf-margin-left: ${appearance.marginLeft};
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: #f4f4f5; color: #18181b; }
a { color: inherit; text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere; }
.print-toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: #fff; border-bottom: 1px solid #e4e4e7; font: 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.print-toolbar-actions { display: flex; gap: 8px; }
.print-toolbar button { border: 1px solid #d4d4d8; background: #fff; color: #18181b; border-radius: 8px; padding: 7px 11px; cursor: pointer; }
.print-toolbar button.primary { background: #18181b; color: #fff; border-color: #18181b; }
.print-status { color: #71717a; }
.export-document { width: min(920px, calc(100% - 32px)); margin: 24px auto 64px; padding: 40px 46px; background: #fff; color: #18181b; box-shadow: 0 10px 40px rgba(0,0,0,.08); font-family: var(--pdf-body-font); font-size: var(--pdf-body-size); line-height: var(--pdf-line-height); }
.export-document.theme-dark { background: #18181b; color: #f4f4f5; }
.document-header { border-bottom: 1px solid #e4e4e7; padding-bottom: 1.25em; margin-bottom: 1.7em; }
.theme-dark .document-header { border-color: #3f3f46; }
.document-title { font-size: 1.85em; line-height: 1.2; letter-spacing: -.025em; margin: 0 0 .2em; }
.document-subtitle { color: #71717a; font-size: .78em; text-transform: uppercase; letter-spacing: .08em; }
.theme-dark .document-subtitle, .theme-dark .document-meta { color: #a1a1aa; }
.document-meta { margin-top: .7em; display: flex; flex-wrap: wrap; gap: .6em 1.2em; color: #71717a; font-size: .72em; }
.message { margin: 0 0 var(--pdf-message-gap); break-inside: auto; }
.message-role { display: inline-block; margin-bottom: .5em; font-size: .7em; font-weight: 750; text-transform: uppercase; letter-spacing: .11em; color: #52525b; }
.theme-dark .message-role { color: #d4d4d8; }
.message-user { border-left: 2px solid #a1a1aa; padding-left: 14px; }
.message-assistant { border-left: 2px solid transparent; }
.message-body { padding-block: var(--pdf-message-padding); }
.message-body > :first-child { margin-top: 0; }
.message-body > :last-child { margin-bottom: 0; }
p { margin: 0 0 var(--pdf-paragraph-gap); orphans: 2; widows: 2; }
h1,h2,h3,h4,h5,h6 { line-height: 1.28; margin: 1.25em 0 .55em; break-after: avoid; page-break-after: avoid; }
h1 { font-size: 1.65em; } h2 { font-size: 1.4em; } h3 { font-size: 1.22em; } h4 { font-size: 1.1em; } h5,h6 { font-size: 1em; }
ul,ol { margin: .55em 0 .8em; padding-left: 1.8em; }
li { margin: .2em 0; }
li > p { margin: 0 0 .25em; }
blockquote { margin: .8em 0; padding: .55em .9em; border-left: 3px solid #a1a1aa; background: #f4f4f5; break-inside: avoid-page; }
.theme-dark blockquote { background: #27272a; border-color: #71717a; }
hr { border: 0; border-top: 1px solid #e4e4e7; margin: 1.2em 0; }
.theme-dark hr { border-color: #3f3f46; }
.inline-code { font-family: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: .9em; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 4px; padding: 1px 4px; }
.theme-dark .inline-code { background: #27272a; border-color: #3f3f46; }
.code-block { margin: .85em 0 1em; border: 1px solid #d4d4d8; border-radius: 8px; overflow: hidden; background: #fafafa; break-inside: auto; }
.code-short { break-inside: avoid-page; }
.code-label { padding: 6px 10px; border-bottom: 1px solid #e4e4e7; font: 600 10px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color: #52525b; background: #f4f4f5; }
.code-block pre { margin: 0; padding: 11px 12px; font-family: ui-monospace, "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: var(--pdf-code-size); line-height: 1.55; white-space: pre; tab-size: 4; }
.code-block.code-wrap pre, .code-block.code-has-long-lines pre { white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; }
.code-theme-dark { background: #18181b; color: #f4f4f5; border-color: #3f3f46; }
.code-theme-dark .code-label { background: #27272a; color: #d4d4d8; border-color: #3f3f46; }
.tok-keyword,.tok-type,.tok-builtin { color: #7c3aed; } .tok-string,.tok-regex { color: #047857; } .tok-number,.tok-boolean { color: #b45309; } .tok-comment { color: #6b7280; font-style: italic; } .tok-function,.tok-class-name { color: #0369a1; } .tok-tag,.tok-attribute,.tok-property { color: #9f1239; }
.code-theme-dark .tok-keyword,.code-theme-dark .tok-type,.code-theme-dark .tok-builtin { color: #c4b5fd; } .code-theme-dark .tok-string,.code-theme-dark .tok-regex { color: #6ee7b7; } .code-theme-dark .tok-number,.code-theme-dark .tok-boolean { color: #fbbf24; } .code-theme-dark .tok-comment { color: #a1a1aa; } .code-theme-dark .tok-function,.code-theme-dark .tok-class-name { color: #7dd3fc; } .code-theme-dark .tok-tag,.code-theme-dark .tok-attribute,.code-theme-dark .tok-property { color: #fda4af; }
.math { max-width: 100%; }
.math-inline { display: inline; vertical-align: baseline; }
.math-block { display: block; margin: .8em 0; text-align: center; overflow: visible; break-inside: avoid-page; }
.math .katex { font-size: 1.06em; color: inherit; }
.math-inline > .katex { display: inline; }
.math-block > .katex-display { margin: 0; overflow: visible; }
.math .katex-html { white-space: nowrap; }
.math math { max-width: 100%; }
.math-fallback { font-family: "Cambria Math", "Times New Roman", serif; white-space: pre-wrap; overflow-wrap: anywhere; }
.math-simple { display: inline-flex; align-items: baseline; }
.math-radicand { border-top: 1px solid currentColor; padding: 0 2px; }
.math-fraction { display: inline-grid; grid-template-rows: auto auto; vertical-align: middle; text-align: center; line-height: 1.12; }
.math-num { border-bottom: 1px solid currentColor; padding: 0 3px 1px; } .math-den { padding: 1px 3px 0; }
.table-shell { width: 100%; overflow: hidden; margin: .85em 0 1em; }
table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: .88em; }
th,td { border: 1px solid #d4d4d8; padding: .45em .6em; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { background: #f4f4f5; font-weight: 700; }
.theme-dark th,.theme-dark td { border-color: #52525b; } .theme-dark th { background: #27272a; }
thead { display: table-header-group; } tr { break-inside: avoid; }
.media-block { margin: .95em 0; text-align: center; break-inside: avoid-page; }
.media-block img { display: block; max-width: 100%; max-height: 240mm; width: auto; height: auto; margin: 0 auto; object-fit: contain; }
.media-block figcaption { margin-top: .45em; font-size: .8em; color: #71717a; }
.media-placeholder { padding: 1em; border: 1px dashed #a1a1aa; color: #71717a; font-size: .85em; }
@media print {
  html, body { background: transparent !important; }
  .print-toolbar { display: none !important; }
  .export-document, .export-document.theme-dark { width: auto; margin: 0; padding: 0; box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .message { margin-bottom: var(--pdf-message-gap); }
  .document-header { margin-bottom: 1.45em; }
  .table-shell { overflow: visible; }
}
`;
}
