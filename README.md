# VK Userscript Runner (Chrome Extension)

A lightweight Manifest V3 Chrome extension that bundles one or more userscripts and runs them on matching pages.  
This project currently ships with two userscripts for `vuxenkul.se`: one for storefront editor/admin helper links, and one for backend category search/export improvements in butikadmin.

---

## What this extension does

The extension has **three moving parts**:

1. **Background service worker (`service_worker.js`)**
   - Reads bundled userscript metadata from script headers (`// ==UserScript== ...`).
   - Decides whether a script should run for the current URL (`@match` + `@exclude`).
   - Injects matching, enabled scripts into the active tab.
   - Stores on/off state per script in `chrome.storage.local`.

2. **Popup UI (`popup.html` + `popup.js`)**
   - Shows all bundled scripts with:
     - script name/version,
     - whether URL matches the current page,
     - whether script has run,
     - toggle to enable/disable each script.
   - Displays any runtime injection error collected by the background worker.

3. **Bundled userscript(s) (`scripts/*.js`)**
   - Regular JavaScript files with Tampermonkey-style metadata comments.
   - Example included: `scripts/front-end-links.js`.
   - Also included: `scripts/backend-varugrupper.js`.

---

## How JavaScript flow works (end-to-end)

### 1) Script metadata is parsed
When the extension starts (or when popup/background logic asks for scripts), `service_worker.js` loads each file listed in `BUNDLED_SCRIPTS` and parses the userscript header:

- `@name`
- `@version`
- `@match`
- `@exclude`

This creates a metadata object for each script and caches it.

### 2) Navigation events trigger evaluation
The background worker listens to:

- `chrome.webNavigation.onCommitted`
- `chrome.webNavigation.onHistoryStateUpdated`

On each top-level navigation, it checks each bundled script:

- Is script enabled in storage?
- Does URL match `@match` patterns?
- Is URL blocked by `@exclude` patterns?

If all checks pass, it injects the script.

### 3) Injection runtime status is written into page
After injection attempt, runtime status is written to `window.__VK_PLUGIN_RUNTIME[scriptId]` inside the tab:

- `ran: true|false`
- `error: null|string`
- `lastRunAt`

The popup reads this object to show **Ran: Yes/No** and possible errors.

### 4) Popup controls enabled state
When you open the extension popup:

- It asks background for scripts relevant to current URL (`GET_SCRIPTS_FOR_TAB`).
- It reads runtime map from current tab.
- Toggling a script sends `SET_SCRIPT_ENABLED`.
- If toggled ON, background evaluates/injects immediately on current tab.

> If toggled OFF after a script already changed the page, UI warns you to reload tab to fully remove existing effects.

---

## Which pages it runs on

### Extension-level host permission
From `manifest.json`, the extension is allowed on:

- `https://vuxenkul.se/*`

### Script-level matching (`front-end-links.js`)
Current bundled script declares:

- `@match https://vuxenkul.se/*`
- `@exclude https://vuxenkul.se/`
- `@exclude https://vuxenkul.se/butikadmin/*`

So practically, it runs on most storefront pages under `vuxenkul.se`, except:

- the exact homepage `/`
- backend admin pages under `/butikadmin/`

---

## What the bundled script does (`front-end-links.js`)

On matching storefront pages, it adds helper tools for admins/editors:

- Adds an action toolbar above product gallery pages.
- Adds **Copy URL** action for visible products, including:
  - Article number
  - Product name
  - Image URL
  - Front-end URL
  - Back-end edit URL
- Adds **Show all products** action (`?page=999`).
- Adds per-product edit links (`✏️ Redigera (...)`).
- Adds category edit link (`✏️ Redigera kategori (...)`) when category ID can be detected.
- If no `.grid-gallery` exists, shows meta title + meta description with character counts at top of page.
- Uses `MutationObserver` to keep enhancements applied when page content updates dynamically.

---

## How to install and run locally

1. Clone/download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder (`VK-plugin`).
6. Open a matching page, e.g. `https://vuxenkul.se/some-category`.
7. Click extension icon to open popup and verify script status.

---

## How to use the popup

For each bundled script card:

- **Matches: Yes/No** = whether current tab URL matches that script's metadata rules.
- **Ran: Yes/No** = whether extension recorded successful injection in this tab runtime.
- Toggle switch = enable/disable script globally (persisted in local extension storage).

Potential popup messages:

- **No bundled scripts found.**
  - No scripts are registered in `BUNDLED_SCRIPTS`.
- **Open a website tab to evaluate scripts.**
  - Active tab isn't an `http/https` page.
- **Could not run: ...**
  - Injection failed (error shown from runtime status).

---


## Extension update notifications (wiki-hosted latest version)

The extension now checks a remote JSON endpoint for the latest available extension version:

- `https://wiki.vuxenkul.se/public/vk-plugin/latest.json`

Expected JSON shape:

```json
{
  "latestVersion": "1.0.1",
  "downloadUrl": "https://wiki.vuxenkul.se/public/vk-plugin/VK-plugin-1.0.1.zip",
  "notes": "Optional release notes"
}
```

How it works:

1. The background service worker compares `latestVersion` with the installed extension version from `manifest.json`.
2. Popup shows either:
   - **Up to date**, or
   - **Update available** with a download button and release notes.
3. Users manually download/install the new extension package.

Important:

- The updater checks metadata only; userscript execution still uses bundled files from `scripts/*.js`.
- `downloadUrl` must point to `https://wiki.vuxenkul.se/...` (other hosts are ignored).

---

## Add another bundled userscript

1. Create a new script file in `scripts/`, with userscript metadata header.
2. Add it to `BUNDLED_SCRIPTS` in `service_worker.js`:

```js
const BUNDLED_SCRIPTS = [
  { id: 'front-end-links', file: 'scripts/front-end-links.js' },
  { id: 'my-new-script', file: 'scripts/my-new-script.js' }
];
```

3. Reload extension in `chrome://extensions`.
4. Open a matching page and verify status in popup.

### Required metadata recommendations

At minimum include:

- `@name`
- `@version`
- `@match` (one or more)
- optional `@exclude` (one or more)

---

## File overview

- `manifest.json` – extension manifest and permissions.
- `service_worker.js` – script metadata parsing, matching, injection, and messaging.
- `popup.html` – popup markup + styles.
- `popup.js` – popup behavior and toggles.
- `scripts/front-end-links.js` – bundled storefront enhancement userscript.

---

## Notes / limitations

- This extension fetches **version metadata only** from `https://wiki.vuxenkul.se/public/vk-plugin/latest.json` to notify about extension updates. Script code still runs from files packaged in this repo.
- URL matching uses wildcard pattern conversion to regular expressions.
- Disabling a script prevents future injections; previous DOM changes may remain until page reload.
- Current setup is designed for Chromium-based browsers with Manifest V3 support.
