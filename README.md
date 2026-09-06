# ChatGPT to PDF

A privacy-focused Chrome Manifest V3 extension for exporting ChatGPT conversations to clean, selectable-text PDFs while preserving structured formatting, code, tables, images where available, and mathematical notation.

> This project is an independent browser extension and is not affiliated with, endorsed by, or an official product of OpenAI.

## Features

- Detects the current `chatgpt.com` conversation.
- Extracts user and assistant messages into a provider-neutral document model.
- Preserves headings, paragraphs, emphasis, links, lists, nested lists, blockquotes, tables, and horizontal rules.
- Preserves inline code and multi-line code with indentation, blank lines, language labels, and normalized syntax-token categories.
- Preserves mathematical content using recovered TeX/LaTeX rendered with locally bundled KaTeX, sanitized MathML, and readable fallback text.
- Supports conversation images, safe SVG/canvas fallbacks, and placeholders when an image cannot be embedded.
- Uses controlled collection for long/virtualized conversations and restores the user's scroll position.
- Detects incomplete/streaming conversations and warns instead of silently claiming completeness.
- Exports through an isolated print document, so the PDF does not depend on ChatGPT's page CSS.
- Supports A4 and Letter, light/dark PDF themes, message filtering, margin presets, code wrapping, and metadata toggles.
- Stores export preferences locally; conversation content is not intentionally persisted as history.
- No backend, analytics, cloud PDF service, CDN math renderer, or conversation upload.

## Export flow

```text
ChatGPT DOM
  -> ChatGPT provider
  -> conversation collector
  -> normalized conversation model
  -> structured parser
  -> code / math / image handling
  -> isolated print renderer
  -> Chrome print preview
  -> Save as PDF
```

The generated document uses normal HTML/CSS print layout rather than screenshots, so text remains selectable and code/math can be rendered semantically.

## Project structure

```text
src/
  background/       Manifest V3 service worker
  content/          page/content-script messaging
  parser/           provider-neutral structured DOM parsing
  popup/            React popup UI and components
  print/            isolated print-page entry point
  providers/
    chatgpt/         ChatGPT selectors, extraction, collection, media adapters
  renderer/          normalized model -> export DOM renderers
  services/          preferences, print jobs, export orchestration
  types/             JSON-serializable normalized models
  utils/             small shared utilities
public/
  icons/             extension icons
  manifest.json
scripts/             build, static audit, release validation/package scripts
tests/               parser, extraction, renderer, settings and reliability tests
```

See `ARCHITECTURE.md` for more detail. The targeted v1.0.1 math-rendering repair is documented in `MATH_FIX_REPORT.md`.

## Requirements

- Node.js >= 22.12.0
- npm
- Chrome/Chromium with Manifest V3 support

## Install dependencies

```bash
npm install
```

## Development

```bash
npm run dev
```

## Validation

```bash
npm run validate:static
npm run typecheck
npm run test
npm run build
npm run validate:release
```

Or run the complete sequence:

```bash
npm run check
```

## Build and load in Chrome

```bash
npm run build
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the generated `dist/` directory.
5. Open a conversation on `https://chatgpt.com/`.
6. Open **ChatGPT to PDF**.
7. Choose export preferences and click **Export PDF**.
8. In Chrome print preview, choose **Save as PDF**.

## Release package

After a successful production build and validation:

```bash
npm run package:release
```

The packaging script is designed to place `manifest.json` at the ZIP root as required by the Chrome Web Store.

## Privacy

The extension reads the active ChatGPT conversation only to provide its export feature. Conversation data is processed in the browser. A temporary print job is placed in `chrome.storage.session` so the isolated print page can render it, then removed after rendering. Export preferences are stored in `chrome.storage.local`.

The project does not intentionally send conversation content to a developer-controlled server and contains no analytics SDK. Some images already referenced by the ChatGPT conversation may be loaded by the browser from their original URL when the print document renders them; inaccessible images degrade to a placeholder.

Read `PRIVACY.md` before publishing. Chrome Web Store policy treats scraped website content, personal communications, and user-generated content as user data, so a public privacy policy is required even when processing is local.

## Permissions

- `activeTab` — reads the active supported ChatGPT tab when the user interacts with the extension.
- `storage` — stores export preferences locally and passes one temporary print job through session storage.
- Content-script scope is limited to `https://chatgpt.com/*`.

The extension does not request `<all_urls>`.

## Security

- Manifest V3.
- No `eval()` or `new Function()`.
- No remotely hosted executable JavaScript.
- URL sanitization for links.
- MathML/SVG sanitization before rendering.
- Conversation code blocks are treated as text and are never executed.
- Production logging does not intentionally dump private conversation content.

See `SECURITY.md`.

## Known limitations

See `KNOWN_LIMITATIONS.md`. The main limitations are around future ChatGPT DOM changes, cross-origin image embedding, and rare TeX/LaTeX constructs not supported by KaTeX.

## Release status

See `RELEASE_REPORT.md` and `RELEASE_CHECKLIST.md` for the exact verification status. Do not publish based only on source review; run the dependency-backed test/build sequence and manual Chrome PDF tests first.

## License

No open-source license has been selected in this repository. Choose one deliberately before publishing the source as an open-source project.
