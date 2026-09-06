# Security

## Security model

ChatGPT to PDF processes untrusted conversation content inside a Chrome Manifest V3 extension. Its security design is based on minimizing permissions, avoiding remote executable code, converting page content into a typed model, and never executing code found in a conversation.

## Permissions

The production manifest requests only:

- `activeTab`
- `storage`

The content script is scoped to:

- `https://chatgpt.com/*`

The extension does not request `<all_urls>`, browsing history, cookies, identity, geolocation, clipboard-read, webRequest, or management permissions.

## Content Security Policy

Extension pages use packaged scripts only. The project does not intentionally use `eval()`, `new Function()`, or remotely hosted JavaScript.

A release validation script scans for these high-risk patterns before packaging.

## Untrusted content handling

### Text and markup

The normalized content model stores typed text/semantic nodes rather than arbitrary message HTML. Renderer output is created by extension code.

### Links

Links are normalized through a protocol allowlist. Unsafe executable protocols are neutralized.

### Code blocks

Conversation code is treated strictly as text. It is never executed, imported, or evaluated.

### Math

When semantic MathML is preserved, unsafe/executable elements and attributes are stripped before rendering. If semantic rendering is not available, the renderer falls back rather than executing macros or scripts.

### SVG

Conversation SVG is sanitized. Script-capable/embedding elements and event-handler attributes are removed; unsupported SVG can degrade to a safer fallback.

### Images

Images may reference data/blob/original HTTPS/HTTP resources. A failed or inaccessible image renders a placeholder instead of failing the export. The extension does not use a developer-controlled proxy to fetch images.

## Network behavior

The source has a static audit that flags explicit runtime use of `fetch`, `XMLHttpRequest`, WebSocket, and `sendBeacon`. No analytics or cloud PDF service is intentionally included.

Browser-native loading of an image URL already contained in a conversation is distinct from sending conversation text to a developer server and is disclosed in `PRIVACY.md`.

## Storage

- Preferences: `chrome.storage.local`.
- Print job: `chrome.storage.session`, transiently, then removed after the print page reads it.
- Full conversation history is not intentionally retained by the extension as persistent application data.

## Logging

Detailed logging is gated to development mode. Production code should not dump conversation bodies, source code, equations, or images to the console.

## Dependency/security checks before release

Run:

```bash
npm install
npm audit
npm run validate:static
npm run typecheck
npm run test
npm run build
npm run validate:release
```

Critical/high exploitable dependency vulnerabilities should be resolved or explicitly documented before publication.

## Reporting vulnerabilities

A public security contact has not been configured in this source tree. Before public release, add the developer's real security/support contact or repository issue process. Do not publish invented contact details.
