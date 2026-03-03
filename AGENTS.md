# SiYuan Chrome Extension - Knowledge Base

**Generated:** 2026-03-04
**Commit:** c3ea8b2
**Branch:** main

## OVERVIEW

Chrome extension for clipping web content to SiYuan note-taking app. Manifest V3, pure JavaScript, no build process.

## STRUCTURE

```
./
├── manifest.json         # Extension config (MV3, permissions, content scripts)
├── background.js         # Service worker: context menus, API calls to SiYuan
├── content.js            # Content script: DOM processing, Readability integration
├── popup.js              # Options page logic (extension popup)
├── options.html          # Options UI (doubles as popup)
├── lib/
│   ├── Readability.js    # Mozilla Readability (article extraction)
│   └── mathjax.js        # MathJax formula processing
└── _locales/             # i18n translations (14 languages)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Context menu actions | `background.js:1-30` | Copy/Send menu creation & handlers |
| SiYuan API integration | `background.js:122-340` | `/api/extension/copy`, `/api/filetree/createDocWithMd` |
| DOM processing | `content.js:118-640` | Style conversion (bold/italic/underline → tags) |
| Readability flow | `content.js:851-886` | `siyuanGetReadability()` entry point |
| Options UI | `popup.js` + `options.html` | Settings storage (`chrome.storage.sync`) |
| i18n system | `popup.js:656-750` | `siyuanLoadLanguageFile()`, `siyuanTranslateDOM()` |
| Template rendering | `background.js:44-86` | `renderTemplate()` for clip formatting |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `safeTabsSendMessage` | Function | `background.js:32` | Safe tab message sending (ignores errors) |
| `renderTemplate` | Function | `background.js:44` | Template engine for clip formatting |
| `siyuanShowTip` | Function | `content.js:73` | Toast notification system |
| `siyuanGetCloneNode` | Function | `content.js:556` | Pre-Readability DOM processor |
| `siyuanSendUpload` | Function | `content.js:707` | Uploads content to SiYuan API |
| `siyuanGetReadability` | Function | `content.js:851` | Main article clipping flow |
| `querySql` | Function | `popup.js:396` | SQL query helper for doc search |
| `sortSearchResults` | Function | `popup.js:464` | Directory-first sorting algorithm |
| `siyuanLoadLanguageFile` | Function | `popup.js:714` | i18n loader with fallback |

## CONVENTIONS

- **Global functions**: All `siyuan*` prefixed (e.g., `siyuanShowTip`, `siyuanSendUpload`)
- **Error handling**: Silent catches with `void chrome.runtime.lastError`, console warnings
- **Async pattern**: Mixed `async/await` + Promise chains (legacy code)
- **Storage**: All settings via `chrome.storage.sync` with defaults
- **DOM manipulation**: Inline style injection for tooltips
- **Event listeners**: `addEventListener('DOMContentLoaded')` for initialization

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** use ES6 modules - Chrome MV3 requires plain scripts
- **DO NOT** add build steps - extension loads files directly
- **DO NOT** suppress token errors - line 158 checks for 401/403 redirects
- **AVOID** nested callback chains - code is migrating to `async/await`
- **DO NOT** remove `keepClasses: true` from Readability (breaks style preservation)

## UNIQUE STYLES

- **Inline tooltip HTML**: Fixed position div with hardcoded styles (lines 76-79)
- **Manual i18n merging**: Current language + English fallback (popup.js:686)
- **Template conditionals**: `${condition ? "true" : "false"}` syntax in clip templates
- **SVG→IMG conversion**: Base64 encoding for SVG compatibility (content.js:459)
- **Directory-first sorting**: Custom SQL to prioritize folders in search (popup.js:464)

## COMMANDS

```bash
# Load unpacked extension
# Chrome: chrome://extensions/ → Load unpacked → Select this folder

# Test i18n
# Options page → Language dropdown → Select locale

# Debug service worker
# Chrome: chrome://extensions/ → SiYuan → Inspect service worker

# Configure keyboard shortcuts
# Chrome: chrome://extensions/shortcuts → SiYuan
#   - Ctrl+Shift+C: Copy selected text to SiYuan
#   - Ctrl+Shift+S: Clip entire page to SiYuan
```

## NOTES

- **Token validation**: API token required (Settings → About in SiYuan)
- **Default API URL**: `http://127.0.0.1:6806` (local SiYuan instance)
- **Readability third-party**: `lib/Readability.js` is unmodified Mozilla code
- **MV3 migration**: Already migrated (uses `chrome.runtime.onInstalled`, service workers)
- **MathJax handling**: Dynamic script injection for formula rendering (content.js:688)
- **Cross-origin images**: Fetches with custom headers to avoid CORS blocks (content.js:790)
