# SiYuan Chrome Extension - Playwright 自动化指南

## 功能概述

扩展支持通过 `postMessage` 与 Playwright 等自动化工具通信，实现网页剪藏的自动化操作。

## 配置步骤

### 0. 前置要求 ⚠️

在配置自动化之前，**必须先完成以下配置**：

1. **配置思源 API Token**
   - 打开思源笔记
   - 点击左上角菜单 → 设置 → 关于
   - 找到 "API token" 字段，复制这个 token
   - 回到扩展选项页面 → "API 令牌" → 粘贴并保存

2. **配置保存路径**
   - 在扩展选项页面
   - 找到 "保存路径" 字段
   - 输入关键字搜索笔记本（例如 "inbox"）
   - 从下拉列表中选择一个路径

3. **验证配置**
   - 确保 API token 不为空
   - 确保保存路径已选择
   - 尝试手动点击 "发送到思源" 按钮测试是否正常

> **提示**: 如果这一步失败，自动化功能也无法工作。请先确保手动剪藏正常。

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

## 调试技巧

### 查看控制台日志

扩展会在浏览器控制台输出调试日志：

1. 按 `F12` 打开开发者工具
2. 切换到 Console 标签
3. 寻找 `[SIYUAN]` 开头的日志

**正常流程：**
```
[SIYUAN] Clipping started: 文章标题
[SIYUAN] siyuanSendUpload called, type: article
[SIYUAN] Storage config: { hasToken: true, hasNotebook: true, ip: '...' }
[SIYUAN] Sending to background: { func: 'upload-copy', type: 'article', title: '...' }
```

**错误日志：**
```
[SIYUAN] Token missing          → 需要在扩展选项配置 API token
[SIYUAN] Notebook missing       → 需要选择保存路径
```

### 使用测试页面

推荐使用 `test-postmessage.html` 进行手动测试：

```bash
# 用 Chrome 打开测试页面
open test-postmessage.html
```

测试页面会显示详细的日志输出和错误信息。

## 完整示例

参考 `playwright-example.js` 文件。

## 安全注意事项

1. **暗号保护**: 暗号应妥善保管，不要提交到版本控制系统
2. **本地使用**: 此功能仅用于本地自动化，不建议在生产环境使用
3. **令牌验证**: 扩展会验证每个 postMessage 的 token，防止恶意调用

## 常见问题

### Q: 提示 "API token not configured" 或 "Save path not configured"？
A: 这是**最常见**的错误。需要先在扩展选项中配置：
   1. 点击扩展图标打开选项页面
   2. 配置 **API 令牌**（从思源设置→关于中复制）
   3. 配置 **保存路径**（搜索并选择一个笔记本）
   4. 保存后刷新页面

### Q: token 验证失败？
A: 确保 Playwright 脚本中的 token 与扩展选项中配置的完全一致（区分大小写）。

### Q: 没有收到响应？
A: 检查：
   - 扩展是否已加载
   - 是否注入了响应监听器
   - 网页是否在 content script 的作用域内（`<all_urls>`）
   - 浏览器控制台是否有报错

### Q: Readability 返回 null 或内容为空？
A: 某些网页结构复杂，Readability 无法提取。尝试：
   - 换一个简单的网页测试（如维基百科）
   - 检查控制台 Readability 日志
   - 使用 `test-postmessage.html` 测试基础功能

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
