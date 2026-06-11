importScripts("lib/siyuan-storage-defaults.js", "lib/siyuan-api.js");

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(function () {
        chrome.contextMenus.create({
            id: "copy-to-siyuan",
            title: chrome.i18n.getMessage("copy_to_siyuan"),
            contexts: ["selection", "image"],
        });

        chrome.contextMenus.create({
            id: "send",
            title: chrome.i18n.getMessage("send"),
            contexts: ["page"],
        });
    });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === "copy-to-siyuan") {
        safeTabsSendMessage(tab && tab.id, {
            func: "copy",
            tabId: tab && tab.id,
            srcUrl: info.srcUrl,
        });
    } else if (info.menuItemId === "send") {
        safeTabsSendMessage(tab && tab.id, {
            func: "siyuanGetReadability",
            tabId: tab && tab.id,
        });
    }
});

chrome.commands.onCommand.addListener(function (command) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        if (!tab) return;

        if (command === "copy-to-siyuan") {
            safeTabsSendMessage(tab.id, {
                func: "copy",
                tabId: tab.id,
                srcUrl: undefined,
            });
        } else if (command === "send-to-siyuan") {
            safeTabsSendMessage(tab.id, {
                func: "siyuanGetReadability",
                tabId: tab.id,
            });
        }
    });
});

function safeTabsSendMessage(tabId, message) {
    if (!tabId) return;
    try {
        chrome.tabs.sendMessage(tabId, message, () => {
            void chrome.runtime.lastError;
        });
    } catch (e) {
        // ignore
    }
}

/** @param {string} excerpt */
function formatClipExcerpt(excerpt) {
    let text = (excerpt || "").trim();
    if (text === "") return "";
    // 将连续的三个换行符替换为两个换行符
    text = text.replace(/\n{3,}/g, "\n\n");
    // 从第二行开始，每行前面加两个空格 https://github.com/siyuan-note/siyuan/issues/11315
    text = text.replace(/\n/g, "\n  ");
    return text.trim();
}

/** @param {string} href */
function decodeClipUrl(href) {
    try {
        return decodeURIComponent(href);
    } catch (e) {
        console.warn(e);
        return href;
    }
}

// 获取当前日期时间格式化函数
function getClipDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let second = now.getSeconds();
    if (month.toString().length === 1) {
        month = "0" + month;
    }
    if (day.toString().length === 1) {
        day = "0" + day;
    }
    if (hour.toString().length === 1) {
        hour = "0" + hour;
    }
    if (minute.toString().length === 1) {
        minute = "0" + minute;
    }
    if (second.toString().length === 1) {
        second = "0" + second;
    }
    return year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
}

// 获取简单日期时间
function getClipSimpleDateTime() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    return { date, time };
}

// 添加模板渲染函数
function renderClipTemplate(template, data) {
    return template.replace(/\${([^}]+)}/g, function (match, key) {
        // 检查是否为条件表达式
        const conditionalMatch = key.match(/(.+?)\s*\?\s*(.*?)\s*:\s*(.*)/);
        if (conditionalMatch) {
            const conditionKey = conditionalMatch[1].trim();
            const trueValueString = conditionalMatch[2].trim();
            const falseValueString = conditionalMatch[3].trim();
            const condition = conditionKey.split(".").reduce((obj, prop) => obj && obj[prop], data);

            // 辅助函数，用于解析值中的变量或字符串
            const getValue = (valueStr) => {
                if (
                    (valueStr.startsWith("'") && valueStr.endsWith("'")) ||
                    (valueStr.startsWith('"') && valueStr.endsWith('"'))
                ) {
                    return valueStr.slice(1, -1); // 字符串字面量
                }
                // 尝试解析为变量
                const parts = valueStr.split("+").map((part) => part.trim());
                let result = "";
                for (const part of parts) {
                    if ((part.startsWith("'") && part.endsWith("'")) || (part.startsWith('"') && part.endsWith('"'))) {
                        result += part.slice(1, -1);
                    } else {
                        const variableValue = part.split(".").reduce((obj, prop) => obj && obj[prop], data);
                        result += variableValue !== undefined ? variableValue : "";
                    }
                }
                return result;
            };

            if (condition) {
                return getValue(trueValueString);
            } else {
                return getValue(falseValueString);
            }
        } else {
            // 普通变量替换
            const value = key.split(".").reduce((obj, prop) => obj && obj[prop], data);
            return value !== undefined ? value : "";
        }
    });
}

