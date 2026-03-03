# SiYuan Chrome Extension - Playwright 自动化指南

## 功能概述

扩展支持通过 `postMessage` 与 Playwright 等自动化工具通信，实现网页剪藏的自动化操作。

## 配置步骤

### 1. 配置自动化暗号

1. 点击扩展图标打开选项页面
2. 找到 **"自动化暗号"** (Automation Token) 字段
3. 输入一个安全的暗号（例如：`my-secret-token-123`）
4. 保存配置

### 2. Playwright 脚本配置

```javascript
const TOKEN = 'my-secret-token-123'; // 必须与扩展选项中配置的暗号一致
```

### 3. 发送剪藏指令

```javascript
await page.evaluate((token) => {
  window.postMessage({
    type: 'SIYUAN_CLIP',
    action: 'clipArticle', // 或 'copy'
    token: token,
    timestamp: Date.now()
  }, '*');
}, TOKEN);
```

### 4. 监听扩展响应

```javascript
// 在页面中注入监听器
await page.addInitScript(() => {
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SIYUAN_RESPONSE') {
      console.log('[SIYUAN]', event.data);
    }
  });
});
```

## 支持的指令

### 剪藏整个网页

```javascript
window.postMessage({
  type: 'SIYUAN_CLIP',
  action: 'clipArticle',
  token: 'your-token'
}, '*');
```

**响应：**
```javascript
{
  type: 'SIYUAN_RESPONSE',
  success: true,
  action: 'clipArticle',
  message: 'Clipping started'
}
```

### 复制选中文本

```javascript
// 先选中文本
await page.selectText('p');

// 发送复制指令
window.postMessage({
  type: 'SIYUAN_CLIP',
  action: 'copy',
  token: 'your-token'
}, '*');
```

**响应：**
```javascript
{
  type: 'SIYUAN_RESPONSE',
  success: true,
  action: 'copy'
}
```

**失败响应（无选中内容）：**
```javascript
{
  type: 'SIYUAN_RESPONSE',
  success: false,
  error: 'No text selected'
}
```

## 完整示例

参考 `playwright-example.js` 文件。

## 安全注意事项

1. **暗号保护**: 暗号应妥善保管，不要提交到版本控制系统
2. **本地使用**: 此功能仅用于本地自动化，不建议在生产环境使用
3. **令牌验证**: 扩展会验证每个 postMessage 的 token，防止恶意调用

## 常见问题

### Q: token 验证失败？
A: 确保 Playwright 脚本中的 token 与扩展选项中配置的完全一致。

### Q: 没有收到响应？
A: 检查：
- 扩展是否已加载
- 是否注入了响应监听器
- 网页是否在 content script 的作用域内（`<all_urls>`）

### Q: 支持哪些 action？
A: 目前支持：
- `clipArticle` - 剪藏整个网页
- `copy` - 复制选中文本

## 测试

运行示例脚本：
```bash
npm install playwright
node playwright-example.js
```
