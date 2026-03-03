/**
 * Playwright 示例：通过 postMessage 与 SiYuan Chrome 扩展通信
 * 
 * 使用方法：
 * 1. 在扩展选项中配置：
 *    - API 令牌（从思源设置→关于中获取）
 *    - 保存路径（选择一个笔记本）
 *    - 自动化暗号（例如：my-secret-token-123）
 * 2. 修改下面的 TOKEN 常量为你配置的暗号
 * 3. 运行此脚本
 * 
 * 注意：必须先确保手动剪藏正常工作！
 */

const { chromium } = require('playwright');

// ===== 配置区域 =====
const TOKEN = 'my-secret-token-123'; // 必须与扩展选项中配置的自动化暗号一致
const SIYUAN_API_URL = 'http://127.0.0.1:6806';
const SIYUAN_TOKEN = 'your-siyuan-api-token'; // 思源 API token（从思源设置→关于中获取）
// ====================

/**
 * 重要提示：
 * 1. 必须先在扩展选项中配置 API token 和保存路径
 * 2. 测试手动剪藏是否正常工作
 * 3. 确保 TOKEN 与扩展配置完全一致
 */

(async () => {
    const browser = await chromium.launch({
        headless: false, // 显示浏览器窗口
    });

    const context = await browser.newContext({
        // 加载已安装的扩展
        // 注意：需要先将扩展加载到 Chrome
    });

    const page = await context.newPage();

    // 监听来自扩展的响应
    page.on('console', msg => {
        if (msg.type() === 'log') {
            const text = msg.text();
            if (text.startsWith('[SIYUAN]')) {
                console.log('📨 扩展响应:', text);
            }
        }
    });

    // 监听 postMessage 响应
    page.exposeFunction('handleSiyuanResponse', (data) => {
        console.log('📨 扩展响应:', data);
    });

    // 注入监听脚本
    await page.addInitScript(() => {
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'SIYUAN_RESPONSE') {
                console.log('[SIYUAN]', event.data);
                if (window.handleSiyuanResponse) {
                    window.handleSiyuanResponse(event.data);
                }
            }
        });
    });

    try {
        // 访问一个简单的文章页面（更容易测试）
        await page.goto('https://zh.wikipedia.org/wiki/笔记软件', {
            waitUntil: 'networkidle',
            timeout: 30000
        });

        console.log('📄 页面加载完成');
        console.log('📝 页面标题:', await page.title());

        // ===== 测试 1: 剪藏整个网页 =====
        console.log('✂️ 开始剪藏整个网页...');
        
        await page.evaluate((token) => {
            window.postMessage({
                type: 'SIYUAN_CLIP',
                action: 'clipArticle',
                token: token,
                timestamp: Date.now()
            }, '*');
        }, TOKEN);

        // 等待响应（最多 30 秒）
        const clipResponse = await Promise.race([
            new Promise(resolve => {
                const handler = (event) => {
                    if (event.data && event.data.type === 'SIYUAN_RESPONSE' && 
                        event.data.action === 'clipArticle') {
                        window.removeEventListener('message', handler);
                        resolve(event.data);
                    }
                };
                window.addEventListener('message', handler);
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    resolve({ success: false, error: 'Timeout' });
                }, 30000);
            })
        ]);

        if (clipResponse.success) {
            console.log('✅ 剪藏成功!');
        } else {
            console.log('❌ 剪藏失败:', clipResponse.error);
        }

        // 等待一下，确保剪藏完成
        await page.waitForTimeout(5000);

        // ===== 测试 2: 复制选中文本 =====
        console.log('📋 测试复制选中文本...');
        
        // 先选中一段文字
        await page.selectText('p');
        
        await page.evaluate((token) => {
            window.postMessage({
                type: 'SIYUAN_CLIP',
                action: 'copy',
                token: token,
                timestamp: Date.now()
            }, '*');
        }, TOKEN);

        // 等待复制响应
        const copyResponse = await Promise.race([
            new Promise(resolve => {
                const handler = (event) => {
                    if (event.data && event.data.type === 'SIYUAN_RESPONSE' && 
                        event.data.action === 'copy') {
                        window.removeEventListener('message', handler);
                        resolve(event.data);
                    }
                };
                window.addEventListener('message', handler);
                setTimeout(() => {
                    window.removeEventListener('message', handler);
                    resolve({ success: false, error: 'Timeout' });
                }, 30000);
            })
        ]);

        if (copyResponse.success) {
            console.log('✅ 复制成功!');
        } else {
            console.log('❌ 复制失败:', copyResponse.error);
        }

        console.log('✨ 所有测试完成');

    } catch (error) {
        console.error('❌ 测试出错:', error);
    } finally {
        // 保持浏览器打开以便检查结果
        console.log('🌐 浏览器将保持打开 10 秒...');
        await page.waitForTimeout(10000);
        await browser.close();
    }
})();
