# Phase Implementation Map

## Phase 1 — Foundation

- React + TypeScript + Vite source architecture
- Manifest V3
- popup/content/background surfaces
- typed messaging foundation
- narrow ChatGPT scope

## Phase 2 — Conversation extraction

- ChatGPT provider abstraction
- semantic user/assistant role detection
- ordered message extraction
- stable/fallback message identity
- title, URL and statistics
- SPA-aware current-conversation behavior

## Phase 3 — Structured content

- provider-neutral block/inline model
- paragraphs/headings/emphasis/links
- ordered/unordered/nested lists
- blockquotes/tables/horizontal rules
- safe fallbacks and JSON serialization

## Phase 4 — Code

- exact source/newline/indentation preservation
- language normalization/display labels
- line/token model
- long-line metadata
- inline code
- token reconstruction tests

## Phase 5 — Math

- inline/display math
- TeX/LaTeX source recovery
- sanitized MathML preservation
- readable fallback text
- duplicate visual/semantic math prevention

## Phase 6 — PDF/print rendering

- isolated `print.html`
- extension-owned print CSS
- A4/Letter
- selectable text
- semantic code/table/math/image renderers
- native Chrome print/Save-as-PDF workflow

## Phase 7 — Product UI/preferences

- polished popup
- system light/dark popup appearance
- PDF theme/page/message filter
- title/date/source toggles
- code wrapping/language-label settings
- margin presets
- `chrome.storage.local` preference persistence

## Phase 8 — Reliability

- controlled long-thread collection
- scroll restoration
- safety/timeout/no-progress limits
- completeness metadata and partial-export warning
- streaming/page-change handling
- image/SVG/canvas model/fallback
- parser fault isolation
- development extraction diagnostics

## Phase 9 — Release preparation

- MV3 permission/CSP audit
- runtime network/dangerous-code static scan
- release/package validation scripts
- privacy/security/architecture/release documentation
- Chrome Web Store listing/permission/privacy draft
- release checklist and known limitations

## Verification note

Source-level/static checks available in the build container pass. Dependency-backed `npm install`, Vitest, Vite production build, and manual Chrome PDF testing remain required because the container cannot resolve the npm registry. See `RELEASE_REPORT.md`.
