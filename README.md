## SiYuan Chrome Extension

[中文](https://github.com/siyuan-note/siyuan-chrome/blob/main/README_zh_CN.md)

### 💡 Introduction

SiYuan browser extension for Chrome.

### 🛠️ Installation

* Chrome: [SiYuan - Chrome Web Store](https://chrome.google.com/webstore/detail/siyuan/hkcgjbeblifaincobbcfiffbpgoafepk)
* Edge: [SiYuan - Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/siyuan/lclhdlhleinlppggbbgimbekofanbkcf)
* GitHub: [siyuan-note/siyuan-chrome](https://github.com/siyuan-note/siyuan-chrome)

### ✨ Usage

1. Install the extension, then configure the API token in the extension options (you can view the token in SiYuan Settings - About)
2. On a web page, select the content you want to clip, then choose "Copy to SiYuan" from the context menu
3. Paste in SiYuan

### 🤖 Automation (Playwright)

You can automate clipping with Playwright:

```bash
# Install dependencies
npm install playwright
```

**Example script:**

```javascript
const { chromium } = require('playwright');

(async () => {
    const automationToken = process.env.SIYUAN_TOKEN;
    const targetUrl = process.env.TARGET_URL || 'https://example.com';
    
    const context = await chromium.launchPersistentContext('./browser-data', {
        headless: false,
        args: [
            '--disable-extensions-except=/path/to/siyuan-chrome',
            '--load-extension=/path/to/siyuan-chrome',
            '--remote-debugging-port=9222'
        ]
    });
    
    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    
    const result = await page.evaluate(async (token) => {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve({ success: false, error: 'Timeout' });
            }, 120000);
            
            window.addEventListener('message', (event) => {
                if (event.data?.type === 'SIYUAN_RESPONSE') {
                    clearTimeout(timeoutId);
                    resolve(event.data);
                }
            });
            
            window.postMessage({
                type: 'SIYUAN_CLIP',
                action: 'clipArticle',
                token: token
            }, '*');
        });
    }, automationToken);
    
    console.log(result);
})();
```

**Message Protocol:**

**Request:**
```javascript
window.postMessage({
    type: 'SIYUAN_CLIP',
    action: 'clipArticle' | 'copy',  // 'clipArticle': clip whole page, 'copy': copy selection
    token: 'your-api-token',
    data: { srcUrl: '...' }          // optional, for 'copy' action
}, '*');
```

**Response events:**
```javascript
window.addEventListener('message', (event) => {
    if (event.data?.type === 'SIYUAN_RESPONSE') {
        const { success, action, error, message, docId, title, article } = event.data;
        
        // Response fields:
        // - success: boolean
        // - action: 'clipArticle' | 'copy'
        // - error: string (on failure)
        // - message: 'Clipping started' | 'Clipping completed'
        // - docId: string (document ID after successful clip)
        // - title: string (clipped document title)
        // - article: { title, contentLength } (when clipping starts)
    }
});
```

**Error cases:**
| Error | Description |
|-------|-------------|
| `Automation token not configured` | Token not set in extension options |
| `Invalid automation token` | Token mismatch |
| `API token not configured` | SiYuan API token not set |
| `Save path not configured` | Notebook not selected in options |
| `No text selected` | No selection for 'copy' action |
| `Unknown action: X` | Invalid action value |
| `Timeout` | Operation timed out |

### 🔒 Privacy Policy

* All data is stored on a device fully controlled by the user
* No usage data is collected
