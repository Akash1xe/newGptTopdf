# Release Checklist — v1.0.1 candidate

## Code

- [x] Phase 1–8 architecture integrated in source.
- [x] Static runtime safety scan passes.
- [x] Core/parser/provider/renderer TypeScript validation passes with available local compiler.
- [x] No development-phase placeholder UI text found in production source.
- [x] No explicit `fetch`, XHR, WebSocket, beacon, `eval`, or `new Function` found in runtime source.
- [ ] `npm install` completes from a clean checkout.
- [ ] `npm audit` reviewed.
- [ ] `npm run typecheck` passes using installed project dependencies.
- [ ] `npm run test` passes using real Vitest/jsdom packages.
- [ ] `npm run build` produces `dist/`.
- [ ] `npm run validate:release` passes against `dist/`.

## Manifest

- [x] Manifest V3.
- [x] Version set to 1.0.1 candidate.
- [x] Permissions limited to `activeTab` and `storage`.
- [x] Content-script scope limited to `https://chatgpt.com/*`.
- [x] No `<all_urls>`.
- [x] Local executable scripts only.
- [x] No `unsafe-eval`.
- [x] 16/32/48/128 PNG icons present at correct pixel sizes.

## Functional

- [x] Conversation/provider extraction implementation present.
- [x] Structured parser implementation present.
- [x] Code preservation/rendering implementation present.
- [x] Math extraction/rendering/fallback implementation present.
- [x] Math v1.0.1 source repair: current `data-math-source`, TeX annotation, MathML namespace, KaTeX print assets/fonts wait, display-math classification.
- [x] Table rendering implementation present.
- [x] Image/fallback implementation present.
- [x] Long-thread controlled collection implementation present.
- [x] Completeness warning flow implemented.
- [x] Streaming/page-change error handling implemented.
- [x] Preferences/filtering/export orchestration implemented.
- [ ] Fresh production Chrome install tested.
- [ ] Short real ChatGPT conversation exported.
- [ ] Assistant-only export tested.
- [ ] Long/virtualized conversation tested.
- [ ] Regenerated/edited branch behavior manually tested.
- [ ] Streaming-response export block manually tested.

## PDF quality

- [ ] A4 PDF inspected.
- [ ] Letter PDF inspected.
- [ ] Light PDF inspected.
- [ ] Dark PDF inspected.
- [ ] 10+ page PDF inspected.
- [ ] Text selection confirmed.
- [ ] Code indentation/blank lines confirmed.
- [ ] Long code-line behavior confirmed.
- [ ] Table pagination confirmed.
- [ ] Root/fraction/superscript/subscript confirmed in an ACTUAL generated PDF after v1.0.1 patch.
- [ ] Integral/summation/matrix/quadratic formula confirmed in an ACTUAL generated PDF after v1.0.1 patch.
- [ ] Unicode/Hindi/CJK sample confirmed.
- [ ] Image rendering/fallback confirmed.

## Privacy and security

- [x] Data-flow documentation created.
- [x] Public privacy-policy draft created.
- [x] No developer-controlled backend in source.
- [x] No analytics SDK in source.
- [x] Preferences storage documented.
- [x] Temporary session print-job storage documented.
- [x] Conversation content is not intentionally stored as persistent history.
- [x] Remote executable code prohibited by architecture/static audit.
- [x] Link/MathML/SVG sanitization architecture documented.
- [ ] Dependency audit completed once registry access is available.
- [ ] Public support/privacy contact inserted before publication.
- [ ] Public privacy policy hosted and URL added to Developer Dashboard.

## Chrome Web Store

- [x] Store listing draft created.
- [x] Single-purpose statement created.
- [x] Permission justifications created.
- [x] Privacy disclosure notes created.
- [x] Screenshot plan created.
- [x] Original 128px extension icon exists.
- [ ] Actual production screenshots captured.
- [ ] Publisher/developer account configured.
- [ ] Google Account 2-step verification confirmed.
- [ ] Store Listing tab completed.
- [ ] Privacy tab completed.
- [ ] Support/contact information completed.
- [ ] Production release ZIP generated from verified `dist/`.
- [ ] ZIP inspected with `manifest.json` at root.
- [ ] Package uploaded as draft.
- [ ] Chrome Web Store pre-submission installation test passes.
- [ ] Item submitted for review by account holder.
