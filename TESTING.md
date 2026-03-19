# Testing Guide for Element-ary Extension

## Quick Start Testing

### 1. Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle switch in the top right corner)
3. Click **"Load unpacked"** button
4. Navigate to and select the `element-ary-extension` folder:
   ```
   /Users/charlie/charlie-dev-projects-misc/chrome-extensions/element-ary-extension
   ```
5. The extension should now appear in your extensions list with the name "Element-ary"

### 2. Verify Installation

- ✅ Extension appears in the list
- ✅ No errors shown (check for red error messages)
- ✅ Extension icon is visible (if you see it)

### 3. Basic Functionality Test

1. **Navigate to any website** (e.g., `https://www.google.com` or `https://github.com`)
2. **Right-click on any element** (a button, text, image, etc.)
3. **Look for "Element-ary Copy"** in the context menu
4. **Click "Element-ary Copy"**
5. **Paste** (Cmd+V / Ctrl+V) into a text editor or notes app
6. **Verify** you see:
   - Element Contents (HTML and/or Text)
   - DOM Path (CSS selector path)
   - Page URL

## Detailed Test Cases

### Test Case 1: Simple Text Element
- **Action**: Right-click on a paragraph or heading
- **Expected**: Copies text content and DOM path

### Test Case 2: Button Element
- **Action**: Right-click on a button
- **Expected**: Copies button HTML, text, and DOM path

### Test Case 3: Image Element
- **Action**: Right-click on an image
- **Expected**: Copies img tag HTML and DOM path

### Test Case 4: Nested Element
- **Action**: Right-click on deeply nested content (e.g., inside multiple divs)
- **Expected**: DOM path shows full hierarchy

### Test Case 5: Element with ID
- **Action**: Right-click on an element with an `id` attribute
- **Expected**: DOM path stops at the ID (since IDs are unique)

### Test Case 6: SVG Element
- **Action**: Right-click on an SVG element
- **Expected**: DOM path correctly handles SVG className

### Test Case 7: Large Element (>1000 chars)
- **Action**: Right-click on an element with very long HTML
- **Expected**: Shows text only with "(HTML too long, showing text only)" message

### Test Case 8: HTTP Page (Fallback Test)
- **Action**: Test on an HTTP page (not HTTPS)
- **Expected**: Still works using fallback clipboard method

### Test Case 9: HTTPS Page (Modern API)
- **Action**: Test on an HTTPS page
- **Expected**: Uses modern clipboard API

### Test Case 10: Rapid Clicks
- **Action**: Right-click multiple elements quickly
- **Expected**: Each click copies the correct element (no race conditions)

## Debugging

### Check Extension Console

1. Go to `chrome://extensions/`
2. Find "Element-ary" extension
3. Click **"service worker"** link (or "background page" in older Chrome)
4. Check console for any errors

### Check Content Script Console

1. Open any webpage
2. Right-click → Inspect (or F12)
3. Go to **Console** tab
4. Look for messages like:
   - "Element info copied to clipboard"
   - "Element info copied using fallback method"
   - Any error messages

### Common Issues

**Issue**: Context menu doesn't appear
- **Solution**: Reload the extension (click reload icon in chrome://extensions/)

**Issue**: "Failed to copy" error
- **Solution**: Check browser console for details. May need HTTPS for clipboard API.

**Issue**: Wrong element copied
- **Solution**: Make sure you're right-clicking directly on the element you want

**Issue**: Extension not loading
- **Solution**: 
  - Check that all files are present (manifest.json, background.js, content.js)
  - Check for syntax errors in console
  - Verify manifest.json is valid JSON

## Testing Checklist

- [ ] Extension loads without errors
- [ ] Context menu item appears on right-click
- [ ] Clicking menu item copies to clipboard
- [ ] Pasted content has correct format
- [ ] DOM path is accurate
- [ ] Page URL is correct
- [ ] Works on HTTPS pages
- [ ] Works on HTTP pages (fallback)
- [ ] Works with text elements
- [ ] Works with button elements
- [ ] Works with image elements
- [ ] Works with nested elements
- [ ] Works with SVG elements
- [ ] Handles large elements correctly
- [ ] No console errors

## Manual Test Script

Run through this sequence:

1. Load extension → ✅
2. Visit google.com → ✅
3. Right-click search box → ✅
4. Select "Element-ary Copy" → ✅
5. Paste in notes → ✅
6. Verify output format → ✅
7. Visit github.com → ✅
8. Right-click logo → ✅
9. Copy and verify → ✅
10. Visit http://example.com (HTTP) → ✅
11. Test fallback method → ✅

## Success Criteria

✅ Extension loads successfully
✅ Context menu appears on all pages
✅ Copy operation completes without errors
✅ Pasted content matches expected format
✅ Works across different websites
✅ No console errors during normal use
