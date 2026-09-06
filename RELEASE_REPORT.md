# Release Report — ChatGPT to PDF v1.0.0

_Date: September 6, 2026_

## 1. Production status

**NOT READY FOR RELEASE (verification incomplete in this environment)**

The source implementation is integrated through the Phase 9 release-preparation layer and passes the static/source checks available in this container. However, npm registry DNS access is unavailable here (`EAI_AGAIN`), which prevents installation of the declared project dependencies. Therefore the real Vitest suite, full project `tsc` invocation with installed `@types/*`, Vite/esbuild production build, release-package validation, and real Chrome PDF tests cannot be honestly marked as passed.

This is a verification blocker, not an assertion that those steps will fail.

## 2. Major implementation completed

- Manifest V3 extension foundation and popup/content/background communication.
- Provider-based ChatGPT detection/extraction.
- Structured provider-neutral conversation model.
- Semantic prose/list/table/link parser.
- Exact code model and renderer.
- Math extraction with TeX/MathML/fallback model and locally bundled KaTeX print rendering.
- Image/SVG/canvas extraction/fallback model.
- Isolated print document and native PDF workflow.
- PDF preferences and versioned local settings.
- Long-conversation controlled collection, completeness metadata, scroll restoration and safety limits.
- Streaming/page-change/error handling.
- Production/static audit scripts and release-package scripts.
- Release/privacy/security/store documentation.

## 3. Manifest audit

- Manifest: V3
- Name: ChatGPT to PDF
- Version: 1.0.0
- Permissions: `activeTab`, `storage`
- Content-script host: `https://chatgpt.com/*`
- Background: MV3 service worker
- CSP: packaged/self executable scripts; no `unsafe-eval`
- `<all_urls>`: not requested

## 4. Permission justification

- `activeTab`: active supported ChatGPT conversation status/extraction after user interaction.
- `storage`: local export preferences plus one temporary `chrome.storage.session` print job.
- `chatgpt.com` content script: required for the single purpose of reading the conversation to export it.

## 5. Security audit performed

`node scripts/validate-static.mjs` was run and passed.

The runtime source scan found no explicit:

- `eval()`
- `new Function()`
- `fetch()`
- `XMLHttpRequest`
- `WebSocket`
- `sendBeacon`
- remote `<script src="https://...">`

Production detailed logging is gated to development mode. The manifest is scoped to ChatGPT and uses MV3.

Dependency vulnerability status is **unverified** because `npm install`/`npm audit` cannot reach the registry in this environment.

## 6. Privacy audit

The extension handles website/user-generated/personal-communication content because it reads the active ChatGPT conversation for export.

Expected data flow:

```text
active ChatGPT conversation
  -> content script/provider
  -> normalized conversation in memory
  -> temporary chrome.storage.session print job
  -> isolated print document
  -> print preview
  -> temporary job removed
```

Persistent extension storage is limited to export preferences in `chrome.storage.local`.

No developer-controlled backend or analytics SDK is present in the current source.

Images referenced by a conversation may still be loaded by the browser from their original URL during printing; this is disclosed in the privacy draft.

## 7. Type/source validation results actually run

The following checks were run successfully with the compiler/tools available in the environment:

- `node scripts/validate-static.mjs` — PASS
- `python -m json.tool public/manifest.json` — PASS
- `tsc -p tsconfig.core.json` — PASS
- `tsc -p tsconfig.logic.json` — PASS
- `tsc -p tsconfig.runtime-logic.json` — PASS
- `tsc -p tsconfig.popup-validation.json` — PASS
- `node --check` on build/package/release/static scripts — PASS
- Icon dimensions verified: 16x16, 32x32, 48x48, 128x128 — PASS

The validation TypeScript configurations use local declaration stubs for unavailable dependency packages where necessary; they are supplemental source-shape checks, not a replacement for `npm run typecheck` after dependency installation.

## 8. Dependency-backed commands not verified

Blocked by npm registry DNS failure:

```text
EAI_AGAIN getaddrinfo registry.npmjs.org
```

Therefore these remain required:

- `npm install`
- `npm audit`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run validate:release`
- `npm run package:release`

## 9. Manual Chrome/PDF tests not verified here

A real production `dist/` has not been loaded into Chrome in this container. Required manual scenarios remain unchecked in `RELEASE_CHECKLIST.md`, including:

- A4/Letter
- light/dark
- 10+ page PDF
- code pagination
- advanced math visual fidelity
- long virtualized conversation
- image embedding/fallback
- streaming response
- SPA navigation
- repeated export cleanup

## 10. Chrome Web Store preparation

Current official documentation was reviewed on September 6, 2026. The source/store documents account for:

- Manifest V3 / no remotely hosted executable code;
- narrow/minimum permissions;
- Store Listing and Privacy tabs;
- user-data/privacy-policy requirement because the extension handles website/user-generated/personal communication content even when processing is local;
- 2-step verification requirement for publishing/updating;
- 128x128 packaged extension icon;
- at least one store screenshot, with official guidance currently specifying 1280x800 or 640x400;
- ZIP package with `manifest.json` at root;
- current pre-submission installation testing after draft upload.

## 11. Store listing material

See `STORE_LISTING.md` for:

- name
- short/detailed description
- single-purpose statement
- permission justifications
- privacy disclosure notes
- screenshot plan

## 12. Accessibility implementation

The popup uses semantic buttons/selects/labels, visible focus styles, keyboard-operable native controls, `aria-expanded` for expandable options, and status feedback. A final manual keyboard/screen-reader pass is still required on the built extension.

## 13. Known limitations

See `KNOWN_LIMITATIONS.md`.

KaTeX supports a broad TeX subset but not every possible package or macro, so rare unsupported expressions can degrade to sanitized MathML or fallback text. Real ChatGPT math must still be manually tested against current production ChatGPT before release.

## 14. Release artifact status

A **source archive** can be produced now.

A Chrome Web Store production ZIP should **not** be labelled as verified/release-ready until a dependency-backed `dist/` is built and the remaining checks pass. The existing `npm run package:release` script will generate the final store ZIP after those prerequisites.

## 15. Manual steps remaining for the developer/account holder

1. Run the clean dependency/test/build sequence on a machine with npm registry access.
2. Load the resulting `dist/` as a fresh unpacked extension and complete the PDF/manual test matrix.
3. Capture actual store screenshots.
4. Add a real public support/privacy contact and host `PRIVACY.md` at a public URL.
5. Configure/verify the Chrome Web Store publisher account and Google 2-step verification.
6. Fill the Store Listing and Privacy tabs accurately.
7. Generate/upload the verified release ZIP.
8. Review the automated installation test on the draft.
9. Submit for review only after all release blockers are cleared.