// 默认剪藏格式的处理函数（当模板渲染失败时使用）
function getDefaultClipMarkdown(requestData, contentMd) {
    let markdown = "---\n\n* " + (requestData.title || "Untitled");
    const siteName = requestData.siteName || "";
    if ("" !== siteName) {
        markdown += " - " + siteName;
    }
    markdown += "\n";
    const href = requestData.href;
    markdown += "* " + "[" + decodeClipUrl(href) + "](" + href + ")\n";
    const excerpt = formatClipExcerpt(requestData.excerpt);
    if ("" !== excerpt) {
        markdown += "* " + excerpt + "\n";
    } else {
        markdown += "\n";
    }
    markdown += "* " + getClipDateTime() + "\n\n---\n\n" + contentMd;
    return markdown;
}

function buildClipMarkdown(requestData, contentMd, clipTemplate) {
    const excerpt = formatClipExcerpt(requestData.excerpt);
    const { date, time } = getClipSimpleDateTime();
    const templateData = {
        title: requestData.title || "Untitled",
        siteName: requestData.siteName || "",
        excerpt: excerpt || "",
        url: requestData.href,
        urlDecoded: decodeClipUrl(requestData.href),
        date,
        time,
        tags: requestData.tags,
        content: contentMd,
    };

    // 渲染模板
    try {
        return renderClipTemplate(clipTemplate || SIYUAN_DEFAULT_CLIP_TEMPLATE, templateData);
    } catch (e) {
        console.error("Template rendering error:", e);
        // 如果模板渲染失败，使用默认格式
        return getDefaultClipMarkdown(requestData, contentMd);
    }
}

/** 在 background 中检测内核连通性，避免 content script 访问 localhost 触发 LNA 权限弹窗 */
async function siyuanCheckKernel({ ip, token, notebook }) {
    const prereq = siyuanValidateClipPrereqs({ token, notebook });
    if (!prereq.ok) {
        return prereq;
    }

    const result = await siyuanKernelFetch({
        ip,
        token,
        path: "/api/filetree/searchDocs",
        body: {
            k: "",
            flashcard: false,
        },
    });
    if (!result.ok) {
        return result;
    }
    return { ok: true };
}

function storageSyncGet(defaults) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(defaults, resolve);
    });
}

async function addClippedDocToDatabase(apiBase, token, docId, databaseID) {
    // 先刷新 SQL 数据库
    const flushResult = await siyuanKernelFetch({
        ip: apiBase,
        token,
        path: "/api/sqlite/flushTransaction",
        body: {},
    });
    if (!flushResult.ok || flushResult.data?.code !== 0) {
        console.warn("flushTransaction failed:", flushResult);
        return false;
    }

    // 刷新完成后再添加到数据库
    const addResult = await siyuanKernelFetch({
        ip: apiBase,
        token,
        path: "/api/av/addAttributeViewBlocks",
        body: {
            avID: databaseID,
            srcs: [{ id: docId, isDetached: false }],
        },
    });
    if (!addResult.ok || addResult.data?.code !== 0) {
        console.warn("addAttributeViewBlocks failed:", addResult);
        return false;
    }
    return true;
}

