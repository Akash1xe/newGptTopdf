# Project status — Phase 1 through Phase 5

Implemented scope matches the requested Phase 1–5 boundary. PDF rendering/export is intentionally not implemented yet.

## Validation completed in the build environment

- `tsc -p tsconfig.core.json` — PASS (strict normalized models, parser, ChatGPT provider, code and math extraction)
- full `src/` TypeScript/TSX source syntax/type-shape validation with local dependency stubs — PASS
- test source TypeScript syntax/type-shape validation with local Vitest stubs — PASS
- `node --check scripts/build-extension.mjs` — PASS
- manifest/file validation — PASS
- runtime network API scan — PASS
- `node scripts/validate-static.mjs` — PASS

## Validation blocked by environment networking

The current container cannot resolve `registry.npmjs.org` (`EAI_AGAIN`). Therefore the following dependency-backed commands could not be honestly completed here:

- `npm install`
- actual Vitest execution
- actual Vite + esbuild production build

On a machine with npm registry access, run:

```bash
npm install
npm run check
```

Then load `dist/` from `chrome://extensions` → Developer mode → Load unpacked.

## Known product limitation retained intentionally

Long ChatGPT conversations can be virtualized: turn shells may exist while older message content is not mounted. This phase reports `possiblyPartial` instead of auto-scrolling. Controlled harvesting is reserved for the later reliability phase, consistent with the requested roadmap.
