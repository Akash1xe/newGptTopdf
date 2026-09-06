# Known Limitations

These are current implementation limitations that should be considered before public release.

1. **ChatGPT DOM changes can require maintenance.** Extraction uses semantic/fallback selectors rather than styling classes, but ChatGPT is a third-party SPA and can change its markup.
2. **Long-thread completeness cannot be mathematically guaranteed.** The controlled collector attempts to mount older virtualized turns and returns completeness metadata, but future virtualization behavior or safety limits can still produce a partial result. The UI warns before exporting a suspected partial thread.
3. **Cross-origin images may not embed.** Images that cannot be accessed/rendered in the isolated extension print page degrade to a placeholder rather than breaking the PDF.
4. **KaTeX does not support every possible TeX package/macro.** The renderer uses locally bundled KaTeX for TeX/LaTeX, then sanitized MathML and readable text fallback. Rare unsupported macros can therefore degrade gracefully instead of matching the source renderer exactly.
5. **Native print preview is part of the export flow.** The extension prepares a dedicated printable document and opens Chrome print preview; the user selects **Save as PDF**. It does not silently write a PDF without user interaction.
6. **Browser/platform PDF differences are possible.** Pagination and font availability can vary slightly between Chrome versions and operating systems.
7. **Manual Chrome release validation is still required.** This repository contains test/validation code, but the final extension should be loaded from a clean production `dist/` build and real PDFs should be inspected before store submission.
