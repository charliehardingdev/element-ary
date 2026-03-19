# Element-ary

Element-ary is a Chrome extension that lets you right-click almost any page element and copy a structured summary of what you clicked.

It is built for developers, QA, and AI-assisted workflows where you want to hand ChatGPT, Claude, Codex, or another assistant the exact page context it needs without manually digging through DevTools first.

## Best Use Case

Element-ary is especially useful when you want to quickly give an AI assistant:

- the exact link, image, form field, or UI element you are talking about
- the surrounding HTML for that element
- a selector-style DOM path
- the cleaned page URL
- a compact summary of element-specific metadata

Instead of saying "the button on the right side is broken," you can paste a structured snapshot that gives the AI far better context right away.

## What It Copies

When you use `Element-ary Copy`, the extension can capture:

- Element HTML
- Visible text content
- A CSS-style DOM path
- The current page URL
- Element-specific metadata for common element types

This makes it useful for:

- AI debugging help
- bug reports
- front-end QA
- copy-pasting page context into tickets, docs, or chats
- quickly understanding unfamiliar UI without a full inspection workflow

Supported element types include:

- Images
- Links
- Form controls
- Video and audio
- Iframes
- Tables
- Lists
- Headings
- Elements with CSS background images

## Privacy By Default

This version is intentionally safer to share and use on real websites.

Before content is copied to your clipboard, Element-ary:

- removes query strings and hashes from copied URLs
- redacts sensitive form values
- sanitizes copied HTML to avoid leaking common high-risk attributes
- redacts data URLs, blob URLs, and JavaScript URLs

That said, this tool still copies what is visible on the page. If you right-click sensitive on-screen content, that visible content can still be copied by design.

## Why It Exists

Sometimes you do not want a full DevTools workflow. You just want to quickly grab:

- the link behind a button
- the source URL for an image
- the structure of a form
- the selector path for a flaky UI element
- the cleaned page URL for a bug report
- the exact page context you want to paste into an AI assistant

Element-ary is built for that fast path.

## Installation

1. Open `chrome://extensions/`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the `element-ary-extension` folder

## Usage

1. Open any webpage
2. Right-click the element you want to inspect
3. Click `Element-ary Copy`
4. Paste the result into ChatGPT, Claude, Codex, a bug report, or your notes

## Great Prompts For AI

You can pair Element-ary with prompts like:

- `Why is this element not clickable?`
- `Explain what this DOM structure is doing.`
- `Write a Playwright selector for this element.`
- `Help me debug why this form field is failing validation.`
- `Suggest cleaner HTML or accessibility improvements for this component.`

The extension gives the AI a much better starting point than a vague screenshot or description.

## Example Output

### Link

```text
Element Contents:
Link Information:
URL: https://example.com/docs
Link Text: Read the docs
Type: External Link
Target: _blank
Rel: noopener noreferrer

HTML:
<a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">Read the docs</a>

DOM Path:
html > body > main > a:nth-child(1)

Page URL:
https://example.com/page
```

### Form Field

```text
Element Contents:
Input Element Information:
Type: email
Name: user_email
Value: [redacted]
Placeholder: Enter your email
Required: Yes
Autocomplete: email

HTML:
<input type="email" name="user_email" value="[redacted]" placeholder="Enter your email" required>

DOM Path:
html > body > form > input:nth-child(1)

Page URL:
https://example.com/signup
```

## Permissions

- `contextMenus`: adds the right-click action
- `activeTab`: reads the current tab after you interact with the extension
- `clipboardWrite`: writes the generated summary to your clipboard

## Project Files

- `manifest.json`: Chrome extension manifest
- `background.js`: context menu setup and message routing
- `content.js`: element detection, extraction, sanitization, and clipboard copy

## Limits

- It does not run on browser-internal pages like `chrome://`
- Clipboard fallback behavior can vary on non-HTTPS pages
- It is not a full DOM inspector and intentionally favors quick summaries over exhaustive detail

## Open Source Notes

This repository is intended to be safe to publish publicly. The extension code has been reviewed to avoid embedding private credentials or copying especially sensitive browser state by default.

If you extend it, keep the privacy model in mind before adding new fields to the copied output.