async function handleArticleClip(requestData, apiBase, copyData, fetchFileErr) {
    let title = requestData.title ? requestData.title : "Untitled";
    title = title.replaceAll("/", "／");

    const { clipTemplate } = await storageSyncGet({ clipTemplate: SIYUAN_DEFAULT_CLIP_TEMPLATE });
    const markdown = buildClipMarkdown(requestData, copyData.md, clipTemplate);

    const createResult = await siyuanKernelFetch({
        ip: requestData.api,
        token: requestData.token,
        path: "/api/filetree/createDocWithMd",
        body: {
            notebook: requestData.notebook,
            parentID: requestData.parentDoc,
            tags: requestData.tags,
            path: requestData.parentHPath + "/" + title,
            markdown: markdown,
            withMath: copyData.withMath,
            clippingHref: requestData.href,
            listDocTree: requestData.listDocTree,
        },
    });
    if (!createResult.ok) {
        safeTabsSendMessage(requestData.tabId, {
            func: "tipKey",
            msg: createResult.error,
            tip: requestData.tip,
        });
        return;
    }

    const createResponse = createResult.data;
    if (createResponse.code !== 0) {
        safeTabsSendMessage(requestData.tabId, {
            func: "tip",
            msg: createResponse.msg,
            tip: requestData.tip,
        });
        return;
    }

    const docId = createResponse.data;

    if (requestData.selectedDatabaseID) {
        const dbOk = await addClippedDocToDatabase(apiBase, requestData.token, docId, requestData.selectedDatabaseID);
        if (!dbOk) {
            console.warn("Failed to add clipped doc to database:", docId, requestData.selectedDatabaseID);
        }
    }

    safeTabsSendMessage(requestData.tabId, {
        func: "tipKey",
        msg: "tip_clip_ok",
        tip: requestData.tip,
    });

    // 检查是否需要打开文档
    const { expOpenAfterClip } = await storageSyncGet({ expOpenAfterClip: false });
    if (expOpenAfterClip && docId) {
        let documentUrl = apiBase + "?id=" + docId;
        if (apiBase.startsWith("http://localhost:") || apiBase.startsWith("http://127.0.0.1:")) {
            documentUrl = `siyuan://blocks/${docId}`;
        }
        chrome.tabs.create({ url: documentUrl });
    }

    if (fetchFileErr) {
        // 可能因为跨域问题导致下载图片失败，这里调用内核接口 `网络图片转换为本地图片` https://github.com/siyuan-note/siyuan/issues/7224
        void fetch(apiBase + "/api/format/netImg2LocalAssets", {
            method: "POST",
            headers: { Authorization: "Token " + requestData.token },
            body: JSON.stringify({
                id: docId,
                url: requestData.href, // 改进浏览器剪藏扩展转换本地图片成功率 https://github.com/siyuan-note/siyuan/issues/7464
            }),
        });
    }

    safeTabsSendMessage(requestData.tabId, { func: "reload" });
}

async function handleUploadCopy(requestData) {
    const apiBase = siyuanNormalizeBase(requestData.api);
    const fetchFileErr = requestData.fetchFileErr;

    const formData = new FormData();
    formData.append("dom", requestData.dom);
    for (const key of Object.keys(requestData.files)) {
        const base64Response = await fetch(requestData.files[key].data);
        formData.append(key, await base64Response.blob());
    }
    formData.append("notebook", requestData.notebook);
    formData.append("parentID", requestData.parentDoc);
    formData.append("parentHPath", requestData.parentHPath);
    formData.append("href", requestData.href);
    formData.append("tags", requestData.tags);
    formData.append("clipType", requestData.type);

    try {
        const copyHttpResponse = await fetch(apiBase + "/api/extension/copy", {
            method: "POST",
            headers: { Authorization: "Token " + requestData.token },
            body: formData,
        });

        if (copyHttpResponse.redirected) {
            safeTabsSendMessage(requestData.tabId, {
                func: "tipKey",
                msg: "tip_token_invalid",
                tip: "tip",
            });
            return;
        }

        const copyResult = await copyHttpResponse.json();
        if (copyResult.code < 0) {
            safeTabsSendMessage(requestData.tabId, {
                func: "tip",
                msg: copyResult.msg,
                tip: requestData.tip,
            });
            return;
        }

        safeTabsSendMessage(requestData.tabId, {
            func: "copy2Clipboard",
            data: copyResult.data.md,
        });

        if ("" !== copyResult.msg && requestData.type !== "article") {
            safeTabsSendMessage(requestData.tabId, {
                func: "tip",
                msg: copyResult.msg,
                tip: requestData.tip,
            });
        }

        if (requestData.type === "article") {
            await handleArticleClip(requestData, apiBase, copyResult.data, fetchFileErr);
        }
    } catch (e) {
        console.error(e);
        safeTabsSendMessage(requestData.tabId, {
            func: "tipKey",
            msg: "tip_siyuan_kernel_unavailable",
            tip: "tip",
        });
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.func === "check-kernel") {
        siyuanCheckKernel(request.data).then(sendResponse);
        return true;
    }
    if (request.func === "upload-copy") {
        void handleUploadCopy(request.data);
    }
});
