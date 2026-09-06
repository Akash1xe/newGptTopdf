# Chrome Web Store Listing Draft

## Recommended name

**ChatGPT to PDF**

This is an independent extension and should not be described as an official OpenAI product.

## Short description

Export ChatGPT conversations to clean PDFs while preserving code, tables, images, and mathematical formatting.

## Single-purpose statement

The extension's single purpose is to export the user's active ChatGPT conversation into a locally prepared, formatted PDF document.

## Detailed description

Export ChatGPT conversations as clean, readable PDFs without turning the entire chat into a blurry screenshot.

ChatGPT to PDF converts the active conversation into a structured print document while preserving the content that matters:

- headings, paragraphs, bold and italic text;
- ordered and nested lists;
- tables and blockquotes;
- inline code and formatted code blocks;
- mathematical expressions using semantic math data when available;
- conversation images where the browser can safely render them;
- long conversations with completeness checks and partial-export warnings.

Choose A4 or Letter, light or dark PDF output, all/user/assistant messages, margin presets, and code formatting preferences.

The export is prepared locally in your browser. The extension does not include a developer-controlled backend, analytics SDK, or cloud PDF service. Export preferences are stored locally, and a temporary session print job is used only to hand the selected conversation to the isolated print page.

The extension opens Chrome's native print preview so you can choose **Save as PDF**.

ChatGPT to PDF is an independent browser extension and is not affiliated with or endorsed by OpenAI.

## Permission justifications

### `activeTab`

Used to communicate with and inspect the active supported ChatGPT conversation after the user invokes the extension. This access is required to determine conversation status and perform the requested export.

### `storage`

Used to save local PDF export preferences and to pass one temporary normalized conversation/export job through `chrome.storage.session` to the isolated print page. The temporary print job is removed after rendering.

### `https://chatgpt.com/*` content-script access

Required because the extension's single user-facing feature needs to read the structured content of ChatGPT conversations on `chatgpt.com`. The scope is intentionally limited to that site instead of requesting `<all_urls>`.

## Privacy disclosure notes for Developer Dashboard

The extension **handles user data** because it reads website content, personal communications, and user-generated conversation content even though processing is local. Do not declare that it handles no user data.

Disclose that:

- conversation content is accessed only to provide the user-requested PDF export;
- it is processed locally rather than intentionally transmitted to a developer-controlled server;
- normalized conversation data is temporarily stored in `chrome.storage.session` for the print handoff;
- export preferences are stored in `chrome.storage.local`;
- the implementation contains no analytics SDK;
- original third-party image URLs may be loaded by the browser when needed to render conversation images.

Use the actual Developer Dashboard wording available at submission time and keep it consistent with `PRIVACY.md`.

## Suggested category

**Productivity**, if that category remains available in the current Chrome Web Store Developer Dashboard.

## Screenshot plan

Use actual production screenshots, ideally at 1280x800:

1. ChatGPT conversation with the popup open — "Export ChatGPT conversations to PDF"
2. Generated PDF showing syntax-highlighted code — "Code formatting preserved"
3. Generated PDF showing fractions/roots/matrix — "Mathematical formatting preserved"
4. Popup advanced export preferences — "Customize your export"
5. Multi-page structured export — "Built for real conversations"

Do not fabricate screenshots before the corresponding production build has been manually tested.

## Store assets/current requirements checklist

Before submission, verify against the live official Chrome Web Store documentation:

- 128x128 extension icon in the uploaded ZIP;
- at least one valid store screenshot (official documentation currently specifies 1280x800 or 640x400, full bleed);
- Store Listing tab completed;
- Privacy tab completed with single-purpose, permission justifications, and user-data declarations;
- public privacy policy URL provided because the extension handles user data;
- developer account/publisher details and 2-step verification completed;
- upload the production ZIP with `manifest.json` at ZIP root;
- review the automated pre-submission installation test that now runs after a package is uploaded to a draft.

## Support/contact placeholders

Before submission, provide real values for:

- support email or support URL;
- public privacy-policy URL;
- repository/issues URL if support is handled through a public repository.

Do not invent contact details in the store listing.
