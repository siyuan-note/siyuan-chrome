## SiYuan Chrome 扩展

[English](https://github.com/siyuan-note/siyuan-chrome/blob/main/README.md)

### 💡 简介

思源笔记 Chrome 浏览器扩展。

### 🛠️ 安装

* Chrome：[SiYuan - Chrome Web Store](https://chrome.google.com/webstore/detail/siyuan/hkcgjbeblifaincobbcfiffbpgoafepk)
* Edge：[SiYuan - Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/siyuan/lclhdlhleinlppggbbgimbekofanbkcf)
* GitHub：[siyuan-note/siyuan-chrome](https://github.com/siyuan-note/siyuan-chrome)

### ✨  使用

1. 安装扩展，在扩展的选项中配置 API token（token 可在思源设置 - 关于中查看）
2. 在 Web 页面上选择需要剪藏的内容，然后在右键菜单中选择 “Copy to SiYuan”
3. 在思源中粘贴

### 🤖 自动化剪裁（Playwright）

可以使用 Playwright 进行自动化剪裁：

```bash
# 安装依赖
npm install playwright
```

**示例脚本：**

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

**消息协议：**

**请求：**
```javascript
window.postMessage({
    type: 'SIYUAN_CLIP',
    action: 'clipArticle' | 'copy',  // 'clipArticle': 剪藏整页, 'copy': 复制选中内容
    token: 'your-api-token',
    data: { srcUrl: '...' }          // 可选，用于 'copy' 操作
}, '*');
```

**响应事件：**
```javascript
window.addEventListener('message', (event) => {
    if (event.data?.type === 'SIYUAN_RESPONSE') {
        const { success, action, error, message, docId, title, article } = event.data;
        
        // 响应字段：
        // - success: 是否成功
        // - action: 'clipArticle' | 'copy'
        // - error: 错误信息（失败时）
        // - message: 'Clipping started' | 'Clipping completed'
        // - docId: 文档ID（剪藏成功后）
        // - title: 剪藏文档标题
        // - article: { title, contentLength }（剪藏开始时）
    }
});
```

**错误情况：**
| 错误 | 说明 |
|------|------|
| `Automation token not configured` | 扩展选项中未设置自动化 Token |
| `Invalid automation token` | Token 不匹配 |
| `API token not configured` | 未配置思源 API Token |
| `Save path not configured` | 未选择保存笔记本 |
| `No text selected` | 'copy' 操作时未选中文本 |
| `Unknown action: X` | 无效的 action 值 |
| `Timeout` | 操作超时 |

### 🔒 隐私条款

* 所有数据都保存在用户自己完全控制的设备上
* 不会收集任何使用数据