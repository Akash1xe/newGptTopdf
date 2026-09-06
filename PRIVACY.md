# Privacy Policy — ChatGPT to PDF

_Last updated: September 6, 2026_

ChatGPT to PDF is a browser extension whose single purpose is to let a user export a ChatGPT conversation to a formatted PDF.

## Data the extension handles

To perform an export, the extension may process data visible in the active ChatGPT conversation, including:

- user and assistant message text;
- code snippets;
- mathematical expressions;
- tables and structured formatting;
- images or image references contained in the conversation;
- the conversation title and current ChatGPT conversation URL.

This information may include personal communications, user-generated content, or other sensitive information depending on what the user has placed in the conversation.

## How the data is used

Conversation data is used only to identify, structure, render, and export the conversation requested by the user.

The extension does not intentionally use conversation content for advertising, profiling, training, analytics, sale, or unrelated purposes.

## Where processing occurs

Conversation extraction, parsing, and PDF preparation occur locally in the browser extension.

The extension does not intentionally transmit conversation text, code, equations, or normalized conversation data to a developer-controlled backend or cloud PDF service.

Some images included in a ChatGPT conversation may reference an existing HTTP/HTTPS resource. When the print document renders such an image, the browser may load that original image URL. If an image cannot be accessed, the exporter can display a placeholder instead.

## Storage and retention

### Export preferences

Preferences such as page size, PDF theme, message filter, margins, and code options are stored in `chrome.storage.local` so they can be reused on later exports.

### Temporary print data

When the user starts an export, the normalized conversation and selected options are temporarily placed in `chrome.storage.session` so the isolated print page can render the document. The print page removes that job after reading/rendering it. Session storage is not intended as a permanent conversation archive.

### Conversation history

The extension does not intentionally maintain a persistent database or history of exported conversations.

## Data sharing

The developer does not intentionally share or sell conversation content to advertisers, data brokers, or other third parties.

No analytics SDK is included in the current implementation.

## Permissions

- `activeTab`: allows the extension to interact with the currently active supported ChatGPT tab when the user invokes it.
- `storage`: stores export preferences and the temporary session print job described above.
- The content script is restricted to `https://chatgpt.com/*`.

## Security

The extension uses Chrome Manifest V3, packaged executable code, a restrictive Content Security Policy, URL sanitization, and sanitization/fallback handling for structured content such as SVG and MathML. Conversation code blocks are treated as text and are never executed by the extension.

## User control

The extension processes the conversation when the user invokes its export workflow. Users can reset stored export preferences from the extension UI. Removing the extension removes its extension-owned storage according to Chrome's normal extension lifecycle.

## Changes to this policy

If the extension's data practices change, this policy and the Chrome Web Store privacy disclosures should be updated before or together with the functionality change.

## Contact

A public support/privacy contact has not been inserted into this source repository. Before Chrome Web Store publication, the publisher should replace this section with a real support/privacy contact or an appropriate public project support URL.

## Chrome Web Store Limited Use

The extension's use of user data is intended to be limited to providing its disclosed single purpose: exporting the user's selected ChatGPT conversation into a formatted PDF. The publisher should ensure the public listing and Developer Dashboard declarations remain consistent with this implementation and with the current Chrome Web Store User Data Policy.
