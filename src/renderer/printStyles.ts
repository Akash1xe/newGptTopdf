import type { ExportPreferences } from "../types/preferences";

const margins = {
  compact: "12mm",
  normal: "16mm",
  comfortable: "20mm"
} as const;

export function buildPrintStyles(preferences: ExportPreferences): string {
  const pageSize = preferences.pageSize === "Letter" ? "Letter" : "A4";
  const margin = margins[preferences.marginPreset];
  return `
@page { size: ${pageSize}; margin: ${margin}; }
:root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; font-size: 14px; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: #f4f4f5; color: #18181b; }
a { color: inherit; text-decoration: underline; text-underline-offset: 2px; overflow-wrap: anywhere; }
.print-toolbar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; background: #fff; border-bottom: 1px solid #e4e4e7; font: 13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
.print-toolbar-actions { display: flex; gap: 8px; }
.print-toolbar button { border: 1px solid #d4d4d8; background: #fff; color: #18181b; border-radius: 8px; padding: 7px 11px; cursor: pointer; }
.print-toolbar button.primary { background: #18181b; color: #fff; border-color: #18181b; }
.print-status { color: #71717a; }
.export-document { width: min(920px, calc(100% - 32px)); margin: 24px auto 64px; padding: 40px 46px; background: #fff; color: #18181b; box-shadow: 0 10px 40px rgba(0,0,0,.08); line-height: 1.58; }
.export-document.theme-dark { background: #18181b; color: #f4f4f5; }
.document-header { border-bottom: 1px solid #e4e4e7; padding-bottom: 18px; margin-bottom: 28px; }
.theme-dark .document-header { border-color: #3f3f46; }
.document-title { font-size: 26px; line-height: 1.2; letter-spacing: -.025em; margin: 0 0 5px; }
.document-subtitle { color: #71717a; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
.theme-dark .document-subtitle, .theme-dark .document-meta { color: #a1a1aa; }
.document-meta { margin-top: 9px; display: flex; flex-wrap: wrap; gap: 8px 16px; color: #71717a; font-size: 11px; }
.message { margin: 0 0 26px; break-inside: auto; }
.message-role { display: inline-block; margin-bottom: 9px; font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .11em; color: #52525b; }
.theme-dark .message-role { color: #d4d4d8; }
.message-user { border-left: 2px solid #a1a1aa; padding-left: 14px; }
.message-assistant { border-left: 2px solid transparent; }
.message-body > :first-child { margin-top: 0; }
.message-body > :last-child { margin-bottom: 0; }
p { margin: 0 0 10px; orphans: 2; widows: 2; }
h1,h2,h3,h4,h5,h6 { line-height: 1.28; margin: 20px 0 9px; break-after: avoid; page-break-after: avoid; }
h1 { font-size: 23px; } h2 { font-size: 19px; } h3 { font-size: 16.5px; } h4 { font-size: 15px; } h5,h6 { font-size: 14px; }
ul,ol { margin: 8px 0 12px; padding-left: 25px; }
li { margin: 3px 0; }
li > p { margin: 0 0 4px; }
blockquote { margin: 12px 0; padding: 8px 13px; border-left: 3px solid #a1a1aa; background: #f4f4f5; break-inside: avoid-page; }
.theme-dark blockquote { background: #27272a; border-color: #71717a; }
hr { border: 0; border-top: 1px solid #e4e4e7; margin: 18px 0; }
.theme-dark hr { border-color: #3f3f46; }
.inline-code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; font-size: .9em; background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 4px; padding: 1px 4px; }
.theme-dark .inline-code { background: #27272a; border-color: #3f3f46; }
.code-block { margin: 13px 0 16px; border: 1px solid #d4d4d8; border-radius: 8px; overflow: hidden; background: #fafafa; break-inside: auto; }
.code-short { break-inside: avoid-page; }
.code-label { padding: 6px 10px; border-bottom: 1px solid #e4e4e7; font: 600 10px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color: #52525b; background: #f4f4f5; }
.code-block pre { margin: 0; padding: 11px 12px; font: 11px/1.55 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace; white-space: pre; tab-size: 4; }
.code-block.code-wrap pre, .code-block.code-has-long-lines pre { white-space: pre-wrap; overflow-wrap: anywhere; word-break: normal; }
.code-theme-dark { background: #18181b; color: #f4f4f5; border-color: #3f3f46; }
.code-theme-dark .code-label { background: #27272a; color: #d4d4d8; border-color: #3f3f46; }
.tok-keyword,.tok-type,.tok-builtin { color: #7c3aed; } .tok-string,.tok-regex { color: #047857; } .tok-number,.tok-boolean { color: #b45309; } .tok-comment { color: #6b7280; font-style: italic; } .tok-function,.tok-class-name { color: #0369a1; } .tok-tag,.tok-attribute,.tok-property { color: #9f1239; }
.code-theme-dark .tok-keyword,.code-theme-dark .tok-type,.code-theme-dark .tok-builtin { color: #c4b5fd; } .code-theme-dark .tok-string,.code-theme-dark .tok-regex { color: #6ee7b7; } .code-theme-dark .tok-number,.code-theme-dark .tok-boolean { color: #fbbf24; } .code-theme-dark .tok-comment { color: #a1a1aa; } .code-theme-dark .tok-function,.code-theme-dark .tok-class-name { color: #7dd3fc; } .code-theme-dark .tok-tag,.code-theme-dark .tok-attribute,.code-theme-dark .tok-property { color: #fda4af; }
.math { font-family: "STIX Two Math", "Cambria Math", "Times New Roman", serif; }
.math-inline { display: inline-block; vertical-align: -0.1em; max-width: 100%; }
.math-block { display: block; margin: 12px 0; text-align: center; overflow-wrap: anywhere; break-inside: avoid-page; }
.math math { max-width: 100%; font-size: 1.04em; }
.math-fallback { font-family: "Cambria Math", "Times New Roman", serif; white-space: pre-wrap; }
.math-simple { display: inline-flex; align-items: baseline; }
.math-radicand { border-top: 1px solid currentColor; padding: 0 2px; }
.math-fraction { display: inline-grid; grid-template-rows: auto auto; vertical-align: middle; text-align: center; line-height: 1.12; }
.math-num { border-bottom: 1px solid currentColor; padding: 0 3px 1px; } .math-den { padding: 1px 3px 0; }
.table-shell { width: 100%; overflow: hidden; margin: 13px 0 16px; }
table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 12px; }
th,td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
th { background: #f4f4f5; font-weight: 700; }
.theme-dark th,.theme-dark td { border-color: #52525b; } .theme-dark th { background: #27272a; }
thead { display: table-header-group; } tr { break-inside: avoid; }
.media-block { margin: 14px 0; text-align: center; break-inside: avoid-page; }
.media-block img { display: block; max-width: 100%; max-height: 240mm; width: auto; height: auto; margin: 0 auto; object-fit: contain; }
.media-block figcaption { margin-top: 6px; font-size: 11px; color: #71717a; }
.media-placeholder { padding: 14px; border: 1px dashed #a1a1aa; color: #71717a; font-size: 12px; }
@media print {
  html, body { background: transparent !important; }
  .print-toolbar { display: none !important; }
  .export-document, .export-document.theme-dark { width: auto; margin: 0; padding: 0; box-shadow: none; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .message { margin-bottom: 20px; }
  .document-header { margin-bottom: 22px; }
  .table-shell { overflow: visible; }
}
`;
}
