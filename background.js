chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.removeAll(function () {
        const title = chrome.i18n.getMessage("copy_to_siyuan");
        chrome.contextMenus.create({
            id: 'copy-to-siyuan',
            title: title,
            contexts: ['selection', 'image'],
        })
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

chrome.contextMenus.onClicked.addListener(function (info, tab) {
    if (info.menuItemId === 'copy-to-siyuan') {
        safeTabsSendMessage(tab && tab.id, {
            'func': 'copy',
            'tabId': tab && tab.id,
            'srcUrl': info.srcUrl,
        })
    }
})

// 添加模板渲染函数
function renderTemplate(template, data) {
    return template.replace(/\${([^}]+)}/g, function (match, key) {
        // 检查是否为条件表达式
        const conditionalMatch = key.match(/(.+?)\s*\?\s*(.*?)\s*:\s*(.*)/);
        if (conditionalMatch) {
            const conditionKey = conditionalMatch[1].trim();
            const trueValueString = conditionalMatch[2].trim();
            const falseValueString = conditionalMatch[3].trim();

            const condition = conditionKey.split('.').reduce((obj, prop) => obj && obj[prop], data);

            // 辅助函数，用于解析值中的变量或字符串
            const getValue = (valueStr) => {
                if ((valueStr.startsWith("'") && valueStr.endsWith("'")) || (valueStr.startsWith('"') && valueStr.endsWith('"'))) {
                    return valueStr.slice(1, -1); // 字符串字面量
                }
                // 尝试解析为变量
                const parts = valueStr.split('+').map(part => part.trim());
                let result = "";
                for (const part of parts) {
                    if ((part.startsWith("'") && part.endsWith("'")) || (part.startsWith('"') && part.endsWith('"'))) {
                        result += part.slice(1, -1);
                    } else {
                        const variableValue = part.split('.').reduce((obj, prop) => obj && obj[prop], data);
                        result += (variableValue !== undefined ? variableValue : '');
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
            const value = key.split('.').reduce((obj, prop) => obj && obj[prop], data);
            return value !== undefined ? value : '';
        }
    });
}

// 获取当前日期时间格式化函数
function getDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    let month = now.getMonth() + 1;
    let day = now.getDate();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let second = now.getSeconds();
    if (month.toString().length === 1) {
        month = '0' + month;
    }
    if (day.toString().length === 1) {
        day = '0' + day;
    }
    if (hour.toString().length === 1) {
        hour = '0' + hour;
    }
    if (minute.toString().length === 1) {
        minute = '0' + minute;
    }
    if (second.toString().length === 1) {
        second = '0' + second;
    }
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second;
}

// 获取简单日期时间
function getSimpleDateTime() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 5);
    return { date, time };
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.func !== 'upload-copy') {
        return
    }

    const requestData = request.data
    const fetchFileErr = requestData.fetchFileErr
    const dom = requestData.dom
    const files = requestData.files
    const formData = new FormData()
    formData.append('dom', dom)
    for (const key of Object.keys(files)) {
        const data = files[key].data
        const base64Response = await fetch(data)
        const blob = base64Response.blob()
        formData.append(key, await blob)
    }
    formData.append("notebook", requestData.notebook)
    formData.append("parentID", requestData.parentDoc)
    formData.append("parentHPath", requestData.parentHPath)
    formData.append("href", requestData.href)
    formData.append("tags", requestData.tags)
    formData.append("clipType", requestData.type)

    fetch(requestData.api + '/api/extension/copy', {
        method: 'POST',
        headers: {
            'Authorization': 'Token ' + requestData.token,
        },
        body: formData,
    }).then((response) => {
        if (response.redirected) {
            safeTabsSendMessage(requestData.tabId, {
                'func': 'tipKey',
                'msg': 'tip_token_invalid',
                'tip': 'tip',
            })
        }
        return response.json()
    }).then((response) => {
        if (response.code < 0) {
            safeTabsSendMessage(requestData.tabId, {
                'func': 'tip',
                'msg': response.msg,
                'tip': requestData.tip,
            })
            return
        }

        safeTabsSendMessage(requestData.tabId, {
            'func': 'copy2Clipboard',
            'data': response.data.md,
        })

        if ('' !== response.msg && requestData.type !== 'article') {
            safeTabsSendMessage(requestData.tabId, {
                'func': 'tip',
                'msg': response.msg,
                'tip': requestData.tip,
            })
        }

        if (requestData.type === 'article') {
            let title = requestData.title ? requestData.title : 'Untitled'
            title = title.replaceAll("/", "／")
            chrome.storage.sync.get({
                clipTemplate: '---\n' +
                    '\n' +
                    '- ${title}${siteName ? " - " + siteName : ""}\n' +
                    '- [${urlDecoded}](${url}) \n' +
                    '${excerpt ? "- " + excerpt : ""}\n' +
                    '- ${date} ${time}\n' +
                    '\n' +
                    '---\n' +
                    '\n' +
                    '${content}',
            }, (items) => {
                let excerpt = requestData.excerpt.trim()
                if ("" !== excerpt) {
                    // 将连续的三个换行符替换为两个换行符
                    excerpt = excerpt.replace(/\n{3,}/g, "\n\n")
                    // 从第二行开始，每行前面加两个空格 https://github.com/siyuan-note/siyuan/issues/11315
                    excerpt = excerpt.replace(/\n/g, "\n  ")
                    excerpt = excerpt.trim()
                }
                let urlDecoded = requestData.href
                try {
                    urlDecoded = decodeURIComponent(urlDecoded)
                } catch (e) {
                    console.warn(e)
                }

                const { date, time } = getSimpleDateTime();
                const templateData = {
                    title: requestData.title || 'Untitled',
                    siteName: requestData.siteName || '',
                    excerpt: excerpt || '',
                    url: requestData.href,
                    urlDecoded: urlDecoded,
                    date,
                    time,
                    tags: requestData.tags,
                    content: response.data.md
                };

                // 渲染模板
                let markdown;
                try {
                    markdown = renderTemplate(items.clipTemplate, templateData);
                } catch (e) {
                    console.error('Template rendering error:', e);
                    // 如果模板渲染失败，使用默认格式
                    markdown = getDefaultMarkdown(requestData, response.data.md);
                }

                fetch(requestData.api + '/api/filetree/createDocWithMd', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Token ' + requestData.token,
                    },
                    body: JSON.stringify({
                        'notebook': requestData.notebook,
                        'parentID': requestData.parentDoc,
                        'tags': requestData.tags,
                        'path': requestData.parentHPath + "/" + title,
                        'markdown': markdown,
                        'withMath': response.data.withMath,
                        'clippingHref': requestData.href,
                        'listDocTree': requestData.listDocTree,
                    }),
                }).then((response) => {
                    return response.json()
                }).then((response) => {
                    if (0 === response.code) {
                        // 添加到数据库
                        if (requestData.selectedDatabaseID) {
                            const docId = response.data;

                            // 先刷新 SQL 数据库
                            fetch(requestData.api + '/api/sqlite/flushTransaction', {
                                method: 'POST',
                                headers: {
                                    'Authorization': 'Token ' + requestData.token,
                                },
                                body: JSON.stringify({}),
                            }).then(() => {
                                // 刷新完成后再添加到数据库
                                const dbInput = {
                                    avID: requestData.selectedDatabaseID,
                                    srcs: [{
                                        id: docId,
                                        isDetached: false,
                                    }]
                                };
                                fetch(requestData.api + '/api/av/addAttributeViewBlocks', {
                                    method: 'POST',
                                    headers: {
                                        'Authorization': 'Token ' + requestData.token,
                                    },
                                    body: JSON.stringify(dbInput),
                                })
                            });
                        }

                        safeTabsSendMessage(requestData.tabId, {
                            'func': 'tipKey',
                            'msg': "tip_clip_ok",
                            'tip': requestData.tip,
                        })

                        // 检查是否需要打开文档
                        chrome.storage.sync.get({
                            expOpenAfterClip: false,
                        }, (items) => {
                            if (items.expOpenAfterClip && response.data) {
                                // 使用 SiYuan 协议在桌面应用中打开文档
                                const documentUrl = `siyuan://blocks/${response.data}`;
                                chrome.tabs.create({ url: documentUrl });
                            }
                        });

                        if (fetchFileErr) {
                            // 可能因为跨域问题导致下载图片失败，这里调用内核接口 `网络图片转换为本地图片` https://github.com/siyuan-note/siyuan/issues/7224
                            fetch(requestData.api + '/api/format/netImg2LocalAssets', {
                                method: 'POST',
                                headers: {
                                    'Authorization': 'Token ' + requestData.token,
                                },
                                body: JSON.stringify({
                                    'id': response.data,
                                    'url': requestData.href, // 改进浏览器剪藏扩展转换本地图片成功率 https://github.com/siyuan-note/siyuan/issues/7464
                                }),
                            })
                        }

                        safeTabsSendMessage(requestData.tabId, {
                            'func': 'reload',
                        })
                    } else {
                        safeTabsSendMessage(requestData.tabId, {
                            'func': 'tip',
                            'msg': response.msg,
                            'tip': requestData.tip,
                        })
                    }
                })
            });
        }
    }).catch((e) => {
        console.error(e)
        safeTabsSendMessage(requestData.tabId, {
            'func': 'tipKey',
            'msg': "tip_siyuan_kernel_unavailable",
            'tip': "tip",
        });
    })
})

// 默认剪藏格式的处理函数（当模板渲染失败时使用）
function getDefaultMarkdown(requestData, contentMd) {
    let markdown = "---\n\n* " + (requestData.title || 'Untitled')
    const siteName = requestData.siteName
    if ("" !== siteName) {
        markdown += " - " + siteName
    }
    markdown += "\n"
    const href = requestData.href
    let linkText = href
    try {
        linkText = decodeURIComponent(linkText)
    } catch (e) {
        console.warn(e)
    }
    markdown += "* " + "[" + linkText + "](" + href + ")\n"
    let excerpt = requestData.excerpt.trim()
    if ("" !== excerpt) {
        // 将连续的三个换行符替换为两个换行符
        excerpt = excerpt.replace(/\n{3,}/g, "\n\n")
        // 从第二行开始，每行前面加两个空格 https://github.com/siyuan-note/siyuan/issues/11315
        excerpt = excerpt.replace(/\n/g, "\n  ")
        excerpt = excerpt.trim()
        markdown += "* " + excerpt + "\n"
    } else {
        markdown += "\n"
    }
    markdown += "* " + getDateTime() + "\n\n---\n\n" + contentMd
    return markdown;
}
