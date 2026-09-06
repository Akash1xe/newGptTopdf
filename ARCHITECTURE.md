# Architecture

## Purpose

ChatGPT to PDF has one narrow purpose: export the current ChatGPT conversation as a formatted PDF while preserving structured content as faithfully as practical.

The system is intentionally split into provider-specific extraction and provider-neutral document/rendering layers. This keeps ChatGPT DOM selectors out of the PDF renderer and leaves room for other providers without rewriting the normalized model.

## Runtime pipeline

```text
chatgpt.com
  |
  | content script
  v
ChatGPT Provider
  |- detector
  |- selectors
  |- DOM utilities
  |- snapshot extractor
  |- long-thread collector
  |- media adapter
  v
Normalized ConversationData
  |- metadata/completeness
  |- ordered messages
  |- provider-neutral ContentBlock[]
  v
Structured Renderer
  |- inline renderer
  |- block renderer
  |- code renderer
  |- math renderer
  |- image renderer
  |- table renderer
  v
Transient Print Job
  |  chrome.storage.session
  v
Isolated print.html
  |- dedicated print CSS
  |- A4/Letter
  |- light/dark
  |- native browser print
  v
Save as PDF
```

## Major modules

### `src/providers/chatgpt/`

Contains all ChatGPT-specific knowledge: stable semantic selectors, role detection, message IDs, route/conversation identity, long-thread collection, streaming detection, and media extraction.

Selectors are centralized so a ChatGPT DOM change can be repaired without modifying the generic parser or PDF renderer.

### `src/parser/`

Converts supported message DOM into JSON-serializable semantic blocks. The parser handles prose, headings, emphasis, links, lists, blockquotes, tables, code, math and media. Unsupported/malformed elements recursively fall back to meaningful text rather than failing the whole conversation.

### `src/types/`

Defines the normalized provider-neutral model. No DOM nodes or functions are stored. This is important because the data crosses Chrome extension messaging/storage boundaries.

### `src/renderer/`

Transforms the normalized model into a dedicated export DOM. It does not depend on ChatGPT CSS or generated class names.

Code tokens are mapped to extension-owned CSS classes. Math uses locally bundled KaTeX for recovered TeX/LaTeX, then sanitized semantic MathML and readable fallback text. KaTeX CSS/fonts are packaged by the Vite build rather than loaded from a CDN. Images are constrained to the page and use placeholders on failure.

### `src/services/`

- `settingsService.ts`: versioned `chrome.storage.local` preferences.
- `printJobService.ts`: temporary `chrome.storage.session` handoff.
- `pdfExportService.ts`: filtering/options/export orchestration.

### `src/popup/`

React UI for page state, conversation summary, export preferences, completeness warnings and export triggering. The popup coordinates services; it does not implement parser/rendering internals.

### `src/print/`

Loads the temporary print job, renders the isolated export document, waits briefly for media, removes the temporary job, and invokes native print preview. A manual Print button remains as a fallback.

## Long conversation strategy

ChatGPT can virtualize older turns. Full extraction uses controlled upward collection:

1. Record current conversation URL and scroll position.
2. Collect currently mounted messages.
3. Scroll upward in controlled steps.
4. Wait for older messages to mount.
5. Merge using stable IDs and order/context rather than plain-text-only deduplication.
6. Stop when the top/no-progress/safety limit is reached.
7. Restore the original scroll position.
8. Return completeness metadata.

The exporter warns when completeness cannot be guaranteed.

## Security boundaries

- Conversation content is untrusted.
- Message code is never evaluated.
- Parsed content becomes typed data instead of arbitrary raw HTML.
- Links use a protocol allowlist.
- SVG/MathML are sanitized before retaining/rendering their semantic markup.
- Extension pages use Manifest V3 CSP and packaged scripts only.

## State/storage

### Persisted

`chrome.storage.local` stores only versioned export preferences.

### Transient

`chrome.storage.session` stores the selected normalized conversation/options only long enough for the print page to render the job. The print page removes the job after loading it.

### Not intentionally persisted

Full conversation history, code, equations, and images are not intentionally saved as a reusable history/database by the extension.

## Failure model

Failures are isolated as low as possible:

- malformed block -> plain-text/block fallback
- malformed math -> MathML/text fallback
- image load failure -> placeholder
- one malformed message -> does not abort all other messages
- page navigation during collection -> typed page-change failure
- streaming response -> export warning/error
- incomplete long history -> explicit completeness warning
