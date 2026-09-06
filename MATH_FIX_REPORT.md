# Math Rendering Fix — v1.0.1 candidate

## Scope

This patch targets the release-blocking PDF math corruption observed in the exported conversation, including missing radicals, flattened fractions, lost superscripts/subscripts, and flattened derivative/integral/matrix structures.

## Root causes addressed

1. **MathML namespace loss** — serialized MathML can lose the explicit `xmlns` attribute when copied from an HTML DOM. Re-parsing that string in the isolated print page without the MathML namespace makes Chrome treat elements such as `mfrac`, `msup`, and `msqrt` as generic XML/HTML-like nodes, flattening structured math into text.
2. **Print-page KaTeX asset readiness** — KaTeX CSS is now imported directly by the print entry point and printing waits for `document.fonts.ready` before opening print preview.
3. **Current ChatGPT math source detection** — extraction now explicitly supports the current `data-math-source` structure, common TeX data attributes, KaTeX annotations, native MathML, and reliable TeX-like ARIA fallback.
4. **Block math classification** — a `<span class="katex-display">` is no longer classified as ordinary inline content merely because it is a `span`.
5. **KaTeX visual/semantic duplication** — the outer formula is treated as one semantic MathNode; inner visual and accessibility layers are not recursively exported as separate text.

## Source priority

```text
current ChatGPT data-math-source / TeX data attribute
  -> annotation encoding application/x-tex / LaTeX
  -> sanitized, explicitly namespaced MathML
  -> readable text fallback
```

## Render priority

```text
TeX source
  -> local KaTeX renderToString(... htmlAndMathml ...)
  -> sanitized namespaced MathML
  -> readable fallback text
```

## Main files changed

- `src/providers/chatgpt/chatgptMath.ts`
- `src/parser/blockParser.ts`
- `src/renderer/mathRenderer.ts`
- `src/renderer/printStyles.ts`
- `src/print/main.ts`
- `src/content/contentScript.ts`
- `src/types/messages.ts`
- `tests/math.test.ts`
- `tests/renderer.test.ts`
- `scripts/validate-release.mjs`
- `scripts/package-release.mjs`

## Regression coverage added

The source tests now cover roots, nth roots, fractions, powers, subscripts, derivatives, partial derivatives, summations, products, limits, integrals, vectors, nabla operations, Greek letters, relations, matrices, cases, aligned equations, binomial coefficients, floor/ceiling, accents, math alphabets, trigonometric/logarithmic functions, quantifiers, contour/multiple integrals, the physics radical formula, and the quadratic formula.

## Validation completed in this environment

Passed:

- `node scripts/validate-static.mjs`
- `tsc -p tsconfig.core.json`
- `tsc -p tsconfig.logic.json`
- `tsc -p tsconfig.runtime-logic.json`
- `tsc -p tsconfig.popup-validation.json`
- `tsc -p tsconfig.tests-validation.json`

Blocked by environment DNS (`EAI_AGAIN registry.npmjs.org`):

- dependency installation
- real Vitest execution
- Vite production build
- release-package asset validation
- manual Chrome PDF inspection

The patch therefore remains a **v1.0.1 candidate** until those dependency-backed and manual checks are run on a machine with npm/Chrome access.
